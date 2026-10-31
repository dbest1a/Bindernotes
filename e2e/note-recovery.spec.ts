import { test, expect } from "@playwright/test";

// Actual study shell/editor/recovery UI with isolated handlers, never live auth.
for (const width of [1440, 390]) {
  test(`recovery actions retain keyboard access and fit at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto("/e2e/fixtures/index.html?preset=notes-focus&recovery");
    if(width<=820) await page.getByRole("navigation",{name:"Mobile study modules"}).getByRole("button",{name:/notes/i}).click();
    const recovery=page.getByRole("region",{name:"Note recovery"});
    await expect(recovery).toBeVisible();
    const editor=page.locator('[data-facelift-module="private-notes"] .tiptap');
    await editor.fill("Draft that must remain available.");
    await expect(page.getByRole("button",{name:"Choose a version",exact:true})).toBeDisabled();
    const latest=recovery.getByRole("button",{name:"Use latest…"});
    await latest.focus();await page.keyboard.press("Enter");
    await expect(recovery.getByRole("button",{name:"Cancel",exact:true})).toBeFocused();
    await expect(editor).toHaveText("Draft that must remain available.");
    await page.keyboard.press("Enter");
    await expect(latest).toBeFocused();
    const downloaded=page.waitForEvent("download");
    await recovery.getByRole("button",{name:"Download draft (.json)"}).click();
    expect((await downloaded).suggestedFilename()).toBe("isolated-note-draft.json");
    await recovery.getByRole("button",{name:"Keep both",exact:true}).click();
    await expect(recovery.getByText(/Both versions are kept/)).toBeVisible();
    await expect(recovery.getByRole("link",{name:"Open saved copy in Personal Notes"})).toBeVisible();
    await expect(editor).toHaveText("Latest account version — isolated fixture.");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  });
}

test("failed recovery leaves editable text and recovery actions available",async({page})=>{
  await page.goto("/e2e/fixtures/index.html?preset=notes-focus&recovery&recovery-error");
  const editor=page.locator('[data-facelift-module="private-notes"] .tiptap');
  await editor.fill("Keep my draft after a connection error.");
  await page.getByRole("button",{name:"Keep both",exact:true}).click();
  await expect(page.getByText("Connection interrupted. Your draft is still here.")).toBeVisible();
  await expect(editor).toHaveText("Keep my draft after a connection error.");
  await expect(page.getByRole("button",{name:"Keep both",exact:true})).toBeEnabled();
});
