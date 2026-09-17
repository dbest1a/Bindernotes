import { supabase } from "@/lib/supabase";
function client() { if (!supabase) throw new Error("Account services are unavailable."); return supabase; }
export async function requestPasswordRecovery(email: string) {
 const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/recovery` });
 if (error) throw new Error("The recovery request could not be sent. Wait a moment and try again.");
}
export async function updateRecoveredPassword(password: string) {
 if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
 const { error } = await client().auth.updateUser({ password }); if (error) throw error;
 const revoked = await client().auth.signOut({ scope: "global" });
 if (revoked.error) throw new Error("Your password changed, but session revocation failed. Use Sign out all devices and retry.");
}
export async function signOutEverywhere() { const { error } = await client().auth.signOut({ scope: "global" }); if (error) throw error; }
export async function deleteOwnAccount(ownerId: string, confirmation: string, password?: string) {
 const initial = await client().auth.getSession();
 if (initial.error || initial.data.session?.user.id !== ownerId) throw new Error("The account changed. Sign in again.");
 if (password) { const email = initial.data.session.user.email; if (!email) throw new Error("Sign in again to confirm deletion.");
  const result = await client().auth.signInWithPassword({ email, password }); if (result.error) throw result.error;
 }
 const { data, error } = await client().auth.getSession(); if (error || data.session?.user.id !== ownerId) throw new Error("The account changed. Sign in again.");
 const key = `bindernotes:account-delete:${ownerId}`;
 const operationId = localStorage.getItem(key) ?? crypto.randomUUID(); localStorage.setItem(key, operationId);
 const response = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ confirmation, operationId }) });
 const result = await response.json().catch(() => ({})); if (!response.ok || result.deleted !== true) throw new Error(result.message ?? "Account deletion is incomplete. Try again.");
 // Remove only journals explicitly keyed by this deleted owner. Never clear
 // another signed-in account's storage or unidentifiable legacy shared entries.
 for (let index=localStorage.length-1;index>=0;index--) { const storedKey=localStorage.key(index); if(storedKey?.includes(ownerId))localStorage.removeItem(storedKey); }
 await client().auth.signOut({ scope: "local" }); localStorage.removeItem(key);
}
