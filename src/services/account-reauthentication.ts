import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase-config";
import type { Database } from "@/lib/database.generated";

/** Password confirmation must never replace the app's persisted login. */
export async function confirmAccountPassword(ownerId: string, email: string, password: string) {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) throw new Error("Account services are unavailable.");
  const confirmation = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `bindernotes:deletion-confirmation:${crypto.randomUUID()}`,
    },
  });
  const release = async () => {
    // The deletion endpoint may already have removed this Auth user. Revocation
    // is best effort and must not replace the original action's outcome.
    await confirmation.auth.signOut({ scope: "local" }).catch(() => undefined);
  };
  try {
    const result = await confirmation.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (
      !result.data.session?.access_token ||
      result.data.session.user.id !== ownerId ||
      result.data.user?.id !== ownerId
    )
      throw new Error("Password confirmation returned a different account. Sign in again.");
    return { accessToken: result.data.session.access_token, release };
  } catch (error) {
    await release();
    throw error;
  }
}
