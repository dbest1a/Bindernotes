export class PersonalNoteConflictError extends Error {
  constructor() {
    super("A newer version was saved elsewhere. Your draft is kept in this tab for reload recovery. Open Personal Notes to save a separate copy and keep both versions.");
    this.name = "PersonalNoteConflictError";
  }
}

/** A conditional write rejected an obsolete (or missing) account revision. */
export class LearnerNoteConflictError extends Error {
  constructor(message = "A newer saved version exists. Keep your draft as a separate note, or load the latest version.") {
    super(message);
    this.name = "LearnerNoteConflictError";
  }
}
