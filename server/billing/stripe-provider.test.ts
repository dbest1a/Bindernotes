import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { stripeProvider } from "./stripe-provider";

const prices = { plus: "price_plus", studio: "price_studio", everything: "price_everything" };
const origin = "https://preview.example.test";
function fixture(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const key = `${init?.method ?? "GET"} ${url.pathname}`;
    calls.push(key);
    if (!(key in routes)) throw new Error(`Unexpected provider request: ${key}`);
    return Response.json(routes[key]);
  };
  const stripe = new Stripe("sk_test_disposable_fixture", { httpClient: Stripe.createFetchHttpClient(fetcher), maxNetworkRetries: 0 });
  return { calls, provider: stripeProvider(stripe, { origin, prices, live: false, webhookSecret: "whsec_disposable_fixture" }) };
}
const list = (data: unknown[], has_more = false) => ({ object: "list", data, has_more });
const session = (id: string, mode = "subscription") => ({ id, object: "checkout.session", customer: "cus_A", livemode: false, mode, status: "open", metadata: { bindernotes_plan: "studio" }, url: `https://checkout.stripe.com/${id}` });
const price = { id: prices.studio, active: true, livemode: false, currency: "usd", unit_amount: 2000, recurring: { interval: "month", interval_count: 1 } };
const line = (priceId = prices.studio, quantity = 1) => ({ quantity, price: { id: priceId } });

describe("provider checkout reconciles actual open-session prices", () => {
  it("expires a matching-metadata session with an obsolete price and creates the configured subscription", async () => {
    const s = fixture({
      "GET /v1/prices/price_studio": price,
      "GET /v1/checkout/sessions": list([session("cs_old")]),
      "GET /v1/checkout/sessions/cs_old/line_items": list([line("price_old")]),
      "POST /v1/checkout/sessions/cs_old/expire": { id: "cs_old", status: "expired" },
      "POST /v1/checkout/sessions": session("cs_new"),
    });
    expect(await s.provider.checkout("cus_A", "studio", "request-a")).toBe("https://checkout.stripe.com/cs_new");
    expect(s.calls).toContain("POST /v1/checkout/sessions/cs_old/expire");
  });
  it("reuses only one exact-price subscription session and expires an extra duplicate", async () => {
    const s = fixture({
      "GET /v1/prices/price_studio": price,
      "GET /v1/checkout/sessions": list([session("cs_first"), session("cs_duplicate")]),
      "GET /v1/checkout/sessions/cs_first/line_items": list([line()]),
      "GET /v1/checkout/sessions/cs_duplicate/line_items": list([line()]),
      "POST /v1/checkout/sessions/cs_duplicate/expire": { id: "cs_duplicate", status: "expired" },
    });
    expect(await s.provider.checkout("cus_A", "studio", "request-a")).toBe("https://checkout.stripe.com/cs_first");
    expect(s.calls).toContain("POST /v1/checkout/sessions/cs_duplicate/expire");
    expect(s.calls).not.toContain("POST /v1/checkout/sessions");
  });
  it.each(["payment", "setup"])("never reuses a %s session as a subscription", async (mode) => {
    const s = fixture({
      "GET /v1/prices/price_studio": price,
      "GET /v1/checkout/sessions": list([session("cs_wrong_mode", mode)]),
      "POST /v1/checkout/sessions/cs_wrong_mode/expire": { status: "expired" },
      "POST /v1/checkout/sessions": session("cs_new"),
    });
    expect(await s.provider.checkout("cus_A", "studio", "request-a")).toBe("https://checkout.stripe.com/cs_new");
  });
  it.each([list([line()], true), list([line(), line()]), list([line(prices.studio, 2)])])("does not reuse incomplete or changed line items", async (lines) => {
    const s = fixture({
      "GET /v1/prices/price_studio": price,
      "GET /v1/checkout/sessions": list([session("cs_changed")]),
      "GET /v1/checkout/sessions/cs_changed/line_items": lines,
      "POST /v1/checkout/sessions/cs_changed/expire": { status: "expired" },
      "POST /v1/checkout/sessions": session("cs_new"),
    });
    expect(await s.provider.checkout("cus_A", "studio", "request-a")).toBe("https://checkout.stripe.com/cs_new");
  });
});

function disputedPayment(statuses: string[], hasMore = false) {
  return fixture({
    "GET /v1/subscriptions": list([{ id: "sub_A", customer: "cus_A", status: "active", latest_invoice: "in_A", items: list([{ price: { id: prices.studio }, current_period_end: 2000000000 }]) }]),
    "GET /v1/invoices/in_A": { id: "in_A", customer: "cus_A", status: "paid", amount_paid: 2000 },
    "GET /v1/invoice_payments": list([{ amount_paid: 2000, payment: { charge: "ch_A" } }]),
    "GET /v1/charges/ch_A": { id: "ch_A", customer: "cus_A", paid: true, refunded: false, disputed: true, amount: 2000, amount_refunded: 0 },
    "GET /v1/disputes": list(statuses.map((status, index) => ({ id: `du_${index}`, charge: "ch_A", status })), hasMore),
  });
}
describe("provider dispute reconciliation", () => {
  it.each(["won", "warning_closed"])("restores paid eligibility after %s despite the historical disputed flag", async (status) => {
    const s = disputedPayment([status]);
    expect(await s.provider.subscriptions("cus_A")).toMatchObject([{ paid: true, fullyRefunded: false }]);
  });
  it.each(["lost", "needs_response", "under_review", "warning_needs_response", "warning_under_review"])("withholds disputed eligibility while %s", async (status) => {
    expect(await disputedPayment([status]).provider.subscriptions("cus_A")).toMatchObject([{ fullyRefunded: true }]);
  });
  it("requires every dispute to be resolved and rejects incomplete provider pages", async () => {
    expect(await disputedPayment(["won", "lost"]).provider.subscriptions("cus_A")).toMatchObject([{ fullyRefunded: true }]);
    await expect(disputedPayment([]).provider.subscriptions("cus_A")).rejects.toThrow("Dispute scope incomplete");
    await expect(disputedPayment(["won"], true).provider.subscriptions("cus_A")).rejects.toThrow("Dispute scope incomplete");
  });
});
