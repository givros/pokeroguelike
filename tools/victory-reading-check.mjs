import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
import {simulate} from './simulate.mjs';
import {readingContrast} from './reading-contrast.mjs';
const browser=await chromium.launch({headless:true}),checks=[],errors=[],out='output/playwright/victory-reading';
await mkdir(out,{recursive:true});
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run);
try{
 for(const [width,height] of [[1440,900],[1280,720],[1024,768]])for(const starter of [1,4,7])for(const stage of [3,10,12]){
  const run=simulate(2026,starter,{camp:'train',stopAt:r=>r.phase==='victoryBeat'&&r.stageIndex===stage}).run;
  assert.equal(run.phase,'victoryBeat');assert.ok(!run.pendingGrowth);assert.equal(run.stageIndex,stage);
  const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(data=>localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data)),{version:3,meta:E.baseMeta(),run});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();await page.locator('.victory-banner').waitFor();await page.locator('[data-action="pause"]').click();
  const paused=await saved(page);await page.waitForTimeout(100);assert.deepEqual(await saved(page),paused);
  const hide=await page.addStyleTag({content:'dialog,dialog::backdrop{visibility:hidden!important}'});
  const layout=await page.locator('.victory-banner').evaluate(node=>{const a=node.getBoundingClientRect(),failures=[],overlaps=[];for(const selector of ['.stage-heading','.ally-card','.enemy-card','.hud-left','.hud-controls','.battle-narration']){const b=document.querySelector(selector).getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)overlaps.push(selector);}if(a.left<8||a.right>innerWidth-8||a.top<8||a.bottom>innerHeight-8||parseFloat(getComputedStyle(node).fontSize)<36)failures.push('Victory title must stay large and within the screen');return {overlaps,failures};});
  assert.deepEqual(layout,{overlaps:[],failures:[]});const contrast=await readingContrast(page,'.victory-banner');assert.ok(contrast.minimum>=4.5);await page.screenshot({path:`${out}/${width}-${starter}-${stage}.png`});await hide.evaluate(node=>node.remove());
  await page.reload();await page.locator('[data-action="resume"]').click();await page.locator('.victory-banner').waitFor();const replay=await saved(page);assert.equal(replay.coins,paused.coins);assert.equal(replay.wins,paused.wins);assert.equal(replay.hero.xp,paused.hero.xp);
  await page.waitForFunction(stage=>{const r=JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run;return r.stageIndex===stage+1&&r.travelProgress>0;},stage);await page.locator('[data-action="pause"]').click();const moved=await saved(page);assert.equal(moved.coins,paused.coins);assert.equal(moved.wins,paused.wins);assert.equal(moved.hero.xp,paused.hero.xp);assert.equal(await page.locator('.victory-banner').count(),0);
  checks.push({width,starter,stage,partner:run.hero.id,...layout,...contrast});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({cases:checks.length,minimumContrast:Math.min(...checks.map(x=>x.minimum)),errors}));
}finally{await browser.close();}
