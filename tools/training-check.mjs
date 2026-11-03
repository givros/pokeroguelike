import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import * as E from '../engine.js';
import {simulate} from '../tools/simulate.mjs';
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')));
async function fixture(starter){
 const run=simulate(9001,starter,{stopAt:r=>r.stageIndex===2&&r.phase==='cache'}).run;
 const meta=E.baseMeta();meta.battleSpeed=750;
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 await context.addInitScript(data=>{if(!localStorage.getItem('pokeRogueAdventureV3'))localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data));},{version:3,meta,run});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();return {page,context,run};
}
try{
 let {page,context,run}=await fixture(1);
 const study=page.locator('[data-action="encounter"][data-value="study"]');assert.match(await study.textContent(),/Sludge Bomb/);
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.screenshot({path:'output/playwright/study-bulbasaur.png'});
 await study.click();const learned=(await saved(page)).run;assert.equal(learned.hero.level,7);assert.equal(learned.coins,run.coins);assert.ok(learned.hero.moves.some(m=>m.id===188));
 await page.reload();await page.locator('[data-action="resume"]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.log.some(line=>line.includes('Bulbasaur: Sludge Bomb')),{},{timeout:15000});
 await page.locator('[data-action="pause"]').click();assert.equal((await saved(page)).run.hero.level,7);
 checks.push('Study preview names Sludge Bomb; the real auto battle uses the learned move after reload, without repeating the level gain');await context.close();
 ({page,context,run}=await fixture(133));await page.locator('[data-action="encounter"][data-value="study"]').click();
 await page.locator('[data-action="evolve"]').first().waitFor();assert.equal((await saved(page)).run.hero.id,133);
 const coins=(await saved(page)).run.coins;
 await page.reload();await page.locator('[data-action="resume"]').click();await page.locator('[data-action="evolve"]').first().waitFor();assert.equal((await saved(page)).run.coins,coins);
 checks.push('Study-triggered Eevee evolution remains a saved player choice on the route');await context.close();
 assert.deepEqual(errors,[]);await writeFile('output/playwright/training-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
