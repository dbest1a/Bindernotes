export class PersonalNoteConflictError extends Error {
  constructor() {
    super("A newer version was saved elsewhere. Your draft is kept in this tab for reload recovery. Open Personal Notes to save a separate copy and keep both versions.");
    this.name = "PersonalNoteConflictError";
  }
}
