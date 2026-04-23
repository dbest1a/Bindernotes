import type { JSONContent } from "@tiptap/react";
import type {
  Highlight,
  HighlightColor,
  HighlightSelectorBlock,
  HighlightSelectorJson,
  HighlightSelectorTextPosition,
  HighlightSelectorTextQuote,
  LessonTextSelection,
} from "@/types";

const HIGHLIGHT_METADATA_STORAGE_KEY = "binder-notes:highlight-metadata:v1";
const HIGHLIGHT_RESET_MARKER_KEY = "binder-notes:highlight-reset:v1";
const RESET_LESSON_IDS = new Set([
  "lesson-algebra-like-terms",
  "lesson-algebra-polynomials",
  "lesson-algebra-factoring",
  "lesson-algebra-quadratics",
  "lesson-algebra-functions",
  "lesson-algebra-lines",
  "lesson-algebra-inequalities",
  "lesson-algebra-systems",
  "lesson-algebra-vocab",
  "lesson-limits",
]);

type StoredHighlightMetadata = {
  id: string;
  binder_id: string;
  lesson_id: string;
  anchor_text: string;
  color: Highlight["color"];
  start_offset: number | null;
  end_offset: number | null;
  created_at: string;
};

type NormalizedHighlightSelector =
  | HighlightSelectorTextQuote
  | HighlightSelectorTextPosition
  | HighlightSelectorBlock;

export type HighlightSegment = {
  id: string;
  color: Highlight["color"];
  start: number;
  end: number;
};

type OverlaySegment = HighlightSegment & {
  createdAt: string;
};

export type HighlightRange = {
  start: number;
  end: number;
};

export type HighlightResolution = {
  range: HighlightRange | null;
  confidence: number;
  needsReview: boolean;
};

export type HighlightStorageScope = {
  binderId?: string;
  lessonId?: string;
};

type HighlightResolutionCacheEntry = {
  plainText: string;
  signature: string;
  resolution: HighlightResolution;
};

type HighlightSegmentCacheEntry = {
  plainText: string;
  segments: HighlightSegment[];
};

const highlightResolutionCache = new WeakMap<Highlight, HighlightResolutionCacheEntry>();
const highlightSegmentCache = new WeakMap<Highlight[], HighlightSegmentCacheEntry>();

export function createLessonSelection(
  text: string,
  startOffset: number,
  endOffset: number,
  options?: {
    prefixText?: string;
    suffixText?: string;
    blockId?: string | null;
  },
): LessonTextSelection {
  const start = Math.max(0, Math.min(startOffset, endOffset));
  const end = Math.max(start, Math.max(startOffset, endOffset));

  return {
    text,
    startOffset: start,
    endOffset: end,
    prefixText: options?.prefixText,
    suffixText: options?.suffixText,
    blockId: options?.blockId ?? null,
  };
}

export function buildSelectionQuoteContext(
  plainText: string,
  startOffset: number,
  endOffset: number,
  contextSize = 40,
) {
  const start = Math.max(0, Math.min(startOffset, endOffset));
  const end = Math.max(start, Math.max(startOffset, endOffset));
  return {
    prefixText: plainText.slice(Math.max(0, start - contextSize), start).trim() || undefined,
    suffixText: plainText.slice(end, Math.min(plainText.length, end + contextSize)).trim() || undefined,
  };
}

export function buildHighlightSelector(selection: LessonTextSelection): HighlightSelectorJson {
  const selectors: Array<
    HighlightSelectorTextQuote | HighlightSelectorTextPosition | HighlightSelectorBlock
  > = [
    {
      type: "TextPositionSelector",
      start: selection.startOffset,
      end: selection.endOffset,
    },
    {
      type: "TextQuoteSelector",
      exact: selection.text,
      prefix: selection.prefixText,
      suffix: selection.suffixText,
    },
  ];

  if (selection.blockId) {
    selectors.unshift({
      type: "BlockSelector",
      blockId: selection.blockId,
      start: selection.startOffset,
      end: selection.endOffset,
    });
  }

  return { selectors };
}

export function selectionMatchesHighlight(
  selection: LessonTextSelection,
  highlight: Highlight,
): boolean {
  const range = getHighlightRange(highlight);
  if (range) {
    return rangesOverlap(
      { start: selection.startOffset, end: selection.endOffset },
      range,
    );
  }

  return normalizeHighlightText(highlight.anchor_text) === normalizeHighlightText(selection.text);
}

export function selectionExactlyMatchesHighlight(
  selection: LessonTextSelection,
  highlight: Highlight,
): boolean {
  const range = getHighlightRange(highlight);
  if (range) {
    return (
      selection.startOffset === range.start &&
      selection.endOffset === range.end
    );
  }

  return normalizeHighlightText(highlight.anchor_text) === normalizeHighlightText(selection.text);
}

export function getHighlightRange(highlight: Highlight): HighlightRange | null {
  if (
    typeof highlight.start_offset === "number" &&
    typeof highlight.end_offset === "number" &&
    highlight.end_offset > highlight.start_offset
  ) {
    return {
      start: highlight.start_offset,
      end: highlight.end_offset,
    };
  }

  return null;
}

export function resolveHighlightRange(
  highlight: Highlight,
  plainText: string,
): HighlightResolution {
  const signature = buildResolutionSignature(highlight);
  const cached = highlightResolutionCache.get(highlight);
  if (cached && cached.plainText === plainText && cached.signature === signature) {
    return cached.resolution;
  }

  const exactText = highlight.selected_text?.trim() || highlight.anchor_text.trim();
  const selectors = normalizeSelectors(highlight.selector_json);
  let resolution: HighlightResolution | null = null;

  const blockRange = selectors.find(
    (selector): selector is HighlightSelectorBlock => selector.type === "BlockSelector",
  );
  if (
    blockRange &&
    typeof blockRange.start === "number" &&
    typeof blockRange.end === "number" &&
    blockRange.end > blockRange.start
  ) {
    const range = { start: blockRange.start, end: blockRange.end };
    if (rangeMatchesText(range, plainText, exactText)) {
      resolution = { range, confidence: 0.98, needsReview: false };
    }
  }

  if (!resolution) {
    const directRange = getHighlightRange(highlight);
    if (directRange && rangeMatchesText(directRange, plainText, exactText)) {
      resolution = { range: directRange, confidence: 1, needsReview: false };
    }
  }

  if (!resolution) {
    const positionSelector = selectors.find(
      (selector): selector is HighlightSelectorTextPosition => selector.type === "TextPositionSelector",
    );
    if (positionSelector && positionSelector.end > positionSelector.start) {
      const range = { start: positionSelector.start, end: positionSelector.end };
      if (rangeMatchesText(range, plainText, exactText)) {
        resolution = { range, confidence: 0.96, needsReview: false };
      }
    }
  }

  if (!resolution) {
    const quoteSelector = selectors.find(
      (selector): selector is HighlightSelectorTextQuote => selector.type === "TextQuoteSelector",
    );
    if (quoteSelector) {
      const quoteMatch = findQuoteRange(plainText, quoteSelector);
      if (quoteMatch) {
        resolution = {
          range: quoteMatch,
          confidence: quoteSelector.prefix || quoteSelector.suffix ? 0.92 : 0.88,
          needsReview: false,
        };
      }
    }
  }

  if (!resolution && exactText) {
    const fuzzyStart = plainText.toLowerCase().indexOf(exactText.toLowerCase());
    if (fuzzyStart >= 0) {
      resolution = {
        range: {
          start: fuzzyStart,
          end: fuzzyStart + exactText.length,
        },
        confidence: 0.72,
        needsReview: false,
      };
    }
  }

  const finalResolution = resolution ?? { range: null, confidence: 0, needsReview: true };
  highlightResolutionCache.set(highlight, {
    plainText,
    signature,
    resolution: finalResolution,
  });
  return finalResolution;
}

export function getSelectionRange(selection: LessonTextSelection): HighlightRange {
  return {
    start: selection.startOffset,
    end: selection.endOffset,
  };
}

export function rangesOverlap(left: HighlightRange, right: HighlightRange) {
  return !(left.end <= right.start || left.start >= right.end);
}

export function trimHighlightToRange(
  highlight: Highlight,
  range: HighlightRange,
  plainText: string,
): Highlight | null {
  const existingRange = getHighlightRange(highlight);
  if (!existingRange) {
    return null;
  }

  const nextStart = Math.max(existingRange.start, range.start);
  const nextEnd = Math.min(existingRange.end, range.end);
  if (nextEnd <= nextStart) {
    return null;
  }

  return {
    ...highlight,
    anchor_text: plainText.slice(nextStart, nextEnd),
    start_offset: nextStart,
    end_offset: nextEnd,
  };
}

export function dedupeHighlights(highlights: Highlight[]): Highlight[] {
  const byIdentity = new Map<string, Highlight>();

  highlights
    .filter((highlight) => highlight.status !== "deleted")
    .forEach((highlight) => {
    const identity = buildHighlightIdentity(highlight);
    const existing = byIdentity.get(identity);
    if (!existing || compareHighlightPriority(existing, highlight) < 0) {
      byIdentity.set(identity, highlight);
    }
    });

  return Array.from(byIdentity.values()).sort(compareHighlightsForDisplay);
}

export function buildHighlightSegments(
  highlights: Highlight[],
  plainText: string,
): HighlightSegment[] {
  if (!plainText) {
    return [];
  }

  const cached = highlightSegmentCache.get(highlights);
  if (cached && cached.plainText === plainText) {
    return cached.segments;
  }

  const lowerText = plainText.toLowerCase();
  const phraseOffsets = new Map<string, number>();
  const candidates = dedupeHighlights(highlights)
    .map((highlight) => {
      const resolution = resolveHighlightRange(highlight, plainText);
      const range = resolution.range;
      if (range) {
        return {
          id: highlight.id,
          color: highlight.color,
          start: range.start,
          end: range.end,
          createdAt: highlight.created_at,
        } satisfies OverlaySegment;
      }

      const phrase = normalizeHighlightText(highlight.anchor_text);
      if (!phrase) {
        return null;
      }

      const lowerPhrase = phrase.toLowerCase();
      const nextSearchStart = phraseOffsets.get(lowerPhrase) ?? 0;
      const matchIndex = lowerText.indexOf(lowerPhrase, nextSearchStart);
      if (matchIndex < 0) {
        return null;
      }

      phraseOffsets.set(lowerPhrase, matchIndex + lowerPhrase.length);

      return {
        id: highlight.id,
        color: highlight.color,
        start: matchIndex,
        end: matchIndex + lowerPhrase.length,
        createdAt: highlight.created_at,
      } satisfies OverlaySegment;
    })
    .filter((segment): segment is OverlaySegment => Boolean(segment))
    .sort(compareSegmentsForOverlay);

  const resolved = candidates.reduce<OverlaySegment[]>((current, segment) => {
    return overlaySegment(current, segment);
  }, []);

  const segments = resolved
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .map(({ id, color, start, end }) => ({
      id,
      color,
      start,
      end,
    }));

  highlightSegmentCache.set(highlights, {
    plainText,
    segments,
  });

  return segments;
}

export function extractRenderablePlainText(node: JSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  return (node.content ?? []).map((child) => extractRenderablePlainText(child)).join("");
}

export function mergeStoredHighlightMetadata(highlights: Highlight[]): Highlight[] {
  const metadata = loadStoredHighlightMetadata();
  if (Object.keys(metadata).length === 0) {
    return dedupeHighlights(highlights);
  }

  return dedupeHighlights(
    highlights.map((highlight) => {
      const stored = metadata[highlight.id];
      if (!stored) {
        return highlight;
    }

    return {
      ...highlight,
      start_offset:
        typeof stored.start_offset === "number" ? stored.start_offset : highlight.start_offset ?? null,
      end_offset:
        typeof stored.end_offset === "number" ? stored.end_offset : highlight.end_offset ?? null,
    };
    }),
  );
}

export function persistHighlightMetadata(highlight: Highlight) {
  if (typeof window === "undefined") {
    return;
  }

  const next = loadStoredHighlightMetadata();
  window.localStorage.setItem(HIGHLIGHT_RESET_MARKER_KEY, "true");
  next[highlight.id] = {
    id: highlight.id,
    binder_id: highlight.binder_id,
    lesson_id: highlight.lesson_id,
    anchor_text: highlight.anchor_text,
    color: highlight.color,
    start_offset:
      typeof highlight.start_offset === "number" ? highlight.start_offset : null,
    end_offset: typeof highlight.end_offset === "number" ? highlight.end_offset : null,
    created_at: highlight.created_at,
  };

  window.localStorage.setItem(HIGHLIGHT_METADATA_STORAGE_KEY, JSON.stringify(next));
}

export function removeStoredHighlightMetadata(highlightId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const next = loadStoredHighlightMetadata();
  delete next[highlightId];
  window.localStorage.setItem(HIGHLIGHT_METADATA_STORAGE_KEY, JSON.stringify(next));
}

export function removeStoredHighlightMetadataByScope(scope: HighlightStorageScope) {
  if (typeof window === "undefined") {
    return;
  }

  const next = Object.fromEntries(
    Object.entries(loadStoredHighlightMetadata()).filter(([, highlight]) =>
      !matchesHighlightStorageScope(highlight, scope),
    ),
  );

  window.localStorage.setItem(HIGHLIGHT_METADATA_STORAGE_KEY, JSON.stringify(next));
}

function loadStoredHighlightMetadata(): Record<string, StoredHighlightMetadata> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(HIGHLIGHT_METADATA_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, StoredHighlightMetadata>;
    return maybeResetStoredHighlightMetadata(parsed ?? {});
  } catch {
    return {};
  }
}

function normalizeHighlightText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function matchesHighlightStorageScope(
  highlight: StoredHighlightMetadata,
  scope: HighlightStorageScope,
) {
  if (scope.binderId && highlight.binder_id !== scope.binderId) {
    return false;
  }

  if (scope.lessonId) {
    return highlight.lesson_id === scope.lessonId;
  }

  if (scope.binderId) {
    return highlight.binder_id === scope.binderId;
  }

  return true;
}

function buildResolutionSignature(highlight: Highlight) {
  return [
    highlight.id,
    highlight.anchor_text,
    highlight.selected_text ?? "",
    highlight.prefix_text ?? "",
    highlight.suffix_text ?? "",
    highlight.start_offset ?? "",
    highlight.end_offset ?? "",
    highlight.color,
    highlight.status ?? "",
    highlight.updated_at ?? "",
    JSON.stringify(highlight.selector_json ?? null),
  ].join("|");
}

function buildHighlightIdentity(highlight: Highlight) {
  const range = getHighlightRange(highlight);
  if (range) {
    return `${highlight.owner_id}:${highlight.binder_id}:${highlight.lesson_id}:${range.start}:${range.end}`;
  }

  return `${highlight.owner_id}:${highlight.binder_id}:${highlight.lesson_id}:text:${normalizeHighlightText(highlight.anchor_text).toLowerCase()}`;
}

function compareHighlightPriority(left: Highlight, right: Highlight) {
  const createdDelta =
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareHighlightsForDisplay(left: Highlight, right: Highlight) {
  const leftRange = getHighlightRange(left);
  const rightRange = getHighlightRange(right);
  if (leftRange && rightRange) {
    return (
      leftRange.start - rightRange.start ||
      leftRange.end - rightRange.end ||
      compareHighlightPriority(left, right)
    );
  }

  if (leftRange) {
    return -1;
  }

  if (rightRange) {
    return 1;
  }

  return compareHighlightPriority(left, right);
}

function compareSegmentsForOverlay(left: OverlaySegment, right: OverlaySegment) {
  return (
    left.start - right.start ||
    left.end - right.end ||
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() ||
    left.id.localeCompare(right.id)
  );
}

function overlaySegment(
  existing: OverlaySegment[],
  candidate: OverlaySegment,
): OverlaySegment[] {
  const next: OverlaySegment[] = [];

  existing.forEach((segment) => {
    if (!rangesOverlap(segment, candidate)) {
      next.push(segment);
      return;
    }

    if (segment.start < candidate.start) {
      next.push({
        ...segment,
        end: candidate.start,
      });
    }

    if (segment.end > candidate.end) {
      next.push({
        ...segment,
        start: candidate.end,
      });
    }
  });

  next.push(candidate);
  return next;
}

function maybeResetStoredHighlightMetadata(
  metadata: Record<string, StoredHighlightMetadata>,
) {
  if (typeof window === "undefined") {
    return metadata;
  }

  if (window.localStorage.getItem(HIGHLIGHT_RESET_MARKER_KEY)) {
    return metadata;
  }

  if (Object.keys(metadata).length === 0) {
    window.localStorage.setItem(HIGHLIGHT_RESET_MARKER_KEY, "true");
    return metadata;
  }

  const filtered = Object.fromEntries(
    Object.entries(metadata).filter(([, highlight]) => !RESET_LESSON_IDS.has(highlight.lesson_id)),
  );
  window.localStorage.setItem(HIGHLIGHT_RESET_MARKER_KEY, "true");
  window.localStorage.setItem(
    HIGHLIGHT_METADATA_STORAGE_KEY,
    JSON.stringify(filtered),
  );
  return filtered;
}

function normalizeSelectors(selectorJson?: HighlightSelectorJson | null): NormalizedHighlightSelector[] {
  if (!selectorJson) {
    return [];
  }

  if ("selectors" in selectorJson && Array.isArray(selectorJson.selectors)) {
    return selectorJson.selectors;
  }

  return "type" in selectorJson ? [selectorJson] : [];
}

function rangeMatchesText(
  range: HighlightRange,
  plainText: string,
  exactText: string,
) {
  if (range.end <= range.start || range.end > plainText.length) {
    return false;
  }

  if (!exactText) {
    return true;
  }

  return normalizeHighlightText(plainText.slice(range.start, range.end)) === normalizeHighlightText(exactText);
}

function findQuoteRange(
  plainText: string,
  selector: HighlightSelectorTextQuote,
) {
  const exact = selector.exact?.trim();
  if (!exact) {
    return null;
  }

  let searchStart = 0;
  while (searchStart < plainText.length) {
    const start = plainText.indexOf(exact, searchStart);
    if (start < 0) {
      return null;
    }

    const end = start + exact.length;
    const prefixMatches = selector.prefix
      ? plainText.slice(Math.max(0, start - selector.prefix.length), start).trim().endsWith(selector.prefix.trim())
      : true;
    const suffixMatches = selector.suffix
      ? plainText.slice(end, Math.min(plainText.length, end + selector.suffix.length)).trim().startsWith(selector.suffix.trim())
      : true;

    if (prefixMatches && suffixMatches) {
      return { start, end };
    }

    searchStart = start + exact.length;
  }

  return null;
}
