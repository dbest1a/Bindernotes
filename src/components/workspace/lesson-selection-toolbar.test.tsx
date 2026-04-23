// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { buildLessonContentSelector } from "@/components/workspace/lesson-content-renderer";
import { resolveToolbarPortalHost } from "@/components/workspace/lesson-selection-toolbar";

describe("lesson selection toolbar helpers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
  });

  it("builds a lesson-specific content selector", () => {
    expect(buildLessonContentSelector("lesson-rome-origins")).toBe(
      `[data-lesson-content="true"][data-lesson-id="lesson-rome-origins"]`,
    );
    expect(buildLessonContentSelector()).toBe(`[data-lesson-content="true"]`);
  });

  it("uses the document body when the lesson is not inside fullscreen", () => {
    document.body.innerHTML = `<div data-lesson-content="true" data-lesson-id="lesson-1"></div>`;

    expect(resolveToolbarPortalHost(buildLessonContentSelector("lesson-1"))).toBe(document.body);
  });

  it("uses the fullscreen host when the lesson surface is inside it", () => {
    const fullscreenHost = document.createElement("section");
    const lessonRoot = document.createElement("div");
    lessonRoot.setAttribute("data-lesson-content", "true");
    lessonRoot.setAttribute("data-lesson-id", "lesson-1");
    fullscreenHost.appendChild(lessonRoot);
    document.body.appendChild(fullscreenHost);

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: fullscreenHost,
    });

    expect(resolveToolbarPortalHost(buildLessonContentSelector("lesson-1"))).toBe(fullscreenHost);
  });
});
