import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
import {validRun} from '../storage.js';
import {simulate} from './simulate.mjs';
import {readingContrast} from './reading-contrast.mjs';
const c={pokemon:JSON.parse(await readFile('data/pokemon.json')),moves:JSON.parse(await readFile('data/moves.json'))};
const baseline=process.argv.includes('--baseline'),peakOnly=process.argv.includes('--peak-only'),out=`output/playwright/transient-reading${baseline?'-before':peakOnly?'-peak':''}`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const fixtures=[];
for(const stage of [0,6,11]){const r=E.createRun(4,E.baseMeta(),c,2026);E.selectBonus(r,r.offers[0]);Object.assign(r,{stageIndex:stage,regionEntry:E.REGIONS[stage===0?0:stage===6?1:2].id});fixtures.push({name:`region-${stage}`,run:r,selector:'.region-entry'});}
const reward=simulate(2026,4,{stopAt:r=>r.stageIndex===1&&r.phase==='reward'}).run;
reward.bonuses=['attack_boost','attack_boost'];reward.offers=['crit_chance','defense_boost','regeneration'];
fixtures.push({name:'awakening',run:reward,selector:'.awakening-toast',action:'[data-action="bonus"][data-value="crit_chance"]'});
for(const [name,bonuses,pick] of [['bulwark',['defense_boost','defense_boost'],'first_guard'],['lifebloom',['regeneration'],'lifesteal']]){const run=structuredClone(reward);run.bonuses=bonuses;run.offers=[pick,'attack_boost','hp_boost'];fixtures.push({name:`awakening-${name}`,run,selector:'.awakening-toast',action:`[data-action="bonus"][data-value="${pick}"]`});}
const camp=E.createRun(7,E.baseMeta(),c,2026);Object.assign(camp,{phase:'camp',stageIndex:13,travelProgress:1,hero:E.fighter(8,10,c),partnerForms:[7,8],regionEntry:null});
fixtures.push({name:'growth-map',run:camp,selector:'.evolution-caption',action:'[data-action="encounter"][data-value="train"]'});
const victory=simulate(2026,4,{stopAt:r=>r.phase==='victoryBeat'}).run;
victory.pendingGrowth=null;victory.pendingAwakenings=[];victory.regionEntry=null;
fixtures.push({name:'victory',run:victory,selector:'.victory-banner'});
const growth=structuredClone(victory);growth.hero=E.fighter(9,11,c);growth.partnerForms=[7,8,9];growth.pendingGrowth={fromId:8,toId:9};
fixtures.push({name:'growth-battle',run:growth,selector:'.evolution-caption'});
for(const f of fixtures.filter(f=>f.name.startsWith('growth-')))fixtures.push({...f,name:`${f.name}-arrival`,arrival:true});
fixtures.push({name:'growth-battle-peak',run:growth,selector:'.evolution-caption',peak:true});
try{
 for(const [width,height] of baseline?[[1280,720]]:[[1440,900],[1280,720],[1024,768]])for(const f of peakOnly?fixtures.filter(f=>f.peak):fixtures){
  assert.ok(validRun(f.run,c),f.name);const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data)),{version:3,meta:E.baseMeta(),run:f.run});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();if(f.action)await page.locator(f.action).click();
  await page.locator(f.selector).waitFor();if(f.arrival)await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('joins your journey'),f.selector);if(f.name.startsWith('region')||f.name.startsWith('awakening'))await page.waitForFunction(selector=>+getComputedStyle(document.querySelector(selector)).opacity>.99,f.selector);
  if(f.peak)await page.waitForFunction(()=>document.querySelector('.actor-ally .body-art')?.dataset.species==='9');await page.locator('[data-action="pause"]').click();
  const saved=await page.evaluate(()=>localStorage.getItem('pokeRogueAdventureV3'));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>localStorage.getItem('pokeRogueAdventureV3')),saved);
  const hidePause=await page.addStyleTag({content:'dialog,dialog::backdrop{visibility:hidden!important}'});
  const layout=await page.locator(f.selector).evaluate(root=>{const a=root.getBoundingClientRect(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),failures=[];let n;while(n=walker.nextNode())if(n.textContent.trim()){const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&r.height&&(r.left<8||r.right>innerWidth-8||r.top<8||r.bottom>innerHeight-8||parseFloat(getComputedStyle(n.parentElement).fontSize)<14))failures.push(n.textContent);}const overlaps=[];if(root.classList.contains('evolution-caption'))for(const sel of ['.battle-narration','.travel-caption']){const el=document.querySelector(sel);if(el&&!el.contains(root)){const b=el.getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)overlaps.push(sel);}}return {failures,overlaps};});
  const contrast=await readingContrast(page,f.selector);await page.screenshot({path:`${out}/${f.name}-${width}.png`});checks.push({name:f.name,width,layout,...contrast});
  if(!baseline){assert.deepEqual(layout.failures,[]);assert.deepEqual(layout.overlaps,[]);assert.ok(contrast.minimum>=4.5,JSON.stringify(checks.at(-1)));}
  await hidePause.evaluate(node=>node.remove());await page.locator('[data-action="close"]').first().click();await page.locator(f.selector).waitFor({state:'detached'});
  if(f.name.startsWith('growth-')){const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run),before=JSON.parse(saved).run;assert.equal(after.pendingGrowth,null);assert.equal(after.hero.id,before.hero.id);assert.equal(after.hero.level,before.hero.level);}
  if(f.name.startsWith('awakening'))assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.pendingAwakenings),[]);
  if(f.name.startsWith('region'))assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.regionEntry),null);
  await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({cases:checks.length,minimumContrast:Math.min(...checks.map(x=>x.minimum)),weak:checks.filter(x=>x.minimum<4.5||x.layout.overlaps.length),errors},null,2));
}finally{await browser.close();}
