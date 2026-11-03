import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
const c={pokemon:JSON.parse(await readFile('data/pokemon.json')),moves:JSON.parse(await readFile('data/moves.json'))},browser=await chromium.launch({headless:true}),checks=[],errors=[],out='output/playwright/upgrade-progression';await mkdir(out,{recursive:true});
try{
 for(const [width,height] of [[1440,900],[1280,720],[1024,768]]){
  const meta=E.baseMeta();meta.gold=100000;const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(meta=>{Date.now=()=>2026;if(!localStorage.getItem('pokeRogueAdventureV3'))localStorage.setItem('pokeRogueAdventureV3',JSON.stringify({version:3,meta,run:null}));},meta);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3'))),click=(action,value)=>page.locator(`[data-action="${action}"]${value?`[data-value="${value}"]`:''}`).first().click();
  await page.goto('http://127.0.0.1:5173');await click('starter',4);const unupgraded=(await saved()).run.hero;await page.reload();await page.locator('[data-action="resume"]').waitFor();await click('upgrades');const active=await saved();
  for(const key of Object.keys(E.UPGRADE_DEFS)){const control=page.locator(`[data-action="upgrade"][data-value="${key}"]`);assert.ok(await control.isDisabled());await control.evaluate(n=>n.click());}assert.deepEqual(await saved(),active);assert.match(await page.locator('dialog').textContent(),/Finish your expedition/);
  await click('close');await click('resume');await click('pause');await click('retire');await click('confirm-retire');await click('finish');const expected=structuredClone((await saved()).meta);await click('upgrades');let purchases=0;
  for(const [key,definition] of Object.entries(E.UPGRADE_DEFS))for(let rank=0;rank<10;rank++){
   const control=page.locator(`[data-action="upgrade"][data-value="${key}"]`),cost=Math.round(definition.cost*(1+rank*.5));assert.match(await control.textContent(),new RegExp(`rank ${rank}/10`));assert.match(await control.textContent(),new RegExp(`${cost} gold`));assert.equal(await control.isDisabled(),false);assert.ok(E.upgrade(expected,key));await control.click();purchases++;
   const actual=(await saved()).meta;assert.equal(actual.gold,expected.gold);assert.deepEqual(actual.permanentUpgrades,expected.permanentUpgrades);assert.equal(Number(await page.locator('.title-gold b').textContent()),expected.gold);
  }
  const capped=await saved();assert.equal(capped.meta.gold,80500);for(const key of Object.keys(E.UPGRADE_DEFS)){const control=page.locator(`[data-action="upgrade"][data-value="${key}"]`);assert.ok(await control.isDisabled());assert.match(await control.textContent(),/rank 10\/10/);await control.evaluate(n=>n.click());}assert.deepEqual(await saved(),capped);
  const layout=await page.locator('dialog').evaluate(root=>{const box=root.getBoundingClientRect(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),failures=[];let n;while(n=walker.nextNode())if(n.textContent.trim()){const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&r.height&&(r.left<box.left||r.right>box.right||r.top<box.top||r.bottom>box.bottom||parseFloat(getComputedStyle(n.parentElement).fontSize)<14))failures.push(n.textContent);}return failures;});assert.deepEqual(layout,[]);await page.screenshot({path:`${out}/${width}-capped.png`});
  await click('close');await page.reload();await page.locator('[data-action="starter"]').first().waitFor();assert.deepEqual((await saved()).meta,capped.meta);await click('starter',4);const boosted=await saved(),oracle=E.createRun(4,expected,c,2026);assert.deepEqual(boosted.run.hero,oracle.hero);assert.equal(boosted.run.hero.maxHp,unupgraded.maxHp+50);assert.equal(boosted.run.coins,80500);assert.deepEqual(boosted.meta.permanentUpgrades,expected.permanentUpgrades);
  checks.push({width,purchases,gold:boosted.meta.gold,ranks:boosted.meta.permanentUpgrades,startingHpBefore:unupgraded.maxHp,startingHpAfter:boosted.run.hero.maxHp,activePurchaseBlocked:true,cappedPurchaseBlocked:true,reloadPreserved:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
