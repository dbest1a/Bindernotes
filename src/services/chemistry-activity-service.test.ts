import { beforeEach, describe, expect, it, vi } from "vitest";
import { listChemistryActivities, saveChemistryActivity, type ChemistryActivity } from "@/services/chemistry-activity-service";
import { createTitrationInitialState, titrationReducer } from "@/lib/chemistry/titration-lab";

type Row = Record<string, unknown>;
const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const id = "10000000-0000-4000-8000-000000000001";
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, fail: false, bypass: false, from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: db.from } }));
beforeEach(() => {
  db.tables = {}; db.fail = false; db.bypass = false;
  db.from.mockReset().mockImplementation((table: string) => {
    let payload: Row | null = null;
    const filters: Array<[string, unknown]> = [];
    let from = 0, to = Infinity;
    const execute = (single: boolean) => {
      if (db.fail) return { data: null, error: { message: "private database error" } };
      let rows = db.tables[table] ?? [];
      if (payload) {
        const row: Row = structuredClone({ ...payload, created_at: "2026-09-17T12:00:00.000Z" });
        rows = [...rows.filter((existing) => existing.id !== row.id), row];
        db.tables[table] = rows; filters.push(["id", row.id]);
      }
      const selected = rows.filter((row) => db.bypass || filters.every(([key, value]) => row[key] === value)).slice(from, to + 1);
      return { data: single ? selected[0] ?? null : selected, error: null };
    };
    const query = {
      upsert: (row: Row) => { payload = row; return query; }, select: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      order: () => query, abortSignal: () => query,
      range: (start: number, end: number) => { from = start; to = end; return query; },
      single: async () => execute(true),
      then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute(false)).then(resolve),
    };
    return query;
  });
});

describe("account-owned chemistry snapshots", () => {
  it("saves and reopens every lab measurement and notebook section without truncating to 80 rows", async () => {
    let state = createTitrationInitialState();
    for (let step = 0; step < 100; step += 1) state = titrationReducer(state, { type: "add_titrant", volumeMl: 0.5 });
    state.notebook = { hypothesis: "Prediction", procedure: "100 half-mL steps", dataTable: "Readings", calculations: "n = cV", observations: "pH rose", errorAnalysis: "Overshoot", conclusion: "25 mL endpoint" };
    const snapshot: ChemistryActivity = { kind: "titration", version: 1, state: { ...state, acidMolarity: 0.1, acidVolumeMl: 25, baseMolarity: 0.1 } };
    const saved = await saveChemistryActivity({ id, ownerId: ownerA, snapshot });
    expect(saved.snapshot).toEqual(snapshot);
    expect(db.tables.user_lab_runs[0]).toMatchObject({ lab_template_id: null, user_id: ownerA });
    expect((await listChemistryActivities({ ownerId: ownerA, kind: "titration" })).records[0]).toEqual(saved);
    expect(state.measurements).toHaveLength(100);
    expect(state.measurements[49]).toEqual({ titrantVolumeMl: 25, ph: 7, equivalenceProgress: 1 });
    expect(titrationReducer(state, { type: "add_titrant", volumeMl: 0.5 })).toBe(state);
  });
  it("retains the original stoichiometry result, inputs, and steps with an idempotent retry", async () => {
    const snapshot: ChemistryActivity = { kind: "stoichiometry", version: 1, template: "template-water-from-hydrogen", givenQuantity: "4.032", result: {
      balancedEquation: "2H2 + O2 -> 2H2O", finalAnswer: { value: 36.03, formula: "H2O", unit: "g" },
      steps: [{ kind: "given_to_moles", label: "4.032 g / 2.016 g/mol", value: 2, unit: "mol" }], conceptTags: ["mole_ratio"],
    } };
    await saveChemistryActivity({ id, ownerId: ownerA, snapshot });
    await saveChemistryActivity({ id, ownerId: ownerA, snapshot });
    expect(db.tables.user_chem_attempts).toHaveLength(1);
    expect(db.tables.user_chem_attempts[0].problem_template_id).toBeNull();
    expect((await listChemistryActivities({ ownerId: ownerA, kind: "stoichiometry" })).records[0].snapshot).toEqual(snapshot);
  });
  it("keeps separate notebook reports and filters history by account", async () => {
    const snapshot: ChemistryActivity = { kind: "notebook", version: 1, notebook: { ...createTitrationInitialState().notebook, conclusion: "My private conclusion" } };
    await saveChemistryActivity({ id, ownerId: ownerA, snapshot });
    expect(db.tables.user_lab_reports[0]).toMatchObject({ conclusion: "My private conclusion", lab_run_id: null });
    expect((await listChemistryActivities({ ownerId: ownerA, kind: "notebook" })).records[0].snapshot).toEqual(snapshot);
    expect((await listChemistryActivities({ ownerId: ownerB, kind: "notebook" })).records).toEqual([]);
    db.bypass = true;
    await expect(listChemistryActivities({ ownerId: ownerB, kind: "notebook" })).rejects.toThrow(/unavailable for this account/);
  });
  it("rejects malformed checkpoints before attempting a write", async () => {
    const snapshot = { kind: "titration", version: 1, state: createTitrationInitialState() } as ChemistryActivity;
    for (const ph of [NaN, Infinity, -1, 15]) {
      await expect(saveChemistryActivity({ id, ownerId: ownerA, snapshot: { ...snapshot, state: { ...createTitrationInitialState(), ph } } as ChemistryActivity })).rejects.toThrow(/Check the chemistry inputs/);
    }
    expect(db.from).not.toHaveBeenCalled();
  });
  it("does not replace failure with an empty success and preserves unsupported old records", async () => {
    db.fail = true;
    await expect(listChemistryActivities({ ownerId: ownerA, kind: "notebook" })).rejects.toThrow(/could not be loaded/);
    await expect(saveChemistryActivity({ id, ownerId: ownerA, snapshot: { kind: "notebook", version: 1, notebook: createTitrationInitialState().notebook } })).rejects.toThrow(/could not be saved/);
    db.fail = false;
    db.tables.user_lab_runs = [{ id, user_id: ownerA, created_at: "2026-09-17T12:00:00Z", checkpoint: { legacy: true } }];
    expect(await listChemistryActivities({ ownerId: ownerA, kind: "titration" })).toEqual({ records: [], hasMore: false, unsupportedCount: 1 });
    expect(db.tables.user_lab_runs).toHaveLength(1);
  });
  it("pages history without silently dropping older work and cancels stale requests", async () => {
    db.tables.user_lab_reports = Array.from({ length: 21 }, (_, index) => ({ id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, user_id: ownerA, created_at: "2026-09-17T12:00:00Z", final_result: { kind: "notebook", version: 1, notebook: createTitrationInitialState().notebook } }));
    expect((await listChemistryActivities({ ownerId: ownerA, kind: "notebook" })).records).toHaveLength(20);
    expect((await listChemistryActivities({ ownerId: ownerA, kind: "notebook" })).hasMore).toBe(true);
    expect((await listChemistryActivities({ ownerId: ownerA, kind: "notebook", page: 1 })).records).toHaveLength(1);
    const controller = new AbortController(); controller.abort();
    await expect(listChemistryActivities({ ownerId: ownerA, kind: "notebook", signal: controller.signal })).rejects.toThrow();
  });
});
