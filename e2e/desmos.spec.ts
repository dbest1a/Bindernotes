import { test, expect, type Page } from "@playwright/test";

const apiKey = process.env.E2E_DESMOS_API_KEY;
test.use({ trace: "off" }); // Keep the configured API key out of diagnostic traces.
const boardKey = "bindernotes:whiteboards:fixture:browser-binder:browser-lesson";
const cardId = "whiteboard-module-card-graph-card";
const graphViewport = (page: Page) => page.evaluate(() => (window as any).__desmosChecks.at(-1).calculator.getState().graph.viewport);
const activeGraph = (page: Page) => page.locator('[data-desmos-canvas] canvas.dcg-graph-inner');
const settle = (page: Page) => page.waitForTimeout(400); // Desmos reports state after its 250 ms quiet period.

async function panInsideGraph(page: Page) {
  const graph = activeGraph(page), card = page.getByTestId(cardId);
  const box = (await graph.boundingBox())!, frame = await card.boundingBox();
  const before = await graphViewport(page);
  // Use empty graph space: dragging on a plotted curve traces its points instead.
  const x = box.x + box.width * .65, y = box.y + box.height * .78;
  await page.mouse.move(x,y); await page.mouse.down();
  await page.mouse.move(x+40,y+20,{steps:16}); await page.mouse.up();
  await expect.poll(async() => (await graphViewport(page)).xmin).toBeLessThan(before.xmin);
  const after = await graphViewport(page);
  expect(Math.abs((before.xmin-after.xmin)/(before.xmax-before.xmin)-40/box.width)).toBeLessThan(.025);
  await settle(page);
  expect(await graphViewport(page)).toEqual(after);
  expect(await card.boundingBox()).toEqual(frame);
}

for (const anchorMode of ["board-fixed-size", "board", "viewport"] as const) {
  test(`real Desmos retains graph and card position through gestures (${anchorMode})`, async({page}) => {
    test.skip(!apiKey,"Set E2E_DESMOS_API_KEY to run against the real Desmos API; this check never substitutes a fake graph.");
    test.setTimeout(60_000);
    await page.setViewportSize({width:1440,height:1000});
    const errors:string[]=[]; page.on("pageerror",error=>errors.push(error.message));
    await page.addInitScript(({key,anchorMode,boardKey})=>{
      (window as any).__BINDER_NOTES_DESMOS_API_KEY__=key;
      if(localStorage.getItem(boardKey)) return;
      const timestamp=new Date().toISOString();
      localStorage.setItem(boardKey,JSON.stringify([{
        id:"fixture-board",ownerId:"fixture",binderId:"browser-binder",lessonId:"browser-lesson",title:"Desmos gesture check",subject:"Math",moduleContext:"lesson",
        scene:{elements:[],appState:{viewBackgroundColor:"#fff",scrollX:0,scrollY:0,zoom:{value:1}},files:{}},
        modules:[{id:"graph-card",type:"bindernotes-module",moduleId:"desmos-graph",graphInstanceId:"graph-gesture-check",title:"Desmos graph",x:90,y:180,width:780,height:580,zIndex:1,mode:"live",anchorMode,createdAt:timestamp,updatedAt:timestamp}],
        objectCount:1,sceneSizeBytes:0,assetSizeBytes:0,storageMode:"local-draft",createdAt:timestamp,updatedAt:timestamp,archivedAt:null,
      }]));
    },{key:apiKey!,anchorMode,boardKey});
    await page.goto("/e2e/fixtures/index.html?board=1");
    await expect(page.locator('[data-desmos-status="ready"]')).toBeVisible({timeout:35_000});
    await page.evaluate(()=>(window as any).__desmosChecks.at(-1).calculator.setExpression({id:"regression-curve",latex:"y=x^2"}));
    await settle(page);
    const card=page.getByTestId(cardId);
    await panInsideGraph(page);
    const beforeWheel=await graphViewport(page), frameBeforeWheel=await card.boundingBox();
    let graphBox=(await activeGraph(page).boundingBox())!;
    await page.mouse.move(graphBox.x+graphBox.width*.65,graphBox.y+graphBox.height*.75);
    await page.mouse.wheel(0,-180); await settle(page);
    const afterWheel=await graphViewport(page);
    expect(afterWheel.xmax-afterWheel.xmin).toBeLessThan(beforeWheel.xmax-beforeWheel.xmin);
    expect(await card.boundingBox()).toEqual(frameBeforeWheel);

    const frame=(await card.boundingBox())!, header=(await card.locator(".whiteboard-module-card__chrome").boundingBox())!;
    const beforeDrag=await page.evaluate(()=>(window as any).__desmosChecks.map((d:any)=>({resize:d.resizeCalls,setState:d.setStateCalls,destroyed:d.destroyed})));
    await page.mouse.move(header.x+90,header.y+18); await page.mouse.down();
    for (const distance of [20,40,60,80]) {
      await page.mouse.move(header.x+90+distance,header.y+18+distance/2,{steps:8});
      await expect.poll(async()=>Math.round((await card.boundingBox())!.x-frame.x)).toBe(distance);
    }
    await page.mouse.up(); await settle(page);
    expect(await graphViewport(page)).toEqual(afterWheel);
    expect(await page.evaluate(()=>(window as any).__desmosChecks.map((d:any)=>({resize:d.resizeCalls,setState:d.setStateCalls,destroyed:d.destroyed})))).toEqual(beforeDrag);
    await panInsideGraph(page);

    // Zoom the board outside the calculator, then use the graph at its new location/scale.
    const viewportBeforeBoardZoom=await graphViewport(page);
    await page.locator(".excalidraw").getByRole("button",{name:/zoom in/i}).click();
    await settle(page);
    expect(await graphViewport(page)).toEqual(viewportBeforeBoardZoom);
    await panInsideGraph(page);

    // Resize keeps graph live, defers calculator layout until the gesture ends.
    const resizeHandle=(await card.getByTestId("whiteboard-card-resize-handle").boundingBox())!;
    const resizeCount=await page.evaluate(()=>(window as any).__desmosChecks.at(-1).resizeCalls);
    await page.mouse.move(resizeHandle.x+12,resizeHandle.y+12); await page.mouse.down();
    await page.mouse.move(resizeHandle.x+52,resizeHandle.y+32,{steps:20});
    await page.waitForTimeout(120);
    expect(await page.evaluate(()=>(window as any).__desmosChecks.at(-1).resizeCalls)).toBe(resizeCount);
    await page.mouse.up();
    await expect.poll(()=>page.evaluate(()=>(window as any).__desmosChecks.at(-1).resizeCalls)).toBe(resizeCount+1);
    await settle(page);

    // Collapse in the same task as a viewport change, before the 250 ms state report.
    const beforeCollapse = await page.evaluate(() => {
      const calculator = (window as any).__desmosChecks.at(-1).calculator;
      calculator.setMathBounds({left:-7,right:13,bottom:-8,top:12});
      const viewport = calculator.getState().graph.viewport;
      (document.querySelector('[aria-label="Collapse module"]') as HTMLButtonElement).click();
      return viewport;
    });
    await expect(page.locator('[data-desmos-status="ready"]')).toHaveCount(0);
    await card.getByRole("button",{name:"Expand module",exact:true}).click();
    await expect(page.locator('[data-desmos-status="ready"]')).toBeVisible();
    await settle(page);
    expect(await graphViewport(page)).toEqual(beforeCollapse);

    // Changing between board and screen layers remounts the calculator as well.
    await card.getByTestId("whiteboard-card-pin-button").click();
    const pinTarget=anchorMode==="viewport" ? "whiteboard-card-anchor-board-fixed" : "whiteboard-card-anchor-viewport";
    const beforePin = await page.evaluate((target) => {
      const calculator = (window as any).__desmosChecks.at(-1).calculator;
      calculator.setMathBounds({left:-17,right:3,bottom:-12,top:8});
      const viewport = calculator.getState().graph.viewport;
      (document.querySelector(`[data-testid="${target}"]`) as HTMLButtonElement).click();
      return viewport;
    },pinTarget);
    await expect(page.locator('[data-desmos-status="ready"]')).toBeVisible();
    await settle(page);
    expect(await graphViewport(page)).toEqual(beforePin);
    const savedViewport=await graphViewport(page);
    await page.reload();
    await expect(page.locator('[data-desmos-status="ready"]')).toBeVisible({timeout:35_000});
    await settle(page);
    expect(await graphViewport(page)).toEqual(savedViewport);
    await page.screenshot({path:`test-results/desmos-${anchorMode}.png`});
    expect(errors).toEqual([]);
  });
}
