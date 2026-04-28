// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { Binder, BinderLesson, DashboardData, Folder, FolderBinderLink } from "@/types";
import {
  createDashboardOrganizationDraft,
  moveBinderToFolder,
  reorderDashboardBinders,
  reorderDashboardFolders,
  resetDashboardOrganizationDraft,
} from "@/lib/dashboard-organization";

const timestamp = new Date(0).toISOString();

function binder(id: string, title: string, dashboardSortOrder?: number): Binder {
  return {
    id,
    owner_id: "admin-1",
    title,
    slug: title.toLowerCase().replace(/\s+/g, "-"),
    description: `${title} description`,
    subject: "History",
    level: "Foundations",
    status: "published",
    price_cents: 0,
    cover_url: null,
    pinned: false,
    dashboard_sort_order: dashboardSortOrder,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function folder(id: string, name: string, sortOrder?: number): Folder {
  return {
    id,
    owner_id: "admin-1",
    name,
    color: "blue",
    sort_order: sortOrder,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function link(folderId: string, binderId: string, sortOrder?: number): FolderBinderLink {
  return {
    id: `${folderId}:${binderId}`,
    owner_id: "admin-1",
    folder_id: folderId,
    binder_id: binderId,
    sort_order: sortOrder,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

const data: DashboardData = {
  binders: [binder("binder-a", "Alpha"), binder("binder-b", "Beta"), binder("binder-c", "Gamma")],
  folders: [folder("folder-one", "One"), folder("folder-two", "Two")],
  folderBinders: [link("folder-one", "binder-a"), link("folder-one", "binder-b"), link("folder-two", "binder-c")],
  lessons: [] as BinderLesson[],
  notes: [],
  recentLessons: [],
  seedHealth: [],
  diagnostics: [],
};

describe("dashboard organization draft", () => {
  it("builds folder, binder, and folder-contained binder order from dashboard data", () => {
    const draft = createDashboardOrganizationDraft(data);

    expect(draft.folderOrder).toEqual(["folder-one", "folder-two"]);
    expect(draft.binderOrder).toEqual(["binder-a", "binder-b", "binder-c"]);
    expect(draft.binderFolderIdByBinderId).toEqual({
      "binder-a": "folder-one",
      "binder-b": "folder-one",
      "binder-c": "folder-two",
    });
    expect(draft.folderBinderOrderByFolderId["folder-one"]).toEqual(["binder-a", "binder-b"]);
  });

  it("reorders folders and binders without mutating the original draft", () => {
    const draft = createDashboardOrganizationDraft(data);
    const foldersReordered = reorderDashboardFolders(draft, "folder-two", "folder-one");
    const bindersReordered = reorderDashboardBinders(draft, "binder-c", "binder-a");

    expect(foldersReordered.folderOrder).toEqual(["folder-two", "folder-one"]);
    expect(bindersReordered.binderOrder).toEqual(["binder-c", "binder-a", "binder-b"]);
    expect(draft.folderOrder).toEqual(["folder-one", "folder-two"]);
    expect(draft.binderOrder).toEqual(["binder-a", "binder-b", "binder-c"]);
  });

  it("honors backend sort fields when building the default draft", () => {
    const sortedData: DashboardData = {
      ...data,
      binders: [
        binder("binder-a", "Alpha", 30),
        binder("binder-b", "Beta", 10),
        binder("binder-c", "Gamma", 20),
      ],
      folders: [folder("folder-one", "One", 20), folder("folder-two", "Two", 10)],
      folderBinders: [
        link("folder-one", "binder-a", 2),
        link("folder-one", "binder-b", 1),
        link("folder-two", "binder-c", 1),
      ],
    };

    const draft = createDashboardOrganizationDraft(sortedData);

    expect(draft.folderOrder).toEqual(["folder-two", "folder-one"]);
    expect(draft.binderOrder).toEqual(["binder-b", "binder-c", "binder-a"]);
    expect(draft.folderBinderOrderByFolderId["folder-one"]).toEqual(["binder-b", "binder-a"]);
  });

  it("moves a binder into another folder and records the insertion order", () => {
    const draft = createDashboardOrganizationDraft(data);
    const moved = moveBinderToFolder(draft, {
      binderId: "binder-b",
      folderId: "folder-two",
      beforeBinderId: "binder-c",
    });

    expect(moved.binderFolderIdByBinderId["binder-b"]).toBe("folder-two");
    expect(moved.folderBinderOrderByFolderId["folder-one"]).toEqual(["binder-a"]);
    expect(moved.folderBinderOrderByFolderId["folder-two"]).toEqual(["binder-b", "binder-c"]);
  });

  it("can reset a modified draft back to server/default order", () => {
    const draft = createDashboardOrganizationDraft(data);
    const moved = moveBinderToFolder(draft, { binderId: "binder-a", folderId: "folder-two" });
    const reset = resetDashboardOrganizationDraft(data, moved);

    expect(reset).toEqual(createDashboardOrganizationDraft(data));
  });
});
