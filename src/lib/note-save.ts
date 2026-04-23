export const NOTE_SAVE_BEFORE_SIGN_OUT_EVENT = "binder-notes:before-sign-out";

export function formatNoteSavedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
