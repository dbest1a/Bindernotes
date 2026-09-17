import { randomUUID } from "node:crypto";
import { z } from "zod";
export type AccountStore = {
  authenticate(token: string): Promise<{ id: string; recentlyAuthenticated: boolean }>;
  operator(owner: string): Promise<boolean>;
  customer(owner: string): Promise<string | null>;
  deleting(owner: string): Promise<boolean>;
  claim(customer: string, event: string, token: string): Promise<string>;
  release(customer: string, token: string): Promise<void>;
  begin(owner: string, operation: string, customer: string | null, lease: string | null): Promise<void>;
  assets(owner: string): Promise<{ bucket: string; path: string }[]>;
  removeAssets(assets: { bucket: string; path: string }[]): Promise<void>;
  deleteUser(owner: string): Promise<void>;
};
export type AccountBilling = { ensureNoRecurringCharges(customer: string): Promise<boolean> };
class AccountError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createAccountHandlers(deps: {
  store: AccountStore;
  billing: AccountBilling;
  origin: string;
}) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  return {
    delete: async (request: Request) => {
      let customer: string | null = null;
      let lease: string | null = null;
      let marked = false;
      try {
        if (request.method !== "POST") throw new AccountError(405, "Use POST.");
        if (request.headers.get("origin") !== deps.origin)
          throw new AccountError(403, "Return to BinderNotes to manage your account.");
        const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
        if (!token) throw new AccountError(401, "Sign in again to delete your account.");
        let user: Awaited<ReturnType<AccountStore["authenticate"]>>;
        try {
          user = await deps.store.authenticate(token);
        } catch {
          throw new AccountError(401, "Sign in again to delete your account.");
        }
        if (!user.recentlyAuthenticated)
          throw new AccountError(401, "Confirm your password or sign in again before deleting your account.");
        const reader = request.body?.getReader();
        if (!reader) throw new AccountError(400, "Confirm account deletion.");
        let body = "";
        let bytes = 0;
        try {
          for (;;) {
            const next = await reader.read();
            if (next.done) break;
            bytes += next.value.length;
            if (bytes > 2048) {
              await reader.cancel();
              throw new AccountError(413, "Request too large.");
            }
            body += new TextDecoder().decode(next.value);
          }
        } finally {
          reader.releaseLock();
        }
        let raw: unknown;
        try {
          raw = JSON.parse(body);
        } catch {
          throw new AccountError(400, "Confirm account deletion.");
        }
        const input = z
          .object({ confirmation: z.literal("DELETE"), operationId: z.string().uuid() })
          .strict()
          .safeParse(raw);
        if (!input.success) throw new AccountError(400, "Type DELETE to confirm permanent account deletion.");
        if (await deps.store.operator(user.id))
          throw new AccountError(
            409,
            "This account has published or shared content. Transfer it through an operator before deleting the account so other students keep their work.",
          );
        marked = await deps.store.deleting(user.id);
        if (!marked) {
          customer = await deps.store.customer(user.id);
          if (customer) {
            lease = randomUUID();
            if (
              (await deps.store.claim(customer, `account-delete:${input.data.operationId}`, lease)) !==
              "claimed"
            )
              throw new AccountError(409, "Billing is being updated. Wait a moment and retry.");
            if (!(await deps.billing.ensureNoRecurringCharges(customer)))
              throw new AccountError(
                409,
                "Cancel your recurring subscription and close any open checkout before deleting your account. Your data is unchanged.",
              );
          }
          await deps.store.begin(user.id, input.data.operationId, customer, lease);
          marked = true;
        }
        // The durable marker now blocks new writes and checkout. Read all paths only
        // after acquiring it; uncertain Storage deletion leaves the marker retryable.
        const assets = await deps.store.assets(user.id);
        await deps.store.removeAssets(assets);
        await deps.store.deleteUser(user.id);
        return json({ deleted: true });
      } catch (error) {
        return error instanceof AccountError
          ? json({ message: error.message }, error.status)
          : json(
              {
                message: marked
                  ? "Account deletion is pending. Sign in again and retry to finish removing files and account data."
                  : "Account deletion could not be verified. Your account is unchanged; try again later.",
              },
              503,
            );
      } finally {
        if (customer && lease && !marked) await deps.store.release(customer, lease).catch(() => {});
      }
    },
  };
}
