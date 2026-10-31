import {
  Fragment,
  useDeferredValue,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Command,
  CornerDownLeft,
  FileText,
  FolderOpen,
  LibraryBig,
  Loader2,
  NotebookPen,
  Pin,
  Search,
  SearchX,
} from "lucide-react";
import { GlobalSearchCloseButton, GlobalSearchFrame } from "@/components/search/global-search-frame";
import type {
  GlobalSearchAction,
  GlobalSearchPage,
  GlobalSearchPageCommand,
} from "@/components/search/global-search-context";
import { useDashboard } from "@/hooks/use-binders";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { queryKeys } from "@/lib/query-keys";
import {
  createSearchQuery,
  getSearchHighlightSegments,
  scoreSearchFields,
  type SearchQuery,
} from "@/lib/search/text-match";
import {
  buildDashboardSearchItems,
  buildNavigationSearchItems,
  buildPersonalNoteSearchItems,
  buildSearchSnippet,
  groupWorkspaceSearchHits,
  pickRecentLessonItems,
  pickRecentNoteItems,
  searchWorkspaceItems,
  type WorkspaceSearchItem,
  type WorkspaceSearchKind,
} from "@/lib/search/workspace-search";
import type { DashboardData, Profile } from "@/types";

export type GlobalSearchDialogProps = {
  actions: readonly GlobalSearchAction[];
  /** Text typed before this chunk loaded; becomes the starting query. */
  draftQueryRef: MutableRefObject<string>;
  onClose: () => void;
  onCloseThen: (afterClose: () => void) => void;
  pageCommands: readonly GlobalSearchPageCommand[];
  pages: readonly GlobalSearchPage[];
  portalTarget: HTMLElement;
  profile: Profile;
};

type SearchOption =
  | { type: "item"; key: string; item: WorkspaceSearchItem; snippet: string | null; icon?: ReactNode }
  | { type: "action"; key: string; item: WorkspaceSearchItem; action: GlobalSearchAction }
  | { type: "page-command"; key: string; command: GlobalSearchPageCommand };

type SearchSection = {
  key: string;
  label: string;
  count?: string;
  options: SearchOption[];
};

type SectionInput = {
  actionsByKey: ReadonlyMap<string, GlobalSearchAction>;
  dashboard: DashboardData | undefined;
  dashboardItems: readonly WorkspaceSearchItem[];
  navigationItems: readonly WorkspaceSearchItem[];
  noteItems: readonly WorkspaceSearchItem[];
  pageCommands: readonly GlobalSearchPageCommand[];
  pageIcons: ReadonlyMap<string, ReactNode>;
};

const groupLabels: Record<WorkspaceSearchKind, string> = {
  lesson: "Lessons",
  note: "Personal notes",
  binder: "Binders",
  folder: "Folders",
  page: "Go to",
};

const kindIcons: Record<WorkspaceSearchKind, ReactNode> = {
  lesson: <FileText />,
  note: <NotebookPen />,
  binder: <LibraryBig />,
  folder: <FolderOpen />,
  page: <ArrowRight />,
};

export function GlobalSearchDialog({
  actions,
  draftQueryRef,
  onClose,
  onCloseThen,
  pageCommands,
  pages,
  portalTarget,
  profile,
}: GlobalSearchDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const listboxId = `${baseId}-results`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollActiveIntoViewRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState(() => draftQueryRef.current);
  const deferredQuery = useDeferredValue(query);
  const [active, setActive] = useState<{ query: string; key: string } | null>(null);

  // Mounted only while search is open, so closed search never loads the library.
  const dashboardQuery = useDashboard(profile, { includeSystemStatus: false });
  const notesQuery = usePersonalNotes(profile);

  const cachedDashboard = useMemo(
    () => (dashboardQuery.data ? undefined : readCachedDashboard(queryClient, profile.id)),
    [dashboardQuery.data, profile.id, queryClient],
  );
  const dashboard = dashboardQuery.data ?? cachedDashboard;
  const dashboardItems = useMemo(() => (dashboard ? buildDashboardSearchItems(dashboard) : []), [dashboard]);
  const noteItems = useMemo(
    () => (notesQuery.data ? buildPersonalNoteSearchItems(notesQuery.data.entries, profile.id) : []),
    [notesQuery.data, profile.id],
  );
  const { actionsByKey, navigationItems, pageIcons } = useMemo(() => {
    const entries = [
      ...pages.map((page) => ({
        key: `page:${page.href}`,
        label: page.label,
        href: page.href,
        description: page.description,
        keywords: page.keywords,
      })),
      ...actions.map((action) => ({
        key: `action:${action.id}`,
        label: action.label,
        description: action.description,
        keywords: action.keywords,
      })),
    ];
    return {
      actionsByKey: new Map(actions.map((action) => [`action:${action.id}`, action])),
      navigationItems: buildNavigationSearchItems(entries),
      pageIcons: new Map<string, ReactNode>([
        ...pages.map((page) => [`page:${page.href}`, page.icon] as const),
        ...actions.map((action) => [`action:${action.id}`, action.icon] as const),
      ]),
    };
  }, [actions, pages]);

  const sectionInput = useMemo<SectionInput>(
    () => ({ actionsByKey, dashboard, dashboardItems, navigationItems, noteItems, pageCommands, pageIcons }),
    [actionsByKey, dashboard, dashboardItems, navigationItems, noteItems, pageCommands, pageIcons],
  );
  const searchQuery = useMemo(() => createSearchQuery(deferredQuery), [deferredQuery]);
  const sections = useMemo(() => buildSections(sectionInput, searchQuery), [sectionInput, searchQuery]);
  const options = useMemo(() => sections.flatMap((section) => section.options), [sections]);
  const activeKey = active?.query === deferredQuery ? active.key : null;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === activeKey),
  );
  const activeOption = options[activeIndex] ?? null;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  useLayoutEffect(() => {
    if (!scrollActiveIntoViewRef.current) {
      return;
    }
    scrollActiveIntoViewRef.current = false;
    document.getElementById(`${baseId}-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, baseId]);

  const hasQuery = searchQuery.tokens.length > 0;
  const dashboardPending = !dashboardQuery.data && !dashboardQuery.isError;
  const notesPending = !notesQuery.data && !notesQuery.isError;
  const dashboardFailed = !dashboardQuery.data && dashboardQuery.isError;
  const notesFailed = !notesQuery.data && notesQuery.isError;
  const resultCount = options.filter((option) => option.type !== "page-command").length;
  const contentResultCount = options.filter(
    (option) => option.type === "item" && option.item.kind !== "page",
  ).length;
  const stillLoading = (dashboardPending && !dashboard) || notesPending;
  const showNoMatches = hasQuery && resultCount === 0 && !stillLoading;
  const showResultSkeleton = stillLoading && contentResultCount === 0;
  const noMatchesHint =
    dashboardFailed && notesFailed
      ? "Lessons and notes could not load, so only app pages were searched."
      : dashboardFailed || notesFailed
        ? "Some results could not load. Retry above, or try different words."
        : "Check the spelling, or try fewer or different words.";

  const liveMessage = !hasQuery
    ? ""
    : stillLoading && resultCount === 0
      ? "Searching your lessons and notes"
      : resultCount === 0
        ? `No results for ${query.trim()}`
        : `${resultCount} result${resultCount === 1 ? "" : "s"}`;

  const moveActive = (delta: number) => {
    if (options.length === 0) {
      return;
    }
    const next = (activeIndex + delta + options.length) % options.length;
    scrollActiveIntoViewRef.current = true;
    setActive({ query: deferredQuery, key: options[next].key });
  };

  const activate = (option: SearchOption) => {
    if (option.type === "page-command") {
      const typed = query.trim();
      onCloseThen(() => option.command.run(typed));
      return;
    }
    if (option.type === "action") {
      onCloseThen(() => option.action.run());
      return;
    }
    const target = option.item.href;
    onClose();
    if (target && target !== `${location.pathname}${location.search}`) {
      navigate(target);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== inputRef.current) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter") {
      // Results may trail fast typing; always open the best match for what is in the box.
      const current =
        query === deferredQuery
          ? activeOption
          : (buildSections(sectionInput, createSearchQuery(query)).flatMap((section) => section.options)[0] ?? null);
      if (current) {
        event.preventDefault();
        activate(current);
      }
    }
  };

  const handleOptionClick = (event: ReactMouseEvent<HTMLElement>, option: SearchOption) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    activate(option);
  };

  let optionIndex = -1;

  return (
    <GlobalSearchFrame
      initialFocusRef={inputRef}
      labelledBy={titleId}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      portalTarget={portalTarget}
    >
      <h2 className="sr-only" id={titleId}>
        Search BinderNotes
      </h2>
      <div className="global-search-field">
        <Search aria-hidden="true" className="global-search-field__icon" />
        <input
          aria-activedescendant={options.length > 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded="true"
          aria-label="Search lessons, binders, and notes"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          className="global-search-field__input"
          data-testid="global-search-input"
          enterKeyHint="go"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search lessons, binders, and notes"
          ref={inputRef}
          role="combobox"
          spellCheck={false}
          type="text"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear search text"
            className="global-search-clear"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            type="button"
          >
            Clear
          </button>
        ) : null}
        <GlobalSearchCloseButton onClose={onClose} />
      </div>

      <div className="global-search-body" data-testid="global-search-results">
        {stillLoading ? (
          <div className="global-search-status" data-testid="global-search-loading">
            <Loader2 aria-hidden="true" className="global-search-spinner" />
            <span className="global-search-status__text">
              {dashboardPending && !dashboard && notesPending
                ? "Loading your lessons and notes…"
                : notesPending
                  ? "Loading personal notes…"
                  : "Loading lessons and binders…"}
            </span>
          </div>
        ) : null}
        {dashboardFailed ? (
          <SearchErrorRow
            isRetrying={dashboardQuery.isFetching}
            message="Lessons and binders could not load."
            onRetry={() => void dashboardQuery.refetch()}
            testId="global-search-error-library"
          />
        ) : null}
        {notesFailed ? (
          <SearchErrorRow
            isRetrying={notesQuery.isFetching}
            message="Personal notes could not load."
            onRetry={() => void notesQuery.refetch()}
            testId="global-search-error-notes"
          />
        ) : null}

        <div aria-label="Search results" id={listboxId} role="listbox">
          {sections.map((section) => (
            <div
              aria-labelledby={`${baseId}-${section.key}`}
              className="global-search-group"
              key={section.key}
              role="group"
            >
              <div className="global-search-group__label" id={`${baseId}-${section.key}`} role="presentation">
                <span>{section.label}</span>
                {section.count ? <span className="global-search-group__count">{section.count}</span> : null}
              </div>
              {section.options.map((option) => {
                optionIndex += 1;
                const index = optionIndex;
                const isActive = index === activeIndex;
                const common = {
                  "aria-label": optionLabel(option, searchQuery, location.pathname),
                  "aria-selected": isActive,
                  className: "global-search-option",
                  "data-active": isActive ? "true" : "false",
                  "data-testid": "global-search-option",
                  id: optionId(index),
                  onMouseDown: (event: ReactMouseEvent<HTMLElement>) => event.preventDefault(),
                  onPointerMove: () => {
                    if (!isActive) {
                      setActive({ query: deferredQuery, key: option.key });
                    }
                  },
                  role: "option" as const,
                };
                const content = renderOptionContent(option, searchQuery, location.pathname);
                return option.type === "item" && option.item.href ? (
                  <Link
                    {...common}
                    key={option.key}
                    onClick={(event) => handleOptionClick(event, option)}
                    tabIndex={-1}
                    to={option.item.href}
                  >
                    {content}
                  </Link>
                ) : (
                  <div {...common} key={option.key} onClick={(event) => handleOptionClick(event, option)}>
                    {content}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {showResultSkeleton ? (
          <div aria-hidden="true" className="global-search-skeleton">
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {showNoMatches ? (
          <div className="global-search-empty" data-testid="global-search-empty">
            <SearchX aria-hidden="true" />
            <strong>No matches for “{query.trim()}”</strong>
            <p>{noMatchesHint}</p>
          </div>
        ) : null}
      </div>

      <div aria-hidden="true" className="global-search-footer">
        <span>
          <kbd className="global-search-kbd">↑</kbd>
          <kbd className="global-search-kbd">↓</kbd>
          Move
        </span>
        <span>
          <kbd className="global-search-kbd">↵</kbd>
          Open
        </span>
        <span>
          <kbd className="global-search-kbd">Esc</kbd>
          Close
        </span>
      </div>
      <p aria-live="polite" className="sr-only" role="status">
        {liveMessage}
      </p>
    </GlobalSearchFrame>
  );
}

function buildSections(
  { actionsByKey, dashboard, dashboardItems, navigationItems, noteItems, pageCommands, pageIcons }: SectionInput,
  query: SearchQuery,
): SearchSection[] {
  const toOption = (item: WorkspaceSearchItem): SearchOption => {
    const action = actionsByKey.get(item.key);
    if (action) {
      return { type: "action", key: item.key, item, action };
    }
    const snippet =
      item.bodyText && query.tokens.length > 0 && scoreSearchFields(query, [{ text: item.primary }, { text: item.secondary }]) === null
        ? buildSearchSnippet(item.bodyText, query)
        : null;
    return { type: "item", key: item.key, item, snippet, icon: pageIcons.get(item.key) };
  };
  const pageCommandSection: SearchSection | null =
    pageCommands.length > 0
      ? {
          key: "on-this-page",
          label: "On this page",
          options: pageCommands.map((command) => ({ type: "page-command", key: `page-command:${command.id}`, command })),
        }
      : null;

  if (query.tokens.length === 0) {
    const recentLessons = dashboard ? pickRecentLessonItems(dashboardItems, dashboard.recentLessons) : [];
    const recentNotes = pickRecentNoteItems(noteItems);
    return [
      ...(pageCommandSection ? [pageCommandSection] : []),
      ...(recentLessons.length > 0
        ? [{ key: "recent-lessons", label: "Recent lessons", options: recentLessons.map(toOption) }]
        : []),
      ...(recentNotes.length > 0 ? [{ key: "recent-notes", label: "Recent notes", options: recentNotes.map(toOption) }] : []),
      { key: "go-to", label: "Go to", options: navigationItems.map(toOption) },
    ];
  }

  const groups = groupWorkspaceSearchHits(searchWorkspaceItems([...dashboardItems, ...noteItems, ...navigationItems], query));
  return [
    ...groups.map((group) => ({
      key: group.kind,
      label: groupLabels[group.kind],
      count: group.total > group.hits.length ? `${group.hits.length} of ${group.total}` : undefined,
      options: group.hits.map((hit) => toOption(hit.item)),
    })),
    ...(pageCommandSection ? [pageCommandSection] : []),
  ];
}

function renderOptionContent(option: SearchOption, query: SearchQuery, currentPath: string) {
  if (option.type === "page-command") {
    const typed = query.raw.trim();
    return (
      <>
        <span aria-hidden="true" className="global-search-option__icon">
          <Command />
        </span>
        <span className="global-search-option__text">
          <span className="global-search-option__title">{option.command.label}</span>
          <span className="global-search-option__subtitle">
            {typed ? `Open with “${typed}” already typed` : option.command.description}
          </span>
        </span>
        <span className="global-search-option__meta">
          <CornerDownLeft aria-hidden="true" className="global-search-enter" />
        </span>
      </>
    );
  }

  const item = option.item;
  const icon = option.type === "action" ? option.action.icon : option.icon;
  const isCurrent = Boolean(item.href) && item.href === currentPath;
  return (
    <>
      <span aria-hidden="true" className="global-search-option__icon">
        {icon ?? kindIcons[item.kind]}
      </span>
      <span className="global-search-option__text">
        <span className="global-search-option__title">
          <HighlightedText query={query} text={item.title} />
        </span>
        {item.subtitle ? <span className="global-search-option__subtitle">{item.subtitle}</span> : null}
        {option.type === "item" && option.snippet ? (
          <span className="global-search-option__snippet">
            <HighlightedText query={query} text={option.snippet} />
          </span>
        ) : null}
      </span>
      <span className="global-search-option__meta">
        {item.pinned ? <Pin aria-label="Pinned" className="global-search-pin" role="img" /> : null}
        {isCurrent ? <span className="global-search-badge global-search-badge--current">Open now</span> : null}
        {item.badge ? <span className="global-search-badge">{item.badge}</span> : null}
        <CornerDownLeft aria-hidden="true" className="global-search-enter" />
      </span>
    </>
  );
}

/** One clean spoken name per row; highlight marks and icons stay visual only. */
function optionLabel(option: SearchOption, query: SearchQuery, currentPath: string) {
  if (option.type === "page-command") {
    const typed = query.raw.trim();
    return `${option.command.label}, ${typed ? `open with “${typed}” already typed` : (option.command.description ?? "this page")}`;
  }
  const item = option.item;
  return [
    item.title,
    item.subtitle,
    option.type === "item" ? option.snippet : null,
    item.badge,
    item.pinned ? "pinned" : null,
    item.href && item.href === currentPath ? "open now" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function HighlightedText({ query, text }: { query: SearchQuery; text: string }) {
  const segments = getSearchHighlightSegments(text, query);
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark className="global-search-mark" key={index}>
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

function SearchErrorRow({
  isRetrying,
  message,
  onRetry,
  testId,
}: {
  isRetrying: boolean;
  message: string;
  onRetry: () => void;
  testId: string;
}) {
  return (
    <div className="global-search-status" data-testid={testId} data-tone="error" role="alert">
      <AlertCircle aria-hidden="true" />
      <span className="global-search-status__text">
        {message} Other results still work.
      </span>
      <button
        className="inline-flex min-h-9 items-center rounded-md border border-border/80 bg-background px-3 text-xs font-semibold transition hover:bg-secondary disabled:opacity-60"
        disabled={isRetrying}
        onClick={onRetry}
        type="button"
      >
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

function readCachedDashboard(queryClient: QueryClient, profileId: string): DashboardData | undefined {
  // Reuse any dashboard copy already in memory (for example, on /dashboard) while the search copy loads.
  for (const [, data] of queryClient.getQueriesData<DashboardData>({
    queryKey: queryKeys.dashboard.forProfile(profileId),
  })) {
    if (data && Array.isArray(data.lessons) && Array.isArray(data.binders)) {
      return data;
    }
  }
  return undefined;
}
