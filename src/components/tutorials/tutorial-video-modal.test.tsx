// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TutorialVideoModal } from "@/components/tutorials/tutorial-video-modal";
import type { TutorialEntry } from "@/lib/tutorials/tutorial-registry";

const baseTutorial: TutorialEntry = {
  id: "uploaded-dashboard",
  title: "Uploaded Dashboard Tutorial",
  audience: "all",
  category: "Dashboard",
  routePatterns: ["/dashboard"],
  promptRoutePatterns: ["/dashboard"],
  tags: ["dashboard"],
  summary: "A real uploaded tutorial.",
  duration: "0:42",
  durationSeconds: 42,
  videoSrc: "https://example.com/tutorial.mp4",
  posterSrc: "/tutorials/posters/bindernotes-tutorial-poster.svg",
  status: "published",
  steps: ["Open Dashboard"],
  transcript: "Dashboard walkthrough transcript.",
  relatedFeatureLink: "/dashboard",
};

function renderModal(tutorial: TutorialEntry) {
  return render(
    <MemoryRouter>
      <TutorialVideoModal onClose={vi.fn()} open tutorial={tutorial} />
    </MemoryRouter>,
  );
}

describe("TutorialVideoModal", () => {
  afterEach(() => cleanup());

  it("renders an uploaded video instead of the missing-upload fallback", () => {
    renderModal(baseTutorial);

    const dialog = screen.getByRole("dialog");
    const video = dialog.querySelector("video");

    expect(video).toBeTruthy();
    expect(screen.queryByText("No tutorial video has been uploaded yet.")).toBeNull();
  });

  it("explains playback failures without claiming the video was not uploaded", () => {
    renderModal(baseTutorial);

    fireEvent.error(document.querySelector("video") as HTMLVideoElement);

    expect(screen.getByText("This tutorial video could not be played here.")).toBeTruthy();
    expect(screen.queryByText("No tutorial video has been uploaded yet.")).toBeNull();
    expect(screen.getByRole("link", { name: /open video file/i }).getAttribute("href")).toBe(
      baseTutorial.videoSrc,
    );
  });

  it("keeps the missing-upload fallback for draft shells without video media", () => {
    renderModal({ ...baseTutorial, videoSrc: "", duration: "", durationSeconds: 0 });

    expect(screen.getByText("No tutorial video has been uploaded yet.")).toBeTruthy();
  });
});
