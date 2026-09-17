import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { deleteOwnAccount, requestPasswordRecovery } from "@/services/account-service";
export function AccountPage() {
  const { profile, session, signOut, isLoading } = useAuth();
  if (isLoading) return <p role="status">Loading account…</p>;
  if (!session) return <Navigate to="/auth?next=/account" replace />;
  return (
    <AccountControls
      key={session.user.id}
      ownerId={session.user.id}
      email={profile?.email ?? session.user.email}
      signOut={signOut}
    />
  );
}
function AccountControls({
  ownerId,
  email,
  signOut,
}: {
  ownerId: string;
  email: string | undefined;
  signOut: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function action(operation: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await operation();
      if (mounted.current) setMessage(success);
    } catch (error) {
      if (mounted.current)
        setMessage(error instanceof Error ? error.message : "Account action failed. Try again.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(async () => {
      await deleteOwnAccount(
        ownerId,
        String(form.get("confirmation") ?? ""),
        String(form.get("password") ?? "") || undefined,
      );
      if (mounted.current) navigate("/auth", { replace: true });
    }, "Account deleted.");
  }
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <h1 className="text-3xl font-semibold">Account and security</h1>
      <p>{email}</p>
      <Link className="text-sm underline" to="/dashboard">
        Return to workspace
      </Link>
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Password and sessions</h2>
        <p className="text-sm">
          Use a recovery email to choose a new password. Signing out all devices preserves your saved
          workspace.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || !email}
            onClick={() => {
              if (email)
                void action(
                  () => requestPasswordRecovery(email),
                  "If this address has an account, a recovery link has been sent.",
                );
            }}
          >
            Send password recovery email
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await signOut();
                if (mounted.current) navigate("/auth");
              }, "All devices signed out.")
            }
          >
            Sign out all devices
          </Button>
        </div>
      </section>
      <section className="space-y-3 rounded-lg border border-destructive/40 p-4">
        <h2 className="text-lg font-semibold">Delete account permanently</h2>
        <p className="text-sm">
          Deletion removes your private notes, courses, whiteboards, reviews, progress and uploaded files.
          Export a copy from Data and backups first. Cancel recurring subscriptions and close checkout
          sessions before deleting.
        </p>
        <Link className="text-sm underline" to="/account/data">
          Open Data and backups
        </Link>
        {import.meta.env.VITE_ACCOUNT_DELETION_ENABLED !== "true" ? (
          <p>Self-service deletion is not enabled in this environment yet.</p>
        ) : (
          <form onSubmit={remove} className="space-y-3">
            <label className="block">
              Current password (email accounts)
              <Input name="password" type="password" autoComplete="current-password" />
            </label>
            <p className="text-sm">
              For Google accounts, sign out and sign in again immediately before deletion.
            </p>
            <label className="block">
              Type DELETE to confirm
              <Input name="confirmation" required pattern="DELETE" autoComplete="off" />
            </label>
            <Button variant="destructive" type="submit" disabled={busy}>
              {busy ? "Working…" : "Delete my account and data"}
            </Button>
          </form>
        )}
      </section>
      {message && (
        <p role="status" className="rounded border p-3">
          {message}
        </p>
      )}
    </main>
  );
}
