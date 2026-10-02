import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";
import { MAX_WHITEBOARDS_PER_USER, MAX_WHITEBOARD_DESMOS_GRAPHS } from "@/lib/whiteboards/whiteboard-limits";

const faqs = [
  { question: "What is available today?", answer: "BinderNotes is free for now. Create an account to read available lessons, write private notes, highlight sources, and use the current math and whiteboard tools." },
  { question: "Are paid plans active?", answer: "No. Plus, Studio, and Everything are future plan ideas. They are not available to purchase, and their prices, features, and launch dates are not final." },
  { question: "What are the current whiteboard limits?", answer: `You can keep ${MAX_WHITEBOARDS_PER_USER} saved whiteboards per account and up to ${MAX_WHITEBOARD_DESMOS_GRAPHS} Desmos graph modules on each board. Archive a saved board before adding another when you reach the limit.` },
  { question: "Is Desmos included?", answer: "Yes. BinderNotes includes Desmos-powered graphing inside the math study flow." },
];

export function PricingPage() {
  const [expandedFaq, setExpandedFaq] = useState(faqs[0].question);
  return (
    <main className="pricing-page">
      <section className="pricing-hero">
        <nav className="marketing-nav pricing-nav" aria-label="Pricing navigation">
          <Link className="marketing-nav__brand" to="/"><LogoMark /><span><strong>BinderNotes</strong><small>Study workspace</small></span></Link>
          <div className="marketing-nav__links"><Link to="/tutorial">Quick start</Link><a href="#pricing-faq">Questions</a><Link to="/help">Help</Link></div>
          <div className="marketing-nav__actions"><Link className="marketing-nav__signin" to="/auth">Sign in</Link><Link className="marketing-nav__start" to="/auth?mode=signup">Start free<ArrowRight data-icon="inline-end" /></Link></div>
        </nav>
        <div className="pricing-hero__inner">
          <div className="pricing-hero__copy">
            <span className="marketing-kicker marketing-kicker--bright">Available today</span>
            <h1>Your study workspace. Free for now.</h1>
            <p>Read a lesson and keep your private notes beside it. Save your work, return to it, and add a graph or whiteboard when it helps.</p>
            <div className="pricing-hero__actions"><Button asChild className="marketing-button marketing-button--primary" size="lg"><Link to="/auth?mode=signup">Create a free account<ArrowRight data-icon="inline-end" /></Link></Button><Button asChild variant="outline" size="lg"><Link to="/tutorial">Read the quick start</Link></Button></div>
          </div>
          <article className="pricing-plan-card" id="plans">
            <div className="pricing-plan-card__top"><span>Current offer</span><strong>Available</strong></div>
            <h2 className="text-3xl font-semibold">Free</h2><div className="pricing-plan-card__price"><span>$0</span><small>during the current free offer</small></div>
            <div className="pricing-plan-card__features">{["Read available lessons and keep private notes", "Highlights and source-linked study tools", "Math graphing and formula references", `${MAX_WHITEBOARDS_PER_USER} saved whiteboards per account`, `Up to ${MAX_WHITEBOARD_DESMOS_GRAPHS} Desmos graph modules per board`].map((feature) => <span key={feature}><Check data-icon="inline-start" />{feature}</span>)}</div>
            <p>Paid plans and checkout are not active. The current free offer is not a promise of permanent pricing or future plan features.</p>
          </article>
        </div>
      </section>
      <section className="pricing-section">
        <div className="pricing-section__intro"><span className="marketing-kicker">Future plans</span><h2>Study now. Paid options may come later.</h2><p>Plus, Studio, and Everything are proposed future plans. None is available to buy. We will describe any future offer and its limits when it is ready.</p></div>
      </section>
      <section className="pricing-faq pricing-section" id="pricing-faq">
        <div className="pricing-section__intro"><span className="marketing-kicker">Questions</span><h2>Know what you are signing up for.</h2></div>
        <div className="pricing-faq__list">{faqs.map((item, index) => {
          const open = expandedFaq === item.question;
          return <article className="pricing-faq__item" data-open={open} key={item.question}><button aria-expanded={open} aria-controls={`pricing-answer-${index}`} onClick={() => setExpandedFaq(open ? "" : item.question)} type="button"><span>{item.question}</span><ChevronDown data-icon="inline-end" /></button><p id={`pricing-answer-${index}`} hidden={!open}>{item.answer}</p></article>;
        })}</div>
      </section>
    </main>
  );
}

// Every pricing entry point describes the same current offer.
export function PricingBetaPage() { return <PricingPage />; }
