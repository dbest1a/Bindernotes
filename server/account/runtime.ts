import type { Database } from "../../src/lib/database.generated";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { createAccountHandlers, type AccountBilling, type AccountStore } from "./handlers";
export function accountRuntime() {
  if (
    process.env.ACCOUNT_DELETION_ENABLED !== "true" ||
    !process.env.APP_ORIGIN ||
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new Error("Account lifecycle unavailable");
  const origin = new URL(process.env.APP_ORIGIN);
  if (
    origin.origin !== process.env.APP_ORIGIN ||
    (origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname))
  )
    throw new Error("Invalid app origin");
  const client = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store: AccountStore = {
    async authenticate(token) {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) throw new Error("Invalid session");
      // Only inspect AMR after GoTrue validates the actual signed token/session.
      const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as {
        amr?: { method: string; timestamp: number }[];
      };
      return {
        id: data.user.id,
        recentlyAuthenticated: Boolean(
          claims.amr?.some(
            (entry) =>
              ["password", "oauth", "otp", "totp", "recovery"].includes(entry.method) &&
              Number.isFinite(entry.timestamp) &&
              entry.timestamp <= Date.now() / 1000 + 30 &&
              entry.timestamp >= Date.now() / 1000 - 300,
          ),
        ),
      };
    },
    async operator(owner) {
      const { data, error } = await client.rpc("account_deletion_requires_transfer", { p_owner: owner });
      if (error) throw error;
      return data === true;
    },
    async customer(owner) {
      const { data, error } = await client
        .from("billing_accounts")
        .select("customer_id")
        .eq("user_id", owner)
        .maybeSingle();
      if (error) throw error;
      return data?.customer_id ?? null;
    },
    async deleting(owner) {
      const { data, error } = await client.rpc("account_deletion_state", { p_owner: owner });
      if (error) throw error;
      return data === true;
    },
    async claim(customer, event, token) {
      const { data, error } = await client.rpc("claim_billing_event", {
        p_customer: customer,
        p_event: event,
        p_token: token,
      });
      if (error) throw error;
      return data;
    },
    async release(customer, token) {
      const { error } = await client.rpc("release_billing_lease", { p_customer: customer, p_token: token });
      if (error) throw error;
    },
    async begin(owner, operation, customer, lease) {
      const { error } = await client.rpc("begin_account_deletion", {
        p_owner: owner,
        p_operation: operation,
        p_customer: customer,
        p_lease: lease,
      });
      if (error) throw error;
    },
    async assets(owner) {
      const rows: { bucket: string; path: string }[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client
          .from("user_assets")
          .select("bucket_id,storage_path")
          .eq("owner_id", owner)
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        rows.push(
          ...(data ?? []).map((row) => ({
            bucket: row.bucket_id as string,
            path: row.storage_path as string,
          })),
        );
        if (!data || data.length < 500) return rows;
      }
    },
    async removeAssets(assets) {
      for (let offset = 0; offset < assets.length; offset += 100) {
        const group = assets.slice(offset, offset + 100);
        if (group.some((asset) => asset.bucket !== "private-assets"))
          throw new Error("Unknown private bucket");
        const { error } = await client.storage
          .from("private-assets")
          .remove(group.map((asset) => asset.path));
        if (error) throw error;
      }
    },
    async deleteUser(owner) {
      const { error } = await client.auth.admin.deleteUser(owner, false);
      if (error) throw error;
    },
  };
  const billing: AccountBilling = {
    async ensureNoRecurringCharges(customer) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key || !/^sk_(test|live)_/.test(key)) throw new Error("Billing verification unavailable");
      if (
        key.startsWith("sk_live_") &&
        (process.env.VERCEL_ENV !== "production" || process.env.STRIPE_ALLOW_LIVE !== "true")
      )
        throw new Error("Live billing not enabled");
      const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 15000 });
      const subscriptions = await stripe.subscriptions.list({ customer, status: "all", limit: 100 });
      const sessions = await stripe.checkout.sessions.list({ customer, status: "open", limit: 100 });
      if (subscriptions.has_more || sessions.has_more) throw new Error("Billing records incomplete");
      return (
        !subscriptions.data.some((item) => !["canceled", "incomplete_expired"].includes(item.status)) &&
        sessions.data.length === 0
      );
    },
  };
  return createAccountHandlers({ store, billing, origin: origin.origin });
}
export async function accountDeleteEndpoint(request: Request) {
  try {
    return await accountRuntime().delete(request);
  } catch {
    return Response.json(
      { message: "Account deletion is not available in this environment yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
