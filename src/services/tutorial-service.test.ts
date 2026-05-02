// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import {
  createUploadedTutorial,
  normalizeInternalTutorialLink,
} from "@/services/tutorial-service";

const validTutorialInput = {
  id: "safe-tutorial",
  title: "Safe tutorial",
  audience: "all" as const,
  category: "Dashboard" as const,
  routePatterns: ["/dashboard"],
  promptRoutePatterns: ["/dashboard"],
  tags: ["dashboard"],
  summary: "A tutorial.",
  durationSeconds: 10,
  steps: ["Open Dashboard"],
  transcript: "Transcript",
  relatedFeatureLink: "/dashboard",
  status: "published" as const,
};

describe("tutorial service security hardening", () => {
  it("keeps tutorial feature links app-relative", () => {
    expect(normalizeInternalTutorialLink("/dashboard?from=tutorial#top")).toBe(
      "/dashboard?from=tutorial#top",
    );
    expect(normalizeInternalTutorialLink("javascript:alert(1)")).toBe("/tutorial");
    expect(normalizeInternalTutorialLink("//evil.test/path")).toBe("/tutorial");
    expect(normalizeInternalTutorialLink("https://evil.test/path")).toBe("/tutorial");
    expect(normalizeInternalTutorialLink("/\\evil")).toBe("/tutorial");
  });

  it("rejects unexpected tutorial video MIME types before upload", async () => {
    const htmlFile = new File(["<script>alert(1)</script>"], "lesson.html", {
      type: "text/html",
    });

    await expect(
      createUploadedTutorial(validTutorialInput, htmlFile, null, "user-1"),
    ).rejects.toThrow("Tutorial video must use an allowed file type.");
  });

  it("rejects unexpected tutorial poster MIME types before upload", async () => {
    const videoFile = new File(["video"], "lesson.mp4", {
      type: "video/mp4",
    });
    const svgFile = new File(["<svg><script>alert(1)</script></svg>"], "poster.svg", {
      type: "image/svg+xml",
    });

    await expect(
      createUploadedTutorial(validTutorialInput, videoFile, svgFile, "user-1"),
    ).rejects.toThrow("Tutorial poster must use an allowed file type.");
  });
});
