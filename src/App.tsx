import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Navigate,
  Outlet,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Component, Suspense, lazy, useState, type ErrorInfo, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const LazyAppShell = lazy(() =>
  import("@/components/layout/app-shell").then((module) => ({ default: module.AppShell })),
);
const LazyTutorialPromptHost = lazy(() =>
  import("@/components/tutorials/tutorial-prompt").then((module) => ({
    default: module.TutorialPromptHost,
  })),
);
const LazyUserAppearanceSync = lazy(() =>
  import("@/components/theme/user-appearance-sync").then((module) => ({
    default: module.UserAppearanceSync,
  })),
);
const LazySyncRecoveryBridge = lazy(() =>
  import("@/components/system/sync-recovery-bridge").then((module) => ({
    default: module.SyncRecoveryBridge,
  })),
);
const LandingPage = lazy(() =>
  import("@/pages/landing-page").then((module) => ({ default: module.LandingPage })),
);
const OgreDungeonRunnerPage = lazy(() =>
  import("@/pages/ogre-dungeon-runner-page").then((module) => ({ default: module.OgreDungeonRunnerPage })),
);
const AuthPage = lazy(() =>
  import("@/pages/auth-page").then((module) => ({ default: module.AuthPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((module) => ({ default: module.DashboardPage })),
);
const PersonalNotesPage = lazy(() =>
  import("@/pages/personal-notes-page").then((module) => ({ default: module.PersonalNotesPage })),
);
const FolderPage = lazy(() =>
  import("@/pages/folder-page").then((module) => ({ default: module.FolderPage })),
);
const BinderPage = lazy(() =>
  import("@/pages/binder-page").then((module) => ({ default: module.BinderPage })),
);
const MathLabPage = lazy(() =>
  import("@/pages/math-lab-page").then((module) => ({ default: module.MathLabPage })),
);
const MathWhiteboardLabPage = lazy(() =>
  import("@/pages/math-whiteboard-lab-page").then((module) => ({ default: module.MathWhiteboardLabPage })),
);
const MathLandingPage = lazy(() =>
  import("@/pages/math-learning-page").then((module) => ({ default: module.MathLandingPage })),
);
const MathCoursePage = lazy(() =>
  import("@/pages/math-learning-page").then((module) => ({ default: module.MathCoursePage })),
);
const MathModulesPage = lazy(() =>
  import("@/pages/math-learning-page").then((module) => ({ default: module.MathModulesPage })),
);
const MathModulePage = lazy(() =>
  import("@/pages/math-learning-page").then((module) => ({ default: module.MathModulePage })),
);
const MathQuestionBankPage = lazy(() =>
  import("@/pages/math-learning-page").then((module) => ({ default: module.MathQuestionBankPage })),
);
const MathQuestionEditorPage = lazy(() =>
  import("@/pages/math-learning-page").then((module) => ({ default: module.MathQuestionEditorPage })),
);
const MathQuizPage = lazy(() =>
  import("@/pages/math-learning-page").then((module) => ({ default: module.MathQuizPage })),
);
const MathQuizAttemptPage = lazy(() =>
  import("@/pages/math-learning-page").then((module) => ({ default: module.MathQuizAttemptPage })),
);
const MathQuizResultsPage = lazy(() =>
  import("@/pages/math-learning-page").then((module) => ({ default: module.MathQuizResultsPage })),
);
const BinderReaderPage = lazy(() =>
  import("@/pages/binder-reader-page").then((module) => ({ default: module.BinderReaderPage })),
);
const AdminStudioPage = lazy(() =>
  import("@/pages/admin-studio-page").then((module) => ({ default: module.AdminStudioPage })),
);
const PricingPage = lazy(() =>
  import("@/pages/pricing-page").then((module) => ({ default: module.PricingPage })),
);
const TutorialPage = lazy(() =>
  import("@/pages/tutorial-page").then((module) => ({ default: module.TutorialPage })),
);

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SignedInBackgroundServices />
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
    <RouteErrorBoundary resetKey={`${location.pathname}${location.search}`}>
      <Suspense fallback={<RouteSkeleton />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/hidden-hollow" element={<OgreDungeonRunnerPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/math/lab/whiteboard" element={<MathWhiteboardLabPage />} />
            <Route element={<LazyAppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/notes" element={<PersonalNotesPage />} />
              <Route path="/notes/:noteId" element={<PersonalNotesPage />} />
              <Route path="/notes/n/:noteId" element={<PersonalNotesPage />} />
              <Route path="/notes/binders/:personalBinderId" element={<PersonalNotesPage />} />
              <Route
                path="/notes/binders/:personalBinderId/documents/:documentId"
                element={<PersonalNotesPage />}
              />
              <Route path="/folders/:folderId" element={<FolderPage />} />
              <Route path="/binders/:binderId" element={<BinderPage />} />
              <Route path="/math" element={<MathLandingPage />} />
              <Route path="/math/lab" element={<MathLabPage />} />
              <Route path="/math/courses/:courseSlug" element={<MathCoursePage />} />
              <Route path="/math/modules" element={<MathModulesPage />} />
              <Route path="/math/modules/:moduleSlug" element={<MathModulePage />} />
              <Route path="/math/questions" element={<MathQuestionBankPage />} />
              <Route path="/math/questions/new" element={<MathQuestionEditorPage />} />
              <Route path="/math/questions/:questionId/edit" element={<MathQuestionEditorPage />} />
              <Route path="/math/quizzes/:quizId" element={<MathQuizPage />} />
              <Route path="/math/quizzes/:quizId/attempt" element={<MathQuizAttemptPage />} />
              <Route path="/math/quizzes/:quizId/results/:attemptId" element={<MathQuizResultsPage />} />
              <Route
                path="/binders/:binderId/documents/:lessonId"
                element={<BinderReaderPage />}
              />
              <Route path="/binder/:binderId" element={<LegacyBinderRoute />} />
              <Route path="/admin" element={<AdminStudioPage />} />
              <Route path="/tutorial" element={<TutorialPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

function SignedInBackgroundServices() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyUserAppearanceSync />
      <LazySyncRecoveryBridge />
    </Suspense>
  );
}

type RouteErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type RouteErrorBoundaryState = {
  error: Error | null;
};

const chunkRecoveryStorageKey = "binder-notes:chunk-recovery:v1";
const chunkRecoveryQueryParam = "bn_chunk_refresh";
const dynamicImportFailurePatterns = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "loading chunk",
  "chunkloaderror",
  "failed to load module script",
];

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message;
}

export function isDynamicImportFailure(error: unknown) {
  const message = errorMessage(error);
  const normalized = message.toLowerCase();

  return dynamicImportFailurePatterns.some((pattern) => normalized.includes(pattern));
}

export function shouldRecoverFromDynamicImportFailure(
  error: unknown,
  routeKey: string,
  storage: Storage | undefined = typeof window === "undefined" ? undefined : window.sessionStorage,
) {
  if (!isDynamicImportFailure(error) || !storage) {
    return false;
  }

  const signature = errorMessage(error).slice(0, 220);
  const key = `${chunkRecoveryStorageKey}:${routeKey}:${signature}`;
  try {
    if (storage.getItem(key) === "tried") {
      return false;
    }

    storage.setItem(key, "tried");
    return true;
  } catch {
    return false;
  }
}

export function clearChunkRecoveryAttempts(
  storage: Storage | undefined = typeof window === "undefined" ? undefined : window.sessionStorage,
) {
  if (!storage) {
    return;
  }

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(chunkRecoveryStorageKey)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => storage.removeItem(key));
  } catch {
    // Best effort only. A normal reload is still better than a stuck route.
  }
}

function chunkRecoveryUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set(chunkRecoveryQueryParam, String(Date.now()));
  return url.toString();
}

function reloadAfterDynamicImportFailure({ clearAttempts = false }: { clearAttempts?: boolean } = {}) {
  if (clearAttempts) {
    clearChunkRecoveryAttempts();
  }

  window.location.replace(chunkRecoveryUrl());
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route render failed", error, info);

    if (
      shouldRecoverFromDynamicImportFailure(
        error,
        this.props.resetKey || window.location.pathname,
      )
    ) {
      reloadAfterDynamicImportFailure();
    }
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const isChunkFailure = isDynamicImportFailure(this.state.error);

      return (
        <main className="app-page">
          <EmptyState
            description={
              isChunkFailure
                ? "BinderNotes tried to load an older page file from before the latest update. Refresh once to get the newest version."
                : this.state.error.message ||
                  "This page hit a render problem. Go back to the dashboard and reopen the binder."
            }
            title={isChunkFailure ? "This page needs a refresh" : "This page could not render"}
            action={
              isChunkFailure ? (
                <Button
                  onClick={() => reloadAfterDynamicImportFailure({ clearAttempts: true })}
                  type="button"
                >
                  Refresh page
                </Button>
              ) : null
            }
          />
        </main>
      );
    }

    return this.props.children;
  }
}

function RouteSkeleton() {
  return (
    <main className="app-loading-shell mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:px-6">
      <Skeleton className="app-loading-shell__bar h-16" />
      <Skeleton className="app-loading-shell__panel h-[520px]" />
    </main>
  );
}

function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="app-loading-shell mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:px-6">
        <Skeleton className="app-loading-shell__bar h-16" />
        <Skeleton className="app-loading-shell__panel h-[520px]" />
      </main>
    );
  }

  if (!profile) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const nextTarget = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return <Navigate replace to={`/auth${nextTarget}`} />;
  }

  return (
    <>
      <Suspense fallback={null}>
        <LazyTutorialPromptHost />
      </Suspense>
      {children ? <>{children}</> : <Outlet />}
    </>
  );
}

function LegacyBinderRoute() {
  const { binderId } = useParams();
  const [searchParams] = useSearchParams();
  const lessonId = searchParams.get("lesson");

  return (
    <Navigate
      replace
      to={lessonId ? `/binders/${binderId}/documents/${lessonId}` : `/binders/${binderId}`}
    />
  );
}
