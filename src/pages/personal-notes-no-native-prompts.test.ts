import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Personal Notes native prompt guard", () => {
  it("does not ship browser prompt, alert, or confirm flows", () => {
    const source = readFileSync(
      join(process.cwd(), "src/pages/personal-notes-page.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/\bwindow\.prompt\b|\bprompt\(/);
    expect(source).not.toMatch(/\bwindow\.alert\b|\balert\(/);
    expect(source).not.toMatch(/\bwindow\.confirm\b|\bconfirm\(/);
  });
});
