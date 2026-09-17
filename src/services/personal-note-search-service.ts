import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { saveQueue } from "@/lib/save-queue";

const matchSchema = z
  .object({ kind: z.enum(["personal-note", "personal-document", "binder-note"]), id: z.string().min(1) })
  .strict();
let generation = 0;
saveQueue.subscribeAccount(() => {
  generation += 1;
});

/** Match identities are paged; note bodies never enter a collection or search cache. */
export async function searchPersonalNoteBodies(
  ownerId: string,
  text: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const query = text.trim();
  if (!query) return new Set();
  if (query.length > 200) throw new Error("Use a search of 200 characters or fewer.");
  const client = supabase,
    started = generation;
  const active = () => {
    if (signal?.aborted) throw new DOMException("Search cancelled", "AbortError");
    if (!client || saveQueue.getAccount() !== ownerId || started !== generation)
      throw new Error("The search account changed.");
  };
  active();
  const matches = new Set<string>();
  for (let offset = 0; offset < 10000; offset += 200) {
    let request = client!.rpc("search_personal_notes", { p_query: query, p_offset: offset, p_limit: 200 });
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    active();
    if (error) throw new Error("Note text search could not finish. Retry when connected.");
    const rows = matchSchema.array().max(200).parse(data);
    for (const row of rows) matches.add(`${row.kind}:${row.id}`);
    if (rows.length < 200) return matches;
  }
  throw new Error("This search matches too many notes. Add more words to narrow it.");
}
