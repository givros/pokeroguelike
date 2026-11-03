import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const r=E.createRun(4,E.baseMeta(),c,2026);E.selectBonus(r,r.offers[0]);r.travelProgress=1;E.arrive(r,c);E.activateStage(r,c);r.hero.hp=r.hero.maxHp=r.enemy.hp=r.enemy.maxHp=500;
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")));
async function open(raw,blocked=false){
 const context=await browser.newContext({viewport:{width:1024,height:768}});
 await context.addInitScript(({raw,blocked})=>{
  if(!localStorage.getItem("pokeRogueAdventureV3"))localStorage.setItem("pokeRogueAdventureV3",raw);
  window.__blockSaveWrites=blocked;const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(window.__blockSaveWrites)throw new Error("Temporary storage failure");return original.call(this,key,value);};
 },{raw,blocked});
 const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto("http://127.0.0.1:5173");await page.locator(".game-screen[data-phase]").waitFor();return {page,context};
}
try{
 let {page,context}=await open(JSON.stringify({version:3,meta:E.baseMeta(),run:r}));await page.locator('[data-action="resume"]').click();
 await page.evaluate(()=>{window.__originalActor=document.querySelector(".actor-ally");window.__blockSaveWrites=true;});
 await page.waitForFunction(()=>document.querySelector("#turn-label")?.textContent.includes("Action 2"));await page.locator(".save-warning").waitFor();
 assert.equal(await page.evaluate(()=>document.querySelector(".actor-ally")===window.__originalActor),true);assert.equal((await saved(page)).run.actions,0);
 await page.locator('[data-action="save-notice"]').click();assert.match(await page.locator("[data-save-message]").textContent(),/Saving is unavailable/);
 assert.equal(await page.locator('[data-action="dismiss-save-notice"]').isVisible(),false);
 await page.locator('[data-action="retry-save"]').click();assert.match(await page.locator("[data-save-message]").textContent(),/Saving is unavailable/);
 await page.screenshot({path:"output/playwright/save-transition-failed.png"});
 await page.evaluate(()=>window.__blockSaveWrites=false);await page.locator('[data-action="retry-save"]').click();
 assert.equal(await page.locator(".save-warning").count(),0);assert.equal(await page.locator("[data-save-message]").textContent(),"Saving is working.");assert.match(await page.locator("[data-save-advice]").textContent(),/has been saved/);
 const checkpoint=await saved(page);assert.ok(checkpoint.run.actions>0);
 for(let i=0;i<3;i++)await page.locator('[data-action="retry-save"]').click();assert.deepEqual(await saved(page),checkpoint);
 await page.screenshot({path:"output/playwright/save-transition-restored.png"});
 await page.reload();await page.locator('[data-action="resume"]').click();await page.locator('[data-action="pause"]').click();const restored=await saved(page);assert.deepEqual(restored.run.hero,checkpoint.run.hero);assert.equal(restored.run.seed,checkpoint.run.seed);assert.equal(restored.run.actions,checkpoint.run.actions);await context.close();
 checks.push("A failed real battle write creates the notice immediately without replacing actors; retry updates paused status and saves the current checkpoint without repeating actions or RNG, including after reload");
 ({page,context}=await open(JSON.stringify({version:3,meta:E.baseMeta(),run:r}),true));await page.locator('[data-action="resume"]').click();assert.equal(await page.locator(".save-warning").count(),1);
 await page.evaluate(()=>{window.__originalActor=document.querySelector(".actor-ally");window.__blockSaveWrites=false;});await page.waitForFunction(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.actions>0);
 assert.equal(await page.locator(".save-warning").count(),0);assert.equal(await page.evaluate(()=>document.querySelector(".actor-ally")===window.__originalActor),true);await context.close();
 checks.push("Successful writing returning during real combat removes the obsolete warning without waiting for a scene change");
 const meta=E.baseMeta();meta.gold=123;
 ({page,context}=await open(JSON.stringify({version:3,meta,run:{broken:true}})));await page.locator('[data-action="save-notice"]').click();assert.match(await page.locator("[data-save-message]").textContent(),/permanent progress/);
 await page.locator('[data-action="retry-save"]').click();assert.match(await page.locator("[data-save-message]").textContent(),/permanent progress/);await page.locator('[data-action="dismiss-save-notice"]').click();assert.equal(await page.locator(".save-warning").count(),0);assert.equal((await saved(page)).meta.gold,123);await context.close();
 checks.push("A previous invalid expedition notice remains distinct from current write availability and can be acknowledged after permanent progress is retained");
 ({page,context}=await open("unreadable save"));await page.locator('[data-action="save-notice"]').click();assert.match(await page.locator("[data-save-message]").textContent(),/previous save could not be read/);assert.match(await page.locator("[data-save-advice]").textContent(),/has been saved/);await context.close();
 checks.push("An unreadable old save is described as a past read failure while successful new saving is reported accurately");
 assert.deepEqual(errors,[]);await writeFile("output/playwright/save-transition-results.json",JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
