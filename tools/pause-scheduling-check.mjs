import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
import {simulate} from './simulate.mjs';
const baseline=process.argv.includes('--baseline'),browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 for(const phase of ['travel','battle']){
  const run=simulate(2026,4,{stopAt:r=>r.phase===phase}).run;run.pendingGrowth=null;run.pendingAwakenings=[];run.regionEntry=null;
  const context=await browser.newContext({viewport:{width:1280,height:720}});
  await context.addInitScript(data=>{
   localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data));
   window.__scheduled={timers:0,frames:0};const timeout=window.setTimeout,frame=window.requestAnimationFrame;
   window.setTimeout=function(...args){window.__scheduled.timers++;return timeout.apply(this,args);};
   window.requestAnimationFrame=function(...args){window.__scheduled.frames++;return frame.apply(this,args);};
  },{version:3,meta:E.baseMeta(),run});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();
  if(phase==='travel')await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.travelProgress>0);
  else await page.waitForFunction(()=>document.querySelector('.actor-ally .body-art')?.getAnimations().length>0);
  await page.locator('[data-action="pause"]').click();await page.waitForTimeout(120);
  const saved=await page.evaluate(()=>localStorage.getItem('pokeRogueAdventureV3'));await page.evaluate(()=>window.__scheduled={timers:0,frames:0});await page.waitForTimeout(700);const paused=await page.evaluate(()=>window.__scheduled);assert.equal(await page.evaluate(()=>localStorage.getItem('pokeRogueAdventureV3')),saved);
  if(!baseline)assert.deepEqual(paused,{timers:0,frames:0},`${phase}: paused simulation must wait for an explicit wake`);
  await page.getByRole('button',{name:'Resume',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'pause','Closing the menu restores its live HUD control');await page.waitForTimeout(90);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(120);
  const hiddenSaved=await page.evaluate(()=>localStorage.getItem('pokeRogueAdventureV3'));await page.evaluate(()=>window.__scheduled={timers:0,frames:0});await page.waitForTimeout(700);const hidden=await page.evaluate(()=>window.__scheduled);assert.equal(await page.evaluate(()=>localStorage.getItem('pokeRogueAdventureV3')),hiddenSaved);
  if(!baseline)assert.deepEqual(hidden,{timers:0,frames:0},`${phase}: hidden simulation must wait for visibility`);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(before=>localStorage.getItem('pokeRogueAdventureV3')!==before,hiddenSaved);await page.locator('[data-action="pause"]').click();await page.locator('[data-action="retire"]').click();await page.locator('[data-action="confirm-retire"]').click();await page.waitForTimeout(150);await page.evaluate(()=>window.__scheduled={timers:0,frames:0});await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>window.__scheduled),{timers:0,frames:0});assert.equal(await page.locator('.vfx,.damage-number').count(),0);
  checks.push({phase,paused,hidden,resumeAndRetire:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`output/playwright/pause-scheduling${baseline?'-before':''}.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
