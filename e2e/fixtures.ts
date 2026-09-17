import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const manifestSchema = z.object({
  apiUrl: z.url(),
  users: z.array(z.object({ name: z.string(), email: z.email(), password: z.string(), id: z.uuid() })),
});
export async function signIn(page: Page, name: "learner-a" | "learner-b" | "creator" | "operator") {
  const manifest = manifestSchema.parse(
    JSON.parse(
      await readFile(process.env.BINDERNOTES_E2E_MANIFEST ?? ".tmp/ci-supabase/runtime.json", "utf8"),
    ),
  );
  if (!["127.0.0.1", "localhost"].includes(new URL(manifest.apiUrl).hostname))
    throw new Error("Refusing a nonlocal E2E backend");
  const user = manifest.users.find((candidate) => candidate.name === name);
  if (!user) throw new Error("Disposable role unavailable");
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Login", exact: true }).last().click();
  await expect(page.getByRole("link", { name: "BinderNotes dashboard", exact: true })).toBeVisible();
  return user;
}

export async function openSettings(page: Page) {
  const compact = page.getByTestId("compact-open-settings");
  if (await compact.isVisible()) await compact.click();
  else {
    await page.getByTestId("profile-menu-button").click();
    await page
      .getByTestId("profile-settings-popover")
      .getByRole("button", { name: "Open settings", exact: true })
      .click();
  }
  await expect(page.getByRole("dialog", { name: "BinderNotes settings", exact: true })).toBeVisible();
}

export async function signOut(page: Page) {
  await openSettings(page);
  await page
    .getByRole("dialog", { name: "BinderNotes settings", exact: true })
    .getByRole("button", { name: "Log out", exact: true })
    .click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
}

export async function enableReviewQueue(page: Page) {
  await openSettings(page);
  await page.getByLabel("Search settings", { exact: true }).fill("Beta Features");
  const toggle = page.getByTestId("beta-flag-toggle-betaRevampReviewQueue");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Close settings", exact: true }).click();
}

export async function createPersonalCourseWithText(page: Page, title: string, text: string) {
  await page.goto("/notes");
  await page.getByRole("button", { name: "Create binder", exact: true }).first().click();
  await page.getByLabel("Binder title", { exact: true }).fill(title);
  await page.getByLabel("Create first document", { exact: true }).check();
  await page.getByRole("button", { name: "Create binder", exact: true }).last().click();
  const editor = page.getByRole("textbox", { name: "Note content", exact: true });
  await expect(editor).toBeVisible();
  await editor.fill(text);
  await expect(editor).toHaveText(text);
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  return page.url();
}
