const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfig = {
  anonKey,
  url,
} as const;

export const isSupabaseConfigured = Boolean(url && anonKey);
