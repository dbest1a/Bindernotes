import { describe, expect, it } from "vitest";
import { emptyDoc } from "@/lib/utils";
import {
  deriveBinderTitle,
  filterVisibleWorkspaceData,
  selectPrimaryWorkspaceDiagnostic,
} from "@/lib/workspace-records";
import type {
  Binder,
  BinderLesson,
  Folder,
  FolderBinderLink,
  LearnerNote,
  WorkspaceDiagnostic,
} from "@/types";

const baseBinder: Binder = {
  id: "binder-real",
  owner_id: "user-1",
  title: "French Revolution Binder",
  slug: "french-revolution-binder",
  description: "Real study content.",
  subject: "History",
  level: "Foundations",
  status: "published",
  price_cents: 0,
  cover_url: null,
  pinned: false,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

describe("workspace-records", () => {
  it("filters out empty placeholder binders, folders, and lessons while keeping real content", () => {
    const placeholderBinder: Binder = {
      ...baseBinder,
      id: "binder-placeholder",
      title: "Untitled binder",
      slug: "untitled-binder",
      description: "Write a clear promise for this binder.",
      status: "draft",
    };
    const realLesson: BinderLesson = {
      id: "lesson-real",
      binder_id: baseBinder.id,
      title: "Storming of the Bastille",
      order_index: 1,
      content: emptyDoc("A real lesson body."),
      math_blocks: [],
      is_preview: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
    const placeholderLesson: BinderLesson = {
      id: "lesson-placeholder",
      binder_id: placeholderBinder.id,
      title: "Untitled lesson",
      order_index: 1,
      content: emptyDoc(""),
      math_blocks: [],
      is_preview: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
    const folders: Folder[] = [
      {
        id: "folder-real",
        owner_id: "user-1",
        name: "History",
        color: "blue",
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      {
        id: "folder-placeholder",
        owner_id: "user-1",
        name: "Untitled",
        color: "rose",
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
    ];
    const folderBinders: FolderBinderLink[] = [
      {
        id: "link-real",
        owner_id: "user-1",
        folder_id: "folder-real",
        binder_id: baseBinder.id,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
      {
        id: "link-placeholder",
        owner_id: "user-1",
        folder_id: "folder-placeholder",
        binder_id: placeholderBinder.id,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
    ];
    const notes: LearnerNote[] = [];

    const visible = filterVisibleWorkspaceData({
      binders: [baseBinder, placeholderBinder],
      folders,
      folderBinders,
      lessons: [realLesson, placeholderLesson],
      notes,
    });

    expect(visible.binders.map((binder) => binder.id)).toEqual([baseBinder.id]);
    expect(visible.folders.map((folder) => folder.id)).toEqual(["folder-real"]);
    expect(visible.lessons.map((lesson) => lesson.id)).toEqual([realLesson.id]);
  });

  it("recovers a binder title from its first real lesson when needed", () => {
    const recovered = deriveBinderTitle(
      {
        ...baseBinder,
        title: "Untitled binder",
      },
      [
        {
          title: "Roman Kingdom and Republic",
          order_index: 1,
          content: emptyDoc(""),
          math_blocks: [],
        },
      ],
    );

    expect(recovered).toBe("Roman Kingdom and Republic");
  });

  it("keeps user content with a missing title so it can be recovered instead of dropped", () => {
    const binder: Binder = {
      ...baseBinder,
      id: "binder-recoverable",
      title: "Untitled binder",
      slug: "untitled-binder",
      description: "",
      status: "draft",
      pinned: false,
    };
    const lesson: BinderLesson = {
      id: "lesson-recoverable",
      binder_id: binder.id,
      title: "Untitled lesson",
      order_index: 1,
      content: emptyDoc("This lesson has real study content."),
      math_blocks: [],
      is_preview: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };

    const visible = filterVisibleWorkspaceData({
      binders: [binder],
      folders: [],
      folderBinders: [],
      lessons: [lesson],
      notes: [],
    });

    expect(visible.binders.map((candidate) => candidate.id)).toContain(binder.id);
    expect(deriveBinderTitle(binder, [lesson])).toContain("This lesson has real study content");
  });

  it("picks one primary diagnostic instead of surfacing a pile of warnings", () => {
    const diagnostics: WorkspaceDiagnostic[] = [
      {
        code: "env_mismatch",
        scope: "supabase",
        severity: "warning",
        title: "Environment mismatch",
        message: "Wrong project.",
      },
      {
        code: "missing_table",
        scope: "suite_templates",
        severity: "error",
        title: "Missing table",
        message: "suite_templates is missing.",
      },
    ];

    expect(selectPrimaryWorkspaceDiagnostic(diagnostics)?.code).toBe("missing_table");
  });
});
