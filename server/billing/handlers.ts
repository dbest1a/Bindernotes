import { randomUUID } from "node:crypto";
import {
  BillingError,
  billingEvents,
  checkoutSchema,
  deriveEntitlement,
  type BillingProvider,
  type BillingStore,
  type PaidPlan,
} from "./contracts";

type Dependencies = {
  provider: BillingProvider;
  store: BillingStore;
  prices: Record<PaidPlan, string>;
  origin: string;
  live: boolean;
};
const response = (status: number, message: string) =>
  Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
const json = (value: unknown) => Response.json(value, { headers: { "Cache-Control": "no-store" } });

async function boundedText(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BillingError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createBillingHandlers(deps: Dependencies) {
  async function authenticated(request: Request) {
    if (request.method !== "POST") throw new BillingError(405, "Use POST.");
    if (request.headers.get("origin") !== deps.origin)
      throw new BillingError(403, "Return to BinderNotes to manage your plan.");
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) throw new BillingError(401, "Sign in to manage your plan.");
    return deps.store.authenticate(authorization.slice(7));
  }
  const safe = (handler: (request: Request) => Promise<Response>) => async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      // Provider errors can contain customer identifiers and secret configuration.
      return error instanceof BillingError
        ? response(error.status, error.message)
        : response(
            503,
            "We could not confirm the billing result. Check your current plan and retry; do not start a second payment while the first is processing.",
          );
    }
  };
  return {
    checkout: safe(async (request) => {
      const user = await authenticated(request);
      let input: unknown;
      try {
        input = JSON.parse(await boundedText(request, 2048));
      } catch (error) {
        if (error instanceof BillingError) throw error;
        throw new BillingError(400, "Choose a valid plan.");
      }
      const parsed = checkoutSchema.safeParse(input);
      if (!parsed.success) throw new BillingError(400, "Choose a valid plan.");
      const { plan, requestId } = parsed.data;
      const customerId =
        (await deps.store.customer(user.id)) ??
        (await deps.store.bindCustomer(user.id, await deps.provider.createCustomer(user.id, user.email)));
      const eventId = `checkout:${requestId}`;
      const token = randomUUID();
      const claim = await deps.store.claim(customerId, eventId, token);
      if (claim === "busy")
        throw new BillingError(409, "Another billing change is still processing. Please retry shortly.");
      if (claim === "unmapped") throw new Error("Billing customer missing");
      try {
        const states = await deps.provider.subscriptions(customerId);
        if (states.some((state) => !["canceled", "incomplete_expired"].includes(state.status))) {
          throw new BillingError(
            409,
            "You already have a subscription. Use Manage billing to change or cancel it.",
          );
        }
        const url = await deps.provider.checkout(customerId, plan, requestId);
        if (claim === "claimed") await deps.store.finish(customerId, eventId, token, null);
        return json({ url });
      } finally {
        if (claim === "claimed") await deps.store.release(customerId, token);
      }
    }),
    portal: safe(async (request) => {
      const user = await authenticated(request);
      const customerId = await deps.store.customer(user.id);
      if (!customerId) throw new BillingError(409, "There is no billing account to manage yet.");
      return json({ url: await deps.provider.portal(customerId) });
    }),
    webhook: safe(async (request) => {
      if (request.method !== "POST") throw new BillingError(405, "Use POST.");
      const signature = request.headers.get("stripe-signature");
      if (!signature) throw new BillingError(400, "Invalid webhook signature.");
      const body = await boundedText(request, 1024 * 1024);
      const event = await deps.provider.verifyEvent(body, signature);
      if (event.live !== deps.live)
        throw new BillingError(400, "Webhook mode does not match this environment.");
      if (!billingEvents.has(event.type) || !event.customerId) return json({ received: true });
      const customerId = event.customerId;
      const token = randomUUID();
      const claim = await deps.store.claim(customerId, event.id, token);
      if (claim === "complete" || claim === "unmapped") return json({ received: true });
      if (claim === "busy") throw new BillingError(503, "Billing reconciliation is busy; retry delivery.");
      try {
        const current = await deps.provider.subscriptions(customerId);
        await deps.store.finish(
          customerId,
          event.id,
          token,
          deriveEntitlement(current, deps.prices, Date.now() / 1000),
        );
        return json({ received: true });
      } finally {
        await deps.store.release(customerId, token);
      }
    }),
  };
}
