import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
const french=process.argv.includes('--fr');
const baseline=process.argv.includes('--baseline'),browser=await chromium.launch({headless:true,args:['--mute-audio']}),checks=[],errors=[];
const context=await browser.newContext({viewport:{width:1280,height:720}}),meta=E.baseMeta();meta.battleSpeed=750;meta.sound=true;meta.language=french?"fr":"en";
await context.addInitScript(meta=>{
 localStorage.setItem('pokeRogueAdventureV3',JSON.stringify({version:3,meta,run:null}));
 window.__scheduled={timers:0,frames:0};const timeout=window.setTimeout,frame=window.requestAnimationFrame;
 window.setTimeout=function(...args){window.__scheduled.timers++;return timeout.apply(this,args);};window.requestAnimationFrame=function(...args){window.__scheduled.frames++;return frame.apply(this,args);};
 window.__audioContexts=0;window.__activeSources=new Set();const Audio=window.AudioContext;
 window.AudioContext=class extends Audio{constructor(...args){super(...args);window.__audioContexts++;}track(source){const start=source.start.bind(source);source.start=(...args)=>{window.__activeSources.add(source);return start(...args);};source.addEventListener('ended',()=>window.__activeSources.delete(source),{once:true});return source;}createOscillator(){return this.track(super.createOscillator());}createBufferSource(){return this.track(super.createBufferSource());}};
},meta);
const page=await context.newPage(),cdp=await context.newCDPSession(page);page.on('pageerror',e=>errors.push(e.message));
const click=(action,value)=>page.locator(`[data-action="${action}"]${value?`[data-value="${value}"]`:''}`).first().click();
async function snapshot(){await cdp.send('HeapProfiler.collectGarbage');const dom=await cdp.send('Memory.getDOMCounters'),heap=await cdp.send('Runtime.getHeapUsage');return {...dom,heapUsed:heap.usedSize,...await page.evaluate(()=>({liveNodes:document.querySelectorAll('*').length,contexts:window.__audioContexts,voices:window.__activeSources.size,animations:document.getAnimations().length}))};}
try{
 await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="starter"]').first().waitFor();const initial=await snapshot();
 for(let cycle=0;cycle<(baseline?3:18);cycle++){
  const starter=[1,4,7][Math.floor(cycle/3)%3],mode=['travel','windup','impact'][cycle%3];await click('starter',starter);await click('bonus');
  await page.locator('.route-node.available').first().waitFor();
  if(mode!=='travel')await click('select-route','0-0');
  if(mode==='travel')assert.equal(await page.locator('.walking').count(),0);
  else if(mode==='windup')await page.waitForFunction(()=>document.querySelector('.actor-ally .body-art')?.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.rotate))||document.querySelector('.actor-enemy .body-art')?.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.rotate)));
  else await page.waitForFunction(()=>!!document.querySelector('.damage-number'));
  await click('pause');await click('retire');await click('confirm-retire');await page.locator('.ending-content').waitFor();const retired=await page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')));assert.equal(retired.run.phase,'retired');assert.ok(retired.run.settled);assert.equal(retired.meta.totalRuns,cycle+1);assert.ok(retired.meta.expeditionHistory.length<=12);
  await click('finish');await page.locator('.mode-title').waitFor();await page.waitForTimeout(200);await page.evaluate(()=>window.__scheduled={timers:0,frames:0});await page.waitForTimeout(250);const idle=await page.evaluate(()=>window.__scheduled);assert.deepEqual(idle,{timers:0,frames:0});assert.equal(await page.locator('.vfx,.damage-number,dialog').count(),0);const memory=await snapshot();assert.equal(memory.voices,0);assert.ok(memory.contexts<=1);checks.push({cycle,starter,mode,...memory});
 }
 const settled=await page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')));assert.equal(settled.run,null);assert.equal(settled.meta.totalRuns,baseline?3:18);assert.deepEqual(errors,[]);
 if(!baseline){const warm=checks.slice(9);assert.ok(Math.max(...warm.map(x=>x.nodes))-Math.min(...warm.map(x=>x.nodes))<=4,'DOM retention must remain bounded after warm-up');assert.equal(new Set(warm.map(x=>x.jsEventListeners)).size,1,'Repeated resets must not accumulate event handlers');}
 await writeFile(`output/playwright/restart-stability${french?'-fr':''}${baseline?'-before':''}.json`,JSON.stringify({initial,checks,errors},null,2));console.log(JSON.stringify({initial,checks,errors},null,2));
}finally{await browser.close();}
