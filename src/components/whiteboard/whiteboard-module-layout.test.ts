import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/whiteboard/whiteboard-module.tsx"), "utf8");

describe("WhiteboardModule workspace layout", () => {
  it("uses a resize-friendly full-height shell for the normal workspace module", () => {
    expect(source).toContain("whiteboard-workspace-panel--module h-full min-h-0");
    expect(source).toContain("whiteboard-module-layout grid h-full min-h-0");
    expect(source).toContain("whiteboard-module-surface relative h-full min-h-0 overflow-hidden");
    expect(source).toContain("whiteboard-module-board relative h-full min-h-0 min-w-0 overflow-hidden");
  });

  it("does not reuse fixed lab-sized canvas constraints in the normal workspace module", () => {
    expect(source).not.toContain('whiteboard-workspace-panel min-h-[720px]');
    expect(source).not.toContain('relative min-h-[680px] overflow-auto');
    expect(source).not.toContain('relative min-h-[1800px] min-w-[1800px]');
  });
});
