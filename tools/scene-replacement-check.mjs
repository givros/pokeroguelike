import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
import {simulate} from './simulate.mjs';
import {elementalBattle} from './elemental-fixtures.mjs';
const french=process.argv.includes('--fr');
const c={pokemon:JSON.parse(await readFile('data/pokemon.json')),moves:JSON.parse(await readFile('data/moves.json'))},baseline=process.argv.includes('--baseline'),browser=await chromium.launch({headless:true}),checks=[],errors=[];
const shop=simulate(2026,4,{stopAt:r=>r.phase==='shop'}).run;Object.assign(shop,{coins:200,bonuses:['defense_boost','first_guard'],pendingGrowth:null,pendingAwakenings:[]});
const growth=E.createRun(7,E.baseMeta(),c,2026);Object.assign(growth,{phase:'camp',stageIndex:13,travelProgress:1,hero:E.fighter(8,10,c),partnerForms:[7,8],regionEntry:null});
const fixtures=[{name:'merchant-plan',run:shop,kind:'awakening-toast',action:['buy','guard']},{name:'windup-plan',run:elementalBattle('dragon','ally',4,c),kind:'windup'},{name:'flight-plan',run:elementalBattle('dragon','ally',4,c),kind:'flight'},{name:'growth-plan',run:growth,kind:'evolution-caption',action:['encounter','train']}];
try{
 for(const f of fixtures){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),meta=E.baseMeta();meta.battleSpeed=2000;meta.language=french?"fr":"en";
  await context.addInitScript(data=>{
   localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data));window.__cosmetics=[];window.__windups=[];
   const selector='.awakening-toast,.evolution-caption,.region-entry',record=n=>{if(n.matches(selector)&&!window.__cosmetics.some(w=>w.node===n))window.__cosmetics.push({node:n,time:performance.now(),kind:[...n.classList].find(k=>['awakening-toast','evolution-caption','region-entry'].includes(k))});};
   new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1){record(n);n.querySelectorAll(selector).forEach(record);}}).observe(document,{subtree:true,childList:true});
   const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const a=animate.call(this,frames,options);if(this.matches('.actor-ally .body-art')&&Array.isArray(frames)&&frames.some(k=>k.rotate))window.__windups.push({node:this,animation:a});return a;};
  },{version:3,meta,run:f.run});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run),click=(action,value)=>page.locator(`[data-action="${action}"]${value?`[data-value="${value}"]`:''}`).first().click();
  await page.goto('http://127.0.0.1:5173');await click('resume');if(f.action)await click(...f.action);
  if(f.kind==='windup')await page.waitForFunction(()=>window.__windups.some(w=>{const p=w.animation.effect.getComputedTiming().progress;return p>.05&&p<.2;}));else if(f.kind==='flight')await page.waitForFunction(()=>{const n=document.querySelector('.projectile'),a=n?.getAnimations()[0],p=a?.effect.getComputedTiming().progress;return p>.2&&p<.5;});else await page.locator('.'+f.kind).waitFor();
  const before=await saved();if(f.name==='merchant-plan'){assert.ok(before.pendingAwakenings.includes('bulwark'));assert.equal(await page.locator('[data-action="leave"]').count(),0,'Merchant choices already wait for the awakening');}await page.evaluate(kind=>window.__oldNode=['windup','flight'].includes(kind)?document.querySelector('.actor-ally .body-art'):document.querySelector('.'+kind),f.kind);
  const visualBefore=await page.evaluate(()=>window.__cosmetics.map(w=>({time:w.time,now:performance.now(),times:w.node.getAnimations().map(a=>a.currentTime)}))),changeStart=Date.now();
  await click('pause');await click('plans');await click('set-plan','predator');const changeMs=Date.now()-changeStart;
  const changed=await saved();assert.equal(changed.actions,before.actions);assert.deepEqual(changed.hero,before.hero);assert.equal(changed.seed,before.seed);assert.equal(changed.coins,before.coins);
  await page.waitForTimeout(250);const replay=await page.evaluate(kind=>['windup','flight'].includes(kind)?window.__windups.some(w=>w.node!==window.__oldNode&&w.node.isConnected):window.__cosmetics.some(w=>w.kind===kind&&w.node!==window.__oldNode&&w.node.isConnected),f.kind);
  if(!replay&&!baseline){await writeFile('output/replacement-failure.json',JSON.stringify({name:f.name,changeMs,visualBefore,run:await saved(),observed:await page.evaluate(()=>window.__cosmetics.map(w=>({kind:w.kind,time:w.time,now:performance.now(),connected:w.node.isConnected,old:w.node===window.__oldNode}))),errors},null,2));await page.screenshot({path:'output/playwright/replacement-failure.png'});}
  if(!baseline)assert.ok(replay,`${f.name}: the replacement scene must replay its unfinished cosmetic work`);
  if(!baseline&&['merchant-plan','flight-plan','growth-plan'].includes(f.name)){
   if(f.kind==='awakening-toast')await page.waitForFunction(()=>+getComputedStyle(document.querySelector('.awakening-toast')).opacity>.99);
   await click('pause');const hide=await page.addStyleTag({content:'dialog,dialog::backdrop{visibility:hidden!important}'});await page.screenshot({path:`output/playwright/scene-replay-${f.name}.png`});await hide.evaluate(n=>n.remove());await page.getByRole('button',{name:french?'Reprendre':'Resume',exact:true}).click();
  }
  if(['windup','flight'].includes(f.kind)){
   const expected=structuredClone(changed);E.battleStep(expected,c);await page.waitForFunction(actions=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.actions>actions,changed.actions);await click('pause');const hit=await saved();assert.equal(hit.actions,expected.actions);assert.equal(hit.seed,expected.seed);assert.equal(hit.enemy.hp,expected.enemy.hp);assert.deepEqual(hit.hero.moves,expected.hero.moves);
  }else{
   await page.waitForFunction(kind=>{const r=JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run;return kind==='region-entry'?!r.regionEntry:kind==='evolution-caption'?!r.pendingGrowth:!r.pendingAwakenings.length;},f.kind);await click('pause');const after=await saved();assert.equal(after.coins,before.coins);assert.equal(after.hero.level,before.hero.level);assert.equal(after.hero.maxHp,before.hero.maxHp);assert.equal(after.bonuses.filter(b=>b==='defense_boost').length,before.bonuses.filter(b=>b==='defense_boost').length);
  }
  checks.push({name:f.name,replayed:replay,resourcesPreserved:true});await context.close();
 }
 if(!baseline){
  const run=elementalBattle('dragon','ally',4,c),context=await browser.newContext({viewport:{width:1280,height:720}});await context.addInitScript(data=>localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data)),{version:3,meta:{...E.baseMeta(),language:french?'fr':'en'},run});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();await page.waitForFunction(()=>document.querySelector('.actor-ally .body-art')?.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.rotate)));await page.locator('[data-action="pause"]').click();const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run);await page.evaluate(()=>document.querySelector('#battle-scene').remove());await page.getByRole('button',{name:french?'Reprendre':'Resume',exact:true}).click();await page.locator('.fatal-panel').waitFor();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run),before);await page.waitForTimeout(100);await page.locator('[data-action="recover"]').click();await page.getByRole('button',{name:french?'Reprendre':'Resume',exact:true}).click();await page.waitForFunction(n=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.actions>n,before.actions);checks.push({name:'missing-scene-recovery',resourcesPreserved:true,resumed:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`output/playwright/scene-replacement${french?'-fr':''}${baseline?'-before':''}.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
