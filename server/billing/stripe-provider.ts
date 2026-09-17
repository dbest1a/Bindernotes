import Stripe from "stripe";
import { z } from "zod";
import { BillingError, type BillingProvider, type PaidPlan, type SubscriptionState } from "./contracts";

const idOf = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
const amounts = { plus: 800, studio: 2000, everything: 3500 };
export function stripeProvider(stripe: Stripe, options: {
  origin: string; webhookSecret: string; prices: Record<PaidPlan, string>; live: boolean;
}): BillingProvider {
  async function invoicePaid(subscription: Stripe.Subscription) {
    const invoiceId = idOf(subscription.latest_invoice);
    if (!invoiceId) return { paid: false, fullyRefunded: false };
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (idOf(invoice.customer) !== idOf(subscription.customer)) throw new Error("Invoice owner mismatch");
    if (invoice.status !== "paid") return { paid: false, fullyRefunded: false };
    if (invoice.amount_paid === 0) return { paid: true, fullyRefunded: false };
    const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 100 });
    if (payments.has_more) throw new Error("Invoice payment page incomplete");
    let settled = 0;
    for (const payment of payments.data) {
      let chargeId = idOf(payment.payment.charge);
      const intentId = idOf(payment.payment.payment_intent);
      if (intentId) chargeId = idOf((await stripe.paymentIntents.retrieve(intentId)).latest_charge);
      // Do not treat unknown payment records or out-of-band payments as verified charges.
      if (!chargeId) continue;
      const charge = await stripe.charges.retrieve(chargeId);
      if (idOf(charge.customer) !== idOf(subscription.customer)) throw new Error("Charge owner mismatch");
      if (charge.paid && !charge.refunded && !charge.disputed) settled += Math.min(payment.amount_paid ?? 0, Math.max(0, charge.amount - charge.amount_refunded));
    }
    return { paid: payments.data.length > 0, fullyRefunded: settled === 0 };
  }
  return {
    async verifyEvent(body, signature) {
      const event = await (async () => {
        try { return await stripe.webhooks.constructEventAsync(body, signature, options.webhookSecret); }
        catch { throw new BillingError(400, "Invalid webhook signature."); }
      })();
      const object = z.object({ customer: z.union([z.string(), z.object({ id: z.string() })]).nullish() }).parse(event.data.object);
      // Disputes refer to a charge; retrieve its trusted customer after signature validation.
      let customerId = idOf(object.customer) ?? null;
      if (event.type.startsWith("charge.dispute.")) {
        const dispute = z.object({ charge: z.union([z.string(), z.object({ id: z.string() })]) }).parse(event.data.object);
        const chargeId = idOf(dispute.charge);
        if (chargeId) customerId = idOf((await stripe.charges.retrieve(chargeId)).customer) ?? null;
      }
      return { id: event.id, type: event.type, customerId, live: event.livemode };
    },
    async createCustomer(ownerId, email) {
      const customer = await stripe.customers.create({ email, metadata: { bindernotes_user_id: ownerId } }, { idempotencyKey: `bindernotes-customer:${ownerId}` });
      return customer.id;
    },
    async subscriptions(customerId) {
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
      if (subscriptions.has_more) throw new Error("Subscription page incomplete");
      const results: SubscriptionState[] = [];
      for (const subscription of subscriptions.data) {
        if (subscription.items.has_more || idOf(subscription.customer) !== customerId) throw new Error("Subscription scope incomplete");
        if (!["active"].includes(subscription.status)) {
          results.push({ id: subscription.id, status: subscription.status, priceId: "", periodEnd: 0, paid: false, fullyRefunded: false });
          continue;
        }
        const payment = await invoicePaid(subscription);
        for (const item of subscription.items.data) {
          results.push({ id: subscription.id, status: subscription.status, priceId: item.price.id, periodEnd: item.current_period_end, ...payment });
        }
      }
      return results;
    },
    async checkout(customerId, plan, requestId) {
      const price = await stripe.prices.retrieve(options.prices[plan]);
      if (!price.active || price.livemode !== options.live || price.currency !== "usd" || price.unit_amount !== amounts[plan] || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) {
        throw new BillingError(503, "This plan is not available for checkout yet.");
      }
      const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
      if (sessions.has_more) throw new Error("Checkout page incomplete");
      for (const session of sessions.data) {
        if (session.metadata?.bindernotes_plan === plan && session.url) return session.url;
        await stripe.checkout.sessions.expire(session.id);
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription", customer: customerId,
        line_items: [{ price: options.prices[plan], quantity: 1 }],
        success_url: `${options.origin}/pricing?billing=processing`, cancel_url: `${options.origin}/pricing?billing=canceled`,
        metadata: { bindernotes_plan: plan },
        subscription_data: { metadata: { bindernotes_plan: plan } },
      }, { idempotencyKey: `bindernotes-checkout:${customerId}:${requestId}` });
      if (!session.url) throw new Error("Checkout URL missing");
      return session.url;
    },
    async portal(customerId) {
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${options.origin}/pricing` });
      return session.url;
    },
  };
}
