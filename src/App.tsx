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
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSyncRecovery } from "@/lib/sync-recovery";

const LandingPage = lazy(() =>
  import("@/pages/landing-page").then((module) => ({ default: module.LandingPage })),
);
const AuthPage = lazy(() =>
  import("@/pages/auth-page").then((module) => ({ default: module.AuthPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((module) => ({ default: module.DashboardPage })),
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
          <SyncRecoveryBridge />
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
          <Route path="/auth" element={<AuthPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/folders/:folderId" element={<FolderPage />} />
              <Route path="/binders/:binderId" element={<BinderPage />} />
              <Route path="/math" element={<MathLabPage />} />
              <Route
                path="/binders/:binderId/documents/:lessonId"
                element={<BinderReaderPage />}
              />
              <Route path="/binder/:binderId" element={<LegacyBinderRoute />} />
              <Route path="/admin" element={<AdminStudioPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/tutorial" element={<TutorialPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

function SyncRecoveryBridge() {
  useSyncRecovery([
    "highlight",
    "workspace_layout",
    "history_event",
    "history_source",
    "history_evidence",
    "history_argument",
    "myth_check",
  ]);

  return null;
}

type RouteErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type RouteErrorBoundaryState = {
  error: Error | null;
};

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route render failed", error, info);
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-page">
          <EmptyState
            description={
              this.state.error.message ||
              "This page hit a render problem. Go back to the dashboard and reopen the binder."
            }
            title="This page could not render"
          />
        </main>
      );
    }

    return this.props.children;
  }
}

function RouteSkeleton() {
  return (
    <main className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:px-6">
      <Skeleton className="h-16" />
      <Skeleton className="h-[520px]" />
    </main>
  );
}

function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-16" />
        <Skeleton className="h-[520px]" />
      </main>
    );
  }

  if (!profile) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const nextTarget = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return <Navigate replace to={`/auth${nextTarget}`} />;
  }

  return children ? <>{children}</> : <Outlet />;
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
