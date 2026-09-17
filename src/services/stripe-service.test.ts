import { afterEach, describe, expect, it, vi } from "vitest";
import { startCheckout } from "./stripe-service";
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("billing client", () => {
  it("sends only a plan and retry ID with the signed-in bearer", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "disposable-token" } }, error: null });
    const fetcher = vi.fn().mockResolvedValue(Response.json({ url: "https://checkout.stripe.com/c/pay/test" })); vi.stubGlobal("fetch", fetcher);
    const id = crypto.randomUUID();
    await expect(startCheckout("studio", id)).resolves.toEqual({ kind: "checkout", url: "https://checkout.stripe.com/c/pay/test" });
    expect(fetcher).toHaveBeenCalledWith("/api/billing/checkout", expect.objectContaining({ body: JSON.stringify({ plan: "studio", requestId: id }), headers: expect.objectContaining({ Authorization: "Bearer disposable-token" }) }));
  });
  it("rejects unsafe redirect hosts and requires a session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "disposable-token" } }, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ url: "https://checkout.stripe.com.attacker.test/" })));
    await expect(startCheckout("plus")).rejects.toThrow("could not be verified");
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(startCheckout("plus")).rejects.toThrow("Sign in");
  });
});
