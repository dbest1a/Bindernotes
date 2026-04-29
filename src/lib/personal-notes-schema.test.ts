import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0016_personal_notes_workspace.sql"),
  "utf8",
);

describe("Personal Notes schema", () => {
  it("creates standalone notes, personal notebook hierarchy, and owner-scoped RLS", () => {
    expect(migration).toMatch(/create table if not exists public\.personal_notes/i);
    expect(migration).toMatch(/create table if not exists public\.personal_note_binders/i);
    expect(migration).toMatch(/create table if not exists public\.personal_note_documents/i);
    expect(migration).toMatch(/create table if not exists public\.personal_note_folders/i);

    for (const table of [
      "personal_notes",
      "personal_note_binders",
      "personal_note_documents",
      "personal_note_folders",
    ]) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      expect(migration).toMatch(new RegExp(`create policy "${table} select own" on public\\.${table}\\s+for select using \\(owner_id = auth\\.uid\\(\\)\\);`, "i"));
      expect(migration).toMatch(new RegExp(`create policy "${table} insert own" on public\\.${table}\\s+for insert with check \\(owner_id = auth\\.uid\\(\\)\\);`, "i"));
      expect(migration).toMatch(new RegExp(`create policy "${table} update own" on public\\.${table}\\s+for update using \\(owner_id = auth\\.uid\\(\\)\\) with check \\(owner_id = auth\\.uid\\(\\)\\);`, "i"));
      expect(migration).toMatch(new RegExp(`create policy "${table} delete own" on public\\.${table}\\s+for delete using \\(owner_id = auth\\.uid\\(\\)\\);`, "i"));
    }
  });

  it("adds owner and recency indexes plus updated_at triggers for personal tables", () => {
    expect(migration).toMatch(/create index if not exists personal_note_folders_owner_sort_idx\s+on public\.personal_note_folders\(owner_id, sort_order, updated_at desc\)/i);
    expect(migration).toMatch(/create index if not exists personal_note_binders_owner_folder_idx\s+on public\.personal_note_binders\(owner_id, folder_id, pinned desc, sort_order, updated_at desc\)/i);
    expect(migration).toMatch(/create index if not exists personal_note_documents_owner_binder_idx\s+on public\.personal_note_documents\(owner_id, binder_id, pinned desc, updated_at desc\)/i);
    expect(migration).toMatch(/create index if not exists personal_notes_owner_folder_idx\s+on public\.personal_notes\(owner_id, folder_id, pinned desc, updated_at desc\)/i);

    for (const table of [
      "personal_note_folders",
      "personal_note_binders",
      "personal_note_documents",
      "personal_notes",
    ]) {
      expect(migration).toMatch(new RegExp(`create trigger set_${table}_updated_at\\s+before update on public\\.${table}`, "i"));
    }
  });

  it("asks PostgREST to reload its schema cache after applying the migration", () => {
    expect(migration).toMatch(/notify\s+pgrst,\s*'reload schema';/i);
  });
});
