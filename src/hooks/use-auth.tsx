import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { demoAdmin, demoProfile } from "@/lib/demo-data";
import { NOTE_SAVE_BEFORE_SIGN_OUT_EVENT } from "@/lib/note-save";
import { getProfile } from "@/services/binder-service";
import type { Profile, Role } from "@/types";

const DEMO_PROFILE_STORAGE_KEY = "binder-notes:demo-profile:v1";

type AuthState = {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  isConfigured: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: Role) => Promise<void>;
  enterDemo: (role: Role) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => loadStoredDemoProfile());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let active = true;

    const hydrateAuthState = async (nextSession: Session | null) => {
      if (!active) {
        return;
      }

      setIsLoading(true);
      setSession(nextSession);

      const user = nextSession?.user;
      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const nextProfile = await getProfile(user.id, user.email ?? "");
        if (!active) {
          return;
        }
        setProfile(nextProfile);
      } catch (error) {
        console.error("Failed to hydrate Supabase profile.", error);
        if (!active) {
          return;
        }
        setProfile(null);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return hydrateAuthState(data.session);
      })
      .catch((error) => {
        console.error("Failed to hydrate Supabase session.", error);
        if (!active) {
          return;
        }
        setSession(null);
        setProfile(null);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrateAuthState(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (supabase) {
      return;
    }

    saveStoredDemoProfile(profile);
  }, [profile]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isConfigured: isSupabaseConfigured,
      isLoading,
      signIn: async (email, password) => {
        if (!supabase) {
          setProfile(email.includes("admin") ? demoAdmin : demoProfile);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setIsLoading(false);
          throw error;
        }
      },
      signInWithGoogle: async (nextPath = "/dashboard") => {
        if (!supabase) {
          throw new Error("Google sign-in is only available when Supabase auth is configured.");
        }

        setIsLoading(true);
        const redirectTo = new URL("/auth", window.location.origin);
        redirectTo.searchParams.set("next", nextPath);

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectTo.toString(),
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });

        if (error) {
          setIsLoading(false);
          throw error;
        }
      },
      signUp: async (email, password, fullName, role) => {
        if (!supabase) {
          setProfile(role === "admin" ? demoAdmin : demoProfile);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
            },
          },
        });

        if (error) {
          setIsLoading(false);
          throw error;
        }
      },
      enterDemo: (role) => {
        setProfile(role === "admin" ? demoAdmin : demoProfile);
        setIsLoading(false);
      },
      signOut: async () => {
        setIsLoading(true);
        if (typeof window !== "undefined") {
          const detail = {
            promises: [] as Promise<unknown>[],
          };
          window.dispatchEvent(
            new CustomEvent(NOTE_SAVE_BEFORE_SIGN_OUT_EVENT, {
              detail,
            }),
          );

          if (detail.promises.length > 0) {
            await Promise.allSettled(detail.promises);
          }
        }

        if (supabase) {
          const { error } = await supabase.auth.signOut();
          if (error) {
            setIsLoading(false);
            throw error;
          }
          return;
        }
        setSession(null);
        setProfile(null);
        setIsLoading(false);
      },
    }),
    [isLoading, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function loadStoredDemoProfile() {
  if (typeof window === "undefined" || supabase) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DEMO_PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (parsed.id === demoAdmin.id) {
      return demoAdmin;
    }
    if (parsed.id === demoProfile.id) {
      return demoProfile;
    }
  } catch {
    return null;
  }

  return null;
}

function saveStoredDemoProfile(profile: Profile | null) {
  if (typeof window === "undefined" || supabase) {
    return;
  }

  if (!profile) {
    window.localStorage.removeItem(DEMO_PROFILE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    DEMO_PROFILE_STORAGE_KEY,
    JSON.stringify({ id: profile.id, role: profile.role }),
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
