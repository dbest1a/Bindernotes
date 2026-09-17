import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { z } from "zod";
import type { Database } from "../../src/lib/database.generated.js";
import { createBillingHandlers } from "./handlers.js";
import { stripeProvider } from "./stripe-provider.js";
import { supabaseBillingStore } from "./supabase-store.js";

const configSchema = z.object({
  BILLING_ENABLED: z.literal("true"),
  APP_ORIGIN: z.url(),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_/),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PLUS_PRICE_ID: z.string().startsWith("price_"),
  STRIPE_STUDIO_PRICE_ID: z.string().startsWith("price_"),
  STRIPE_EVERYTHING_PRICE_ID: z.string().startsWith("price_"),
});
export function billingRuntime() {
  const config = configSchema.parse(process.env);
  const origin = new URL(config.APP_ORIGIN);
  if (
    origin.origin !== config.APP_ORIGIN ||
    (origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname))
  )
    throw new Error("Invalid billing origin");
  const live = config.STRIPE_SECRET_KEY.startsWith("sk_live_");
  if (live && (process.env.VERCEL_ENV !== "production" || process.env.STRIPE_ALLOW_LIVE !== "true"))
    throw new Error("Live billing requires explicit production activation");
  const prices = {
    plus: config.STRIPE_PLUS_PRICE_ID,
    studio: config.STRIPE_STUDIO_PRICE_ID,
    everything: config.STRIPE_EVERYTHING_PRICE_ID,
  };
  if (new Set(Object.values(prices)).size !== 3) throw new Error("Billing prices must be distinct");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15000 });
  const client = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return createBillingHandlers({
    provider: stripeProvider(stripe, {
      origin: origin.origin,
      webhookSecret: config.STRIPE_WEBHOOK_SECRET,
      prices,
      live,
    }),
    store: supabaseBillingStore(client),
    prices,
    origin: origin.origin,
    live,
  });
}
export function billingEndpoint(kind: "checkout" | "portal" | "webhook") {
  return async (request: Request) => {
    try {
      return await billingRuntime()[kind](request);
    } catch {
      return Response.json(
        { message: "Paid plans are not available yet. You can keep using the free workspace." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
