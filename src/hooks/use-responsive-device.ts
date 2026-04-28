import { useEffect, useState } from "react";

export type ViewportCategory = "phone" | "tablet" | "desktop";

export type ResponsiveDeviceSnapshot = {
  category: ViewportCategory;
  hasCoarsePointer: boolean;
  isDesktop: boolean;
  isPhone: boolean;
  isTablet: boolean;
  prefersReducedMotion: boolean;
};

const PHONE_QUERY = "(max-width: 767px)";
const TABLET_QUERY = "(min-width: 768px) and (max-width: 1180px)";
const DESKTOP_QUERY = "(min-width: 1181px)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type ResponsiveMediaQuery = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

export function getViewportCategory(width: number): ViewportCategory {
  if (width <= 767) {
    return "phone";
  }

  if (width <= 1180) {
    return "tablet";
  }

  return "desktop";
}

export function useViewportCategory() {
  return useResponsiveDevice().category;
}

export function useResponsiveDevice(): ResponsiveDeviceSnapshot {
  const [snapshot, setSnapshot] = useState<ResponsiveDeviceSnapshot>(() =>
    readResponsiveDeviceSnapshot(),
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueries = [
      window.matchMedia(PHONE_QUERY),
      window.matchMedia(TABLET_QUERY),
      window.matchMedia(DESKTOP_QUERY),
      window.matchMedia(COARSE_POINTER_QUERY),
      window.matchMedia(REDUCED_MOTION_QUERY),
    ] as ResponsiveMediaQuery[];

    const updateSnapshot = () => {
      setSnapshot(readResponsiveDeviceSnapshot(mediaQueries));
    };

    mediaQueries.forEach((mediaQuery) => {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", updateSnapshot);
        return;
      }

      mediaQuery.addListener?.(updateSnapshot);
    });

    updateSnapshot();

    return () => {
      mediaQueries.forEach((mediaQuery) => {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", updateSnapshot);
          return;
        }

        mediaQuery.removeListener?.(updateSnapshot);
      });
    };
  }, []);

  return snapshot;
}

function readResponsiveDeviceSnapshot(
  existingQueries?: ResponsiveMediaQuery[],
): ResponsiveDeviceSnapshot {
  const queries =
    existingQueries ??
    (typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? ([
          window.matchMedia(PHONE_QUERY),
          window.matchMedia(TABLET_QUERY),
          window.matchMedia(DESKTOP_QUERY),
          window.matchMedia(COARSE_POINTER_QUERY),
          window.matchMedia(REDUCED_MOTION_QUERY),
        ] as ResponsiveMediaQuery[])
      : []);

  const [phoneQuery, tabletQuery, desktopQuery, coarsePointerQuery, reducedMotionQuery] = queries;
  const hasViewportWidth =
    typeof window !== "undefined" && Number.isFinite(window.innerWidth);
  let category = hasViewportWidth ? getViewportCategory(window.innerWidth) : "desktop";

  if (!hasViewportWidth) {
    if (phoneQuery?.matches) {
      category = "phone";
    } else if (tabletQuery?.matches) {
      category = "tablet";
    } else if (desktopQuery?.matches) {
      category = "desktop";
    }
  }

  return {
    category,
    hasCoarsePointer: Boolean(coarsePointerQuery?.matches),
    isDesktop: category === "desktop",
    isPhone: category === "phone",
    isTablet: category === "tablet",
    prefersReducedMotion: Boolean(reducedMotionQuery?.matches),
  };
}
