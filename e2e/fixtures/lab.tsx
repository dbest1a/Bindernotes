// Isolated lab fixture: the real Math Lab, Math Whiteboard Lab, and chemistry modules,
// signed in as a synthetic local learner with a stubbed Supabase client. No account data.
import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { MathLabPage } from "@/pages/math-lab-page";
import { MathWhiteboardLabPage } from "@/pages/math-whiteboard-lab-page";
import { workspaceModuleRegistry } from "@/components/workspace/workspace-modules";
import { boardOnlyWhiteboardModuleIds } from "@/lib/whiteboards/whiteboard-module-registry";
import type { WorkspaceModuleId } from "@/types";
import { AuthProvider } from "./auth";
import "@/styles.css";
import "@/workspace-fit.css";

const params = new URLSearchParams(location.search);
const page = params.get("page") ?? "whiteboard";
// Board objects (the Molecule card) only show a "lives on whiteboards" notice outside a board.
const chemistryModules = Object.keys(workspaceModuleRegistry).filter(
  (id) => id.startsWith("chem-") && !boardOnlyWhiteboardModuleIds.has(id as WorkspaceModuleId),
);

function ChemistryGallery() {
  const only = params.get("module");
  const ids = only ? [only] : chemistryModules;
  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-6" data-testid="chemistry-gallery">
      {ids.map((id) => {
        const definition = (workspaceModuleRegistry as Record<string, { title: string; render: (context: unknown) => JSX.Element }>)[id];
        return (
          <section className="rounded-2xl border border-border/70 bg-card p-4" data-chem-module={id} key={id}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{definition.title}</h2>
            <Suspense fallback={<p>Loading {definition.title}…</p>}>{definition.render({})}</Suspense>
          </section>
        );
      })}
    </main>
  );
}

const path = page === "math-lab" ? "/math/lab" : page === "chemistry" ? "/chemistry" : "/math/lab/whiteboard";
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <Routes>
            <Route path="/math/lab" element={<MathLabPage />} />
            <Route path="/math/lab/whiteboard" element={<MathWhiteboardLabPage />} />
            <Route path="/chemistry" element={<ChemistryGallery />} />
            <Route path="*" element={<p data-testid="lab-fixture-navigated">Navigated away from the lab fixture.</p>} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    </AuthProvider>
  </QueryClientProvider>,
);
