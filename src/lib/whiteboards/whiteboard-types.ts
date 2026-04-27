import type { JSONContent } from "@tiptap/react";
import type { Comment, Highlight, WorkspaceModuleId } from "@/types";

export type WhiteboardModuleMode = "live" | "preview" | "collapsed";
export type WhiteboardModuleAnchorMode = "board" | "board-fixed-size" | "viewport";

export type WhiteboardModuleElement = {
  id: string;
  type: "bindernotes-module";
  moduleId: WorkspaceModuleId;
  binderId?: string;
  lessonId?: string;
  savedGraphId?: string;
  graphInstanceId?: string;
  noteContent?: JSONContent;
  noteTitle?: string;
  whiteboardHighlights?: Highlight[];
  whiteboardComments?: Comment[];
  sourceConfirmed?: boolean;
  sourceDisplayMode?: "compact" | "full" | "summary" | "header-hidden";
  cardDensity?: "compact" | "comfortable";
  textSize?: "small" | "normal" | "large";
  showMathInline?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  mode: WhiteboardModuleMode;
  anchorMode?: WhiteboardModuleAnchorMode;
  pinned?: boolean;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

export type WhiteboardSceneData = {
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
};

export type BinderWhiteboardStorageMode = "local-draft" | "supabase";
export type WhiteboardStorageBackend = "local" | "supabase";

export type BinderWhiteboard = {
  id: string;
  ownerId: string;
  binderId: string;
  lessonId: string | null;
  title: string;
  subject: string;
  moduleContext: "binder" | "lesson" | "math-lab";
  scene: WhiteboardSceneData;
  modules: WhiteboardModuleElement[];
  thumbnailDataUrl?: string | null;
  objectCount: number;
  sceneSizeBytes: number;
  assetSizeBytes: number;
  storageMode: BinderWhiteboardStorageMode;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type WhiteboardScope = {
  ownerId: string;
  binderId: string;
  lessonId?: string | null;
};

export type WhiteboardTemplate = {
  id: string;
  name: string;
  description: string;
  subject: "math" | "general";
  starterElements?: unknown[];
};

export type WhiteboardSaveStatus =
  | "saved"
  | "saving"
  | "offline-draft"
  | "error"
  | "limit"
  | "storage-limit"
  | "unavailable";

export type WhiteboardSaveResult = {
  board: BinderWhiteboard;
  backend: WhiteboardStorageBackend;
  status: "saved" | "local-draft" | "error" | "limit" | "storage-limit" | "unavailable";
  message: string;
  savedAt: string;
  error?: string;
};

export type WhiteboardListResult = {
  boards: BinderWhiteboard[];
  backend: WhiteboardStorageBackend;
  status: "loaded" | "local-draft" | "error";
  message: string;
  error?: string;
};

export type WhiteboardArchiveResult = {
  backend: WhiteboardStorageBackend;
  status: "archived" | "local-draft" | "error";
  message: string;
  archivedAt?: string;
  error?: string;
};

export type WhiteboardValidationResult = {
  valid: boolean;
  objectCount: number;
  sceneSizeBytes: number;
  warnings: string[];
  errors: string[];
};
