export type Plan = {
  id: "free" | "pro";
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
};

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "For students building a private study system.",
    features: ["Read free binders", "Private notes", "Highlights", "Math blocks"],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12",
    description: "For serious learners and creators selling premium binders.",
    features: [
      "Unlimited binders",
      "Admin studio",
      "Concept graph",
      "Stripe-ready publishing",
    ],
    cta: "Upgrade",
  },
];

export async function startCheckout(planId: Plan["id"]) {
  if (planId === "free") {
    return { kind: "free" as const };
  }

  const priceId = import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string | undefined;

  if (!priceId) {
    return {
      kind: "stub" as const,
      message:
        "Stripe Checkout is scaffolded. Add VITE_STRIPE_PRO_PRICE_ID and the serverless checkout route to activate payments.",
    };
  }

  return {
    kind: "stub" as const,
    message:
      "Create a Vercel serverless endpoint that calls Stripe Checkout Sessions with this price id.",
  };
}
