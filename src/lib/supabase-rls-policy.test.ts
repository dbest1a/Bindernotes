import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0005_align_content_ids_with_app_routes.sql"),
  "utf8",
);

describe("Supabase private data RLS policies", () => {
  it("scopes learner notes and workspace preferences to the signed-in user", () => {
    expect(migration).toMatch(
      /create policy "learner notes own" on public\.learner_notes\s+for all using \(owner_id = auth\.uid\(\)\) with check \(owner_id = auth\.uid\(\)\);/i,
    );
    expect(migration).toMatch(
      /create policy "workspace preferences own" on public\.workspace_preferences\s+for all using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\);/i,
    );
  });
});
