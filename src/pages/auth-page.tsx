import { FormEvent, ReactNode, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AlertCircle, BookOpenCheck, FunctionSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { LogoMark } from "@/components/ui/logo-mark";

type AuthMode = "login" | "signup" | "recovery" | "update-password";

export function AuthPage() {
  const { profile, session, signIn, signInWithGoogle, signUp, requestPasswordReset, resendConfirmation, updatePassword, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const [mode, setMode] = useState<AuthMode>(requestedMode === "signup" || requestedMode === "recovery" || requestedMode === "update-password" ? requestedMode : "login");
  const [error, setError] = useState(() => searchParams.get("error_description") ?? new URLSearchParams(window.location.hash.slice(1)).get("error_description") ?? "");
  const [notice, setNotice] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const authDisabled = !isConfigured || isSubmitting || isGoogleSubmitting;

  if (profile && mode !== "update-password") return <Navigate replace to={nextPath} />;

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
    setConfirmationEmail("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authDisabled) return;
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();
    if (mode !== "update-password" && !z.string().email().safeParse(email).success) {
      setError("Enter a valid email address."); return;
    }
    if (mode !== "recovery" && password.length < (mode === "login" ? 1 : 6)) {
      setError(mode === "login" ? "Enter your password." : "Use a password with at least 6 characters."); return;
    }
    setIsSubmitting(true);
    try {
      if (mode === "recovery") {
        await requestPasswordReset(email);
        setNotice("If an account uses this email, a password reset link will arrive shortly. Check your inbox and spam folder.");
        return;
      }
      if (mode === "update-password") {
        if (!session) throw new Error("Open the password reset link from your email before choosing a new password.");
        await updatePassword(password);
      } else if (mode === "login") {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password, fullName || email.split("@")[0], "learner", nextPath);
        if (result.confirmationRequired) {
          setConfirmationEmail(email);
          setNotice("Check your email to confirm your account. Open the confirmation link, then return to your workspace.");
          return;
        }
      }
      navigate(nextPath, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resend = async () => {
    setError(""); setIsSubmitting(true);
    try {
      await resendConfirmation(confirmationEmail, nextPath);
      setNotice("Confirmation email requested. Check your inbox and spam folder before requesting another.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not resend the confirmation email."); }
    finally { setIsSubmitting(false); }
  };

  const submitGoogle = async () => {
    setError(""); setIsGoogleSubmitting(true);
    try { await signInWithGoogle(nextPath); }
    catch (caught) { setError(formatGoogleAuthError(caught)); setIsGoogleSubmitting(false); }
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
              {isConfigured ? "Your study workspace" : "Account sign-in unavailable"}
            </Badge>
            <CardTitle className="text-3xl sm:text-4xl">{mode === "signup" ? "Create your account" : mode === "recovery" ? "Reset your password" : mode === "update-password" ? "Choose a new password" : "Welcome back"}</CardTitle>
            <CardDescription>
              Read a lesson, keep your private notes beside it, and return to your saved work.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConfigured ? (
              <p
                className="mb-5 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-auth-config-missing="true"
              >
                <AlertCircle className="mt-0.5 shrink-0" data-icon="inline-start" />
                <span>
                  <strong className="block">Account sign-in is not ready</strong>
                  Account access is temporarily unavailable. You can still read the quick start below.
                </span>
              </p>
            ) : null}

            <TabsList aria-label="Account access" className="mb-5 w-full">
              <TabsTrigger active={mode === "login"} className="flex-1" disabled={isSubmitting || isGoogleSubmitting} onClick={() => changeMode("login")}>
                Login
              </TabsTrigger>
              <TabsTrigger active={mode === "signup"} className="flex-1" disabled={isSubmitting || isGoogleSubmitting} onClick={() => changeMode("signup")}>
                Signup
              </TabsTrigger>
            </TabsList>

            <form
              autoComplete="on"
              className="flex flex-col gap-4"
              data-form-type={mode === "login" ? "login" : "register"}
              id="bindernotes-auth-form"
              method="post"
              onChange={() => setError("")}
              onSubmit={submit}
            >
              {mode === "signup" ? (
                <div className="flex flex-col gap-2 text-sm font-medium">
                  <label htmlFor="auth-full-name">Full name</label>
                  <Input
                    autoComplete="name"
                    disabled={authDisabled || Boolean(confirmationEmail)}
                    id="auth-full-name"
                    name="fullName"
                    placeholder="Ada Lovelace"
                  />
                </div>
              ) : null}
              {mode !== "update-password" ? <div className="flex flex-col gap-2 text-sm font-medium">
                <label htmlFor="auth-email">Email</label>
                <Input
                  autoCapitalize="none"
                  autoComplete="username"
                  disabled={authDisabled || Boolean(confirmationEmail)}
                  id="auth-email"
                  inputMode="email"
                  name="email"
                  placeholder="you@example.com"
                  spellCheck={false}
                  type="email"
                />
              </div> : null}
              {mode !== "recovery" ? <div className="flex flex-col gap-2 text-sm font-medium">
                <label htmlFor="auth-password">Password</label>
                <Input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  disabled={authDisabled || Boolean(confirmationEmail)}
                  id="auth-password"
                  name="password"
                  aria-describedby={mode !== "login" ? "password-hint" : undefined}
                  placeholder={mode === "login" ? "Enter your password" : "Create a password"}
                  type="password"
                />
              </div> : null}

              {mode === "signup" || mode === "update-password" ? <p id="password-hint" className="text-xs text-muted-foreground">Use at least 6 characters. Choose a unique password you do not use elsewhere.</p> : null}
              {mode === "login" ? <button className="self-start text-sm text-primary underline" type="button" onClick={() => changeMode("recovery")}>Forgot password?</button> : null}
              {notice ? <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{notice}</p> : null}
              {confirmationEmail ? <Button disabled={authDisabled} onClick={() => void resend()} type="button" variant="outline">Resend confirmation email</Button> : null}

              {error ? (
                <p role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle data-icon="inline-start" />
                  {error}
                </p>
              ) : null}

              {confirmationEmail ? <button className="self-start text-sm text-primary underline" type="button" onClick={() => changeMode("signup")}>Use a different email</button> : <Button disabled={authDisabled} type="submit">
                {isSubmitting ? "Working…" : mode === "login" ? "Login" : mode === "recovery" ? "Send reset link" : mode === "update-password" ? "Save new password" : "Create account"}
              </Button>}
            </form>

            {isConfigured && (mode === "login" || mode === "signup") ? (
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

            <nav aria-label="Account help" className="mt-5 flex flex-wrap gap-4 text-sm text-primary underline"><Link to="/tutorial">Quick start</Link><Link to="/help">Help</Link><Link to="/help#privacy">Privacy & terms</Link><Link to="/pricing">Current offer</Link></nav>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) {
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
    return "Google sign-in is currently unavailable. Please use email and password.";
  }

  return message;
}
