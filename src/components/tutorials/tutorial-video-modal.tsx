import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, FileText, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TutorialEntry } from "@/lib/tutorials/tutorial-registry";

type TutorialVideoModalProps = {
  onClose: () => void;
  onWatched?: () => void;
  open: boolean;
  tutorial: TutorialEntry | null;
};

export function TutorialVideoModal({
  onClose,
  onWatched,
  open,
  tutorial,
}: TutorialVideoModalProps) {
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setVideoError(false);
  }, [tutorial?.id, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open || !tutorial) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[90] grid place-items-center bg-background/82 px-3 py-4 backdrop-blur-sm"
      data-testid="tutorial-video-modal"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {tutorial.category}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{tutorial.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {tutorial.summary}
            </p>
          </div>
          <button
            aria-label="Close tutorial"
            className="rounded-md border border-border/70 p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.7fr)]">
            <div className="overflow-hidden rounded-lg border border-border/70 bg-background/85">
              {videoError || !tutorial.videoSrc ? (
                <div
                  className="grid min-h-[320px] place-items-center p-8 text-center"
                  data-testid="tutorial-video-fallback"
                >
                  <div>
                    <Play className="mx-auto size-10 text-primary" />
                    <h3 className="mt-4 text-lg font-semibold">No tutorial video has been uploaded yet.</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      This slot is ready for the real tutorial upload. The steps, transcript, and feature link are still available.
                    </p>
                  </div>
                </div>
              ) : (
                <video
                  className="aspect-video w-full bg-background"
                  controls
                  onCanPlay={onWatched}
                  onError={() => setVideoError(true)}
                  poster={tutorial.posterSrc}
                  preload="metadata"
                  src={tutorial.videoSrc}
                >
                  <track kind="captions" label="English" srcLang="en" />
                </video>
              )}
            </div>

            <aside className="rounded-lg border border-border/70 bg-background/72 p-4">
              {tutorial.videoSrc && tutorial.duration ? (
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="size-4 text-primary" />
                  {tutorial.duration}
                </div>
              ) : null}
              <Button asChild className="mt-4 w-full" type="button">
                <Link to={tutorial.relatedFeatureLink} onClick={onClose}>
                  Open this feature
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <div className="mt-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-primary" />
                  Steps
                </h3>
                <ol className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
                  {tutorial.steps.map((step) => (
                    <li className="rounded-md border border-border/60 bg-card/70 p-3" key={step}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>

          <section className="mt-4 rounded-lg border border-border/70 bg-background/72 p-4">
            <h3 className="text-sm font-semibold">Transcript</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{tutorial.transcript}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
