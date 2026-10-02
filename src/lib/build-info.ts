declare const __BUILD_INFO__: { commit: string; dirty: boolean; builtAt: string };

export const buildInfo = typeof __BUILD_INFO__ === "undefined"
  ? { commit: "development", dirty: true, builtAt: "" }
  : __BUILD_INFO__;

export const buildLabel = `${buildInfo.commit.slice(0, 12)}${buildInfo.dirty ? " (local changes)" : ""}`;
