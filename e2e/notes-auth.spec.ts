import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const schema = z.object({ apiUrl: z.url(), users: z.array(z.object({ name: z.string(), email: z.email(), password: z.string(), id: z.uuid() })) });
async function signIn(page: Page, name: string) {
  const manifest = schema.parse(JSON.parse(await readFile(process.env.BINDERNOTES_E2E_MANIFEST ?? ".tmp/ci-supabase/runtime.json", "utf8")));
  if (!["127.0.0.1", "localhost"].includes(new URL(manifest.apiUrl).hostname)) throw new Error("Refusing a nonlocal E2E backend");
  const user = manifest.users.find((candidate) => candidate.name === name);
  if (!user) throw new Error("Disposable role unavailable");
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Login", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible();
}

test("real Auth, note creation, navigation/reload persistence and same-browser account isolation", async ({ page }) => {
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
  const content = "E2E_PRIVATE_A. Equation: x² differentiates to2x. This substantial note must survive navigation and reload.";
  await editor.fill(content);
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page.getByRole("link", { name: "Personal Notes", exact: true }).click();
  await expect(editor).toHaveText(content);
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.reload();
  await expect(editor).toHaveText(content);
  await page.getByRole("button", { name: "Log out", exact: true }).click();
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
