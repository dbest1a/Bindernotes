import type { ReactNode } from "react";
import type { Profile } from "@/types";

// Isolated local test account for component fixtures. It never contacts Supabase;
// the fixture Supabase client is stubbed, so data stays in this browser's storage.
export const fixtureProfile: Profile = {
  id: "fixture-learner",
  email: "learner@fixture.invalid",
  full_name: "Fixture Learner",
  role: "learner",
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const unavailable = async () => {
  throw new Error("Authentication is not available in isolated fixtures.");
};

const state = {
  session: null,
  user: null,
  profile: fixtureProfile,
  isConfigured: false,
  isLoading: false,
  signIn: unavailable,
  signInWithGoogle: unavailable,
  signUp: unavailable,
  requestPasswordReset: unavailable,
  resendConfirmation: unavailable,
  updatePassword: unavailable,
  signOut: async () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return state;
}

export function shouldBlockAuthHydration() {
  return false;
}

export function shouldRefreshProfile() {
  return false;
}
