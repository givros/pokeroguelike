import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
import {simulate} from './simulate.mjs';
const c={pokemon:JSON.parse(await readFile('data/pokemon.json')),moves:JSON.parse(await readFile('data/moves.json'))},baseline=process.argv.includes('--baseline');
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const fixtures=[];
for(const enabled of [false,true])for(const beat of ['windup','impact']){const run=simulate(2026,4,{stopAt:r=>r.phase==='battle'}).run;fixtures.push({name:`${beat}-${enabled?'idle':'manual'}`,run,enabled,beat});}
const travel=E.createRun(4,E.baseMeta(),c,2026);E.selectBonus(travel,travel.offers[0]);travel.regionEntry=null;fixtures.push({name:'travel-idle',run:travel,enabled:true,beat:'travel'});
const landmark=simulate(2026,4,{stopAt:r=>r.phase==='arrival'&&r.stageIndex===9}).run;landmark.regionEntry=null;fixtures.push({name:'landmark-idle',run:landmark,enabled:true,beat:'landmark'});
const growth=E.createRun(7,E.baseMeta(),c,2026);Object.assign(growth,{phase:'camp',stageIndex:13,travelProgress:1,hero:E.fighter(8,10,c),partnerForms:[7,8],regionEntry:null});fixtures.push({name:'growth-idle',run:growth,enabled:true,beat:'growth',action:'[data-action="encounter"][data-value="train"]'});
const reward=simulate(2026,4,{stopAt:r=>r.phase==='reward'}).run;Object.assign(reward,{bonuses:['attack_boost','attack_boost'],offers:['crit_chance','defense_boost','regeneration']});fixtures.push({name:'awakening-idle',run:reward,enabled:true,beat:'awakening',action:'[data-action="bonus"][data-value="crit_chance"]'});
const region=E.createRun(4,E.baseMeta(),c,2026);E.selectBonus(region,region.offers[0]);fixtures.push({name:'region-idle',run:region,enabled:true,beat:'region'});
const selectors={impact:'.effect-sprite',travel:'#map-actor .body-art',landmark:'#map-actor .body-art',growth:'#map-actor .body-art',awakening:'.awakening-toast',region:'.region-entry'};
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run);
try{
 for(const f of fixtures){const run=structuredClone(f.run);run.pendingAwakenings=[];run.pendingGrowth=null;Object.assign(run,{plan:f.enabled?'predator':'manual',idleEnabled:f.enabled,idleAt:null});
  const context=await browser.newContext({viewport:{width:1280,height:720}});await context.addInitScript(data=>localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data)),{version:3,meta:E.baseMeta(),run});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();if(f.action)await page.locator(f.action).click();
  let selector=selectors[f.beat];
  if(f.beat==='windup'){await page.waitForFunction(()=>[...document.querySelectorAll('.actor .body-art')].some(n=>n.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.rotate))));selector=await page.evaluate(()=>{const r=JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run;return `.actor-${r.nextSide} .body-art`;});}
  else if(f.beat==='travel')await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.travelProgress>.02);
  else if(f.beat==='landmark')await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.landmark?.progress>.02);
  else if(f.beat==='growth')await page.waitForFunction(()=>!!document.querySelector('.evolving'));
  else await page.locator(selector).waitFor();
  await page.locator('[data-action="pause"]').click();await page.locator(selector).evaluate(n=>Promise.all(n.getAnimations().map(a=>a.ready)));
  // Let the HP meter finish displaying the already committed hit before comparing paused pixels.
  await page.waitForTimeout(250);const paused=await saved(page);assert.equal(paused.idleAt,null);
  const before=await page.locator(selector).evaluate(n=>{window.__heldNode=n;window.__heldAnimations=n.getAnimations();return {src:n.getAttribute('src'),text:n.textContent,times:window.__heldAnimations.map(a=>a.currentTime)};});
  const hidePause=await page.addStyleTag({content:'dialog,dialog::backdrop{visibility:hidden!important}'}),beforeFrame=await page.screenshot({path:`output/playwright/paused-visibility-${f.name}-before.png`});
  await page.evaluate(()=>{window.__hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);await page.evaluate(()=>{window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);
  const after=await page.evaluate(selector=>({retained:document.querySelector(selector)===window.__heldNode,connected:window.__heldNode.isConnected,src:document.querySelector(selector)?.getAttribute('src'),times:window.__heldAnimations.map(a=>a.currentTime),states:window.__heldAnimations.map(a=>a.playState)}),selector);assert.deepEqual(await saved(page),paused);assert.equal(await page.getByRole('heading',{name:'While you were away'}).count(),0);
  const afterFrame=await page.screenshot({path:`output/playwright/paused-visibility-${f.name}-after.png`}),samePixels=beforeFrame.equals(afterFrame);await hidePause.evaluate(n=>n.remove());
  if(!baseline){assert.ok(after.retained&&after.connected,`${f.name}: a paused scene must survive visibility without absence`);assert.equal(after.src,before.src);assert.deepEqual(after.times,before.times);assert.ok(after.states.every(state=>state==='paused'));assert.ok(samePixels,`${f.name}: the rendered paused scene must remain identical`);}
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.waitForFunction(({beat,before})=>{const r=JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run;if(['windup','impact'].includes(beat))return r.actions>before.actions;if(beat==='growth')return !r.pendingGrowth&&r.hero.id===9;if(beat==='awakening')return !r.pendingAwakenings.length;if(beat==='region')return !r.regionEntry&&r.travelProgress>before.travelProgress;if(beat==='landmark')return r.landmark?.progress>before.landmark.progress||r.landmark?.state!==before.landmark.state;return r.travelProgress>before.travelProgress;},{beat:f.beat,before:paused});
  checks.push({name:f.name,before,after,samePixels,stateUnchanged:true,resumed:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`output/playwright/paused-visibility${baseline?'-before':''}.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({cases:checks.length,replaced:checks.filter(c=>!c.after.retained).map(c=>c.name),errors}));
}finally{await browser.close();}
