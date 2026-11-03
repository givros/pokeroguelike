import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {simulate} from "./simulate.mjs";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const engine=await readFile("engine.js","utf8"),script=await readFile("script.js","utf8");
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")));
function battle(){const r=E.createRun(4,E.baseMeta(),c,2026);E.selectBonus(r,r.offers[0]);r.travelProgress=1;E.arrive(r,c);E.activateStage(r,c);return r;}
async function fixture(run,{blocked=false,idle=false,action=false}={}){
 if(idle)Object.assign(run,{plan:"predator",idleEnabled:true,idleAt:Date.now()});
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 await context.addInitScript(({data,blocked})=>{
  if(blocked)Object.defineProperty(window,"localStorage",{value:{getItem:key=>key==="pokeRogueAdventureV3"?JSON.stringify(data):null,setItem:()=>{throw new Error("Storage blocked");}}});
  else if(!localStorage.getItem("pokeRogueAdventureV3"))localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));
 },{data:{version:3,meta:E.baseMeta(),run},blocked});
 const fault='if(!globalThis.__recoveryProbe){globalThis.__recoveryProbe=true;run.coins+=777;run.hero=null;throw new Error("Checkpoint recovery probe");}';
 if(action)await context.route("**/script.js",route=>route.fulfill({contentType:"text/javascript",body:script.replace('if (action === "buy") {','if (action === "buy") { if(!globalThis.__recoveryProbe){globalThis.__recoveryProbe=true;run.coins+=777;run.hero=null;throw new Error("Purchase recovery probe");}')}));
 else await context.route("**/engine.js",route=>route.fulfill({contentType:"text/javascript",body:engine.replace("export function battleStep(run, catalogue) {","export function battleStep(run, catalogue) {"+fault)}));
 const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();return {page,context};
}
try{
 for(const options of [{},{idle:true},{blocked:true}]){
  const run=battle(),{page,context}=await fixture(run,options);
  await page.locator(".fatal-panel").waitFor();assert.equal(await page.locator('dialog[open]').count(),1);assert.equal(await page.locator("#menu-host dialog").count(),0);
  assert.equal(await page.locator(".recovery-details").getAttribute("open"),null);
  await page.keyboard.press("Escape");assert.equal(await page.locator('dialog[open]').count(),1);
  if(!options.idle&&!options.blocked)for(const [width,height] of [[1440,900],[1280,720],[1024,768]]){
   await page.setViewportSize({width,height});
   const layout=await page.locator(".fatal-panel").evaluate(root=>{
    const b=root.getBoundingClientRect(),failures=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode()))if(node.textContent.trim()&&node.parentElement.getClientRects().length){if(parseFloat(getComputedStyle(node.parentElement).fontSize)<14)failures.push(node.textContent);const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.left<b.left||r.right>b.right||r.top<b.top||r.bottom>b.bottom)failures.push(node.textContent);}
    return {failures,inView:b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight};
   });assert.deepEqual(layout.failures,[]);assert.equal(layout.inView,true);await page.screenshot({path:`output/playwright/recovery-dialog-${width}.png`});
  }
  if(!options.blocked){const before=await saved(page);assert.equal(before.run.hero.hp,run.hero.hp);assert.equal(before.run.coins,run.coins);if(options.idle)assert.equal(before.run.idleAt,null);await page.evaluate(()=>{window.dispatchEvent(new Event("pagehide"));document.dispatchEvent(new Event("visibilitychange"));});assert.deepEqual(await saved(page),before);}
  else assert.equal(await page.locator('[data-action="reload"]').count(),0);
  await page.screenshot({path:`output/playwright/recovery-${options.blocked?"memory":options.idle?"idle":"battle"}.png`});
  await page.locator('[data-action="recover"]').click();await page.getByRole("heading",{name:"Pause",exact:true}).waitFor();
  await page.getByRole("button",{name:"Resume",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector("#turn-label")?.textContent.includes("Action 2")||document.querySelector(".victory-banner"));
  await page.locator('[data-action="pause"]').click();assert.ok(Number(await page.locator("#hud-coins").textContent())<777);
  checks.push(`${options.blocked?"In-memory":options.idle?"Idle-enabled":"Saved"} combat checkpoint survives a partial mutation, blocks Escape/background menus and resumes only after explicit recovery`);await context.close();
 }
 const shop=simulate(2026,4,{stopAt:r=>r.phase==="shop"}).run;shop.pendingGrowth=null;shop.pendingAwakenings=[];shop.coins=200;shop.bonuses=[];
 const {page,context}=await fixture(shop,{action:true});await page.locator('[data-action="buy"][data-value="force"]').click();await page.locator(".fatal-panel").waitFor();assert.equal((await saved(page)).run.coins,200);
 await page.locator('[data-action="recover"]').click();await page.getByRole("button",{name:"Resume",exact:true}).click();await page.locator('[data-action="buy"][data-value="force"]').click();assert.equal((await saved(page)).run.coins,130);await context.close();
 checks.push("A failing manual purchase preserves its pre-purchase checkpoint and charges the real purchase once after recovery");
 assert.deepEqual(errors,[]);await writeFile("output/playwright/recovery-results.json",JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
