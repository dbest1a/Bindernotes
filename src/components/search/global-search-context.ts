import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

/** A page-specific command offered under "On this page" in global search. */
export type GlobalSearchPageCommand = {
  id: string;
  label: string;
  description?: string;
  keywords?: string;
  /** Runs after global search has closed and returned focus; receives the typed query. */
  run: (query: string) => void;
};

/** An app-wide action offered under "Go to", such as opening settings. */
export type GlobalSearchAction = {
  id: string;
  label: string;
  description?: string;
  keywords?: string;
  icon?: ReactNode;
  run: () => void;
};

export type GlobalSearchPage = {
  href: string;
  label: string;
  description?: string;
  keywords?: string;
  icon?: ReactNode;
};

export type GlobalSearchPageRegistration = {
  commands: readonly GlobalSearchPageCommand[];
  /** Called just before global search opens so a page palette can close first. */
  onSearchOpen?: () => void;
};

export type GlobalSearchController = {
  open: (options?: { query?: string }) => void;
  close: () => void;
  registerPage: (registration: GlobalSearchPageRegistration) => () => void;
};

export const GlobalSearchContext = createContext<GlobalSearchController | null>(null);

/** Ctrl+K or Cmd+K, including keyboard layouts whose K key types another letter. */
export function isGlobalSearchShortcut(
  event: Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey">,
) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
    return false;
  }
  const key = (event.key ?? "").toLowerCase();
  return key === "k" || (event.code === "KeyK" && !/^[a-z]$/.test(key));
}

/** Null outside the signed-in app shell, where pages keep their own shortcuts. */
export function useGlobalSearch() {
  return useContext(GlobalSearchContext);
}

/**
 * Lets a page offer its own command palette from global search, and close that
 * palette whenever global search opens, so only one palette is ever visible.
 */
export function useGlobalSearchPage(registration: GlobalSearchPageRegistration) {
  const controller = useGlobalSearch();
  const latest = useRef(registration);
  useLayoutEffect(() => {
    latest.current = registration;
  });

  const commandsSignature = registration.commands
    .map((command) => [command.id, command.label, command.description ?? "", command.keywords ?? ""].join("\u0000"))
    .join("\u0001");

  useEffect(() => {
    if (!controller) {
      return;
    }

    return controller.registerPage({
      commands: latest.current.commands.map((command) => ({
        ...command,
        run: (query: string) =>
          latest.current.commands.find((candidate) => candidate.id === command.id)?.run(query),
      })),
      onSearchOpen: () => latest.current.onSearchOpen?.(),
    });
  }, [commandsSignature, controller]);
}
