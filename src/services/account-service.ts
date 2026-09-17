import { supabase } from "@/lib/supabase";
import { saveQueue } from "@/lib/save-queue";
import { removeAccountDeviceData } from "@/lib/account-device-data";
let accountGeneration = 0;
saveQueue.subscribeAccount(() => {
  accountGeneration += 1;
});
function client() {
  if (!supabase) throw new Error("Account services are unavailable.");
  return supabase;
}
export async function requestPasswordRecovery(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/auth/recovery`,
  });
  if (error) throw new Error("The recovery request could not be sent. Wait a moment and try again.");
}
export async function updateRecoveredPassword(password: string) {
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
  const revoked = await client().auth.signOut({ scope: "global" });
  if (revoked.error)
    throw new Error(
      "Your password changed, but session revocation failed. Use Sign out all devices and retry.",
    );
}
export async function signOutEverywhere() {
  const { error } = await client().auth.signOut({ scope: "global" });
  if (error) throw error;
}
export async function deleteOwnAccount(ownerId: string, confirmation: string, password?: string) {
  const generation = accountGeneration;
  const check = () => {
    if (saveQueue.getAccount() !== ownerId || generation !== accountGeneration)
      throw new Error("The account changed. Reopen Account and security in the intended account.");
  };
  check();
  const initial = await client().auth.getSession();
  check();
  if (initial.error || initial.data.session?.user.id !== ownerId)
    throw new Error("The account changed. Sign in again.");
  if (password) {
    const email = initial.data.session.user.email;
    if (!email) throw new Error("Sign in again to confirm deletion.");
    const result = await client().auth.signInWithPassword({ email, password });
    check();
    if (result.error) throw result.error;
  }
  const { data, error } = await client().auth.getSession();
  check();
  if (error || data.session?.user.id !== ownerId) throw new Error("The account changed. Sign in again.");
  const key = `bindernotes:account-delete:${ownerId}`;
  const operationId = localStorage.getItem(key) ?? crypto.randomUUID();
  localStorage.setItem(key, operationId);
  const response = await fetch("/api/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ confirmation, operationId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.deleted !== true)
    throw new Error(result.message ?? "Account deletion is incomplete. Try again.");
  // A confirmed deletion may finish after an account switch. Its journals can
  // be removed, but its response must never sign out the newly active account.
  let cleanupFailed = false;
  try {
    removeAccountDeviceData(ownerId, [localStorage, sessionStorage]);
  } catch {
    cleanupFailed = true;
  }
  check();
  const active = await client().auth.getSession();
  check();
  if (active.error || active.data.session?.user.id !== ownerId)
    throw new Error("The account changed. The current account was not signed out.");
  const signedOut = await client().auth.signOut({ scope: "local" });
  if (signedOut.error)
    throw new Error(
      "Your account was deleted, but this device could not sign out. Reload and sign out again.",
    );
  if (cleanupFailed)
    throw new Error(
      "Your account was deleted, but some device backups could not be removed. Clear this site's stored data on this device.",
    );
}
