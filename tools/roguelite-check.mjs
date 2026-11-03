import assert from 'node:assert/strict';
import {chromium}from'playwright';
import {mkdir,writeFile}from'node:fs/promises';
import*as E from'../engine.js';
import{validRun}from'../storage.js';
import{catalogue,manualDecision,simulateRoguelite}from'./roguelite-fixtures.mjs';
const out='output/roguelite/acceptance';await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')));
async function click(p,action,value){const selector=`[data-action="${action}"]${value===undefined?'':`[data-value="${value}"]`}`,inside=p.locator(`dialog ${selector}`),target=(await inside.count()?inside:p.locator(selector)).first();await target.click();}
async function context(meta,size){const ctx=await browser.newContext({viewport:size,isMobile:size.width<981,hasTouch:size.width<981,deviceScaleFactor:1});await ctx.addInitScript(meta=>{Date.now=()=>6;if(!localStorage.getItem('pokeRogueAdventureV3'))localStorage.setItem('pokeRogueAdventureV3',JSON.stringify({version:3,meta,run:null}));},meta);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5173');return{p,ctx};}
try{
 for(const size of[{width:1280,height:720},{width:390,height:844}]){
  const meta=E.baseMeta();meta.language='fr';meta.battleSpeed=750;const expected=simulateRoguelite(6,{meta:structuredClone(meta)}),{p,ctx}=await context(meta,size);
  await p.locator('[data-action="random-start"]').waitFor();assert.equal(await p.locator('.starter-pokemon').count(),0);await click(p,'random-start');await p.locator('.roll-strip').waitFor();const rolled=(await saved(p)).run;await p.waitForTimeout(350);await p.screenshot({path:`${out}/roll-${size.width}.png`});await p.locator('[data-action="bonus"]').first().waitFor();assert.equal((await saved(p)).run.hero.id,rolled.hero.id);assert.equal((await saved(p)).run.seed,rolled.seed);
  const seen=new Set(),deadline=Date.now()+180000;let reloaded=false;
  while(Date.now()<deadline){const{run:r}=await saved(p);seen.add(r.phase);if(['defeat','complete'].includes(r.phase))break;if(r.introPending||r.pendingGrowth||r.pendingAwakenings?.length){await p.waitForTimeout(70);continue;}
   const decision=manualDecision(r);
   if(decision){
    if(decision.action==='route'){
     if(r.stageIndex===1){assert.ok(await p.locator('[data-route-node="1-0"] img').getAttribute('src').then(src=>src.endsWith('capture-ball.webp')));assert.equal(await p.locator('[data-route-node="1-0"] .pokemon-art').count(),0);}
     await click(p,'select-route',decision.value);if(size.width<981)await click(p,'enter-route',decision.value);
    }else if(decision.action==='capture'){
     assert.equal(r.enemy.hp,0);if(decision.value==='attempt'){await p.locator('.capture-dock').waitFor();await p.screenshot({path:`${out}/capture-offer-${size.width}.png`});await click(p,'capture-attempt');const result=(await saved(p)).run;assert.ok(result.pendingCapture.attempted);await p.screenshot({path:`${out}/capture-result-${size.width}.png`});
      if(!reloaded){const fingerprint=structuredClone(result);await p.reload();await click(p,'resume');await p.locator('.capture-dock').waitFor();assert.deepEqual((await saved(p)).run,fingerprint);assert.equal(await p.locator('[data-action="capture-attempt"]').count(),0);reloaded=true;}
     }else await click(p,'capture-continue');
    }else if(decision.action==='leave')await click(p,'leave');else await click(p,decision.action,decision.value);
   }else if(r.phase==='evolution')await click(p,'evolve',134);else await p.waitForTimeout(70);
  }
  await p.locator('.ending-content').waitFor();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.settled);const final=await saved(p);assert.equal(final.run.phase,'defeat');assert.ok(validRun(final.run,catalogue));
  for(const key of ['seed','hero','enemy','bonuses','actions','wins','stageIndex','coins','captures','salvage','skill','gear','legacyReward','stats','discoveryLedger','branchPath','branchStart'])assert.deepEqual(final.run[key],expected.run[key],`${size.width}: ${key}`);
  assert.deepEqual(final.meta,expected.meta);assert.ok(Object.keys(final.meta.captured).length);assert.ok(seen.has('capture'));await p.screenshot({path:`${out}/defeat-${size.width}.png`});await p.reload();await p.locator('.ending-content').waitFor();assert.deepEqual(await saved(p),final);
  await click(p,'finish');await click(p,'partners');const owned=Number(Object.keys(final.meta.captured)[0]);await click(p,'partner-choice',owned);await click(p,'close');await click(p,'legacy');if(final.meta.legacyMarks>=3)await click(p,'unlock-skill','adrenaline');await click(p,'upgrades');if(final.meta.gold>=100)await click(p,'upgrade','maxHpBonus');await click(p,'close');await click(p,'random-start');await p.locator('[data-action="bonus"]').first().waitFor();const next=(await saved(p)).run;assert.equal(next.hero.id,owned);assert.equal(next.coins,0);if(final.meta.legacyMarks>=3)assert.equal(next.skill,'adrenaline');if(final.meta.gold>=100)assert.equal(next.upgrades.maxHpBonus,1);assert.equal(next.introMode,'chosen');checks.push({size,depth:final.run.stageIndex+1,wins:final.run.wins,captured:final.meta.captured,marks:final.meta.legacyMarks,exactOracle:true,lockedRandomStart:true,captureReload:true,deathCollectionSelection:true,statAndSkillCarry:true});await ctx.close();
 }
 const earned=simulateRoguelite(2026,{starter:133,plan:'predator'});assert.ok(Object.keys(earned.meta.equipment).length);earned.meta.language='fr';const{p,ctx}=await context(earned.meta,{width:390,height:844});await click(p,'legacy');await click(p,'unlock-skill','ward');await click(p,'equip-gear','charm');const prepared=(await saved(p)).meta;await p.screenshot({path:`${out}/equipment-390.png`});await click(p,'close');await click(p,'random-start');await p.locator('[data-action="bonus"]').first().waitFor();const next=(await saved(p)).run;assert.equal(next.skill,'ward');assert.deepEqual(next.gear,{id:'charm',tier:prepared.equipment.charm});assert.equal(next.hero.maxHp,E.fighter(next.hero.id,5,catalogue,prepared.permanentUpgrades).maxHp+25+8*prepared.equipment.charm);checks.push({equipmentSecuredFromRealEngineRun:true,equippedTier:next.gear.tier,skillSnapshot:true,gearHpBonus:true});await ctx.close();
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}

