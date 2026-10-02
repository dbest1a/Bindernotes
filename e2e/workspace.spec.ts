import { test, expect } from "@playwright/test";

for (const [width,height] of [[1165,757],[820,600],[821,757],[1180,900],[1181,600],[1440,900]]) {
  for (const preset of ["notes-focus","focused-reading"]) {
    test(`editor remains reachable ${width}x${height} ${preset}`, async ({page}) => {
      const errors:string[]=[]; page.on("pageerror",error=>errors.push(error.message));
      await page.setViewportSize({width,height});
      await page.goto(`/e2e/fixtures/index.html?preset=${preset}`);
      if(preset==="focused-reading") {
        const source=page.locator('[data-facelift-module="lesson"] .source-lesson-content');
        await expect(source).toBeVisible();
        await source.scrollIntoViewIfNeeded();
        await expect(source).toBeInViewport();
        await page.getByRole("button",{name:"Notes",exact:true}).first().click();
      }
      if(width<=820) await page.getByRole("navigation",{name:"Mobile study modules"}).getByRole("button",{name:/notes/i}).click();
      const editor=page.locator('[data-facelift-module="private-notes"] .tiptap');
      await expect(editor).toBeVisible();
      await editor.scrollIntoViewIfNeeded();
      await expect(editor).toBeInViewport();
      expect((await editor.boundingBox())!.height).toBeGreaterThan(80);
      await editor.fill(`Exact persisted content at ${width} by ${height}`);
      const save=page.getByRole("button",{name:"Save now",exact:true}).last();
      await save.click();
      await page.reload();
      if(preset==="focused-reading") await page.getByRole("button",{name:"Notes",exact:true}).first().click();
      if(width<=820) await page.getByRole("navigation",{name:"Mobile study modules"}).getByRole("button",{name:/notes/i}).click();
      await expect(editor).toHaveText(`Exact persisted content at ${width} by ${height}`);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
      expect(errors).toEqual([]);
    });
  }
}

for(const density of ["comfortable","compact","focus"]) {
  test(`minimal chrome retains writing surface in ${density}`,async({page})=>{
    await page.setViewportSize({width:1165,height:757});
    await page.goto(`/e2e/fixtures/index.html?preset=notes-focus&density=${density}&chrome=minimal`);
    const editor=page.locator('[data-facelift-module="private-notes"] .tiptap');
    await expect(editor).toBeVisible();
    await editor.scrollIntoViewIfNeeded();
    await expect(editor).toBeInViewport();
    await editor.fill("Minimal chrome still supports editing.");
    await expect(page.getByRole("button",{name:"Save now",exact:true}).last()).toBeEnabled();
  });
}
