import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ITERATIONS = 50000;
const SEED = 20260515;

const months = [
  { key: "sep", label: "September 2026", adSpend: 10000, organicVisits: [800, 1600, 3200], siteLift: [0.82, 1.0, 1.16] },
  { key: "oct", label: "October 2026", adSpend: 10000, organicVisits: [1000, 2300, 5200], siteLift: [0.9, 1.08, 1.3] },
  { key: "nov", label: "November 2026", adSpend: 0, organicVisits: [1200, 3200, 7200], siteLift: [0.96, 1.18, 1.5] },
];

const plans = {
  plus: {
    price: 8,
    stripeFee: 0.53,
    aiCost: [0.5, 0.85, 1.2],
    cloudCost: [0.03, 0.06, 0.1],
    churn: [0.08, 0.14, 0.24],
  },
  studio: {
    price: 20,
    stripeFee: 0.88,
    aiCost: [1.5, 2.4, 3.5],
    cloudCost: [0.08, 0.2, 0.5],
    churn: [0.05, 0.1, 0.18],
  },
  everything: {
    price: 35,
    stripeFee: 1.32,
    aiCost: [4, 6, 8],
    cloudCost: [0.15, 0.5, 1],
    churn: [0.04, 0.08, 0.16],
  },
};

const fixedCloudCost = 155;
const freeCloudCost = [0.005, 0.02, 0.05];
const freeMonthlyRetention = [0.35, 0.55, 0.75];

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function triangular(rng, min, mode, max) {
  const u = rng();
  const c = (mode - min) / (max - min);
  if (u < c) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function bounded(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantile(values, q) {
  const index = (values.length - 1) * q;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return values[lo];
  return values[lo] + (values[hi] - values[lo]) * (index - lo);
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p05: quantile(sorted, 0.05),
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    p95: quantile(sorted, 0.95),
  };
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatCurrency(value) {
  const rounded = Math.round(value);
  return `$${rounded.toLocaleString("en-US")}`;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-US");
}

function allocatePlans(rng, paidCount) {
  const plusShare = triangular(rng, 0.72, 0.82, 0.9);
  const studioShare = triangular(rng, 0.08, 0.15, 0.24);
  const everythingShare = Math.max(0.01, 1 - plusShare - studioShare);
  const total = plusShare + studioShare + everythingShare;
  return {
    plus: paidCount * (plusShare / total),
    studio: paidCount * (studioShare / total),
    everything: paidCount * (everythingShare / total),
  };
}

function newUsersFromChannel(rng, visits, siteLift, channel) {
  const signupRate =
    channel === "search"
      ? triangular(rng, 0.028, 0.055, 0.11)
      : channel === "social"
        ? triangular(rng, 0.01, 0.026, 0.055)
        : triangular(rng, 0.025, 0.06, 0.12);
  const activationRate = triangular(rng, 0.2, 0.36, 0.55);
  const signupCount = visits * bounded(signupRate * siteLift, 0, 0.18);
  return {
    signups: signupCount,
    activated: signupCount * activationRate,
  };
}

function simulateOne(iteration) {
  const rng = mulberry32(SEED + iteration * 9973);
  const paid = { plus: 0, studio: 0, everything: 0 };
  const activeFreeByAge = [];
  const activatedFreeCohorts = [];
  const monthly = [];
  let cumulativeAdSpend = 0;
  let cumulativeRevenue = 0;
  let cumulativeContribution = 0;
  let cumulativeFixedCloud = 0;
  let cumulativeNewPaid = 0;
  let cumulativeSignups = 0;
  let cumulativeActivated = 0;

  const searchShare = triangular(rng, 0.28, 0.45, 0.64);
  const searchCpc = triangular(rng, 3.25, 6.23, 9.25);
  const socialCpc = triangular(rng, 0.85, 1.35, 2.6);
  const referralVisitsPerActiveUser = triangular(rng, 0.003, 0.018, 0.055);
  const sameMonthPaidRate = triangular(rng, 0.012, 0.026, 0.055);
  const nextMonthPaidRate = triangular(rng, 0.006, 0.014, 0.032);
  const secondMonthPaidRate = triangular(rng, 0.002, 0.006, 0.016);
  const freeCost = triangular(rng, ...freeCloudCost);

  for (const month of months) {
    for (const planKey of Object.keys(paid)) {
      paid[planKey] *= 1 - triangular(rng, ...plans[planKey].churn);
    }

    const freeRetention = triangular(rng, ...freeMonthlyRetention);
    for (let index = 0; index < activeFreeByAge.length; index += 1) {
      activeFreeByAge[index] *= freeRetention;
    }

    let newPaid = { plus: 0, studio: 0, everything: 0 };
    const cohortConversions = [];
    for (let age = 0; age < activatedFreeCohorts.length; age += 1) {
      const cohort = activatedFreeCohorts[age];
      const rate = age === 0 ? sameMonthPaidRate : age === 1 ? nextMonthPaidRate : secondMonthPaidRate;
      const converted = cohort.remainingActivated * rate;
      cohort.remainingActivated = Math.max(0, cohort.remainingActivated - converted);
      cohortConversions.push(converted);
    }

    const paidFromOlderCohorts = cohortConversions.reduce((sum, value) => sum + value, 0);
    const olderPaidPlans = allocatePlans(rng, paidFromOlderCohorts);
    for (const planKey of Object.keys(newPaid)) {
      newPaid[planKey] += olderPaidPlans[planKey];
    }

    const adSpend = month.adSpend;
    const siteLift = triangular(rng, ...month.siteLift);
    const adSearchVisits = adSpend > 0 ? (adSpend * searchShare) / searchCpc : 0;
    const adSocialVisits = adSpend > 0 ? (adSpend * (1 - searchShare)) / socialCpc : 0;
    const organicVisits = triangular(rng, ...month.organicVisits);
    const activeUsers = paid.plus + paid.studio + paid.everything + activeFreeByAge.reduce((sum, value) => sum + value, 0);
    const referralVisits = activeUsers * referralVisitsPerActiveUser;

    const searchUsers = newUsersFromChannel(rng, adSearchVisits, siteLift, "search");
    const socialUsers = newUsersFromChannel(rng, adSocialVisits, siteLift, "social");
    const organicUsers = newUsersFromChannel(rng, organicVisits + referralVisits, siteLift, "organic");

    const newSignups = searchUsers.signups + socialUsers.signups + organicUsers.signups;
    const newActivated = searchUsers.activated + socialUsers.activated + organicUsers.activated;
    cumulativeSignups += newSignups;
    cumulativeActivated += newActivated;

    const sameMonthPaid = newActivated * sameMonthPaidRate;
    const sameMonthPaidPlans = allocatePlans(rng, sameMonthPaid);
    for (const planKey of Object.keys(newPaid)) {
      newPaid[planKey] += sameMonthPaidPlans[planKey];
    }
    const remainingActivated = Math.max(0, newActivated - sameMonthPaid);
    activatedFreeCohorts.unshift({ remainingActivated });
    if (activatedFreeCohorts.length > 3) activatedFreeCohorts.pop();
    activeFreeByAge.unshift(Math.max(0, newSignups - sameMonthPaid));
    if (activeFreeByAge.length > 4) activeFreeByAge.pop();

    for (const planKey of Object.keys(paid)) {
      paid[planKey] += newPaid[planKey];
      cumulativeNewPaid += newPaid[planKey];
    }

    const activeFree = activeFreeByAge.reduce((sum, value) => sum + value, 0);
    const revenue =
      paid.plus * plans.plus.price + paid.studio * plans.studio.price + paid.everything * plans.everything.price;
    const stripe =
      paid.plus * plans.plus.stripeFee + paid.studio * plans.studio.stripeFee + paid.everything * plans.everything.stripeFee;
    const ai =
      paid.plus * triangular(rng, ...plans.plus.aiCost) +
      paid.studio * triangular(rng, ...plans.studio.aiCost) +
      paid.everything * triangular(rng, ...plans.everything.aiCost);
    const cloud =
      activeFree * freeCost +
      paid.plus * triangular(rng, ...plans.plus.cloudCost) +
      paid.studio * triangular(rng, ...plans.studio.cloudCost) +
      paid.everything * triangular(rng, ...plans.everything.cloudCost);
    const contribution = revenue - stripe - ai - cloud;
    const fixed = fixedCloudCost;

    cumulativeAdSpend += adSpend;
    cumulativeRevenue += revenue;
    cumulativeContribution += contribution;
    cumulativeFixedCloud += fixed;

    monthly.push({
      month: month.label,
      adSpend,
      adSearchVisits,
      adSocialVisits,
      organicVisits,
      newSignups,
      newActivated,
      newPaid: newPaid.plus + newPaid.studio + newPaid.everything,
      activeFree,
      paid: { ...paid },
      revenue,
      contribution,
      netAfterAdsAndFixed: contribution - adSpend - fixed,
    });
  }

  const finalPaid = paid.plus + paid.studio + paid.everything;
  const finalMrr = plans.plus.price * paid.plus + plans.studio.price * paid.studio + plans.everything.price * paid.everything;
  const finalContribution =
    paid.plus * (plans.plus.price - plans.plus.stripeFee - 0.85 - 0.06) +
    paid.studio * (plans.studio.price - plans.studio.stripeFee - 2.4 - 0.2) +
    paid.everything * (plans.everything.price - plans.everything.stripeFee - 6 - 0.5);
  const blendedContributionPerPaid = finalPaid > 0 ? finalContribution / finalPaid : 0;
  const paidCac = finalPaid > 0 ? cumulativeAdSpend / finalPaid : Infinity;
  const activePaidCac = finalPaid > 0 ? cumulativeAdSpend / finalPaid : Infinity;

  return {
    finalFree: monthly.at(-1).activeFree,
    finalPaid,
    finalPlus: paid.plus,
    finalStudio: paid.studio,
    finalEverything: paid.everything,
    finalMrr,
    finalMonthlyContribution: finalContribution,
    cumulativeSignups,
    cumulativeActivated,
    cumulativeNewPaid,
    cumulativeRevenue,
    cumulativeContribution,
    cumulativeAdSpend,
    cumulativeFixedCloud,
    cumulativeCashAfterAdsAndFixed: cumulativeContribution - cumulativeAdSpend - cumulativeFixedCloud,
    paidCac,
    activePaidCac,
    paybackMonths: blendedContributionPerPaid > 0 ? paidCac / blendedContributionPerPaid : Infinity,
    monthly,
  };
}

const results = [];
for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
  results.push(simulateOne(iteration));
}

const metrics = [
  "finalFree",
  "finalPaid",
  "finalPlus",
  "finalStudio",
  "finalEverything",
  "finalMrr",
  "finalMonthlyContribution",
  "cumulativeSignups",
  "cumulativeActivated",
  "cumulativeNewPaid",
  "cumulativeRevenue",
  "cumulativeContribution",
  "cumulativeCashAfterAdsAndFixed",
  "paidCac",
  "paybackMonths",
];

const summary = Object.fromEntries(metrics.map((metric) => [metric, summarize(results.map((result) => result[metric]))]));

const monthlySummary = months.map((month, monthIndex) => {
  const metric = (name) => summarize(results.map((result) => result.monthly[monthIndex][name]));
  return {
    month: month.label,
    adSpend: month.adSpend,
    newSignups: metric("newSignups"),
    newPaid: metric("newPaid"),
    activeFree: metric("activeFree"),
    revenue: metric("revenue"),
    contribution: metric("contribution"),
    netAfterAdsAndFixed: metric("netAfterAdsAndFixed"),
  };
});

function row(label, values, formatter = formatNumber) {
  return `| ${label} | ${formatter(values.p10)} | ${formatter(values.p50)} | ${formatter(values.p90)} |`;
}

const markdown = `# BinderNotes September Launch Financial Simulation

Run date: May 15, 2026

This is a conservative Monte Carlo simulation with ${ITERATIONS.toLocaleString("en-US")} seeded runs. It assumes BinderNotes improves through summer, paid launch begins in September 2026, ads spend $10,000 in September and $10,000 in October, and the business is measured at November 30, 2026.

## Headline Result

| Metric by Nov 30, 2026 | P10 | Base P50 | P90 |
| --- | ---: | ---: | ---: |
${row("Active free users", summary.finalFree)}
${row("Active paid users", summary.finalPaid)}
${row("Plus users", summary.finalPlus)}
${row("Studio users", summary.finalStudio)}
${row("Everything users", summary.finalEverything)}
${row("MRR", summary.finalMrr, formatCurrency)}
${row("Monthly gross contribution before fixed costs", summary.finalMonthlyContribution, formatCurrency)}
${row("Cumulative signups, Sep-Nov", summary.cumulativeSignups)}
${row("Cumulative paid conversions, Sep-Nov", summary.cumulativeNewPaid)}
${row("Cumulative revenue, Sep-Nov", summary.cumulativeRevenue, formatCurrency)}
${row("Cumulative contribution before ads/fixed, Sep-Nov", summary.cumulativeContribution, formatCurrency)}
${row("Cash after ads and lean fixed cloud, Sep-Nov", summary.cumulativeCashAfterAdsAndFixed, formatCurrency)}
${row("Paid CAC using $20k ad spend / active paid users", summary.paidCac, formatCurrency)}
${row("Contribution payback months", summary.paybackMonths, (value) => `${round(value, 1)} mo`)}

## Monthly Funnel

| Month | Ad spend | New signups P50 | New paid P50 | Active free P50 | Revenue P50 | Contribution P50 | Cash after ads/fixed P50 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${monthlySummary
  .map(
    (month) =>
      `| ${month.month} | ${formatCurrency(month.adSpend)} | ${formatNumber(month.newSignups.p50)} | ${formatNumber(month.newPaid.p50)} | ${formatNumber(month.activeFree.p50)} | ${formatCurrency(month.revenue.p50)} | ${formatCurrency(month.contribution.p50)} | ${formatCurrency(month.netAfterAdsAndFixed.p50)} |`,
  )
  .join("\n")}

## Conservative Interpretation

- The likely base case is roughly ${formatNumber(summary.finalPaid.p50)} active paid users and ${formatCurrency(summary.finalMrr.p50)} MRR by November 30.
- The conservative P10 case is roughly ${formatNumber(summary.finalPaid.p10)} active paid users and ${formatCurrency(summary.finalMrr.p10)} MRR.
- The upside P90 case is roughly ${formatNumber(summary.finalPaid.p90)} active paid users and ${formatCurrency(summary.finalMrr.p90)} MRR.
- For cost metrics, higher is worse: the base CAC is ${formatCurrency(summary.paidCac.p50)}, while the worse P90 CAC is ${formatCurrency(summary.paidCac.p90)}.
- The $20,000 ad test is very unlikely to pay back by November. In the base case, it is buying learning, cohorts, and signal, not immediate profitability.
- The model expects fixed cloud costs to be small relative to ad spend. The key constraints are conversion rate, activation quality, paid conversion, and paid retention.

## What Has To Be True For Ads To Work

The base blended November ARPU is about ${formatCurrency(summary.finalMrr.p50 / Math.max(1, summary.finalPaid.p50))}/month, and the base blended contribution is about ${formatCurrency(summary.finalMonthlyContribution.p50 / Math.max(1, summary.finalPaid.p50))}/month per active paid user.

| Goal from the $20k launch spend | Required active paid users | Implied MRR | Required CAC |
| --- | ---: | ---: | ---: |
| 12-month contribution payback | ${formatNumber(20000 / ((summary.finalMonthlyContribution.p50 / Math.max(1, summary.finalPaid.p50)) * 12))} | ${formatCurrency((20000 / ((summary.finalMonthlyContribution.p50 / Math.max(1, summary.finalPaid.p50)) * 12)) * (summary.finalMrr.p50 / Math.max(1, summary.finalPaid.p50)))} | ${formatCurrency((summary.finalMonthlyContribution.p50 / Math.max(1, summary.finalPaid.p50)) * 12)} |
| 6-month contribution payback | ${formatNumber(20000 / ((summary.finalMonthlyContribution.p50 / Math.max(1, summary.finalPaid.p50)) * 6))} | ${formatCurrency((20000 / ((summary.finalMonthlyContribution.p50 / Math.max(1, summary.finalPaid.p50)) * 6)) * (summary.finalMrr.p50 / Math.max(1, summary.finalPaid.p50)))} | ${formatCurrency((summary.finalMonthlyContribution.p50 / Math.max(1, summary.finalPaid.p50)) * 6)} |
| $1,000 MRR by November | ${formatNumber(1000 / (summary.finalMrr.p50 / Math.max(1, summary.finalPaid.p50)))} | $1,000 | ${formatCurrency(20000 / (1000 / (summary.finalMrr.p50 / Math.max(1, summary.finalPaid.p50))))} |

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
`;

const output = {
  runDate: "2026-05-15",
  iterations: ITERATIONS,
  seed: SEED,
  assumptions: {
    launch: "September 2026 paid launch, September and October ad spend, November 30 measurement",
    monthlyAdSpend: months.map(({ label, adSpend }) => ({ month: label, adSpend })),
    fixedCloudCost,
    planPrices: Object.fromEntries(Object.entries(plans).map(([key, value]) => [key, value.price])),
  },
  summary,
  monthlySummary,
};

const artifactsPath = join(process.cwd(), "artifacts", "launch-financial-simulation-2026.json");
const reportPath = join(process.cwd(), "docs", "launch-financial-simulation-2026.md");
mkdirSync(dirname(artifactsPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(artifactsPath, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(reportPath, markdown);

console.log(markdown);
console.log(`\nWrote ${reportPath}`);
console.log(`Wrote ${artifactsPath}`);
