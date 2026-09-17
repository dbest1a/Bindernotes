import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "@/lib/telemetry-runtime";

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

type AuthenticatedAppProvidersProps = {
  children: ReactNode;
};

export function AuthenticatedAppProviders({ children }: AuthenticatedAppProvidersProps) {
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

  useEffect(
    () => () => {
      void queryClient.cancelQueries();
      queryClient.clear();
    },
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Suspense fallback={null}>
          <LazyUserAppearanceSync />
          <LazySyncRecoveryBridge />
        </Suspense>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
