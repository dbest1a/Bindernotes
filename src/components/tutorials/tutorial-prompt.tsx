import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpenCheck, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorialVideoModal } from "@/components/tutorials/tutorial-video-modal";
import { useAuth } from "@/hooks/use-auth";
import { useTutorialPrompts } from "@/hooks/use-tutorial-prompts";
import {
  findTutorialForPathname,
  tutorialSeenStorageKey,
  type TutorialEntry,
} from "@/lib/tutorials/tutorial-registry";
import { listUploadedTutorials } from "@/services/tutorial-service";

type TutorialPromptHostProps = {
  delayMs?: number;
};

export function hasSeenTutorial(tutorialId: string, storage = getTutorialStorage()) {
  if (!storage) {
    return false;
  }

  try {
    return storage.getItem(tutorialSeenStorageKey(tutorialId)) === "true";
  } catch {
    return false;
  }
}

export function markTutorialSeen(tutorialId: string, storage = getTutorialStorage()) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(tutorialSeenStorageKey(tutorialId), "true");
  } catch {
    // Storage can be unavailable in private or restricted browser modes.
  }
}

export function TutorialPromptHost({ delayMs = 900 }: TutorialPromptHostProps) {
  const { profile } = useAuth();
  const { promptsEnabled } = useTutorialPrompts(profile);
  const location = useLocation();
  const [isPromptVisible, setPromptVisible] = useState(false);
  const [activeTutorial, setActiveTutorial] = useState<TutorialEntry | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  const uploadedTutorialsQuery = useQuery({
    queryKey: ["tutorial-entries", "published-prompts"],
    queryFn: () => listUploadedTutorials(false),
    staleTime: 60_000,
  });

  const tutorialLibrary = useMemo(
    () => (uploadedTutorialsQuery.data ?? []).filter((tutorial) => tutorial.videoSrc),
    [uploadedTutorialsQuery.data],
  );

  const matchedTutorial = useMemo(() => {
    if (location.pathname === "/tutorial" || location.pathname === "/auth") {
      return null;
    }
    return findTutorialForPathname(location.pathname, tutorialLibrary, profile?.role ?? "learner");
  }, [location.pathname, profile?.role, tutorialLibrary]);

  useEffect(() => {
    setPromptVisible(false);
    setPlayerOpen(false);
    setActiveTutorial(null);

    if (!promptsEnabled || !matchedTutorial || hasSeenTutorial(matchedTutorial.id)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveTutorial(matchedTutorial);
      setPromptVisible(true);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, matchedTutorial, promptsEnabled]);

  const dismiss = useCallback(() => {
    if (activeTutorial) {
      markTutorialSeen(activeTutorial.id);
    }
    setPromptVisible(false);
  }, [activeTutorial]);

  const watchTutorial = useCallback(() => {
    if (activeTutorial) {
      markTutorialSeen(activeTutorial.id);
    }
    setPromptVisible(false);
    setPlayerOpen(true);
  }, [activeTutorial]);

  const closePlayer = useCallback(() => {
    setPlayerOpen(false);
  }, []);

  return (
    <>
      {isPromptVisible && activeTutorial ? (
        <aside
          className="fixed bottom-4 right-4 z-[75] w-[min(92vw,390px)] rounded-lg border border-border bg-card p-4 text-card-foreground shadow-2xl"
          data-testid="tutorial-prompt"
        >
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-primary/12 p-2 text-primary">
              <BookOpenCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                First time here
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">{activeTutorial.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Watch the quick tutorial for this page, or skip it and keep working.
              </p>
            </div>
            <button
              aria-label="Close tutorial prompt"
              className="rounded-md border border-border/70 p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              onClick={() => setPromptVisible(false)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={watchTutorial} size="sm" type="button">
              <Play data-icon="inline-start" />
              Watch tutorial
            </Button>
            <Button onClick={dismiss} size="sm" type="button" variant="outline">
              Skip
            </Button>
            <Button onClick={dismiss} size="sm" type="button" variant="ghost">
              Don't show again
            </Button>
            <Button asChild size="sm" type="button" variant="ghost">
              <Link onClick={dismiss} to="/tutorial">View all tutorials</Link>
            </Button>
          </div>
        </aside>
      ) : null}

      <TutorialVideoModal
        onClose={closePlayer}
        onWatched={() => activeTutorial && markTutorialSeen(activeTutorial.id)}
        open={playerOpen}
        tutorial={activeTutorial}
      />
    </>
  );
}

function getTutorialStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
