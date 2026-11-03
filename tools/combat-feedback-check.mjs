import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import * as E from '../engine.js';
import {simulate} from './simulate.mjs';
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const run=simulate(2026,4,{stopAt:r=>r.phase==='battle'}).run;
run.bonuses=['attack_boost','attack_boost','crit_chance','defense_boost','defense_boost','first_guard','regeneration','lifesteal'];
run.enemy.maxHp=run.enemy.hp=600;run.hero.hp=run.hero.maxHp;
const meta=E.baseMeta();meta.battleSpeed=750;
const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage();
await context.addInitScript(data=>{if(!localStorage.getItem('pokeRogueAdventureV3'))localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data));},{version:3,meta,run});
page.on('pageerror',e=>errors.push(e.message));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')));
async function capture(name){
 return page.evaluate(()=>{
  const cards=[...document.querySelectorAll('.battle-card,.battle-narration')].map(n=>n.getBoundingClientRect());
  return [...document.querySelectorAll('.damage-number')].map(n=>{const r=n.getBoundingClientRect();return {label:n.textContent,x:r.x,y:r.y,width:r.width,height:r.height,overHud:cards.some(b=>r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top)};});
 });
}
try{
 await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.stats.shielding>0);
 assert.equal(Number(await page.locator('[data-barrier-value]').textContent()),(await saved()).run.hero.shield);
 const outgoing=await capture();assert.ok(outgoing.some(n=>n.label.startsWith('ECHO')));assert.ok(outgoing.some(n=>n.label.includes('BARRIER')));
 await page.screenshot({path:'output/playwright/feedback-outgoing.png'});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.stats.reflected>0);
 const incoming=await capture();await page.screenshot({path:'output/playwright/feedback-incoming.png'});
 assert.ok(incoming.some(n=>n.label.startsWith('RIPOSTE')));
 assert.equal(incoming.some(n=>n.label.startsWith('ECHO')||n.label.startsWith('+3 BARRIER')),false);
 assert.equal(Number(await page.locator('[data-barrier-value]').textContent()),(await saved()).run.hero.shield);
 assert.equal([...outgoing,...incoming].some(n=>n.overHud),false);
 for(const labels of [outgoing,incoming])for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
  const a=labels[i],b=labels[j];assert.equal(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y,false,`${a.label} overlaps ${b.label}`);
 }
 await page.locator('[data-action="pause"]').click();const frozen=await saved();await page.waitForTimeout(500);assert.deepEqual(await saved(),frozen);
 checks.push('Real attacks update the compact barrier label and meter while showing separate echo, barrier and riposte feedback');
 checks.push('Combat values avoid HP cards, narration and one another, and pause preserves HP, shield and combat progress');
 const edgeBounds=await page.evaluate(async()=>{
  const {BattleEffects}=await import('/presentation.js');const fx=new BattleEffects();fx.setPaused(true);fx.clear();
  const scene=document.querySelector('#battle-scene');
  fx.floatingText('CRITICAL -999999',{x:0,y:350},'critical');fx.floatingText('CRITICAL -999999',{x:scene.clientWidth,y:350},'critical');
  for(const a of fx.animations){await a.ready;a.currentTime=250;}
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const b=scene.getBoundingClientRect();return [...document.querySelectorAll('.damage-number')].map(n=>{const r=n.getBoundingClientRect();return {left:r.left-b.left,right:r.right-b.right};});
 });
 assert.equal(edgeBounds.every(b=>b.left>=0&&b.right<=0),true);
 checks.push('Maximum six-digit critical labels remain inside both screen edges at their enlarged animation frame');
 assert.deepEqual(errors,[]);await writeFile('output/playwright/combat-feedback-results.json',JSON.stringify({checks,outgoing,incoming,errors},null,2));console.log(JSON.stringify({checks,outgoing,incoming,errors},null,2));
}finally{await browser.close();}
