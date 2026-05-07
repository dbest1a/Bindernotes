import { useEffect, useState } from "react";

export type ViewportCategory = "phone" | "tablet" | "desktop";
export type ViewportOrientation = "portrait" | "landscape";

export type ResponsiveDeviceSnapshot = {
  category: ViewportCategory;
  hasCoarsePointer: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isMobileWorkspace: boolean;
  isPhone: boolean;
  isPortrait: boolean;
  isTablet: boolean;
  isTabletLandscape: boolean;
  isTabletPortrait: boolean;
  prefersReducedMotion: boolean;
};

const PHONE_QUERY = "(max-width: 767px)";
const TABLET_QUERY = "(min-width: 768px) and (max-width: 1180px)";
const DESKTOP_QUERY = "(min-width: 1181px)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const PORTRAIT_QUERY = "(orientation: portrait)";
const LANDSCAPE_QUERY = "(orientation: landscape)";

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
      window.matchMedia(PORTRAIT_QUERY),
      window.matchMedia(LANDSCAPE_QUERY),
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
          window.matchMedia(PORTRAIT_QUERY),
          window.matchMedia(LANDSCAPE_QUERY),
        ] as ResponsiveMediaQuery[])
      : []);

  const [
    phoneQuery,
    tabletQuery,
    desktopQuery,
    coarsePointerQuery,
    reducedMotionQuery,
    portraitQuery,
    landscapeQuery,
  ] = queries;
  const hasViewportWidth =
    typeof window !== "undefined" && Number.isFinite(window.innerWidth);
  const hasViewportHeight =
    typeof window !== "undefined" && Number.isFinite(window.innerHeight);
  let category = hasViewportWidth ? getViewportCategory(window.innerWidth) : "desktop";
  let orientation: ViewportOrientation =
    hasViewportWidth && hasViewportHeight && window.innerHeight >= window.innerWidth
      ? "portrait"
      : "landscape";

  if (!hasViewportWidth) {
    if (phoneQuery?.matches) {
      category = "phone";
    } else if (tabletQuery?.matches) {
      category = "tablet";
    } else if (desktopQuery?.matches) {
      category = "desktop";
    }
  }

  if (!hasViewportWidth || !hasViewportHeight) {
    if (portraitQuery?.matches) {
      orientation = "portrait";
    } else if (landscapeQuery?.matches) {
      orientation = "landscape";
    }
  }

  const isPhone = category === "phone";
  const isTablet = category === "tablet";
  const isPortrait = orientation === "portrait";
  const isLandscape = orientation === "landscape";
  const isTabletPortrait = isTablet && isPortrait;
  const isTabletLandscape = isTablet && isLandscape;

  return {
    category,
    hasCoarsePointer: Boolean(coarsePointerQuery?.matches),
    isDesktop: category === "desktop",
    isLandscape,
    isMobileWorkspace: isPhone || isTabletPortrait,
    isPhone,
    isPortrait,
    isTablet,
    isTabletLandscape,
    isTabletPortrait,
    prefersReducedMotion: Boolean(reducedMotionQuery?.matches),
  };
}
