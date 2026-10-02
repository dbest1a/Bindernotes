import { Link } from "react-router-dom";
import { BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  ["Choose a lesson", "Create an account, open Dashboard, and choose an available binder. Open one lesson that you want to study."],
  ["Write one private note", "Open the lesson's Notes panel and add a sentence in your own words. Your note is separate from the source lesson."],
  ["Check the save status", "Wait for the note's save status to say it is saved. If it reports an error or a conflict, keep the page open and use the recovery action before leaving."],
  ["Reopen your work", "Return to Dashboard or Personal Notes, open the same note, and check that your sentence is there. This is the quickest way to confirm the study flow on your account."],
  ["Add a graph or board when useful", "For a math lesson, open a graph or the Whiteboard from the study tools. Move a module by its header. Start with one tool, and wait for its own save status before leaving."],
];

export function QuickStart() {
  return <section className="page-shell p-6 sm:p-8" aria-labelledby="quick-start-title" id="quick-start">
    <span className="page-kicker">Written quick start · About 3 minutes</span>
    <h2 className="mt-3 text-3xl font-semibold" id="quick-start-title">Your first saved study note</h2>
    <p className="mt-3 text-muted-foreground">Start with a source and one thought of your own. No video needed.</p>
    <ol className="mt-6 grid list-decimal gap-5 pl-6">{steps.map(([title, body]) => <li className="pl-2" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{body}</p></li>)}</ol>
    <div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link to="/auth?mode=signup"><BookOpenCheck data-icon="inline-start" />Start your first note</Link></Button><Button asChild variant="outline"><Link to="/help">Account and saving help</Link></Button></div>
  </section>;
}
