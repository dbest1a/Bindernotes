import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

function now() {
  return new Date().toISOString();
}

function createBootstrapProfile(userId: string, email: string): Profile {
  return {
    id: userId,
    email,
    full_name: email.split("@")[0] ?? "Learner",
    role: "learner",
    created_at: now(),
    updated_at: now(),
  };
}

export async function getProfile(userId: string, email: string): Promise<Profile> {
  if (!supabase) {
    throw new Error(
      "Supabase is required for Binder Notes accounts. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as Profile;
  }

  const bootstrap = createBootstrapProfile(userId, email);
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: bootstrap.id,
        email: bootstrap.email,
        full_name: bootstrap.full_name,
        updated_at: now(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted as Profile;
}
