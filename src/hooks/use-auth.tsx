import { AUTH_SESSION_VALIDATION_EVENT } from "@/lib/session-validation";
import {
  createContext,
  ReactNode,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AuthChangeEvent, Session, User as SupabaseUser } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase-config";
import { NOTE_SAVE_BEFORE_SIGN_OUT_EVENT } from "@/lib/note-save";
import { saveQueue } from "@/lib/save-queue";
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
  validateSession: () => Promise<void>;
  sessionCheckMessage: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

async function loadSupabaseClient() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<Profile | null>(profile);

  const hydrationGenerationRef = useRef(0);
  const signingOutRef = useRef(false);
  const [sessionCheckMessage, setSessionCheckMessage] = useState<string | null>(null);
  const validationGenerationRef = useRef(0);
  const revokedTokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const validateSession = useCallback(async () => {
    const captured = sessionRef.current;
    if (!captured || !isSupabaseConfigured) return;
    const generation = ++validationGenerationRef.current;
    const isCurrent = () => mountedRef.current && validationGenerationRef.current === generation &&
      sessionRef.current?.user.id === captured.user.id && sessionRef.current?.access_token === captured.access_token;
    try {
      const supabase = await loadSupabaseClient(); if (!supabase || !isCurrent()) return;
      const { data, error } = await supabase.rpc("get_account_session_status");
      if (!isCurrent()) return;
      if (error || !["active", "deleting", "revoked"].includes(String(data))) throw new Error("Session status unavailable");
      if (data === "revoked") {
        // Retire the captured UI identity only. A background SDK signOut could
        // otherwise race a new account sign-in and clear that newer session.
        // The revoked credential cannot read/write; refresh will reject it too.
        revokedTokenRef.current = captured.access_token;
        hydrationGenerationRef.current += 1;
        sessionRef.current = null; profileRef.current = null;
        saveQueue.setAccount(null); setSession(null); setProfile(null); setIsLoading(false);
        setSessionCheckMessage("Your session ended. Sign in again. Unsaved drafts are retained on this device.");
      } else if (data === "deleting") {
        hydrationGenerationRef.current += 1; profileRef.current = null; setProfile(null); setIsLoading(false);
        setSessionCheckMessage("Your account deletion is pending. Open Account to retry removing the remaining data.");
      } else setSessionCheckMessage(null);
    } catch {
      if (isCurrent()) setSessionCheckMessage("Your session could not be checked. Reconnect and retry; your drafts are retained.");
    }
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    const focus = () => { void validateSession(); };
    const visibility = () => { if (document.visibilityState === "visible") void validateSession(); };
    window.addEventListener("focus", focus); window.addEventListener(AUTH_SESSION_VALIDATION_EVENT, focus); document.addEventListener("visibilitychange", visibility);
    return () => { mountedRef.current = false; validationGenerationRef.current += 1; window.removeEventListener("focus", focus); window.removeEventListener(AUTH_SESSION_VALIDATION_EVENT, focus); document.removeEventListener("visibilitychange", visibility); };
  }, [validateSession]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;
    let authEventVersion = 0;

    void loadSupabaseClient()
      .then(async (supabase) => {
        if (!active) {
          return;
        }
        if (!supabase) {
          setIsLoading(false);
          return;
        }

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

          if (nextSession?.access_token && nextSession.access_token === revokedTokenRef.current) nextSession = null;
          const currentUserId = sessionRef.current?.user?.id ?? null;
          const nextUserId = nextSession?.user?.id ?? null;
          const userChanged = currentUserId !== nextUserId;
          const hasCurrentProfile = Boolean(nextUserId && profileRef.current?.id === nextUserId);
          const shouldBlock = userChanged || !hasCurrentProfile || options?.foreground;
          const generation = ++hydrationGenerationRef.current;
          const isCurrent = () =>
            active && generation === hydrationGenerationRef.current &&
            sessionRef.current?.user?.id === nextUserId;

          saveQueue.setAccount(nextUserId);
          if (userChanged) {
            setProfile(null);
            profileRef.current = null;
          }

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

          if (hasCurrentProfile && !options?.refreshProfile) {
            if (!signingOutRef.current) {
              setIsLoading(false);
            }
            return;
          }

          try {
            const { getProfile } = await import("@/services/auth-profile");
            if (!isCurrent()) {
              return;
            }
            const nextProfile = await getProfile(user.id, user.email ?? "");
            if (!isCurrent()) {
              return;
            }
            if (nextProfile.id !== user.id) {
              throw new Error("The account profile does not match the authenticated user.");
            }
            setProfile(nextProfile);
            profileRef.current = nextProfile;
          } catch (error) {
            if (!isCurrent()) {
              return;
            }
            console.error("Failed to hydrate Supabase profile.", error);
            if (profileRef.current?.id !== user.id) {
              setProfile(null);
              profileRef.current = null;
            }
          } finally {
            if (isCurrent() && !signingOutRef.current) {
              setIsLoading(false);
            }
          }
        };

        const initialEventVersion = authEventVersion;
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (!active) {
            return;
          }
          authEventVersion += 1;
          const nextUserId = nextSession?.user?.id ?? null;
          const currentUserId = sessionRef.current?.user?.id ?? null;

          if (
            event === "TOKEN_REFRESHED" &&
            currentUserId === nextUserId &&
            nextUserId &&
            profileRef.current?.id === nextUserId
          ) {
            setSession(nextSession);
            sessionRef.current = nextSession;
            return;
          }

          void hydrateAuthState(nextSession, {
            foreground: shouldBlockAuthHydration(event, {
              currentUserId,
              hasProfile: Boolean(profileRef.current),
              nextUserId,
            }),
            refreshProfile: shouldRefreshProfile(event),
          });
        });
        unsubscribe = () => subscription.unsubscribe();

        try {
          const { data, error } = await supabase.auth.getSession();
          // An auth event is newer evidence than an in-flight initial session read.
          if (!active || authEventVersion !== initialEventVersion) {
            return;
          }
          if (error) {
            throw error;
          }
          await hydrateAuthState(data.session, {
            foreground: !profileRef.current,
            refreshProfile: true,
          });
        } catch (error) {
          if (active && authEventVersion === initialEventVersion) {
            throw error;
          }
        }
      })
      .catch((error) => {
        if (!active || authEventVersion > 0) {
          return;
        }
        console.error("Failed to hydrate Supabase session.", error);
        hydrationGenerationRef.current += 1;
        sessionRef.current = null;
        profileRef.current = null;
        saveQueue.setAccount(null);
        setSession(null);
        setProfile(null);
        setIsLoading(false);
      });

    return () => {
      active = false;
      hydrationGenerationRef.current += 1;
      saveQueue.setAccount(null);
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: profile?.id === session?.user.id ? profile : null,
      isConfigured: isSupabaseConfigured,
      isLoading,
      validateSession, sessionCheckMessage,
      signIn: async (email, password) => {
        const supabase = await loadSupabaseClient();
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
        const supabase = await loadSupabaseClient();
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
      signUp: async (email, password, fullName) => {
        const supabase = await loadSupabaseClient();
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
            },
          },
        });

        if (error) {
          setIsLoading(false);
          throw error;
        }
      },
      signOut: async () => {
        const departingUserId = sessionRef.current?.user.id ?? null;
        hydrationGenerationRef.current += 1;
        signingOutRef.current = true;
        setIsLoading(true);
        try {
          if (typeof window !== "undefined") {
            const detail = { promises: [] as Promise<unknown>[] };
            window.dispatchEvent(new CustomEvent(NOTE_SAVE_BEFORE_SIGN_OUT_EVENT, { detail }));
            await Promise.allSettled(detail.promises);
          }
          if ((sessionRef.current?.user.id ?? null) !== departingUserId) {
            return;
          }
          if (isSupabaseConfigured) {
            const supabase = await loadSupabaseClient();
            if ((sessionRef.current?.user.id ?? null) !== departingUserId) {
              return;
            }
            if (supabase) {
              const { error } = await supabase.auth.signOut();
              if (error) {
                throw error;
              }
            }
          }
          const currentUserId = sessionRef.current?.user.id ?? null;
          if (currentUserId && currentUserId !== departingUserId) {
            return;
          }
          hydrationGenerationRef.current += 1;
          sessionRef.current = null;
          profileRef.current = null;
          saveQueue.setAccount(null);
          setSession(null);
          setProfile(null);
        } finally {
          signingOutRef.current = false;
          const currentUserId = sessionRef.current?.user.id ?? null;
          if (!currentUserId || currentUserId === departingUserId || profileRef.current?.id === currentUserId) {
            setIsLoading(false);
          }
        }
      },
    }),
    [isLoading, profile, session, validateSession, sessionCheckMessage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function createSupabaseRequiredError() {
  return new Error(
    "Supabase is required for Binder Notes accounts. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before signing in.",
  );
}

export function shouldBlockAuthHydration(
  event: AuthChangeEvent,
  context?: {
    currentUserId?: string | null;
    hasProfile?: boolean;
    nextUserId?: string | null;
  },
) {
  if (
    event === "SIGNED_IN" &&
    context?.hasProfile &&
    context.currentUserId &&
    context.currentUserId === context.nextUserId
  ) {
    return false;
  }

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
