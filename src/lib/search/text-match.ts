/**
 * Shared search matching for BinderNotes: global search, the dashboard filter,
 * and the Personal Notes command palette.
 *
 * Every meaningful query word must match somewhere in the record, in any
 * order. Words match exactly, as a prefix, inside a longer word, as initials
 * ("hsm" -> "Hide side monitor"), typed without spaces ("newnote"), or with a
 * small typo once they are long enough to make typos unambiguous.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;
const APOSTROPHES = /['‘’`]/g;
const NON_WORD = /[^\p{L}\p{M}\p{N}]+/gu;
const LETTERS_ONLY = /^\p{L}+$/u;

// Common English filler words only narrow a query when they are all it has.
const OPTIONAL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

// Initials are only meaningful for short labels such as titles and commands.
const MAX_ACRONYM_WORDS = 12;

const MATCH_QUALITY = {
  exact: 1,
  prefix: 0.82,
  infix: 0.55,
  joined: 0.5,
  acronym: 0.48,
  oneTypo: 0.42,
  twoTypos: 0.28,
} as const;

export type PreparedSearchText = {
  readonly normalized: string;
  readonly words: readonly string[];
  readonly joined: string;
  readonly wordStarts: readonly number[];
  readonly initials: string;
};

export type SearchQuery = {
  readonly raw: string;
  readonly normalized: string;
  readonly tokens: readonly string[];
  readonly requiredTokens: readonly string[];
  readonly optionalTokens: readonly string[];
};

export type SearchField = {
  readonly text: PreparedSearchText | string | null | undefined;
  /** Relative importance; the first field is treated as the record title. */
  readonly weight?: number;
  /** Typo tolerance is useful for titles but noisy for long bodies. */
  readonly typos?: boolean;
};

export type SearchHighlightSegment = {
  text: string;
  match: boolean;
};

const EMPTY_PREPARED_TEXT: PreparedSearchText = {
  normalized: "",
  words: [],
  joined: "",
  wordStarts: [],
  initials: "",
};

export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(APOSTROPHES, "")
    .replace(NON_WORD, " ")
    .trim();
}

export function prepareSearchText(value: string | null | undefined): PreparedSearchText {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return EMPTY_PREPARED_TEXT;
  }

  const orderedWords = normalized.split(" ");
  const wordStarts: number[] = [];
  let joined = "";
  for (const word of orderedWords) {
    wordStarts.push(joined.length);
    joined += word;
  }

  return {
    normalized,
    words: [...new Set(orderedWords)],
    joined,
    wordStarts,
    initials:
      orderedWords.length <= MAX_ACRONYM_WORDS ? orderedWords.map((word) => word[0]).join("") : "",
  };
}

export function createSearchQuery(raw: string): SearchQuery {
  const normalized = normalizeSearchText(raw);
  const tokens = normalized ? [...new Set(normalized.split(" "))] : [];
  const meaningful = tokens.filter((token) => !OPTIONAL_WORDS.has(token));

  return {
    raw,
    normalized,
    tokens,
    requiredTokens: meaningful.length > 0 ? meaningful : tokens,
    optionalTokens: meaningful.length > 0 ? tokens.filter((token) => OPTIONAL_WORDS.has(token)) : [],
  };
}

export function isEmptySearchQuery(query: SearchQuery) {
  return query.tokens.length === 0;
}

/**
 * Scores a record against a query. Returns null when any required query word
 * is missing from every field; otherwise higher scores are better matches.
 */
export function scoreSearchFields(query: SearchQuery, fields: readonly SearchField[]): number | null {
  if (query.tokens.length === 0) {
    return 0;
  }

  const prepared = fields.map((field) => ({
    text: toPreparedText(field.text),
    weight: field.weight ?? 1,
    typos: field.typos ?? true,
  }));

  let total = 0;
  for (const token of query.requiredTokens) {
    let best = 0;
    for (const field of prepared) {
      if (field.text.words.length === 0 || field.weight <= best) {
        continue;
      }
      const quality = matchTokenInText(token, field.text, field.typos);
      best = Math.max(best, quality * field.weight);
    }
    if (best === 0) {
      return null;
    }
    total += best;
  }

  let score = total / query.requiredTokens.length;
  for (const token of query.optionalTokens) {
    if (prepared.some((field) => matchTokenInText(token, field.text, false) >= MATCH_QUALITY.prefix)) {
      score += 0.03;
    }
  }

  const title = prepared[0]?.text;
  if (title?.normalized) {
    if (title.normalized === query.normalized) {
      score += 0.6;
    } else if (title.normalized.startsWith(query.normalized)) {
      score += 0.35;
    } else if (query.tokens.length > 1 && ` ${title.normalized}`.includes(` ${query.normalized}`)) {
      score += 0.2;
    }
  }

  return score;
}

export function matchesSearchText(
  query: SearchQuery | string,
  ...texts: Array<PreparedSearchText | string | null | undefined>
): boolean {
  const searchQuery = typeof query === "string" ? createSearchQuery(query) : query;
  return scoreSearchFields(searchQuery, texts.map((text) => ({ text }))) !== null;
}

/**
 * Splits text into highlighted and plain segments for exact, prefix, and
 * in-word matches. Typo and initials matches are intentionally not marked.
 */
export function getSearchHighlightSegments(text: string, query: SearchQuery): SearchHighlightSegment[] {
  if (!text || query.tokens.length === 0) {
    return [{ text, match: false }];
  }

  let normalized = "";
  const sourceStart: number[] = [];
  const sourceEnd: number[] = [];
  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index) ?? 0;
    const character = String.fromCodePoint(codePoint);
    const folded = normalizeSearchCharacter(character);
    for (let unit = 0; unit < folded.length; unit += 1) {
      normalized += folded[unit];
      sourceStart.push(index);
      sourceEnd.push(index + character.length);
    }
    index += character.length;
  }

  const ranges: Array<[number, number]> = [];
  for (const token of query.tokens) {
    let from = normalized.indexOf(token);
    while (from !== -1) {
      const atWordStart = from === 0 || normalized[from - 1] === " ";
      if (atWordStart || token.length >= 3) {
        ranges.push([sourceStart[from], sourceEnd[from + token.length - 1]]);
      }
      from = normalized.indexOf(token, from + 1);
    }
  }

  if (ranges.length === 0) {
    return [{ text, match: false }];
  }

  ranges.sort((left, right) => left[0] - right[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([range[0], range[1]]);
    }
  }

  const segments: SearchHighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), match: false });
    }
    segments.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }
  return segments;
}

function toPreparedText(text: PreparedSearchText | string | null | undefined): PreparedSearchText {
  if (!text) {
    return EMPTY_PREPARED_TEXT;
  }
  return typeof text === "string" ? prepareSearchText(text) : text;
}

function normalizeSearchCharacter(character: string) {
  const folded = character
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(APOSTROPHES, "");
  return folded.replace(NON_WORD, " ");
}

function matchTokenInText(token: string, text: PreparedSearchText, allowTypos: boolean): number {
  let best = 0;
  for (const word of text.words) {
    if (word === token) {
      return MATCH_QUALITY.exact;
    }
    if (word.startsWith(token)) {
      best = Math.max(best, MATCH_QUALITY.prefix);
    } else if (token.length >= 3 && best < MATCH_QUALITY.infix && word.includes(token)) {
      best = MATCH_QUALITY.infix;
    }
  }
  if (best > 0) {
    return best;
  }

  if (token.length >= 4 && text.wordStarts.some((start) => text.joined.startsWith(token, start))) {
    return MATCH_QUALITY.joined;
  }

  if (token.length >= 2 && token.length <= 6 && text.initials.includes(token) && LETTERS_ONLY.test(token)) {
    return MATCH_QUALITY.acronym;
  }

  return allowTypos ? matchTokenWithTypos(token, text.words) : 0;
}

function matchTokenWithTypos(token: string, words: readonly string[]): number {
  if (token.length < 4) {
    return 0;
  }
  // Four-letter words have too many one-letter neighbours ("math"/"path", "rome"/"rose"),
  // so only swapped letters count ("roem" -> "rome").
  if (token.length === 4) {
    return words.some((word) => word.length >= 4 && isAdjacentSwap(token, word.slice(0, 4)))
      ? MATCH_QUALITY.oneTypo
      : 0;
  }

  const maxEdits = token.length >= 8 ? 2 : 1;
  const firstLetterMatters = token.length < 7;
  let fewestEdits = maxEdits + 1;
  for (const word of words) {
    if (word.length < 3) {
      continue;
    }
    if (firstLetterMatters && word[0] !== token[0] && !(word[0] === token[1] && word[1] === token[0])) {
      continue;
    }
    if (Math.abs(word.length - token.length) <= maxEdits) {
      fewestEdits = Math.min(fewestEdits, boundedEditDistance(token, word, maxEdits));
    }
    // Partially typed longer words: compare with a prefix of similar length.
    if (word.length > token.length) {
      for (let length = token.length - maxEdits; length <= token.length + maxEdits; length += 1) {
        if (length >= 3 && length < word.length) {
          fewestEdits = Math.min(fewestEdits, boundedEditDistance(token, word.slice(0, length), maxEdits));
        }
      }
    }
    if (fewestEdits === 1 && maxEdits === 1) {
      break;
    }
  }

  if (fewestEdits === 1) {
    return MATCH_QUALITY.oneTypo;
  }
  if (fewestEdits === 2 && maxEdits >= 2) {
    return MATCH_QUALITY.twoTypos;
  }
  return 0;
}

function isAdjacentSwap(left: string, right: string) {
  if (left.length !== right.length || left === right) {
    return false;
  }
  let index = 0;
  while (left[index] === right[index]) {
    index += 1;
  }
  return (
    index < left.length - 1 &&
    left[index] === right[index + 1] &&
    left[index + 1] === right[index] &&
    left.slice(index + 2) === right.slice(index + 2)
  );
}

/** Optimal string alignment distance, giving up once it exceeds `limit`. */
function boundedEditDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) {
    return limit + 1;
  }

  let previousPrevious: number[] = [];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let rowBest = row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      let value = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        value = Math.min(value, previousPrevious[column - 2] + 1);
      }
      current.push(value);
      rowBest = Math.min(rowBest, value);
    }
    if (rowBest > limit) {
      return limit + 1;
    }
    previousPrevious = previous;
    previous = current;
  }
  return previous[right.length];
}
