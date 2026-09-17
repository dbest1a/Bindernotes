import { test, expect } from "@playwright/test";
import { signIn, signOut } from "./fixtures";

test("real Auth, note creation, navigation/reload persistence and same-browser account isolation", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.name));
  await signIn(page, "learner-a");
  await page.getByRole("link", { name: "Personal Notes", exact: true }).click();
  await page.getByRole("button", { name: "Create binder", exact: true }).click();
  await page.getByLabel("Binder title", { exact: true }).fill("E2E private course A");
  await page.getByLabel("Create first document", { exact: true }).check();
  await page.getByRole("button", { name: "Create binder", exact: true }).last().click();
  const editor = page.getByRole("textbox", { name: "Note content", exact: true });
  await expect(editor).toBeVisible();
  const privateUrl = page.url();
  const content =
    "E2E_PRIVATE_A. Equation: x² differentiates to2x. This substantial note must survive navigation and reload.";
  await editor.fill(content);
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page.getByRole("link", { name: "Personal Notes", exact: true }).click();
  await expect(editor).toHaveText(content);
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.reload();
  await expect(editor).toHaveText(content);
  await signOut(page);
  await signIn(page, "learner-b");
  await page.goto(privateUrl);
  await expect(page.getByRole("heading", { name: "Personal Notes", exact: true })).toBeVisible();
  await expect(page.getByText(content, { exact: true })).toHaveCount(0);
  await expect(page.getByText("E2E private course A", { exact: true })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("unsigned requests to protected routes redirect to real sign-in", async ({ page }) => {
  await page.goto("/notes");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal Notes", exact: true })).toHaveCount(0);
});

test("learner cannot navigate directly to operator administration", async ({ page }) => {
  await signIn(page, "learner-b");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Admin Studio", exact: true })).toHaveCount(0);
});
