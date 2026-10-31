import "./global-search.css";
import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { GlobalSearchCloseButton, GlobalSearchFrame } from "@/components/search/global-search-frame";
import {
  GlobalSearchContext,
  isGlobalSearchShortcut,
  useGlobalSearch,
  type GlobalSearchAction,
  type GlobalSearchController,
  type GlobalSearchPage,
  type GlobalSearchPageRegistration,
} from "@/components/search/global-search-context";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

type DialogModule = typeof import("@/components/search/global-search-dialog");

let dialogModulePromise: Promise<DialogModule> | null = null;

/** Starts downloading the search dialog, for example when a pointer approaches the trigger. */
export function preloadGlobalSearch() {
  dialogModulePromise ??= import("@/components/search/global-search-dialog").catch((error: unknown) => {
    // Let the next attempt download again instead of caching a failed chunk forever.
    dialogModulePromise = null;
    throw error;
  });
  return dialogModulePromise;
}

function createLazyDialog() {
  return lazy(() => preloadGlobalSearch().then((module) => ({ default: module.GlobalSearchDialog })));
}

let LazyGlobalSearchDialog = createLazyDialog();

type SearchSession = {
  id: number;
  portalTarget: HTMLElement;
};

type GlobalSearchProviderProps = {
  actions?: readonly GlobalSearchAction[];
  children: ReactNode;
  /** Lets the shell close its own menus before search takes over the screen. */
  onBeforeOpen?: () => void;
  pages?: readonly GlobalSearchPage[];
  profile: Profile | null;
};

const noActions: readonly GlobalSearchAction[] = [];
const noPages: readonly GlobalSearchPage[] = [];

export function GlobalSearchProvider({
  actions = noActions,
  children,
  onBeforeOpen,
  pages = noPages,
  profile,
}: GlobalSearchProviderProps) {
  const enabled = Boolean(profile);
  const location = useLocation();
  const navigationType = useNavigationType();
  const [session, setSession] = useState<SearchSession | null>(null);
  const [registrations, setRegistrations] = useState<
    ReadonlyArray<{ token: object; registration: GlobalSearchPageRegistration }>
  >([]);
  const registrationsRef = useRef(registrations);
  const onBeforeOpenRef = useRef(onBeforeOpen);
  const isOpenRef = useRef(false);
  const sessionCountRef = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const draftQueryRef = useRef("");
  const isOpen = session !== null;

  useLayoutEffect(() => {
    registrationsRef.current = registrations;
    onBeforeOpenRef.current = onBeforeOpen;
  });

  const open = useCallback(
    (options?: { query?: string }) => {
      if (!enabled || isOpenRef.current) {
        return;
      }
      const activeElement = document.activeElement;
      returnFocusRef.current =
        activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null;
      onBeforeOpenRef.current?.();
      for (const { registration } of registrationsRef.current) {
        registration.onSearchOpen?.();
      }
      draftQueryRef.current = options?.query ?? "";
      isOpenRef.current = true;
      sessionCountRef.current += 1;
      void preloadGlobalSearch().catch(() => undefined);
      setSession({
        id: sessionCountRef.current,
        // Browser fullscreen only shows the fullscreen element, so search must render inside it.
        portalTarget: document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : document.body,
      });
    },
    [enabled],
  );

  const closeThen = useCallback((afterClose?: () => void) => {
    if (!isOpenRef.current) {
      return;
    }
    afterCloseRef.current = afterClose ?? null;
    isOpenRef.current = false;
    setSession(null);
  }, []);

  const close = useCallback(() => closeThen(), [closeThen]);

  useEffect(() => {
    if (isOpen) {
      return;
    }
    const returnTarget = returnFocusRef.current;
    const afterClose = afterCloseRef.current;
    returnFocusRef.current = null;
    afterCloseRef.current = null;
    // Only put focus back if closing left it nowhere (navigation may have focused something new).
    if (returnTarget?.isConnected && (!document.activeElement || document.activeElement === document.body)) {
      returnTarget.focus({ preventScroll: true });
    }
    afterClose?.();
  }, [isOpen]);

  useEffect(() => {
    // Browser back/forward while searching: get out of the way of the page being restored.
    if (navigationType === "POP") {
      close();
    }
  }, [close, location.key, navigationType]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isGlobalSearchShortcut(event) || event.defaultPrevented || event.isComposing) {
        return;
      }
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      if (isOpenRef.current) {
        close();
        return;
      }
      // Settings and other true modals keep the keyboard until they close.
      const activeElement = document.activeElement;
      if (activeElement instanceof Element && activeElement.closest('[aria-modal="true"]')) {
        return;
      }
      open();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, enabled, open]);

  const registerPage = useCallback((registration: GlobalSearchPageRegistration) => {
    const token = {};
    setRegistrations((current) => [...current, { token, registration }]);
    return () => setRegistrations((current) => current.filter((entry) => entry.token !== token));
  }, []);

  const controller = useMemo<GlobalSearchController | null>(
    () => (enabled ? { close, open, registerPage } : null),
    [close, enabled, open, registerPage],
  );
  const pageCommands = useMemo(
    () => registrations.flatMap((entry) => entry.registration.commands),
    [registrations],
  );

  return (
    <GlobalSearchContext.Provider value={controller}>
      {children}
      {session && profile ? (
        <GlobalSearchBoundary key={session.id} onClose={close} portalTarget={session.portalTarget}>
          <Suspense
            fallback={
              <GlobalSearchLoadingShell
                draftQueryRef={draftQueryRef}
                onClose={close}
                portalTarget={session.portalTarget}
              />
            }
          >
            <LazyGlobalSearchDialog
              actions={actions}
              draftQueryRef={draftQueryRef}
              onClose={close}
              onCloseThen={closeThen}
              pageCommands={pageCommands}
              pages={pages}
              portalTarget={session.portalTarget}
              profile={profile}
            />
          </Suspense>
        </GlobalSearchBoundary>
      ) : null}
    </GlobalSearchContext.Provider>
  );
}

export function GlobalSearchTrigger({ className }: { className?: string }) {
  const search = useGlobalSearch();
  if (!search) {
    return null;
  }

  const shortcut = isApplePlatform() ? "⌘K" : "Ctrl K";
  return (
    <button
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      aria-label="Search lessons, binders, and notes"
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border/70 bg-card/72 text-sm font-medium text-muted-foreground shadow-sm transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[1440px]:w-auto min-[1440px]:justify-start min-[1440px]:px-3",
        className,
      )}
      data-testid="global-search-trigger"
      onClick={() => search.open()}
      onFocus={() => void preloadGlobalSearch().catch(() => undefined)}
      onPointerEnter={() => void preloadGlobalSearch().catch(() => undefined)}
      title={`Search (${shortcut})`}
      type="button"
    >
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <span className="hidden min-[1440px]:inline">Search</span>
      <kbd
        aria-hidden="true"
        className="hidden h-5 items-center rounded border border-border/80 bg-background px-1.5 text-[11px] font-semibold text-muted-foreground min-[1440px]:inline-flex"
      >
        {shortcut}
      </kbd>
    </button>
  );
}

function GlobalSearchLoadingShell({
  draftQueryRef,
  onClose,
  portalTarget,
}: {
  draftQueryRef: MutableRefObject<string>;
  onClose: () => void;
  portalTarget: HTMLElement;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Typing starts immediately; the full dialog picks up whatever was typed here.
  return (
    <GlobalSearchFrame initialFocusRef={inputRef} labelledBy={titleId} onClose={onClose} portalTarget={portalTarget}>
      <h2 className="sr-only" id={titleId}>
        Search BinderNotes
      </h2>
      <div className="global-search-field">
        <Search aria-hidden="true" className="global-search-field__icon" />
        <input
          aria-label="Search lessons, binders, and notes"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          className="global-search-field__input"
          data-testid="global-search-input"
          defaultValue={draftQueryRef.current}
          onChange={(event) => {
            draftQueryRef.current = event.target.value;
          }}
          placeholder="Search lessons, binders, and notes"
          ref={inputRef}
          spellCheck={false}
          type="text"
        />
        <GlobalSearchCloseButton onClose={onClose} />
      </div>
      <div className="global-search-body">
        <div className="global-search-status" data-testid="global-search-loading" role="status">
          <Loader2 aria-hidden="true" className="global-search-spinner" />
          <span className="global-search-status__text">Opening search…</span>
        </div>
      </div>
    </GlobalSearchFrame>
  );
}

type GlobalSearchBoundaryProps = {
  children: ReactNode;
  onClose: () => void;
  portalTarget: HTMLElement;
};

/** A failed search download or render never takes the current page down with it. */
class GlobalSearchBoundary extends Component<GlobalSearchBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Global search could not open.", error, info);
    LazyGlobalSearchDialog = createLazyDialog();
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return <GlobalSearchUnavailable onClose={this.props.onClose} portalTarget={this.props.portalTarget} />;
  }
}

function GlobalSearchUnavailable({ onClose, portalTarget }: { onClose: () => void; portalTarget: HTMLElement }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  return (
    <GlobalSearchFrame initialFocusRef={closeRef} labelledBy={titleId} onClose={onClose} portalTarget={portalTarget}>
      <div className="global-search-empty" data-testid="global-search-unavailable" role="alert">
        <AlertCircle aria-hidden="true" />
        <strong id={titleId}>Search could not open</strong>
        <p>Your page is unchanged. Close this and try again, or refresh to load the latest version.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button
            className="inline-flex min-h-10 items-center rounded-lg border border-border/80 bg-background px-4 text-sm font-semibold transition hover:bg-secondary"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            Close
          </button>
          <button
            className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            onClick={() => window.location.reload()}
            type="button"
          >
            Refresh page
          </button>
        </div>
      </div>
    </GlobalSearchFrame>
  );
}

function isApplePlatform() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}
