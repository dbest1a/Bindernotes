// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getViewportCategory,
  useResponsiveDevice,
  type ResponsiveDeviceSnapshot,
} from "@/hooks/use-responsive-device";

type MatchMediaListener = (event: MediaQueryListEvent) => void;

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("responsive device detection", () => {
  it("classifies phone, tablet, and desktop widths at the product breakpoints", () => {
    expect(getViewportCategory(360)).toBe("phone");
    expect(getViewportCategory(767)).toBe("phone");
    expect(getViewportCategory(768)).toBe("tablet");
    expect(getViewportCategory(1180)).toBe("tablet");
    expect(getViewportCategory(1181)).toBe("desktop");
    expect(getViewportCategory(1440)).toBe("desktop");
  });

  it("detects coarse pointers and reduced motion through matchMedia", () => {
    const listeners: MatchMediaListener[] = [];
    stubMatchMedia((query) => {
      if (query === "(pointer: coarse)") {
        return true;
      }
      if (query === "(prefers-reduced-motion: reduce)") {
        return true;
      }
      return query === "(max-width: 767px)";
    }, listeners);
    setViewportWidth(390);

    const { result } = renderHook(() => useResponsiveDevice());

    expect(result.current).toEqual(
      expect.objectContaining<Partial<ResponsiveDeviceSnapshot>>({
        category: "phone",
        isPhone: true,
        isTablet: false,
        isDesktop: false,
        hasCoarsePointer: true,
        prefersReducedMotion: true,
      }),
    );
  });

  it("updates category when viewport media queries change without resize polling", () => {
    const listeners: MatchMediaListener[] = [];
    let width = 1181;
    stubMatchMedia((query) => {
      if (query === "(max-width: 767px)") {
        return width <= 767;
      }
      if (query === "(min-width: 768px) and (max-width: 1180px)") {
        return width >= 768 && width <= 1180;
      }
      if (query === "(min-width: 1181px)") {
        return width > 1180;
      }
      return false;
    }, listeners);
    setViewportWidth(width);
    const addEventListener = vi.spyOn(window, "addEventListener");

    const { result } = renderHook(() => useResponsiveDevice());
    expect(result.current.category).toBe("desktop");

    act(() => {
      width = 820;
      setViewportWidth(width);
      listeners.forEach((listener) =>
        listener({ matches: true, media: "(min-width: 768px) and (max-width: 1180px)" } as MediaQueryListEvent),
      );
    });

    expect(result.current.category).toBe("tablet");
    expect(addEventListener).not.toHaveBeenCalledWith("resize", expect.any(Function));
  });
});

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

function stubMatchMedia(
  matchesForQuery: (query: string) => boolean,
  listeners: MatchMediaListener[],
) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matchesForQuery(query),
    media: query,
    onchange: null,
    addEventListener: (_event: "change", listener: MatchMediaListener) => {
      listeners.push(listener);
    },
    removeEventListener: (_event: "change", listener: MatchMediaListener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },
    addListener: (listener: MatchMediaListener) => {
      listeners.push(listener);
    },
    removeListener: (listener: MatchMediaListener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },
    dispatchEvent: () => false,
  }));
}
