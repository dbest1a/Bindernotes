import { createContext } from "react";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type { WhiteboardSaveStatus } from "@/lib/whiteboards/whiteboard-types";

/** The board's real save state, so cards that save with the board can report it truthfully. */
export const WhiteboardSaveStatusContext = createContext<WhiteboardSaveStatus | null>(null);

type NoteSaveCopy = Pick<WorkspaceModuleContext, "autosaveStatus" | "noteSaveLabel" | "noteSaveDetail" | "noteSaveError">;

/** What a notes card on the board should say about saving, given the board's save state. */
export function describeBoardNoteSave(status: WhiteboardSaveStatus | null): NoteSaveCopy {
  switch (status) {
    case "saved":
      return { autosaveStatus: "saved", noteSaveLabel: "Saved with board", noteSaveDetail: "This note saves with the whiteboard.", noteSaveError: null };
    case "saving":
      return { autosaveStatus: "saving", noteSaveLabel: "Saving with board…", noteSaveDetail: "This note saves with the whiteboard.", noteSaveError: null };
    case "offline-draft":
      return { autosaveStatus: "offline", noteSaveLabel: "Saved on this device", noteSaveDetail: "This board is kept on this device until it can save to your account.", noteSaveError: null };
    case "limit":
    case "storage-limit":
      return {
        autosaveStatus: "error",
        noteSaveLabel: "Board can't save",
        noteSaveDetail: "This board reached a storage limit. Your note is kept in its recovery copy on this device.",
        noteSaveError: "The board reached a storage limit.",
      };
    case "error":
    case "unavailable":
      return {
        autosaveStatus: "error",
        noteSaveLabel: "Not saved to your account yet",
        noteSaveDetail: "Your note is kept in this board's recovery copy on this device, and saving will retry.",
        noteSaveError: "The board could not save to your account.",
      };
    default:
      return { autosaveStatus: "saved", noteSaveLabel: "Saves with this board", noteSaveDetail: "This note is part of the whiteboard and saves with it.", noteSaveError: null };
  }
}
