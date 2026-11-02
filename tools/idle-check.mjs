import assert from "node:assert/strict";
import {chromium} from "playwright";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import * as E from "../engine.js";
const catalogue={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")));
async function fixture(idleAt,enabled=true,starter=4){
 const run=E.createRun(starter,E.baseMeta(),catalogue,2026);Object.assign(run,{plan:"predator",idleEnabled:enabled,idleAt});
 const context=await browser.newContext({viewport:{width:1024,height:768}});
 await context.addInitScript(data=>{if(!localStorage.getItem("pokeRogueAdventureV3"))localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));},{version:3,meta:E.baseMeta(),run});
 const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto("http://127.0.0.1:5173");await page.locator('.game-screen').waitFor();return {page,context};
}
try{
 let {page,context}=await fixture(Date.now()-3600000);
 await page.getByRole('heading',{name:'While you were away'}).waitFor();
 const ending=await saved(page);assert.equal(ending.run.phase,"complete");assert.equal(ending.run.settled,true);assert.equal(ending.meta.totalRuns,1);
 await mkdir('output/playwright',{recursive:true});await page.screenshot({path:'output/playwright/idle-summary.png'});
 await page.reload();assert.equal(await page.getByRole('heading',{name:'While you were away'}).count(),0);
 await page.locator('.game-screen').waitFor();assert.deepEqual(await saved(page),ending);
 checks.push('Opted-in saved absence completes the real seeded expedition, displays its outcome and settles exactly once across reload');await context.close();
 ({page,context}=await fixture(null));assert.equal((await saved(page)).run.phase,'starter');assert.equal(await page.locator('dialog').count(),0);
 await page.locator('[data-action="resume"]').click();await page.locator('[data-action="plans"]').click();
 assert.match(await page.locator('[data-action="idle-toggle"]').textContent(),/On/);
 await page.locator('[data-action="idle-toggle"]').click();assert.equal((await saved(page)).run.idleEnabled,false);
 checks.push('A paused expedition with no absence timestamp earns nothing; away progression can be disabled explicitly');await context.close();
 ({page,context}=await fixture(null));
 await page.locator('[data-action="resume"]').click();
 await page.evaluate(()=>{
   window.idleTestHidden=true;
   Object.defineProperty(document,"hidden",{get:()=>window.idleTestHidden,configurable:true});
   document.dispatchEvent(new Event("visibilitychange"));
 });
 assert.ok((await saved(page)).run.idleAt);
 await page.evaluate(()=>{
   const realNow=Date.now; Date.now=()=>realNow()+60000;
   window.idleTestHidden=false; document.dispatchEvent(new Event("visibilitychange"));
 });
 await page.getByRole('heading',{name:'While you were away'}).waitFor();
 const returned=await saved(page);assert.ok(returned.run.actions>0);
 await page.waitForTimeout(500);assert.deepEqual(await saved(page),returned);
 checks.push('Simulated browser visibility changes cancel live work, catch up elapsed time and pause on a stable return summary');await context.close();
 ({page,context}=await fixture(Date.now()-3600000,true,133));
 await page.getByRole('heading',{name:'While you were away'}).waitFor();assert.equal((await saved(page)).run.phase,'evolution');
 await page.locator('[data-action="close"]').last().click();await page.locator('[data-action="evolve"]').first().waitFor();
 checks.push('Eevee stops away progression for a visible player evolution choice');await context.close();
 assert.deepEqual(errors,[]);await writeFile('output/playwright/idle-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
