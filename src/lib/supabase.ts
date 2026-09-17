import { sessionAwareFetch } from "@/lib/session-validation";
import type { Database } from "@/lib/database.generated";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseConfig } from "@/lib/supabase-config";

const { anonKey: supabaseAnonKey, url: supabaseUrl } = supabaseConfig;

export const supabaseProjectRef = supabaseUrl
  ? (() => {
      try {
        return new URL(supabaseUrl).hostname.split(".")[0] ?? null;
      } catch {
        return null;
      }
    })()
  : null;

export { isSupabaseConfigured } from "@/lib/supabase-config";

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      global: { fetch: sessionAwareFetch },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
