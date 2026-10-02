import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

function policyUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
}

export function HelpPage() {
  const privacy = policyUrl(import.meta.env.VITE_PRIVACY_POLICY_URL);
  const terms = policyUrl(import.meta.env.VITE_TERMS_URL);
  return <main className="app-page max-w-[900px] gap-6 py-8">
    <nav aria-label="Help navigation" className="flex flex-wrap gap-4 text-sm underline"><Link to="/">Home</Link><Link to="/tutorial">Quick start</Link><Link to="/pricing">Current offer</Link><Link to="/auth">Sign in</Link></nav>
    <section className="page-shell p-6"><h1 className="text-3xl font-semibold">Help & account information</h1><p className="mt-3 text-muted-foreground">Start with these steps if you cannot access your account or find your saved work.</p></section>
    <section className="page-shell p-6" id="account"><h2 className="text-xl font-semibold">Account access</h2><p className="mt-3 leading-7">Use the same email or Google account you used to sign up. If you have forgotten your password, request a reset link. If signup asks you to confirm your email, check your inbox and spam folder; you can resend the confirmation from the signup screen.</p><Button asChild className="mt-4" variant="outline"><Link to="/auth?mode=recovery">Reset password</Link></Button></section>
    <section className="page-shell p-6" id="saving"><h2 className="text-xl font-semibold">Saving and reopening notes</h2><p className="mt-3 leading-7">Wait for the save status before leaving an editor. If saving fails, keep the page open and retry. A conflict means the saved version changed elsewhere; review both versions before replacing either. Check Personal Notes and the lesson you were reading, using the same account.</p><p className="mt-3 leading-7">A device recovery copy can help after an interrupted save, but it is not a replacement for a successful account save. Do not clear browser storage while recovering unsaved work.</p></section>
    <section className="page-shell p-6" id="privacy"><h2 className="text-xl font-semibold">Privacy and terms</h2><p className="mt-3 leading-7">Personal notes are associated with the signed-in account and kept separate from published source lessons. This describes how the workspace works; it is not a privacy policy or terms of service.</p><div className="mt-4 flex flex-wrap gap-4 text-primary underline">{privacy ? <a href={privacy} rel="noopener noreferrer" target="_blank">Privacy policy</a> : null}{terms ? <a href={terms} rel="noopener noreferrer" target="_blank">Terms of service</a> : null}</div>{!privacy || !terms ? <p className="mt-3 text-sm text-muted-foreground">{!privacy && !terms ? "Privacy policy and terms links have not been published here yet." : !privacy ? "A privacy policy link has not been published here yet." : "A terms of service link has not been published here yet."}</p> : null}</section>
  </main>;
}
