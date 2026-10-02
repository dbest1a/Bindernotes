import { test, expect, type Page } from "@playwright/test";

const notePath = process.env.E2E_NOTE_PATH!;
const writingSurface = (page: Page) => page.getByTestId("personal-note-writing-surface").locator(".tiptap");
async function save(page: Page) {
  const button = page.getByRole("button", { name: /^(Save|Save now)$/ }).last();
  if (await button.isEnabled()) await button.click();
  await expect(button).toBeDisabled();
  await expect(page.getByText("Save failed", { exact: true })).toHaveCount(0);
}

test("server-backed exact content survives navigation/reload and rejects a stale tab", async ({page,browser}) => {
  await page.goto(`/auth?next=${encodeURIComponent(notePath)}`);
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole("textbox", { name: "Note title", exact: true })).toBeVisible();
  const originalTitle = await page.getByRole("textbox", { name: "Note title", exact: true }).inputValue();
  expect(originalTitle.startsWith("TEST "), "Only a designated TEST note may be edited").toBeTruthy();
  await expect(page).toHaveURL(new URL(notePath, process.env.E2E_STAGING_URL).href);
  const baseline = `TEST baseline ${Date.now()}`;
  await writingSurface(page).fill(baseline);
  await save(page);
  await page.reload();
  await expect(writingSurface(page)).toHaveText(baseline);

  const staleContext = await browser.newContext({ storageState: await page.context().storageState() });
  const stale = await staleContext.newPage();
  try {
    await stale.goto(new URL(notePath, process.env.E2E_STAGING_URL).href);
    await expect(writingSurface(stale)).toHaveText(baseline);
    const latest = `${baseline} — newer saved contribution`;
    await writingSurface(page).fill(latest);
    await save(page);
    await page.goto("/dashboard");
    await page.goto(notePath);
    await expect(writingSurface(page)).toHaveText(latest);
    await writingSurface(stale).fill(`${baseline} — stale contribution kept separately`);
    await stale.getByRole("button",{name:/^(Save|Save now)$/}).last().click();
    await expect(stale.getByText(/A newer version was saved elsewhere/)).toBeVisible();
    await expect(stale.getByRole("button",{name:"Save a separate copy"})).toBeVisible();
    await page.reload();
    await expect(writingSurface(page)).toHaveText(latest);
    await stale.getByRole("button",{name:"Save a separate copy"}).click();
    await expect(stale).not.toHaveURL(new URL(notePath, process.env.E2E_STAGING_URL).href);
    await stale.reload();
    await expect(writingSurface(stale)).toHaveText(`${baseline} — stale contribution kept separately`);
  } finally { await staleContext.close(); }
});
