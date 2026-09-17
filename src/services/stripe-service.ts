import { supabase } from "@/lib/supabase";
import { z } from "zod";

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
    description: "A private study workspace.",
    features: ["Private notes", "Highlights", "Math blocks", "3 Math Whiteboards"],
    cta: "Start free",
  },
  {
    id: "plus",
    name: "Plus",
    price: "$8",
    description: "Support your study workspace.",
    features: ["Private binders", "3 Math Whiteboards", "Graph states"],
    cta: "Start Plus",
  },
  {
    id: "studio",
    name: "Studio",
    price: "$20",
    description: "Publish and manage your own learning materials.",
    features: ["Creator workspace", "Publish your own notes", "20 Math Whiteboards"],
    cta: "Start Studio",
  },
  {
    id: "everything",
    name: "Everything",
    price: "$35",
    description: "Support continued development with all current Studio features.",
    features: ["Everything in Studio", "20 Math Whiteboards"],
    cta: "Get Everything",
  },
];

async function billingRequest(path: "checkout" | "portal", body: unknown) {
  if (!supabase) throw new Error("Sign in to manage your plan.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in to manage your plan.");
  const result = await fetch(`/api/billing/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(body),
  });
  const payload: unknown = await result.json().catch(() => null);
  if (!result.ok) {
    const message = z.object({ message: z.string().max(300) }).safeParse(payload);
    throw new Error(
      message.success ? message.data.message : "Billing is temporarily unavailable. Please retry.",
    );
  }
  const url = new URL(z.object({ url: z.url() }).parse(payload).url);
  if (
    url.protocol !== "https:" ||
    !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error("The billing link could not be verified. Please retry.");
  return url.href;
}
export async function startCheckout(planId: Plan["id"], requestId: string = crypto.randomUUID()) {
  if (planId === "free") return { kind: "free" as const };
  return { kind: "checkout" as const, url: await billingRequest("checkout", { plan: planId, requestId }) };
}
export async function openBillingPortal() {
  return billingRequest("portal", {});
}
