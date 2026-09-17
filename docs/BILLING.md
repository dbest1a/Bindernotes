# Trusted billing boundary

Billing is **disabled by default**. This code is not evidence of a working Stripe account or production payment readiness. Provider test-mode checkout, renewal, refund, portal and webhook delivery still require the owner's Stripe test configuration. No paid Supabase environment was created; the user chose local testing.

The Vercel `/api/billing/{checkout,portal,webhook}` Web handlers use the official Stripe22.6.2 SDK. The SPA rewrite excludes `/api/`. The browser supplies a plan name and stable request UUID, never a price ID, customer ID, role, or entitlement. The server validates the Supabase bearer through Auth and chooses its own price. Exact configured USD monthly prices must match the displayed $8/$20/$35 amounts before checkout. Open sessions are reused only when subscription mode, customer, test/live mode and the single quantity-one line item match the current price. Obsolete prices and duplicate open sessions are expired under a customer lease. Existing subscriptions go through the Stripe billing portal instead of creating another subscription.

Server-only environment names (never `VITE_`):

- `BILLING_ENABLED=true`
- `APP_ORIGIN` (exact frontend origin), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PLUS_PRICE_ID`, `STRIPE_STUDIO_PRICE_ID`, `STRIPE_EVERYTHING_PRICE_ID`
- Live mode additionally requires `VERCEL_ENV=production` and `STRIPE_ALLOW_LIVE=true`. Do not set these until all release gates pass.

Configure the webhook for the event names in `server/billing/contracts.ts`, using the SDK-compatible Stripe API version. Configure the customer portal's permitted products/prices, cancellation and plan changes in Stripe. No secrets belong in Git, browser env, test output, or telemetry.

Signature validation uses the original bounded request body and Stripe's timestamp tolerance. Unknown events are acknowledged without writes. Mode mismatch and invalid signatures fail. Valid delivery failures return a retryable status. Migration0029 stores provider customer bindings, event IDs and per-customer leases behind service-only RPCs; no client or operator RPC execution is granted. Completion atomically updates the entitlement and marks the delivery processed. Lease tokens are tied to the event and expire; stale workers cannot finish or release a replacement worker's lease.

Event payload ordering is not used to decide a plan. Each accepted event fetches the current subscription, latest invoice and settled charges while holding the lease. Duplicate delivery skips completed events. Paid active subscriptions with recognized prices receive time-bounded access. Cancellation at period end retains current paid access until its paid period ends; immediate cancellation, delinquency, failed renewal, expiry, complete refund or dispute removes access. Partial refunds retain access while some current-invoice payment remains settled. A new paid renewal can restore access. Unknown payment records fail closed. No function changes `profiles.role`; creator access remains restricted to owned content. Data above a downgraded quota is preserved; new board creation is limited by the database.

Local evidence:

```text
node node_modules/vitest/vitest.mjs run server/billing/billing.test.ts src/services/stripe-service.test.ts src/pages/pricing-page.test.tsx --config vite.config.ts --configLoader runner
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.server.json --pretty false
```

29 focused tests passed, including actual SDK signature verification, tamper/expiry, mode, ownership, retries, out-of-order delivery and inactive states. Real PostgreSQL tests additionally cover forbidden roles, customer uniqueness, concurrent lease claims, null/old/wrong-event fencing, transactional receipt/entitlement writes and unchanged learner role. These do not replace Stripe test-mode end-to-end evidence.

Independent review additionally found and corrected stale-price session reuse and restoration after a won dispute. A charge's historical `disputed` flag does not establish its current outcome: reconciliation now reads all current charge disputes, restores eligibility only after every dispute is won or warning-closed, and retries incomplete provider responses. Generic failure messages acknowledge an uncertain result rather than promising no side effect. The provider and handler pair passes34 tests, including actual SDK HTTP parsing against controlled provider responses. These fixtures are distinct from real Stripe test-mode verification.

References: [Stripe webhooks](https://docs.stripe.com/webhooks), [Checkout API](https://docs.stripe.com/api/checkout/sessions/create), [Checkout line items](https://docs.stripe.com/api/checkout/sessions/line_items), [Disputes](https://docs.stripe.com/api/disputes/object), [Invoice payments](https://docs.stripe.com/api/invoice-payment/object), [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js).
