import { ZodError } from "zod";

export type ArchiveOperation = "export" | "validate" | "import" | "restore";
const fallback: Record<ArchiveOperation, string> = {
  export:
    "The complete archive could not be prepared. Nothing was downloaded. Check your connection and try again.",
  validate:
    "This archive could not be validated. Choose a valid BinderNotes JSON archive and try again. Your saved work has not changed.",
  import:
    "The import could not be confirmed. Keep this archive and retry the same file to check its result without duplicates.",
  restore:
    "Device Math setup could not be completed. Its backup remains in your account. Check your connection and try again.",
};
const safeMessages = new Map([
  [
    "The account changed. Reopen Data & backups in the intended account.",
    "The account changed. Reopen Data & backups in the intended account.",
  ],
  ["Choose a BinderNotes JSON archive up to 100 MiB.", "Choose a BinderNotes JSON archive up to 100 MiB."],
  [
    "Archive exceeds the 100 MiB limit.",
    "This archive exceeds the 100 MiB limit. Choose a smaller complete archive.",
  ],
  [
    "This complete archive exceeds 100 MiB. No partial archive was downloaded.",
    "This complete archive exceeds 100 MiB. No partial archive was downloaded.",
  ],
  [
    "Legacy whiteboard attachments need migration before a complete archive can be created. Their saved data is unchanged.",
    "Some older whiteboard attachments cannot be included yet. Your saved work is unchanged; a complete archive was not downloaded.",
  ],
  [
    "Finish or remove pending file uploads before creating a complete archive.",
    "Finish or remove pending file uploads before creating a complete archive.",
  ],
  [
    "The import receipt did not confirm every requested record. Keep the archive and retry to check the result.",
    "The import did not confirm every requested record. Keep the archive and retry the same file to check its result.",
  ],
  [
    "Math records with these IDs differ on this device. The imported backup is preserved in your account.",
    "Some Math work on this device differs from the imported backup. Your existing work and the account backup have both been kept.",
  ],
]);

/** Never render schema paths, rejected payloads, SQL details or raw server bodies. */
export function archiveErrorMessage(error: unknown, operation: ArchiveOperation): string {
  if (error instanceof SyntaxError && operation === "validate")
    return "This file is not valid JSON. Choose a BinderNotes JSON archive and try again. Your saved work has not changed.";
  if (error instanceof ZodError)
    return operation === "validate"
      ? "This archive is invalid or uses an unsupported version. Choose a valid BinderNotes JSON archive and try again. Your saved work has not changed."
      : fallback[operation];
  if (error instanceof Error) {
    const safe = safeMessages.get(error.message);
    if (safe) return safe;
  }
  return fallback[operation];
}
