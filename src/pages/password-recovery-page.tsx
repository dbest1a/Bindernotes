import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { updateRecoveredPassword } from "@/services/account-service";
export function PasswordRecoveryPage() {
  const { session, isLoading } = useAuth();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== form.get("confirm")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateRecoveredPassword(password);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-16">
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      {saved ? (
        <p role="status">
          Your password changed and all sessions were signed out.{" "}
          <Link className="underline" to="/auth">
            Sign in
          </Link>
        </p>
      ) : isLoading ? (
        <p role="status">Checking recovery link…</p>
      ) : !session ? (
        <p role="alert">
          This recovery link is missing, expired or already used.{" "}
          <Link className="underline" to="/auth">
            Request a new recovery email
          </Link>
        </p>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <label className="block">
            New password
            <Input name="password" type="password" minLength={12} required autoComplete="new-password" />
          </label>
          <label className="block">
            Confirm password
            <Input name="confirm" type="password" required autoComplete="new-password" />
          </label>
          <p className="text-sm">Use at least 12 characters. Changing your password signs out all devices.</p>
          <Button type="submit" disabled={busy}>
            {busy ? "Updating…" : "Set password and sign out"}
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
