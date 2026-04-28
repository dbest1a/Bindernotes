import { FormEvent, ReactNode, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AlertCircle, BookOpenCheck, FunctionSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { LogoMark } from "@/components/ui/logo-mark";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2).optional().or(z.literal("")),
});

export function AuthPage() {
  const { profile, signIn, signInWithGoogle, signUp, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const authDisabled = !isConfigured || isSubmitting;

  if (profile) {
    return <Navigate replace to={nextPath} />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const values = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
    };

    const parsed = authSchema.safeParse(values);
    if (!parsed.success) {
      setError("Use a valid email and a password with at least 6 characters.");
      setIsSubmitting(false);
      return;
    }

    try {
      if (mode === "login") {
        await signIn(parsed.data.email, parsed.data.password);
      } else {
        await signUp(
          parsed.data.email,
          parsed.data.password,
          parsed.data.fullName || parsed.data.email.split("@")[0],
          "learner",
        );
      }
      navigate(nextPath, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitGoogle = async () => {
    setError("");
    setIsGoogleSubmitting(true);

    try {
      await signInWithGoogle(nextPath);
    } catch (caught) {
      setError(formatGoogleAuthError(caught));
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-foreground text-background lg:block">
        <img
          alt=""
          className="h-full w-full object-cover opacity-45"
          src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=82"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/30 via-foreground/55 to-foreground/88" />
        <div className="absolute inset-0 flex flex-col justify-between p-10">
          <div className="flex items-center gap-3">
            <LogoMark className="bg-background text-foreground" />
            <div className="leading-none">
              <p className="text-sm font-semibold">Binder Notes</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-background/60">
                Study workspace
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <Badge className="bg-background text-foreground">Focused in under 30 seconds</Badge>
            <h1 className="mt-5 text-5xl font-semibold leading-[0.95] tracking-tight">
              Notes that feel ready before the setup work starts.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-background/78">
              Built for students who need a calm place to read, annotate, derive, and keep their
              own thinking clearly separate from the source material.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <FeaturePill icon={<BookOpenCheck data-icon="inline-start" />} label="Structured binders" />
              <FeaturePill icon={<FunctionSquare data-icon="inline-start" />} label="Math-first notes" />
              <FeaturePill icon={<Sparkles data-icon="inline-start" />} label="Workspace presets" />
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Badge className="w-fit" variant="outline">
              {isConfigured ? "Supabase Auth" : "Auth setup required"}
            </Badge>
            <CardTitle className="text-3xl sm:text-4xl">Open Binder Notes</CardTitle>
            <CardDescription>
              Sign in with email and password or Google. Your workspace is tied to your Supabase
              account so notes, highlights, and layouts stay with you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConfigured ? (
              <p className="mb-5 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 shrink-0" data-icon="inline-start" />
                <span>
                  <strong className="block">Supabase configuration required</strong>
                  Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before account sign-in can run.
                </span>
              </p>
            ) : null}

            <TabsList className="mb-5 w-full">
              <TabsTrigger active={mode === "login"} className="flex-1" onClick={() => setMode("login")}>
                Login
              </TabsTrigger>
              <TabsTrigger active={mode === "signup"} className="flex-1" onClick={() => setMode("signup")}>
                Signup
              </TabsTrigger>
            </TabsList>

            <form
              autoComplete="on"
              className="flex flex-col gap-4"
              data-form-type={mode === "login" ? "login" : "register"}
              id="bindernotes-auth-form"
              method="post"
              onSubmit={submit}
            >
              {mode === "signup" ? (
                <div className="flex flex-col gap-2 text-sm font-medium">
                  <label htmlFor="auth-full-name">Full name</label>
                  <Input
                    autoComplete="name"
                    disabled={!isConfigured}
                    id="auth-full-name"
                    name="fullName"
                    placeholder="Ada Lovelace"
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-2 text-sm font-medium">
                <label htmlFor="auth-email">Email</label>
                <Input
                  autoCapitalize="none"
                  autoComplete="username"
                  disabled={!isConfigured}
                  id="auth-email"
                  inputMode="email"
                  name="email"
                  placeholder="you@example.com"
                  spellCheck={false}
                  type="email"
                />
              </div>
              <div className="flex flex-col gap-2 text-sm font-medium">
                <label htmlFor="auth-password">Password</label>
                <Input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  disabled={!isConfigured}
                  id="auth-password"
                  name="password"
                  placeholder="Enter your password"
                  type="password"
                />
              </div>

              {mode === "signup" && isConfigured ? (
                <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  New accounts start as learners. Promote admins from the Supabase SQL editor.
                </p>
              ) : null}

              {error ? (
                <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle data-icon="inline-start" />
                  {error}
                </p>
              ) : null}

              <Button disabled={authDisabled} type="submit">
                {isSubmitting ? "Working..." : mode === "login" ? "Login" : "Create account"}
              </Button>
            </form>

            {isConfigured ? (
              <>
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/70" />
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Or continue with
                  </span>
                  <div className="h-px flex-1 bg-border/70" />
                </div>
                <Button
                  className="w-full"
                  disabled={isSubmitting || isGoogleSubmitting}
                  onClick={submitGoogle}
                  type="button"
                  variant="outline"
                >
                  <GoogleMark />
                  {isGoogleSubmitting ? "Redirecting to Google..." : "Continue with Google"}
                </Button>
              </>
            ) : null}

          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}

function FeaturePill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-background/14 bg-background/8 px-4 py-3 text-sm text-background/82 backdrop-blur">
      <div className="mb-2 text-background/70">{icon}</div>
      <p className="font-medium">{label}</p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
    >
      <path
        d="M21.805 12.23c0-.76-.068-1.49-.195-2.19H12v4.146h5.498a4.7 4.7 0 0 1-2.037 3.082v2.557h3.296c1.93-1.777 3.048-4.396 3.048-7.595Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.754 0 5.064-.913 6.752-2.475l-3.296-2.557c-.914.613-2.083.975-3.456.975-2.654 0-4.904-1.792-5.708-4.2H2.884v2.638A10.19 10.19 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.292 13.743A6.12 6.12 0 0 1 5.973 12c0-.606.11-1.193.319-1.743V7.619H2.884A10.19 10.19 0 0 0 1.818 12c0 1.644.393 3.202 1.066 4.381l3.408-2.638Z"
        fill="#FBBC04"
      />
      <path
        d="M12 6.057c1.5 0 2.845.516 3.904 1.53l2.929-2.93C17.059 3.012 14.749 2 12 2 7.89 2 4.346 4.355 2.884 7.619l3.408 2.638c.804-2.408 3.054-4.2 5.708-4.2Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function formatGoogleAuthError(caught: unknown) {
  const fallback = "Google sign-in could not start right now.";
  const message = caught instanceof Error ? caught.message : fallback;

  if (message.toLowerCase().includes("provider is not enabled")) {
    return "Google sign-in is wired in the app, but the Supabase Google provider still needs its client ID and secret.";
  }

  return message;
}
