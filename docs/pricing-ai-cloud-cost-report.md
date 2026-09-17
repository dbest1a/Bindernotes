# BinderNotes Pricing, AI Usage, and Cloud Cost Report

Checked: May 15, 2026  
Scope: planning analysis only. No billing, Supabase, deployment, or production settings were changed.

## Executive Summary

BinderNotes can make money with the current public tiers, but the business only works cleanly if AI is packaged as a narrow, capped study helper rather than an unlimited tutor.

The current prices in the app are:

| Plan | Price | Best role in the business |
| --- | ---: | --- |
| Free | $0/mo | Acquisition, trust, study habit proof |
| Plus | $8/mo | Main student subscription |
| Studio | $20/mo | Tutors, creators, serious students, publishing/PDF/admin workflows |
| Everything | $35/mo | Premium all-access tier with high capacity |

The most important correction: Supabase XL compute is currently about $210/month, not $400/month. The tier around $400/month is 2XL, currently about $410/month before the base Pro plan, credits, Vercel, Desmos, PITR, or other add-ons.

Desmos should be treated as a fixed cost once BinderNotes charges for productized graphing. Desmos' current API page exposes a commercial Starter path at $100/month for early-stage organizations under $100,000 annual revenue, with a 90-day free trial and enterprise/contact-sales path for larger use.

## Product Basis From The Codebase

This report is based on the current BinderNotes product shape:

- Public pricing page: `Free`, `Plus $8`, `Studio $20`, and `Everything $35`.
- Stripe checkout is scaffolded, but production Checkout/webhooks/entitlements still need server-side implementation before real billing.
- AI is already positioned as "source-grounded AI study helpers" for recall questions, mistake explanations, review tags, and editable flashcards; the code explicitly keeps open-ended homework-answer AI out of scope.
- Free-response quiz answers are currently stored for review, with no AI grading.
- Desmos is client-side through `VITE_DESMOS_API_KEY`, with 2D/3D graph modules and saved graph states.
- Supabase is the source of truth for auth, account data, binders, notes, whiteboards, graph states, quizzes, attempts, and workspace preferences.

## How BinderNotes Makes Money

Recommended model:

1. Free account: useful enough to build trust, but capped. Keep source lessons, private notes, highlights, and starter graph/whiteboard use.
2. Plus at $8/month: the main student plan. Sell unlimited binders, graph states, Desmos-powered study, 3 whiteboards, and a capped AI study-helper allowance.
3. Studio at $20/month: the tutor/creator plan. Sell Admin Studio, publishing, PDFs, 20 whiteboards, larger storage/graphing capacity, and a larger AI allowance.
4. Everything at $35/month: premium all-access. This should include visibly higher capacity and priority features, not just the same student plan with softer limits.
5. Later expansion: school/group seats, tutor classrooms, annual discounts, and possibly paid content packs or creator revenue share.

Avoid launching "unlimited AI" at any tier. It will create unpredictable cost and student-safety/product-positioning problems.

## Payment Fees And Net Revenue

Using Stripe's current standard US online card pricing of 2.9% + $0.30 per successful domestic card transaction:

| Plan | Gross | Stripe estimate | Net before cloud/AI |
| --- | ---: | ---: | ---: |
| Plus | $8.00 | $0.53 | $7.47 |
| Studio | $20.00 | $0.88 | $19.12 |
| Everything | $35.00 | $1.32 | $33.68 |

This means Plus is viable only if fixed costs are covered by volume and AI remains capped. Studio and Everything have much more room for storage, AI, support, and content/admin features.

## AI Cost Model

Do not use ChatGPT Plus accounts to power the product. ChatGPT Plus is a $20/month consumer web-app subscription, and OpenAI states API usage is separate and billed independently. BinderNotes should use the OpenAI API.

Useful current OpenAI API rates:

| Model | Input / 1M tokens | Output / 1M tokens | BinderNotes role |
| --- | ---: | ---: | --- |
| GPT-5.4 nano | $0.20 | $1.25 | Cheap classification, tagging, drafts |
| GPT-5.4 mini | $0.75 | $4.50 | Default student helper model |
| GPT-5.4 | $2.50 | $15.00 | Higher-quality mistake explanations |
| GPT-5.5 / chat-latest | $5.00 | $30.00 | Rare premium/deep tasks only |

Estimated per-action costs:

| AI action type | Token assumption | Nano | Mini | GPT-5.4 | GPT-5.5 |
| --- | --- | ---: | ---: | ---: | ---: |
| Light recall/tag helper | 1,000 input + 400 output | $0.0007 | $0.0026 | $0.0085 | $0.0170 |
| Medium flashcard/explanation | 2,500 input + 700 output | $0.0014 | $0.0050 | $0.0168 | $0.0335 |
| Heavy source-grounded help | 6,000 input + 1,500 output | $0.0031 | $0.0113 | $0.0375 | $0.0750 |

The good news: if BinderNotes keeps AI scoped to selected notes, attempts, formulas, and source links, the raw model cost can be very low. The danger is not one helper call. The danger is long open-ended chat, repeated retries, web search, file tools, image/audio, and "solve my homework" loops.

## Recommended AI Allowances

These allowances are competitive while keeping COGS predictable:

| Plan | Recommended AI allowance | Expected AI COGS if active | Notes |
| --- | ---: | ---: | --- |
| Free | 0 by default, or 5 trial actions/month | less than $0.05/user | Use as product preview only |
| Plus | 100 study-helper actions/month | about $0.50-$1.20/user | Default to GPT-5.4 mini, nano for tags |
| Studio | 300 actions/month | about $1.50-$3.50/user | Add higher-quality mistake explanations |
| Everything | 750 actions/month | about $4-$8/user | Premium cap, still not unlimited |

If you want a simpler launch message: Plus gets "100 AI study assists/month", Studio gets "300", Everything gets "750". Then make the actual implementation count by action type internally.

Recommended internal multipliers:

- Recall questions from selected notes: 1 action.
- Review tags or source summary: 1 action.
- Editable formula card generation: 1 action.
- Mistake explanation using a student attempt: 2 actions.
- Long source-grounded review from many notes: 3-5 actions.

## Cloud Hosting Costs

### Supabase

Supabase paid organizations have a fixed plan fee plus variable usage and project compute. Official examples show Pro at $25/month, Micro compute at about $10/month, and a $10 compute credit, making a one-project Pro/Micro setup effectively about $25/month before add-ons.

Current compute prices:

| Compute | Approx monthly compute | Notes |
| --- | ---: | --- |
| Micro | $10 | 1 GB RAM, shared CPU |
| Small | $15 | 2 GB RAM |
| Medium | $60 | 4 GB RAM |
| Large | $110 | 8 GB RAM, dedicated CPU |
| XL | $210 | 16 GB RAM, dedicated CPU |
| 2XL | $410 | 32 GB RAM, dedicated CPU |

For one project, rough Supabase totals after the $10 compute credit:

| Setup | Supabase monthly estimate |
| --- | ---: |
| Pro + Micro | $25 |
| Pro + Small | $30 |
| Pro + Medium | $75 |
| Pro + Large | $125 |
| Pro + XL | $225 |
| Pro + 2XL | $425 |

Important add-ons:

- Supabase custom domain: $10/month.
- PITR: $100/month for 7-day retention, $200/month for 14-day, $400/month for 28-day.
- Pro/Team quotas include 100,000 MAU, 250 GB egress, 100 GB storage, and 2 million Edge Function invocations before overage.

Recommendation: do not jump straight to XL/2XL. Upgrade when metrics show sustained CPU, memory, database connection, or disk I/O pressure after query/index work and load testing.

### Vercel

Vercel Pro is currently $20/month plus additional usage, with $20 included usage credit. It includes enough for early BinderNotes hosting in most cases: 1 TB monthly Fast Data Transfer, 10M Edge Requests, and 1M function invocations before overage.

For the current Vite SPA, Vercel should stay modest until serverless billing, webhooks, API routes, image-heavy media, or very high traffic are introduced.

### Desmos

Plan for Desmos as a fixed $100/month cost once BinderNotes is commercializing embedded graphing. Keep the free/personal key for development/non-commercial use only. Once users are paying for graphing in the product, switch to the commercial subscription path.

## Monthly Fixed-Cost Scenarios

These are planning estimates, not invoices.

| Scenario | Included stack | Fixed monthly cost |
| --- | --- | ---: |
| Lean paid launch | Supabase Pro/Micro + Vercel Pro + Desmos Starter | about $145 |
| Lean paid launch with Supabase custom domain | Above + Supabase custom domain | about $155 |
| Growth database | Supabase Pro/Medium + Vercel Pro + Desmos | about $195 |
| XL database | Supabase Pro/XL + Vercel Pro + Desmos | about $345 |
| XL with domain + 7-day PITR | Above + custom domain + PITR | about $455 |
| 2XL database | Supabase Pro/2XL + Vercel Pro + Desmos | about $545 |
| 2XL with domain + 7-day PITR | Above + custom domain + PITR | about $655 |

Break-even paid subscribers before AI/support/content costs:

| Fixed cost | Plus-only break-even | Studio-only break-even | Everything-only break-even |
| ---: | ---: | ---: | ---: |
| $155 | 21 users | 9 users | 5 users |
| $345 | 47 users | 19 users | 11 users |
| $455 | 61 users | 24 users | 14 users |
| $655 | 88 users | 35 users | 20 users |

The practical takeaway: the first commercial goal should be 25-50 paying users before adding expensive infrastructure. XL is fine later, but it should be justified by metrics, not by launch anxiety.

## Competitive Positioning

BinderNotes Plus at $8/month is competitive if it is sold as a study workspace with graphing, notes, source context, and controlled AI. It is not competitive if the claim is simply "AI tutor", because Khanmigo is $4/month for US learner/parent subscriptions and ChatGPT itself is a broad $20/month consumer benchmark.

Market anchors:

| Product | Current pricing signal | What it means for BinderNotes |
| --- | ---: | --- |
| Khanmigo | $4/month learner/parent | AI-only education help is price-sensitive |
| Wolfram Alpha Pro | $9.99 monthly or $5/mo annually | Math step-by-step tools are a near neighbor |
| Notion Plus | $10/member/month | Notes/workspace baseline |
| Notion Business | $20/member/month with AI workspace features | Studio at $20 is plausible if creator/admin workflows are real |
| ChatGPT Plus | $20/month | Broad AI benchmark; API separate |

Recommended positioning:

- Plus at $8: "private study workspace with Desmos graphs, source-linked notes, whiteboards, and 100 AI study assists."
- Studio at $20: "publish, upload PDFs, run tutor/creator workflows, and get 300 AI study assists."
- Everything at $35: "all capacity unlocked, premium controls, and 750 AI study assists."

Annual pricing would help student conversion:

- Plus annual: $72/year ($6/month effective).
- Studio annual: $180/year ($15/month effective).
- Everything annual: $300/year ($25/month effective).

## Guardrails Needed Before Selling AI

1. Add server-side AI endpoints; do not call OpenAI from the browser.
2. Store API keys only server-side.
3. Track per-user monthly AI action usage.
4. Count actions by type, not just raw API calls.
5. Hard cap prompt/context size.
6. Use selected notes/sources/attempts as inputs, not whole-account dumps.
7. Use GPT-5.4 mini as the default and route only hard explanations to GPT-5.4.
8. Avoid OpenAI web search, containers, voice, image, and file-search tools in student plans unless separately priced.
9. Keep safety language: source-grounded study help, not homework outsourcing.
10. Log cost per request so pricing can be adjusted from real usage.

## Recommendation

Keep the current public prices for now:

- Free stays free.
- Plus stays $8/month, but cap AI at 100 study assists/month.
- Studio stays $20/month, with 300 assists/month.
- Everything stays $35/month, with 750 assists/month.

Do not upgrade Supabase yet. Start with the smallest paid setup that production needs, then upgrade from metrics. Budget Desmos at $100/month as soon as BinderNotes starts selling the graphing-powered product. Treat Supabase XL as a later growth stage around $225/month all-in for Supabase, and treat 2XL as the actual roughly-$400 compute tier.

## Sources

- OpenAI API pricing: https://openai.com/api/pricing/ and https://platform.openai.com/docs/pricing
- OpenAI ChatGPT Plus help: https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus
- Supabase billing overview: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase compute and disk: https://supabase.com/docs/guides/platform/compute-and-disk
- Supabase custom domain usage: https://supabase.com/docs/guides/platform/manage-your-usage/custom-domains
- Supabase PITR usage: https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery
- Vercel pricing: https://vercel.com/pricing
- Desmos API: https://www.desmos.com/my-api
- Stripe pricing: https://stripe.com/pricing
- Khanmigo subscription plans: https://support.khanacademy.org/hc/en-us/articles/25921448458893-What-features-are-available-in-the-Learner-Parent-and-Teacher-Khanmigo-subscription-plans
- Wolfram Alpha Pro pricing: https://www.wolframalpha.com/pro/pricing
- Notion pricing: https://www.notion.com/pricing
