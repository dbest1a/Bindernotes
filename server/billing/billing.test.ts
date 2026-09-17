import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { BillingError, deriveEntitlement, type BillingEvent, type BillingProvider, type BillingStore, type Entitlement, type SubscriptionState } from "./contracts";
import { createBillingHandlers } from "./handlers";
import { stripeProvider } from "./stripe-provider";
import { billingEndpoint } from "./runtime";

const origin = "https://preview.example.test";
const prices = { plus: "price_plus", studio: "price_studio", everything: "price_everything" };
const future = Math.floor(Date.now() / 1000) + 86400;
const state = (override: Partial<SubscriptionState> = {}): SubscriptionState => ({ id: "sub_1", priceId: prices.studio, status: "active", periodEnd: future, paid: true, fullyRefunded: false, ...override });
const request = (body: unknown, options: { path?: string; authorization?: string; origin?: string } = {}) => new Request(`${origin}/api/billing/${options.path ?? "checkout"}`, {
  method: "POST", headers: { Origin: options.origin ?? origin, Authorization: options.authorization ?? "Bearer valid-a", "Content-Type": "application/json", "Stripe-Signature": "signature" }, body: JSON.stringify(body),
});
function setup() {
  let current: SubscriptionState[] = [];
  let event: BillingEvent = { id: "evt_1", type: "customer.subscription.updated", customerId: "cus_A", live: false };
  let entitlement: Entitlement | null = null;
  const completed = new Set<string>();
  let lease: string | null = null;
  const provider: BillingProvider = {
    verifyEvent: vi.fn(async () => event), createCustomer: vi.fn(async () => "cus_A"),
    subscriptions: vi.fn(async () => current), checkout: vi.fn(async () => "https://checkout.stripe.com/c/pay/test"), portal: vi.fn(async () => "https://billing.stripe.com/p/session/test"),
  };
  const store: BillingStore = {
    authenticate: vi.fn(async (token) => { if (token !== "valid-a") throw new BillingError(401, "Sign in again."); return { id: "owner-a" }; }),
    customer: vi.fn(async () => "cus_A"), bindCustomer: vi.fn(async (_owner, customer) => customer),
    claim: vi.fn(async (_customer, id, token) => {
      if (completed.has(id)) return "complete";
      if (lease) return "busy";
      lease = token; return "claimed";
    }),
    finish: vi.fn(async (_customer, id, token, value) => {
      if (lease !== token) throw new Error("lease lost");
      if (value) { entitlement = value; completed.add(id); }
      lease = null;
    }),
    release: vi.fn(async (_customer, token) => { if (lease === token) lease = null; }),
  };
  return { provider, store, handlers: createBillingHandlers({ provider, store, prices, origin, live: false }),
    setCurrent: (value: SubscriptionState[]) => { current = value; }, setEvent: (value: BillingEvent) => { event = value; }, getEntitlement: () => entitlement };
}

describe("trusted billing handlers", () => {
  it("uses a verified account and rejects client price/user/entitlement claims", async () => {
    const s = setup(); const requestId = crypto.randomUUID();
    expect((await s.handlers.checkout(request({ plan: "studio", requestId, userId: "owner-b", priceId: "price_cheap" }))).status).toBe(400);
    expect(s.provider.checkout).not.toHaveBeenCalled();
    expect((await s.handlers.checkout(request({ plan: "studio", requestId }))).status).toBe(200);
    expect(s.provider.checkout).toHaveBeenCalledWith("cus_A", "studio", requestId);
    expect(s.store.customer).toHaveBeenCalledWith("owner-a");
  });
  it("rejects expired authentication and cross-origin requests", async () => {
    const s = setup(); const input = { plan: "plus", requestId: crypto.randomUUID() };
    expect((await s.handlers.checkout(request(input, { authorization: "Bearer forged" }))).status).toBe(401);
    expect((await s.handlers.checkout(request(input, { origin: "https://attacker.example" }))).status).toBe(403);
    expect(s.provider.checkout).not.toHaveBeenCalled();
  });
  it("prevents duplicate subscriptions and exposes the account's management portal", async () => {
    const s = setup(); s.setCurrent([state()]);
    expect((await s.handlers.checkout(request({ plan: "plus", requestId: crypto.randomUUID() }))).status).toBe(409);
    expect(s.provider.checkout).not.toHaveBeenCalled();
    expect((await s.handlers.portal(request({}))).status).toBe(200);
    expect(s.provider.portal).toHaveBeenCalledWith("cus_A");
  });
  it("deduplicates webhook delivery and grants product features without role mutation", async () => {
    const s = setup(); s.setCurrent([state()]);
    await s.handlers.webhook(request({})); await s.handlers.webhook(request({}));
    expect(s.provider.subscriptions).toHaveBeenCalledTimes(1);
    expect(s.getEntitlement()).toEqual({ plan: "studio", status: "active", validUntil: new Date(future * 1000).toISOString() });
  });
  it("reversed event order cannot resurrect a canceled entitlement", async () => {
    const s = setup(); s.setCurrent([state({ status: "canceled" })]);
    s.setEvent({ id: "evt_new", type: "customer.subscription.deleted", customerId: "cus_A", live: false });
    expect((await s.handlers.webhook(request({}))).status).toBe(200);
    s.setEvent({ id: "evt_old", type: "checkout.session.completed", customerId: "cus_A", live: false });
    expect((await s.handlers.webhook(request({}))).status).toBe(200);
    expect(s.getEntitlement()?.status).toBe("inactive");
  });
  it("failed reconciliation retries without marking the event processed or exposing secrets", async () => {
    const s = setup(); vi.mocked(s.provider.subscriptions).mockRejectedValueOnce(new Error("secret-customer-private"));
    const first = await s.handlers.webhook(request({}));
    expect(first.status).toBe(503); expect(await first.text()).not.toContain("secret-customer-private");
    s.setCurrent([state()]);
    expect((await s.handlers.webhook(request({}))).status).toBe(200);
    expect(s.getEntitlement()?.plan).toBe("studio");
  });
  it("requests provider redelivery while a customer reconciliation is busy", async () => {
    const s = setup(); vi.mocked(s.store.claim).mockResolvedValue("busy");
    expect((await s.handlers.webhook(request({}))).status).toBe(503);
    expect(s.provider.subscriptions).not.toHaveBeenCalled();
  });
  it("refuses invalid signatures and the wrong test/live mode", async () => {
    const s = setup(); vi.mocked(s.provider.verifyEvent).mockRejectedValueOnce(new BillingError(400, "Invalid webhook signature."));
    expect((await s.handlers.webhook(request({}))).status).toBe(400);
    s.setEvent({ id: "evt_live", type: "invoice.paid", customerId: "cus_A", live: true });
    expect((await s.handlers.webhook(request({}))).status).toBe(400);
    expect(s.store.claim).not.toHaveBeenCalled();
  });
  it("bounds actual streamed input and fails closed when billing is unconfigured", async () => {
    const s = setup();
    expect((await s.handlers.checkout(request({ huge: "x".repeat(2200) }))).status).toBe(413);
    vi.stubEnv("BILLING_ENABLED", "false");
    try { expect((await billingEndpoint("checkout")(request({}))).status).toBe(503); }
    finally { vi.unstubAllEnvs(); }
  });
});
describe("current provider state entitlement policy", () => {
  it.each(["past_due", "unpaid", "incomplete", "incomplete_expired", "canceled", "paused", "trialing"])("removes paid access for %s", (status) => {
    expect(deriveEntitlement([state({ status })], prices, Date.now() / 1000).status).toBe("inactive");
  });
  it("handles renewal failure, full refund, untrusted prices and expired periods", () => {
    for (const value of [state({ paid: false }), state({ fullyRefunded: true }), state({ priceId: "price_unknown" }), state({ periodEnd: 0 }), state({ periodEnd: NaN })]) {
      expect(deriveEntitlement([value], prices, Date.now() / 1000).status).toBe("inactive");
    }
  });
  it("reflects upgrades and downgrades from provider prices", () => {
    expect(deriveEntitlement([state({ priceId: prices.everything })], prices, 0).plan).toBe("everything");
    expect(deriveEntitlement([state({ priceId: prices.plus })], prices, 0).plan).toBe("plus");
  });
});
describe("official Stripe signature verification", () => {
  it("accepts an authentic raw body and rejects altered/expired signatures", async () => {
    const stripe = new Stripe("sk_test_placeholder");
    const secret = "whsec_disposable_unit_test";
    const provider = stripeProvider(stripe, { origin, prices, live: false, webhookSecret: secret });
    const payload = JSON.stringify({ id: "evt_signed", type: "invoice.paid", livemode: false, data: { object: { customer: "cus_A" } } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(await provider.verifyEvent(payload, header)).toMatchObject({ id: "evt_signed", customerId: "cus_A", live: false });
    await expect(provider.verifyEvent(payload.replace("cus_A", "cus_B"), header)).rejects.toThrow("Invalid webhook signature");
    const expired = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: 1 });
    await expect(provider.verifyEvent(payload, expired)).rejects.toThrow("Invalid webhook signature");
  });
});
