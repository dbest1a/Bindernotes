import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockInsertSingle,
  mockInsertSelect,
  mockInsert,
  mockUpdateSingle,
  mockUpdateSelect,
  mockUpdateEqSecond,
  mockUpdateEqFirst,
  mockUpdate,
  mockFrom,
} = vi.hoisted(() => {
  const insertSingle = vi.fn();
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  const updateSingle = vi.fn();
  const updateSelect = vi.fn(() => ({ single: updateSingle }));
  const updateEqSecond = vi.fn(() => ({ select: updateSelect }));
  const updateEqFirst = vi.fn(() => ({ eq: updateEqSecond }));
  const update = vi.fn(() => ({ eq: updateEqFirst }));

  const from = vi.fn((table: string) => {
    if (table === "highlights") {
      return {
        insert,
        update,
      };
    }

    throw new Error(`Unexpected table access in test: ${table}`);
  });

  return {
    mockInsertSingle: insertSingle,
    mockInsertSelect: insertSelect,
    mockInsert: insert,
    mockUpdateSingle: updateSingle,
    mockUpdateSelect: updateSelect,
    mockUpdateEqSecond: updateEqSecond,
    mockUpdateEqFirst: updateEqFirst,
    mockUpdate: update,
    mockFrom: from,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
  isSupabaseConfigured: true,
  supabaseProjectRef: "test-project",
}));

import { createHighlight, updateHighlight } from "@/services/binder-service";

describe("binder-service legacy highlight compatibility", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockInsert.mockClear();
    mockInsertSelect.mockClear();
    mockInsertSingle.mockReset();
    mockUpdate.mockClear();
    mockUpdateEqFirst.mockClear();
    mockUpdateEqSecond.mockClear();
    mockUpdateSelect.mockClear();
    mockUpdateSingle.mockReset();
  });

  it("falls back to a legacy insert payload when extended highlight columns are missing", async () => {
    mockInsertSingle
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "column highlights.selected_text does not exist",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "hl-1",
          owner_id: "user-1",
          binder_id: "binder-1",
          lesson_id: "lesson-1",
          anchor_text: "same phrase",
          color: "yellow",
          note_id: null,
          start_offset: 4,
          end_offset: 15,
          created_at: "2026-04-22T10:00:00.000Z",
        },
        error: null,
      });

    const highlight = await createHighlight({
      ownerId: "user-1",
      binderId: "binder-1",
      lessonId: "lesson-1",
      anchorText: "same phrase",
      selectedText: "same phrase",
      color: "yellow",
      startOffset: 4,
      endOffset: 15,
      prefixText: "The ",
      suffixText: " matters",
    });

    expect(mockInsert).toHaveBeenCalledTimes(2);
    const [firstInsertArgs = [], secondInsertArgs = []] = mockInsert.mock.calls as unknown[][];
    expect(firstInsertArgs).toBeTruthy();
    expect(secondInsertArgs).toBeTruthy();
    expect(firstInsertArgs[0]).toMatchObject({
      document_id: "lesson-1",
      selected_text: "same phrase",
      selector_json: {
        selectors: expect.any(Array),
      },
    });
    expect(secondInsertArgs[0]).toEqual({
      owner_id: "user-1",
      binder_id: "binder-1",
      lesson_id: "lesson-1",
      anchor_text: "same phrase",
      color: "yellow",
      note_id: null,
      start_offset: 4,
      end_offset: 15,
    });
    expect(highlight.start_offset).toBe(4);
    expect(highlight.end_offset).toBe(15);
  });

  it("falls back to a legacy update payload when extended highlight columns are missing", async () => {
    mockUpdateSingle
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "column highlights.updated_at does not exist",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "hl-1",
          owner_id: "user-1",
          binder_id: "binder-1",
          lesson_id: "lesson-1",
          anchor_text: "same phrase",
          color: "blue",
          note_id: null,
          start_offset: 4,
          end_offset: 15,
          created_at: "2026-04-22T10:00:00.000Z",
        },
        error: null,
      });

    const highlight = await updateHighlight({
      ownerId: "user-1",
      highlightId: "hl-1",
      anchorText: "same phrase",
      selectedText: "same phrase",
      color: "blue",
      startOffset: 4,
      endOffset: 15,
      prefixText: "The ",
      suffixText: " matters",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    const [firstUpdateArgs = [], secondUpdateArgs = []] = mockUpdate.mock.calls as unknown[][];
    expect(firstUpdateArgs).toBeTruthy();
    expect(secondUpdateArgs).toBeTruthy();
    expect(firstUpdateArgs[0]).toMatchObject({
      selected_text: "same phrase",
      updated_at: expect.any(String),
    });
    expect(secondUpdateArgs[0]).toEqual({
      anchor_text: "same phrase",
      color: "blue",
      start_offset: 4,
      end_offset: 15,
    });
    expect(highlight.color).toBe("blue");
  });
});
