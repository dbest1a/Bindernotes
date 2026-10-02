import { test, expect, type Page } from "@playwright/test";

async function seedBoard(page: Page) {
  await page.addInitScript(()=>{
    if(localStorage.getItem("bindernotes:whiteboards:fixture:browser-binder:browser-lesson")) return;
    const timestamp=new Date().toISOString();
    localStorage.setItem("bindernotes:whiteboards:fixture:browser-binder:browser-lesson",JSON.stringify([{
      id:"fixture-board",ownerId:"fixture",binderId:"browser-binder",lessonId:"browser-lesson",title:"Browser board",subject:"Math",moduleContext:"lesson",
      scene:{elements:[],appState:{viewBackgroundColor:"#ffffff",scrollX:0,scrollY:0,zoom:{value:1}},files:{}},
      modules:[{id:"drag-card",type:"bindernotes-module",moduleId:"private-notes",title:"Drag this note",noteTitle:"Drag this note",noteContent:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"A note on the board."}]}]},x:150,y:250,width:430,height:380,zIndex:1,mode:"live",anchorMode:"board",createdAt:timestamp,updatedAt:timestamp}],
      objectCount:1,sceneSizeBytes:0,assetSizeBytes:0,storageMode:"local-draft",createdAt:timestamp,updatedAt:timestamp,archivedAt:null,
    }]));
  });
}

test("pan, drag and save keep a card under the pointer without snapping back", async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await seedBoard(page);
  await page.goto("/e2e/fixtures/index.html?board=1");
  const card=page.getByTestId("whiteboard-module-card-drag-card");
  await expect(card).toBeVisible();
  await expect(page.locator(".excalidraw__canvas.interactive")).toBeVisible();
  const initial=(await card.boundingBox())!;
  await page.mouse.click(800,720);
  await page.keyboard.press("h");
  await expect(page.getByRole("radio",{name:"Hand (panning tool) — H",exact:true})).toBeChecked();
  await page.mouse.move(800,720);await page.mouse.down();await page.mouse.move(900,770,{steps:15});await page.mouse.up();
  await page.keyboard.press("v");
  await expect.poll(async()=>Math.round((await card.boundingBox())!.x-initial.x)).toBe(100);
  const panned=(await card.boundingBox())!;
  const header=card.locator(".whiteboard-module-card__chrome");
  const handle=(await header.boundingBox())!;
  await page.mouse.move(handle.x+36,handle.y+18);await page.mouse.down();
  for(const distance of [30,60,90,120]) {
    await page.mouse.move(handle.x+36+distance,handle.y+18+distance/2,{steps:6});
    await expect.poll(async()=>Math.round((await card.boundingBox())!.x-panned.x)).toBe(distance);
  }
  await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("bindernotes:whiteboards:fixture:browser-binder:browser-lesson")!)[0].modules[0].x)).toBe(270);
  const saved=(await card.boundingBox())!;
  expect(Math.abs(saved.x-(panned.x+120))).toBeLessThan(2);
  expect(Math.abs(saved.y-(panned.y+60))).toBeLessThan(2);
  await page.screenshot({path:"test-results/whiteboard-after-pan-drag.png"});
  await page.reload();
  await expect(card).toBeVisible();
  await expect.poll(async()=>Math.round((await card.boundingBox())!.x)).toBe(Math.round(saved.x));
  await expect.poll(async()=>Math.round((await card.boundingBox())!.y)).toBe(Math.round(saved.y));
  expect(errors).toEqual([]);
});

test("backup import and archive restore preserve the original board and editable card contents", async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await seedBoard(page);
  await page.goto("/e2e/fixtures/index.html?board=1");
  await expect(page.getByTestId("whiteboard-module-card-drag-card")).toBeVisible();
  await page.getByText("Navigate, organize & export",{exact:true}).click();
  // Read the actual downloaded blob in-page; Windows Chrome can retain a lock
  // on its temporary download file even after the download event completes.
  await page.evaluate(()=>document.addEventListener("click",event=>{
    const link=event.target;
    if(link instanceof HTMLAnchorElement && link.download.endsWith(".json")) (window as any).__backupText=fetch(link.href).then(response=>response.text());
  },true));
  const downloaded=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download JSON backup",exact:true}).click();
  const download=await downloaded;
  expect(download.suggestedFilename()).toBe("Browser board.json");
  const backup:string=await page.evaluate(()=>(window as any).__backupText);
  expect(JSON.parse(backup).board.modules[0].noteContent.content[0].content[0].text).toBe("A note on the board.");
  await page.getByText("Archive & restore backup",{exact:true}).click();
  await page.getByLabel("Whiteboard JSON backup").setInputFiles({name:"board.json",mimeType:"application/json",buffer:Buffer.from(backup)});
  await expect(page.getByLabel("Whiteboard name")).toHaveValue("Browser board (restored)");
  await expect(page.getByText("A note on the board.",{exact:true})).toBeVisible();
  const records=await page.evaluate(()=>JSON.parse(localStorage.getItem("bindernotes:whiteboards:fixture:browser-binder:browser-lesson")!));
  expect(records).toHaveLength(2);
  expect(records.find((board:any)=>board.id==="fixture-board").title).toBe("Browser board");
  await page.getByRole("button",{name:"Archive Browser board",exact:true}).click();
  await page.getByRole("button",{name:"Refresh archive",exact:true}).click();
  await page.getByRole("button",{name:"Restore Browser board",exact:true}).click();
  await expect(page.getByLabel("Whiteboard name")).toHaveValue("Browser board");
  await expect(page.getByText("A note on the board.",{exact:true})).toBeVisible();
  await page.getByLabel("Whiteboard JSON backup").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from('{"format":"bindernotes-whiteboard","version":9}')});
  await expect(page.getByText(/backup version is not supported/)).toBeVisible();
  await expect(page.getByLabel("Whiteboard name")).toHaveValue("Browser board");
  await page.screenshot({path:"test-results/whiteboard-restored.png"});
  expect(errors).toEqual([]);
});

test("a phone-sized board keeps controls usable and a dragged card stays at the released position", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await seedBoard(page);
  await page.goto("/e2e/fixtures/index.html?board=1");
  await page.getByRole("button",{name:"Minimize whiteboard controls",exact:true}).click();
  const card=page.getByTestId("whiteboard-module-card-drag-card");
  const header=card.locator(".whiteboard-module-card__chrome");
  await expect(header).toBeVisible();
  const initial=(await card.boundingBox())!;
  await page.mouse.move(initial.x+34,initial.y+16);await page.mouse.down();
  await page.mouse.move(initial.x-46,initial.y+86,{steps:15});await page.mouse.up();
  await expect.poll(async()=>Math.round((await card.boundingBox())!.x)).toBe(Math.round(initial.x-80));
  await expect.poll(async()=>Math.round((await card.boundingBox())!.y)).toBe(Math.round(initial.y+70));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/whiteboard-mobile-drag.png"});
  await page.getByRole("button",{name:"Open whiteboard controls",exact:true}).click();
  await expect(page.getByRole("button",{name:"New Whiteboard",exact:true})).toBeVisible();
});

test("a scoped canvas notebook opens its template once and preserves live notes after reload", async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await seedBoard(page);
  await page.goto("/e2e/fixtures/index.html?board=1&notebook=1");
  await expect(page.locator(".excalidraw__canvas.interactive")).toBeVisible();
  await expect(page.getByLabel("Whiteboard name")).toHaveValue("Equation Solving");
  expect(await page.getByText("Browser board",{exact:true}).count()).toBe(0);
  const storageKey="bindernotes:whiteboards:fixture:canvas-notebook:canvas-page";
  const original=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey);
  expect(original).toHaveLength(1);
  expect(original[0].scene.elements.length).toBeGreaterThan(10);
  await page.getByText("Navigate, organize & export",{exact:true}).click();
  await page.getByRole("button",{name:"Add sticky note",exact:true}).click();
  const editor=page.locator('[data-whiteboard-module="private-notes"] [contenteditable="true"]');
  await editor.fill("A live note in my personal canvas");
  await expect.poll(()=>page.evaluate(key=>JSON.stringify(JSON.parse(localStorage.getItem(key)!)[0].modules),storageKey)).toContain("A live note in my personal canvas");
  await page.reload();
  await expect(page.getByText("A live note in my personal canvas",{exact:true})).toBeVisible();
  const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey);
  expect(restored).toHaveLength(1);
  expect(restored[0].id).toBe(original[0].id);
  expect(restored[0].scene.elements.length).toBe(original[0].scene.elements.length);
});
