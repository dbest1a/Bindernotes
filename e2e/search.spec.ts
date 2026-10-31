import { test, expect, type Page } from "@playwright/test";

// Isolated component checks with synthetic records: not proof of live auth or account data.
const fixture = "/e2e/fixtures/search.html";
const searchBox = (page: Page) => page.getByRole("combobox", { name: "Search lessons, binders, and notes" });

async function openWithShortcut(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(searchBox(page)).toBeFocused();
}

test.describe("global search", () => {
  test("opens a non-recent lesson in the reader from the keyboard and restores focus on Escape", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(fixture);

    const pageField = page.getByLabel("Page field");
    await pageField.focus();
    await openWithShortcut(page);
    await expect(page.getByRole("dialog", { name: "Search BinderNotes" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(pageField).toBeFocused();

    await openWithShortcut(page);
    await page.keyboard.type("limiting stoichiometry");
    await expect(page.getByRole("option", { name: /^Stoichiometry and limiting reagents,/ })).toBeVisible();
    await expect(page.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("location")).toHaveText("/binders/fixture-chemistry/documents/fixture-lesson-1");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("keeps Tab and Shift+Tab inside the dialog and returns focus to the header button", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(fixture);

    const trigger = page.getByRole("button", { name: "Search lessons, binders, and notes" });
    await trigger.click();
    const input = searchBox(page);
    await expect(input).toBeFocused();
    await page.keyboard.type("square");
    const clear = page.getByRole("button", { name: "Clear search text" });
    const close = page.getByRole("button", { name: "Close search" });

    await page.keyboard.press("Tab");
    await expect(clear).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("moves through results with arrow keys and opens a notebook document at its own route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(fixture);
    await openWithShortcut(page);

    const input = searchBox(page);
    const first = await input.getAttribute("aria-activedescendant");
    await page.keyboard.press("ArrowDown");
    const second = await input.getAttribute("aria-activedescendant");
    expect(second).not.toBe(first);
    await expect(page.locator(`[id="${second}"]`)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.type("quadratic review");
    await page.getByRole("option", { name: /^Unit review plan,/ }).click();
    await expect(page.getByTestId("location")).toHaveText("/notes/binders/fixture-notebook/documents/fixture-note-2");
  });

  test("hands off to the page's command palette so only one palette is ever open", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${fixture}?page=notes`);
    await openWithShortcut(page);

    await expect(page.getByRole("group", { name: "On this page" })).toBeVisible();
    await page.keyboard.type("focus mode");
    await page.getByRole("option", { name: /^Personal Notes commands,/ }).click();

    const palette = page.getByRole("dialog", { name: "Personal Notes command palette" });
    await expect(palette).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(palette.getByLabel("Command search")).toBeFocused();
    await expect(palette.getByLabel("Command search")).toHaveValue("focus mode");

    await page.keyboard.press("ControlOrMeta+k");
    await expect(searchBox(page)).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("fits a phone screen with touch-sized controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixture);

    const trigger = page.getByRole("button", { name: "Search lessons, binders, and notes" });
    const triggerBox = (await trigger.boundingBox())!;
    expect(triggerBox.width).toBeGreaterThanOrEqual(40);
    expect(triggerBox.height).toBeGreaterThanOrEqual(40);
    await trigger.click();
    await expect(searchBox(page)).toBeFocused();
    await page.keyboard.type("practice");

    const panel = page.getByRole("dialog", { name: "Search BinderNotes" });
    // Measure the settled panel: its entrance animation scales it up from 0.99.
    await panel.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
    const panelBox = (await panel.boundingBox())!;
    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(390);
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();

    const close = page.getByRole("button", { name: "Close search" });
    const closeBox = (await close.boundingBox())!;
    expect(closeBox.width).toBeGreaterThanOrEqual(44);
    expect(closeBox.height).toBeGreaterThanOrEqual(44);
    const optionBox = (await page.getByRole("option").first().boundingBox())!;
    expect(optionBox.height).toBeGreaterThanOrEqual(44);
    expect(await searchBox(page).evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");

    // Long result lists scroll inside the panel instead of pushing it off screen.
    const results = page.getByTestId("global-search-results");
    expect(await results.evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");
    await page.screenshot({ path: "test-results/global-search-390.png" });
  });

  test("skips the entrance animation when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(fixture);
    await openWithShortcut(page);

    const panel = page.getByRole("dialog", { name: "Search BinderNotes" });
    expect(await panel.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });
});
