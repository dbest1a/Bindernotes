import { z } from "zod";

export const paidPlanSchema = z.enum(["plus", "studio", "everything"]);
export type PaidPlan = z.infer<typeof paidPlanSchema>;
export const checkoutSchema = z.object({ plan: paidPlanSchema, requestId: z.uuid() }).strict();
export const entitlementSchema = z
  .object({
    plan: z.enum(["free", "plus", "studio", "everything"]),
    status: z.enum(["active", "inactive"]),
    validUntil: z.iso.datetime().nullable(),
  })
  .strict();
export type Entitlement = z.infer<typeof entitlementSchema>;
export type SubscriptionState = {
  id: string;
  priceId: string;
  status: string;
  periodEnd: number;
  paid: boolean;
  fullyRefunded: boolean;
};
export class BillingError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const rank = { free: 0, plus: 1, studio: 2, everything: 3 };

/** Reconcile provider's CURRENT state, never apply an old event's plan payload. */
export function deriveEntitlement(
  states: SubscriptionState[],
  prices: Record<PaidPlan, string>,
  now: number,
): Entitlement {
  let result: Entitlement = { plan: "free", status: "inactive", validUntil: null };
  for (const state of states) {
    const plan = paidPlanSchema.options.find((candidate) => prices[candidate] === state.priceId);
    if (
      !plan ||
      state.status !== "active" ||
      !state.paid ||
      state.fullyRefunded ||
      !Number.isFinite(state.periodEnd) ||
      state.periodEnd <= now
    )
      continue;
    if (
      rank[plan] > rank[result.plan] ||
      (plan === result.plan && state.periodEnd > Date.parse(result.validUntil ?? "") / 1000)
    ) {
      result = { plan, status: "active", validUntil: new Date(state.periodEnd * 1000).toISOString() };
    }
  }
  return result;
}

export const billingEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
]);

export type BillingEvent = { id: string; type: string; customerId: string | null; live: boolean };
export interface BillingProvider {
  verifyEvent(body: string, signature: string): Promise<BillingEvent>;
  createCustomer(ownerId: string, email: string | undefined): Promise<string>;
  subscriptions(customerId: string): Promise<SubscriptionState[]>;
  checkout(customerId: string, plan: PaidPlan, requestId: string): Promise<string>;
  portal(customerId: string): Promise<string>;
}
export interface BillingStore {
  authenticate(token: string): Promise<{ id: string; email?: string }>;
  customer(ownerId: string): Promise<string | null>;
  bindCustomer(ownerId: string, customerId: string): Promise<string>;
  claim(
    customerId: string,
    eventId: string,
    token: string,
  ): Promise<"claimed" | "complete" | "busy" | "unmapped">;
  finish(customerId: string, eventId: string, token: string, entitlement: Entitlement | null): Promise<void>;
  release(customerId: string, token: string): Promise<void>;
}
