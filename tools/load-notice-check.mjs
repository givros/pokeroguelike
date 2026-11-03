import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {simulate} from "./simulate.mjs";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const browser=await chromium.launch({headless:true}),errors=[],checks=[],layouts=[];
async function measure(page){
 return page.evaluate(()=>{
  const root=document.querySelector("dialog[open]")||document.querySelector(".game-screen,.loading-viewport"),frame=root.getBoundingClientRect(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),failures=[];let node;
  while((node=walker.nextNode())){if(!node.textContent.trim()||!node.parentElement.getClientRects().length)continue;const style=getComputedStyle(node.parentElement);if(style.visibility==="hidden")continue;
   if(parseFloat(style.fontSize)<14)failures.push(`Small text: ${node.textContent}`);
   const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.left<frame.left-1||r.right>frame.right+1||r.top<frame.top-1||r.bottom>frame.bottom+1)failures.push(`Text outside frame: ${node.textContent}`);
  }
  const notice=document.querySelector(".save-warning"),overlaps=[];
  if(notice&&!document.querySelector("dialog[open]")){const a=notice.getBoundingClientRect();for(const selector of [".battle-narration",".relic-rail",".encounter-dock",".initial-bonus-dock",".map-hero-card",".hud-controls",".title-actions","#map-actor .body-art"]){const node=document.querySelector(selector);if(!node)continue;const b=node.getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)overlaps.push(selector);}}
  return {failures,overlaps};
 });
}
try{
 const loading=await browser.newContext({viewport:{width:1280,height:720}});let release;
 await loading.route("**/assets/generated/gold-coins.webp",async route=>{await new Promise(resolve=>release=resolve);await route.continue();});
 let page=await loading.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto("http://127.0.0.1:5173",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>{const m=document.querySelector("[data-loading-progress]");return m&&+m.getAttribute("aria-valuemax")>1&&+m.getAttribute("aria-valuenow")>0;});
 const progress=await page.locator("[data-loading-progress]").evaluate(m=>({ready:+m.getAttribute("aria-valuenow"),total:+m.getAttribute("aria-valuemax")}));assert.ok(progress.ready<progress.total);assert.ok(release);
 assert.deepEqual((await measure(page)).failures,[]);await page.screenshot({path:"output/playwright/illustrated-loading.png"});release();await page.locator('[data-action="starter"]').first().waitFor();await loading.close();checks.push("Loading progress reflects actually decoded illustrations and reaches camp when the held resource completes");
 for(const [width,height] of [[1440,900],[1280,720],[1024,768]]){
  const context=await browser.newContext({viewport:{width,height}});let attempts=0;
  await context.route("**/assets/generated/gold-coins.webp",route=>{attempts++;return attempts===1?route.fulfill({status:404,body:"missing"}):route.continue();});
  page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="reload"]').waitFor();await page.waitForTimeout(200);assert.equal(attempts,1);
  assert.equal(await page.locator("details").getAttribute("open"),null);const layout=await measure(page);assert.deepEqual(layout.failures,[]);layouts.push({width,state:"load-error",...layout});
  await page.screenshot({path:`output/playwright/load-error-${width}.png`});await page.locator("summary").click();assert.deepEqual((await measure(page)).failures,[]);
  await page.locator('[data-action="reload"]').click();await page.locator('[data-action="starter"]').first().waitFor();assert.ok(attempts>=2);const recoveredAttempts=attempts;await page.waitForTimeout(250);assert.equal(attempts,recoveredAttempts,"Recovered artwork must not enter a retry loop");await context.close();
 }
 checks.push("Resource failures show readable illustrated recovery at all three desktop sizes; diagnostics stay collapsed and retry is explicit and recoverable");
 const paper=await browser.newContext({viewport:{width:1024,height:768}});await paper.route("**/assets/generated/parchment-panel.webp",r=>r.fulfill({status:404,body:"missing"}));page=await paper.newPage();await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="reload"]').waitFor();assert.deepEqual((await measure(page)).failures,[]);assert.equal(await page.locator(".loading-paper").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(241, 228, 189)");await paper.close();checks.push("Failure of the frame artwork itself retains a light readable recovery surface");
 const states=[{name:"title",run:null},{name:"starter",run:E.createRun(4,E.baseMeta(),c,2026)},...["travel","reward","battle","shop","shrine","cache","camp","complete"].map(phase=>({name:phase,run:simulate(2026,4,{stopAt:r=>r.phase===phase}).run}))];
 for(const [width,height] of [[1440,900],[1280,720],[1024,768]])for(const state of states){
  const run=state.run?structuredClone(state.run):null;if(run){run.pendingGrowth=null;run.pendingAwakenings=[];run.regionEntry=null;}
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>{Object.defineProperty(document,"hidden",{get:()=>true});Object.defineProperty(window,"localStorage",{value:{getItem:key=>key==="pokeRogueAdventureV3"?JSON.stringify(data):null,setItem:()=>{throw new Error("Blocked");}}});},{version:3,meta:E.baseMeta(),run});
  page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto("http://127.0.0.1:5173");await page.locator(".save-warning").waitFor();if(await page.locator('[data-action="resume"]').count())await page.locator('[data-action="resume"]').click();
  if(run&&!['complete','defeat','retired'].includes(run.phase))assert.equal(await page.locator(".game-screen.mode-title").count(),0,`${state.name} must be resumed`);
  let layout=await measure(page);layouts.push({width,state:state.name,...layout});assert.deepEqual(layout.failures,[]);assert.deepEqual(layout.overlaps,[]);
  if(width===1024)await page.screenshot({path:`output/playwright/save-notice-${state.name}.png`});
  await page.locator('[data-action="save-notice"]').click();assert.match(await page.locator("dialog").textContent(),/window/);assert.deepEqual((await measure(page)).failures,[]);await context.close();
 }
 checks.push("Save notice stays clear of gameplay/choice controls in30 desktop states; its detailed message opens deliberately in a paused game window");
 assert.deepEqual(errors,[]);await writeFile("output/playwright/load-notice-results.json",JSON.stringify({checks,progress,layouts,errors},null,2));console.log(JSON.stringify({checks,progress,layouts:layouts.length,errors},null,2));
}finally{await browser.close();}
