import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import * as E from '../engine.js';
import {simulate} from './simulate.mjs';
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const run=simulate(2026,4,{stopAt:r=>r.stageIndex===9&&r.phase==='shrine'}).run;
run.bonuses=['crit_chance'];run.offers=['attack_boost','first_guard','pp_boost'];run.hero.hp=run.hero.maxHp;
const cost=E.shrineOfferingCost(run),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
await context.addInitScript(data=>{if(!localStorage.getItem('pokeRogueAdventureV3'))localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data));},{version:3,meta:E.baseMeta(),run});
page.on('pageerror',e=>errors.push(e.message));const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')));
try{
 await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();
 await page.locator('[data-action="offering"]').click();assert.equal((await saved()).run.hero.hp,run.hero.hp);
 assert.equal(await page.locator('[data-action="bonus"][data-value="first_guard"]').isDisabled(),true);
 assert.equal(await page.locator('[data-action="bonus"][data-value="pp_boost"]').isDisabled(),true);
 assert.match(await page.locator('[data-action="bonus"][data-value="attack_boost"]').textContent(),/Awakens Windscar Talons/);
 await page.locator('[data-action="offering"]').click();assert.equal((await saved()).run.hero.hp,run.hero.hp);
 await page.locator('[data-action="offering"]').click();await page.reload();await page.locator('[data-action="resume"]').click();
 assert.equal((await saved()).run.shrineEmpowered,true);assert.match(await page.locator('[data-action="offering"]').textContent(),new RegExp(`Pay ${cost} HP`));
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.screenshot({path:'output/playwright/shrine-offering.png'});
 await page.locator('[data-action="bonus"][data-value="attack_boost"]').click();
 const paid=(await saved()).run;assert.equal(paid.hero.hp,run.hero.hp-cost);assert.equal(E.count(paid,'attack_boost'),2);assert.equal(paid.coins,run.coins);assert.equal(paid.shrineEmpowered,false);
 await page.reload();await page.locator('[data-action="resume"]').click();await page.locator('[data-action="pause"]').click();
 const resumed=(await saved()).run;assert.equal(resumed.hero.hp,paid.hero.hp);assert.equal(E.count(resumed,'attack_boost'),2);assert.equal(resumed.coins,paid.coins);
 checks.push('Offering can be enabled, cancelled and reloaded without payment; unique and instant-recovery boons are disabled');
 checks.push('The selected two-rank boon pays the displayed HP once, previews its awakening, and retains both ranks after reload');
 assert.deepEqual(errors,[]);await writeFile('output/playwright/shrine-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
