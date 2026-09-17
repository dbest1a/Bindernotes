import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../../src/lib/database.generated";
import { BillingError, entitlementSchema, type BillingStore } from "./contracts";

export function supabaseBillingStore(client: SupabaseClient<Database>): BillingStore {
  async function rpc<Name extends keyof Database["public"]["Functions"]>(name: Name, params: Database["public"]["Functions"][Name]["Args"]): Promise<unknown> {
    const { data, error } = await client.rpc(name, params);
    if (error) throw new Error("Billing transaction failed");
    return data;
  }
  return {
    async authenticate(token) {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) throw new BillingError(401, "Your session expired. Sign in again.");
      return { id: data.user.id, email: data.user.email };
    },
    async customer(ownerId) {
      const { data, error } = await client.from("billing_accounts").select("customer_id").eq("user_id", ownerId).maybeSingle();
      if (error) throw new Error("Billing account unavailable");
      return data ? z.object({ customer_id: z.string().regex(/^cus_[a-zA-Z0-9]+$/) }).parse(data).customer_id : null;
    },
    async bindCustomer(ownerId, customerId) {
      return z.string().parse(await rpc("bind_billing_customer", { p_owner: ownerId, p_customer: customerId }));
    },
    async claim(customerId, eventId, token) {
      return z.enum(["claimed", "complete", "busy", "unmapped"]).parse(await rpc("claim_billing_event", { p_customer: customerId, p_event: eventId, p_token: token }));
    },
    async finish(customerId, eventId, token, entitlement) {
      await rpc("finish_billing_event", { p_customer: customerId, p_event: eventId, p_token: token, p_entitlement: entitlement ? entitlementSchema.parse(entitlement) : null });
    },
    async release(customerId, token) { await rpc("release_billing_lease", { p_customer: customerId, p_token: token }); },
  };
}
