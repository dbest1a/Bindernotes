import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AuthChangeEvent, Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { NOTE_SAVE_BEFORE_SIGN_OUT_EVENT } from "@/lib/note-save";
import { getProfile } from "@/services/binder-service";
import type { Profile, Role } from "@/types";

type AuthState = {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  isConfigured: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: Role) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<Profile | null>(profile);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let active = true;

    const hydrateAuthState = async (
      nextSession: Session | null,
      options?: {
        foreground?: boolean;
        refreshProfile?: boolean;
      },
    ) => {
      if (!active) {
        return;
      }

      const currentUserId = sessionRef.current?.user?.id ?? null;
      const nextUserId = nextSession?.user?.id ?? null;
      const userChanged = currentUserId !== nextUserId;
      const shouldBlock = options?.foreground ?? (userChanged || !sessionRef.current);

      if (shouldBlock) {
        setIsLoading(true);
      }

      setSession(nextSession);
      sessionRef.current = nextSession;

      const user = nextSession?.user;
      if (!user) {
        setProfile(null);
        profileRef.current = null;
        setIsLoading(false);
        return;
      }

      if (!userChanged && profileRef.current && !options?.refreshProfile) {
        if (shouldBlock) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const nextProfile = await getProfile(user.id, user.email ?? "");
        if (!active) {
          return;
        }
        setProfile(nextProfile);
        profileRef.current = nextProfile;
      } catch (error) {
        console.error("Failed to hydrate Supabase profile.", error);
        if (!active) {
          return;
        }
        if (!profileRef.current || userChanged) {
          setProfile(null);
          profileRef.current = null;
        }
      } finally {
        if (active && shouldBlock) {
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
        return hydrateAuthState(data.session, {
          foreground: true,
          refreshProfile: true,
        });
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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextUserId = nextSession?.user?.id ?? null;
      const currentUserId = sessionRef.current?.user?.id ?? null;

      if (
        event === "TOKEN_REFRESHED" &&
        currentUserId === nextUserId &&
        profileRef.current
      ) {
        setSession(nextSession);
        sessionRef.current = nextSession;
        return;
      }

      void hydrateAuthState(nextSession, {
        foreground: shouldBlockAuthHydration(event),
        refreshProfile: shouldRefreshProfile(event),
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isConfigured: isSupabaseConfigured,
      isLoading,
      signIn: async (email, password) => {
        if (!supabase) {
          setIsLoading(false);
          throw createSupabaseRequiredError();
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
          setIsLoading(false);
          throw createSupabaseRequiredError();
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

function createSupabaseRequiredError() {
  return new Error(
    "Supabase is required for Binder Notes accounts. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before signing in.",
  );
}

export function shouldBlockAuthHydration(event: AuthChangeEvent) {
  return event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "PASSWORD_RECOVERY";
}

export function shouldRefreshProfile(event: AuthChangeEvent) {
  return event === "SIGNED_IN" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY";
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
