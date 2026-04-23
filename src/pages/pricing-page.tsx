import { useState } from "react";
import { ArrowLeft, Check, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { plans, startCheckout } from "@/services/stripe-service";

export function PricingPage() {
  const [message, setMessage] = useState("");

  const upgrade = async (planId: "free" | "pro") => {
    const result = await startCheckout(planId);
    setMessage(result.kind === "free" ? "Free plan selected." : result.message);
  };

  return (
    <main className="app-page">
      <section className="hero-grid">
        <div className="page-shell p-6 sm:p-8">
          <Badge variant="outline">Payments-ready MVP</Badge>
          <h1 className="mt-4 page-heading max-w-4xl text-4xl sm:text-5xl">
            Pricing that stays clear, useful, and student-first.
          </h1>
          <p className="mt-4 max-w-2xl page-copy">
            Stripe Checkout is scaffolded as a clean production boundary now, with secure checkout
            and webhook expansion ready for the next pass.
          </p>
        </div>
        <aside className="hero-aside">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Decision guide
          </p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Free is built for personal study and private notes.</p>
            <p>Pro is the creator path for publishing, teaching, and premium workspace customization.</p>
          </div>
          <Button asChild className="mt-6 w-full" variant="outline">
            <Link to="/dashboard">
              <ArrowLeft data-icon="inline-start" />
              Back to workspace
            </Link>
          </Button>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <Card
            className={plan.id === "pro" ? "border-primary bg-accent/35" : ""}
            key={plan.id}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                {plan.id === "pro" ? <Badge>Creator-ready</Badge> : <Badge variant="secondary">Student</Badge>}
              </div>
              <CardDescription>{plan.description}</CardDescription>
              <p className="pt-6 text-5xl font-semibold tracking-tight">
                {plan.price}
                {plan.id === "pro" ? <span className="text-base text-muted-foreground"> /mo</span> : null}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {plan.features.map((feature) => (
                <p className="flex items-center gap-2 text-sm" key={feature}>
                  <Check className="text-primary" data-icon="inline-start" />
                  {feature}
                </p>
              ))}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => upgrade(plan.id)}
                type="button"
                variant={plan.id === "pro" ? "default" : "outline"}
              >
                <CreditCard data-icon="inline-start" />
                {plan.cta}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>

      {message ? (
        <div className="page-shell p-4 text-sm text-muted-foreground">{message}</div>
      ) : null}
    </main>
  );
}
