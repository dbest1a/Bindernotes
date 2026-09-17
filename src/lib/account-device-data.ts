/** Delete only recognized account-keyed data. An owner ID inside an entity ID
 * or payload is not evidence that a storage entry belongs to that account. */
export function removeAccountDeviceData(ownerId: string, storages: Storage[]) {
  if (!ownerId || ownerId.includes(":")) throw new Error("Invalid account storage scope.");
  const encoded = encodeURIComponent(ownerId);
  const prefixes = [
    `binder-notes:draft:v2:${encoded}:`,
    `binder-notes:reader-note-id:${ownerId}:`,
    `bindernotes:whiteboard-draft:v1:${encoded}:`,
    `bindernotes:whiteboard-draft:v1:selected:${encoded}:`,
    `bindernotes:whiteboards:${ownerId}:`,
    `bindernotes:recall-lab:${ownerId}:`,
    `bindernotes:canonical-recall-draft:v1:${ownerId}:`,
    `bindernotes:cloud-review-pending:v1:${ownerId}:`,
    `bindernotes:cloud-recall-session-pending:v1:${ownerId}:`,
    `bindernotes:creator-draft:v1:${ownerId}:`,
    `binder-notes:math-lab:v3:${ownerId}:`,
    `bindernotes:upload:${ownerId}:`,
    `binder-notes:workspace:v1:${ownerId}:`,
  ];
  const exact = new Set([
    `bindernotes:study-items:v1:${ownerId}`,
    `bindernotes:study-review-events:v1:${ownerId}`,
    `bindernotes:math-study-loop:problem-logs:v1:${ownerId}`,
    `bindernotes:math-study-loop:formula-cards:v1:${ownerId}`,
    `bindernotes:math-study-loop:graph-links:v1:${ownerId}`,
    `bindernotes:math-local-import-backup:v1:${ownerId}`,
    `bindernotes:account-delete:${ownerId}`,
    `bindernotes:beta-features:${ownerId}`,
    `binder-notes:personal-notes:${ownerId}:preferences:v1`,
    `binder-notes:dashboard-workspace-view:${ownerId}`,
    `binder-notes:admin-dashboard-width:${ownerId}`,
    `binder-notes:admin-dashboard-order:${ownerId}`,
    `bindernotes:tutorial-prompts:v1:${ownerId}`,
  ]);
  for (const storage of storages) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && (exact.has(key) || prefixes.some((prefix) => key.startsWith(prefix))))
        storage.removeItem(key);
    }
  }
}
