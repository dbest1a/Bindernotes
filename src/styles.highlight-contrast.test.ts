import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

function cssBlock(selector: string) {
  const start = css.indexOf(selector);
  const end = css.indexOf("}", start);
  return start >= 0 && end >= 0 ? css.slice(start, end + 1) : "";
}

describe("theme-aware highlight contrast styles", () => {
  it("uses theme tokens for default editor highlight marks instead of fixed amber", () => {
    const markBlock = cssBlock(".ProseMirror mark {");

    expect(markBlock).toContain("background-color: hsl(var(--editor-highlight-yellow)");
    expect(markBlock).toContain("color: hsl(var(--editor-highlight-yellow-foreground))");
    expect(markBlock).not.toContain("bg-amber-200");
  });

  it("maps saved toolbar colors to theme-aware highlight variants", () => {
    for (const color of [
      "--editor-highlight-yellow",
      "--editor-highlight-blue",
      "--editor-highlight-green",
      "--editor-highlight-pink",
      "--editor-highlight-orange",
    ]) {
      expect(css).toContain(color);
    }

    expect(css).toContain('.ProseMirror mark[style*="#fde68a"]');
    expect(css).toContain('.ProseMirror mark[style*="#fdba74"]');
    expect(css).toContain("!important");
  });

  it("defines darker readable highlight colors for dark themes", () => {
    const darkBlock = cssBlock(".dark {");

    expect(darkBlock).toContain("--editor-highlight-yellow: 42 88% 32%");
    expect(darkBlock).toContain("--editor-highlight-yellow-foreground: 44 96% 94%");
  });
});
