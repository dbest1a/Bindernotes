import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { isGlobalSearchShortcut } from "@/components/search/global-search-context";

const FOCUS_CANDIDATE_SELECTOR = "a[href], button, input, select, textarea, [tabindex]";

type GlobalSearchFrameProps = {
  children: ReactNode;
  initialFocusRef: RefObject<HTMLElement | null>;
  labelledBy: string;
  onClose: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  portalTarget: HTMLElement;
};

/**
 * Modal shell shared by the loading state and the full search dialog: keeps
 * keyboard focus inside, closes on Escape, Ctrl/Cmd+K, or a backdrop press,
 * and stops page shortcuts from reacting while search is open.
 */
export function GlobalSearchFrame({
  children,
  initialFocusRef,
  labelledBy,
  onClose,
  onKeyDown,
  portalTarget,
}: GlobalSearchFrameProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pressStartedOnBackdropRef = useRef(false);

  useEffect(() => {
    initialFocusRef.current?.focus({ preventScroll: true });
  }, [initialFocusRef]);

  useEffect(() => {
    // Phone keyboards shrink the visual viewport; keep results above them.
    const viewport = window.visualViewport;
    const overlay = overlayRef.current;
    if (!viewport || !overlay) {
      return;
    }
    const sync = () => overlay.style.setProperty("--global-search-viewport-height", `${Math.round(viewport.height)}px`);
    sync();
    viewport.addEventListener("resize", sync);
    return () => viewport.removeEventListener("resize", sync);
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Escape" || isGlobalSearchShortcut(event.nativeEvent)) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      keepTabFocusInside(event, panelRef.current);
      return;
    }
    onKeyDown?.(event);
  };

  return createPortal(
    <div
      className="global-search-overlay"
      data-testid="global-search-overlay"
      onClick={(event) => {
        if (pressStartedOnBackdropRef.current && event.target === event.currentTarget) {
          onClose();
        }
        pressStartedOnBackdropRef.current = false;
      }}
      onPointerDown={(event) => {
        pressStartedOnBackdropRef.current = event.target === event.currentTarget;
      }}
      ref={overlayRef}
      role="presentation"
    >
      <div
        aria-labelledby={labelledBy}
        aria-modal="true"
        className="global-search-panel"
        data-testid="global-search-dialog"
        onFocus={(event) => {
          if (event.target === event.currentTarget) {
            initialFocusRef.current?.focus({ preventScroll: true });
          }
        }}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    portalTarget,
  );
}

export function GlobalSearchCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button aria-label="Close search" className="global-search-close" onClick={onClose} type="button">
      <span aria-hidden="true" className="global-search-close__key">
        Esc
      </span>
      <X aria-hidden="true" className="global-search-close__icon" />
    </button>
  );
}

function keepTabFocusInside(event: ReactKeyboardEvent<HTMLDivElement>, panel: HTMLElement | null) {
  if (!panel) {
    return;
  }

  // Without layout (unit tests) every candidate counts as rendered.
  const hasLayout = panel.getClientRects().length > 0;
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUS_CANDIDATE_SELECTOR)).filter((element) =>
    isTabbable(element, hasLayout),
  );
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const index = focusable.indexOf(document.activeElement as HTMLElement);
  if (event.shiftKey && index <= 0) {
    event.preventDefault();
    focusable[focusable.length - 1].focus();
  } else if (!event.shiftKey && (index === -1 || index === focusable.length - 1)) {
    event.preventDefault();
    focusable[0].focus();
  }
}

/** Result rows use tabindex=-1 (arrow keys move between them), so only real tab stops count. */
function isTabbable(element: HTMLElement, hasLayout: boolean) {
  if (element.tabIndex < 0 || element.hasAttribute("disabled")) {
    return false;
  }
  if (element.closest('[inert], [hidden], [aria-hidden="true"]')) {
    return false;
  }
  if (hasLayout && element.getClientRects().length === 0) {
    return false;
  }
  return getComputedStyle(element).visibility !== "hidden";
}
