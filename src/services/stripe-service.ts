export type Plan = {
  id: "free" | "plus" | "studio" | "everything";
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
    id: "plus",
    name: "Plus",
    price: "$8",
    description: "For students who want unlimited binders, three whiteboards, and Desmos PowerGraphs.",
    features: [
      "Unlimited binders",
      "3 Math Whiteboards",
      "Desmos PowerGraphs",
      "Graph states",
    ],
    cta: "Start Plus",
  },
  {
    id: "studio",
    name: "Studio",
    price: "$20",
    description: "For creators who need Admin Studio, publishing, files, PDFs, and 20 whiteboards.",
    features: [
      "Unlimited binders",
      "Admin studio",
      "Publish your own notes",
      "Upload and annotate PDFs",
      "20 Math Whiteboards",
    ],
    cta: "Start Studio",
  },
  {
    id: "everything",
    name: "Everything",
    price: "$35",
    description: "For the full BinderNotes workspace with all study, graphing, publishing, and admin controls.",
    features: [
      "Everything in Studio",
      "Full Admin Studio controls",
      "Expanded whiteboard capacity",
      "All graph and PDF tools",
    ],
    cta: "Get Everything",
  },
];

export async function startCheckout(planId: Plan["id"]) {
  if (planId === "free") {
    return { kind: "free" as const };
  }

  const priceIds: Partial<Record<Exclude<Plan["id"], "free">, string | undefined>> = {
    plus: import.meta.env.VITE_STRIPE_PLUS_PRICE_ID as string | undefined,
    studio: import.meta.env.VITE_STRIPE_STUDIO_PRICE_ID as string | undefined,
    everything: import.meta.env.VITE_STRIPE_EVERYTHING_PRICE_ID as string | undefined,
  };
  const priceId = priceIds[planId];

  if (!priceId) {
    return {
      kind: "stub" as const,
      message:
        "Stripe Checkout is scaffolded. Add the plan price id and the serverless checkout route to activate payments.",
    };
  }

  return {
    kind: "stub" as const,
    message:
      "Create a Vercel serverless endpoint that calls Stripe Checkout Sessions with this price id.",
  };
}
