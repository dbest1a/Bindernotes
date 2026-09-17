# BinderNotes September Launch Financial Simulation

Run date: May 15, 2026

This is a conservative Monte Carlo simulation with 50,000 seeded runs. It assumes BinderNotes improves through summer, paid launch begins in September 2026, ads spend $10,000 in September and $10,000 in October, and the business is measured at November 30, 2026.

## Headline Result

| Metric by Nov 30, 2026 | P10 | Base P50 | P90 |
| --- | ---: | ---: | ---: |
| Active free users | 418 | 592 | 834 |
| Active paid users | 11 | 18 | 27 |
| Plus users | 9 | 14 | 21 |
| Studio users | 2 | 3 | 4 |
| Everything users | 0 | 1 | 1 |
| MRR | $124 | $195 | $298 |
| Monthly gross contribution before fixed costs | $101 | $159 | $243 |
| Cumulative signups, Sep-Nov | 746 | 972 | 1,256 |
| Cumulative paid conversions, Sep-Nov | 12 | 20 | 30 |
| Cumulative revenue, Sep-Nov | $212 | $337 | $518 |
| Cumulative contribution before ads/fixed, Sep-Nov | $138 | $239 | $383 |
| Cash after ads and lean fixed cloud, Sep-Nov | $-20,327 | $-20,226 | $-20,082 |
| Paid CAC using $20k ad spend / active paid users | $744 | $1,134 | $1,777 |
| Contribution payback months | 82.4 mo | 125.7 mo | 197.5 mo |

## Monthly Funnel

| Month | Ad spend | New signups P50 | New paid P50 | Active free P50 | Revenue P50 | Contribution P50 | Cash after ads/fixed P50 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| September 2026 | $10,000 | 276 | 3 | 273 | $33 | $20 | $-10,135 |
| October 2026 | $10,000 | 371 | 7 | 521 | $107 | $74 | $-10,081 |
| November 2026 | $0 | 297 | 9 | 592 | $195 | $144 | $-11 |

## Conservative Interpretation

- The likely base case is roughly 18 active paid users and $195 MRR by November 30.
- The conservative P10 case is roughly 11 active paid users and $124 MRR.
- The upside P90 case is roughly 27 active paid users and $298 MRR.
- For cost metrics, higher is worse: the base CAC is $1,134, while the worse P90 CAC is $1,777.
- The $20,000 ad test is very unlikely to pay back by November. In the base case, it is buying learning, cohorts, and signal, not immediate profitability.
- The model expects fixed cloud costs to be small relative to ad spend. The key constraints are conversion rate, activation quality, paid conversion, and paid retention.

## What Has To Be True For Ads To Work

The base blended November ARPU is about $11/month, and the base blended contribution is about $9/month per active paid user.

| Goal from the $20k launch spend | Required active paid users | Implied MRR | Required CAC |
| --- | ---: | ---: | ---: |
| 12-month contribution payback | 185 | $2,042 | $108 |
| 6-month contribution payback | 369 | $4,085 | $54 |
| $1,000 MRR by November | 90 | $1,000 | $221 |

This means cold paid ads are not the clean first growth engine unless the offer converts far better than a normal early freemium SaaS funnel. Paid ads can still be useful as a test, but the business should pair them with warm channels: tutor partnerships, school/community launches, AP/college math content, creator demos, email capture, and annual prepay offers.

## Assumptions

- Paid plan prices: Plus $8, Studio $20, Everything $35.
- Plan mix among new paid users: mostly Plus, smaller Studio, small Everything.
- Variable gross margin includes Stripe, AI study-assist usage, and storage/hosting per active user.
- Free users are cheap because notes, binders, graph states, and whiteboards are mostly text/JSON; PDFs/media would change this.
- Ads are blended between education/search intent traffic and cheaper social traffic.
- Google/search clicks are modeled more expensive and higher intent than social clicks.
- Website conversion improves modestly from September to November, but the site is not assumed to be a mature, high-converting funnel.

## Benchmarks Used

- Education search CPC planning was anchored around current public education Google Ads benchmarks near $6 CPC and high cost-per-lead.
- Social CPC planning was anchored around current Meta/Facebook education and SaaS benchmarks near $1-$2.50 CPC.
- Visitor-to-signup and freemium-to-paid assumptions were anchored around SaaS freemium benchmarks: visitor to signup often 1-10%, signup to activation often 20-70%, freemium to paid often 2-5% for many products.
- Payment and AI margin assumptions came from the existing BinderNotes pricing and AI/cloud cost report.

## Sources

- BinderNotes pricing and AI/cloud cost report: docs/pricing-ai-cloud-cost-report.md
- OpenAI API pricing: https://openai.com/api/pricing/
- Stripe pricing: https://stripe.com/pricing
- Supabase compute and billing: https://supabase.com/docs/guides/platform/compute-and-disk
- Vercel pricing: https://vercel.com/pricing
- Education Google Ads benchmarks: https://ppcchief.com/google-ads-benchmarks/education
- WordStream/LocaliQ Google Ads benchmark context: https://www.wordstream.com/blog/2025-google-ads-benchmarks
- SaaS conversion benchmarks: https://www.saaspricelab.com/benchmarks/saas-conversion-rates
- Meta/Facebook education ad benchmark context: https://www.digitalpointllc.com/research/facebook-ads-benchmarks-2026
- Meta CPC benchmark context: https://useadmetrics.com/benchmarks/facebook-ads-cpc-2026
