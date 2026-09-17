import { test, expect } from "@playwright/test";
import { createPersonalCourseWithText, enableReviewQueue, openSettings, signIn, signOut } from "./fixtures";

// These journeys use the disposable Linux Supabase fixture and real rendered UI.
// No route interception, manufactured responses, or injected authenticated storage.
test.use({ viewport: { width: 1100, height: 900 } });
test.setTimeout(90_000);

test("quiz answers, score and question context survive reload and a second login", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /cannot (?:be a descendant|contain a nested)|hydration error/i.test(message.text())
    )
      errors.push("invalid DOM nesting");
  });
  await signIn(page, "learner-a");
  await page.goto("/math/questions");
  for (const title of ["Graphical meaning of f'(a)", "Slope of x squared at 3", "Moving the tangent point"]) {
    await page.getByRole("checkbox", { name: `Select question: ${title}`, exact: true }).check();
  }
  await page.getByRole("button", { name: "Quiz selected", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Custom math practice", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "The slope of the tangent line at x=a", exact: true }).check();
  await page.getByLabel("Numeric answer: Slope of x squared at 3", { exact: true }).fill("6");
  await page
    .getByLabel("Written answer: Moving the tangent point", { exact: true })
    .fill("it moves along the curve");
  await page.getByRole("button", { name: "Submit answers", exact: true }).click();
  await expect(page).toHaveURL(/\/math\/quizzes\/[^/]+\/results\/[^/]+$/);
  const resultUrl = page.url();
  await expect(page.getByRole("heading", { name: "Score: 3 / 3", exact: true })).toBeVisible();
  await expect(page.getByText("it moves along the curve", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Score: 3 / 3", exact: true })).toBeVisible();
  await signOut(page);
  await signIn(page, "learner-b");
  await page.goto(resultUrl);
  await expect(page.getByText("Saved attempt unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("it moves along the curve", { exact: true })).toHaveCount(0);
  await signOut(page);
  await signIn(page, "learner-a");
  await page.goto(resultUrl);
  await expect(page.getByRole("heading", { name: "Score: 3 / 3", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Slope of x squared at 3", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("canonical review rating and schedule reopen in a fresh browser context", async ({ page, browser }) => {
  await signIn(page, "learner-b");
  await enableReviewQueue(page);
  await page.goto("/review");
  await page.getByRole("button", { name: "Add free-response item", exact: true }).click();
  await expect(page.getByText("Review item saved to your account.", { exact: true })).toBeVisible();
  const card = page.getByTestId("review-session-card");
  await card
    .getByLabel("Student response", { exact: true })
    .fill("I can explain this idea from my own notes.");
  await card.getByRole("button", { name: "Reveal / check", exact: true }).click();
  await card.getByRole("button", { name: "Good", exact: true }).click();
  await expect(page.getByTestId("review-session-summary")).toContainText("1 items");
  await page.reload();
  await expect(page.getByText("No due study items", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await expect(
    card.getByRole("heading", { name: "Explain one idea from today's notes.", exact: true }),
  ).toBeVisible();

  const secondDevice = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    baseURL: "http://127.0.0.1:5174",
  });
  try {
    const second = await secondDevice.newPage();
    await signIn(second, "learner-b");
    await enableReviewQueue(second);
    await second.goto("/review");
    await expect(second.getByText("No due study items", { exact: true })).toBeVisible();
    await second.getByRole("button", { name: "Upcoming", exact: true }).click();
    await expect(
      second
        .getByTestId("review-session-card")
        .getByRole("heading", { name: "Explain one idea from today's notes.", exact: true }),
    ).toBeVisible();
    await second
      .getByTestId("review-session-card")
      .getByRole("button", { name: "Reveal / check", exact: true })
      .click();
    await expect(second.getByTestId("review-session-card")).toContainText(
      "Write the source-linked answer in your own words before checking.",
    );
  } finally {
    await secondDevice.close();
  }
});

test("trashing and restoring a private course preserves its saved document", async ({ page }) => {
  await signIn(page, "learner-a");
  const title = "E2E restore my private course";
  const text =
    "A restorable lesson: the derivative of x squared is two x. Keep the original explanation after restore.";
  const documentUrl = await createPersonalCourseWithText(page, title, text);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Note content", exact: true })).toHaveText(text);
  await page
    .locator("summary")
    .filter({ hasText: /^Trash$/ })
    .click();
  const trash = page.getByRole("region", { name: "Personal Notes trash", exact: true });
  await trash
    .getByLabel("Item to move to trash", { exact: true })
    .selectOption({ label: `course: ${title}` });
  await trash.getByRole("button", { name: "Move to trash", exact: true }).click();
  await expect(trash.getByRole("listitem").filter({ hasText: title })).toBeVisible();
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  await page
    .locator("summary")
    .filter({ hasText: /^Trash$/ })
    .click();
  await trash
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await expect(trash.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);
  await page.goto(documentUrl);
  await expect(page.getByRole("textbox", { name: "Note content", exact: true })).toHaveText(text);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Note content", exact: true })).toHaveText(text);
});

test("learner, paid creator and operator have distinct rendered workspaces", async ({ page }) => {
  await signIn(page, "learner-b");
  await page.goto("/creator");
  await expect(page.getByText("Creator access required", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New creator binder", exact: true })).toHaveCount(0);
  await signOut(page);
  await signIn(page, "creator");
  await page.goto("/creator");
  await expect(page.getByRole("heading", { name: "Creator workspace", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New creator binder", exact: true }).click();
  await page.getByLabel("Binder title", { exact: true }).fill("E2E creator publication");
  await page.getByRole("button", { name: "Save as draft", exact: true }).click();
  await expect(page.getByText("Saved “E2E creator publication” as draft.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "E2E creator publication · draft", exact: true }).click();
  await expect(page.getByLabel("Binder title", { exact: true })).toHaveValue("E2E creator publication");
  await page.getByRole("button", { name: "Publish binder", exact: true }).click();
  await expect(
    page.getByText("Saved “E2E creator publication” as published.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "E2E creator publication · published", exact: true }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Publishing queue", exact: true })).toHaveCount(0);
  await signOut(page);
  await signIn(page, "operator");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Publishing queue", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New binder", exact: true })).toBeVisible();
});

test("narrow-screen navigation reaches account settings and backups without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "learner-b");
  await openSettings(page);
  const dialog = page.getByRole("dialog", { name: "BinderNotes settings", exact: true });
  await dialog.getByRole("link", { name: "Password, sessions and account deletion", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account and security", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open Data and backups", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/data$/);
  await expect(page.getByRole("heading", { name: "Data & backups", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("link", { name: "BinderNotes dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await signOut(page);
});

test("a listed course with no published curriculum explains what is available", async ({ page }) => {
  await signIn(page, "learner-b");
  await page.goto("/math/courses/ap-calculus-ab");
  await expect(page.getByRole("heading", { name: "AP Calculus AB", exact: true })).toBeVisible();
  await expect(
    page.getByText("No topics have been published for this course yet.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No modules published yet", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Browse available modules", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Math modules", exact: true })).toBeVisible();
});
