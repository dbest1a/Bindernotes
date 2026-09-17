export const METADATA_PAGE_SIZE = 200;

type PageError = { message?: string; code?: string; details?: string; hint?: string };

/** Read a stable, uniquely ordered metadata query without PostgREST's row cap truncating it. */
export async function readMetadataPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PageError | null }>,
): Promise<{ data: T[]; error: PageError | null }> {
  const rows: T[] = [];
  for (let from = 0; from < 1_000_000; from += METADATA_PAGE_SIZE) {
    const page = await read(from, from + METADATA_PAGE_SIZE - 1);
    // A failed later page must not look like a successfully loaded smaller collection.
    if (page.error) return { data: [], error: page.error };
    const batch = page.data ?? [];
    rows.push(...batch);
    if (batch.length < METADATA_PAGE_SIZE) return { data: rows, error: null };
  }
  return {
    data: [],
    error: { message: "This collection is too large to load safely. Narrow the selection and retry." },
  };
}

/** Bound both the returned rows and the URL's IN filter for large course collections. */
export async function readMetadataForIds<T>(
  ids: string[],
  read: (
    ids: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PageError | null }>,
): Promise<{ data: T[]; error: PageError | null }> {
  const rows: T[] = [];
  const unique = [...new Set(ids)];
  for (let start = 0; start < unique.length; start += 100) {
    const result = await readMetadataPages((from, to) => read(unique.slice(start, start + 100), from, to));
    if (result.error) return { data: [], error: result.error };
    rows.push(...result.data);
  }
  return { data: rows, error: null };
}
