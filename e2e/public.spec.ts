import { test, expect } from "@playwright/test";

for (const viewport of [{width:1180,height:757},{width:390,height:844}]) {
  test(`public first-use journey at ${viewport.width}px`,async({page})=>{
    const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setViewportSize(viewport);
    for(const route of ["/pricing","/tutorial","/help","/auth?mode=signup","/auth?mode=recovery"]){
      await page.goto(`http://127.0.0.1:5197${route}`);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Something went wrong");
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route).toBeTruthy();
      if(route==="/pricing") {
        const heading = page.getByRole("heading", { level: 1, name: "Your study workspace. Free for now." });
        await expect(heading).toBeVisible();
        // Wait for the finite clip-path reveal before checking or capturing text.
        await heading.evaluate(async (element) => {
          await document.fonts.ready;
          await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
        });
        expect(await heading.evaluate((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          const text = range.getBoundingClientRect();
          const paragraph = element.nextElementSibling?.getBoundingClientRect();
          const hero = element.closest(".pricing-hero")!.getBoundingClientRect();
          return {
            fullyRevealed: style.clipPath === "none" || (style.clipPath.startsWith("inset(") && style.clipPath.slice(6, -1).split(/\s+/).every((inset) => Number.parseFloat(inset) === 0)),
            fitsSection: text.left >= hero.left && text.right <= hero.right && text.top >= hero.top && text.bottom <= hero.bottom,
            clearsParagraph: Boolean(paragraph && box.bottom <= paragraph.top && text.bottom <= paragraph.top),
          };
        }), "The complete pricing heading must fit its section and clear the next paragraph").toEqual({ fullyRevealed: true, fitsSection: true, clearsParagraph: true });
      }
      if(route==="/tutorial") {
        await expect(page.getByText(/quick.start/i).first()).toBeVisible();
        await expect(page.locator("body")).toContainText(/reopen/i);
      }
      if(route.includes("signup")) {
        await expect(page.getByLabel("Password",{exact:true})).toBeVisible();
        await expect(page.locator("body")).not.toContainText("SQL editor");
        await expect(page.locator('form button[type="submit"]')).toContainText(/create|sign up/i);
      }
      if(route.includes("recovery")) await expect(page.locator('form button[type="submit"]')).toContainText(/reset/i);
      await page.screenshot({path:`test-results/public-${viewport.width}-${route.replace(/[^a-z]+/gi,"-")}.png`,fullPage:true});
    }
    expect(errors).toEqual([]);
  });
}
