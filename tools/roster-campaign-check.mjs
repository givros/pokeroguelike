import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
import {simulate} from './simulate.mjs';
const args=process.argv.slice(2),evolution=Number(args.find(arg=>arg.startsWith('--evolution='))?.split('=')[1]??134);assert.ok([134,135,136].includes(evolution));
const threat=Number(args.find(arg=>arg.startsWith('--threat='))?.split('=')[1]??0),maximum=args.includes('--max-upgrades'),cache=args.find(arg=>arg.startsWith('--cache='))?.split('=')[1],camp=args.find(arg=>arg.startsWith('--camp='))?.split('=')[1]||'train',allowDefeat=args.includes('--allow-defeat');assert.ok(Number.isInteger(threat)&&threat>=0&&threat<=E.MAX_THREAT);assert.ok(!cache||['gold','heal','study'].includes(cache));assert.ok(['rest','train','scout'].includes(camp));
const french=args.includes('--fr');
const ids=args.filter(arg=>!arg.startsWith('--')).map(Number);if(!ids.length)ids.push(1,4,7,25,133,152);for(const id of ids)assert.ok([1,4,7,25,133,152].includes(id));
const browser=await chromium.launch({headless:true}),out=`output/playwright/roster${french?'-fr':''}${evolution===134?'':`-evolution-${evolution}`}${threat?`-threat-${threat}`:''}${maximum?'-max':''}${cache?`-cache-${cache}`:''}${camp==='train'?'':`-camp-${camp}`}`,reports=[],errors=[];await mkdir(out,{recursive:true});
const preference=['regeneration','lifesteal','attack_boost','defense_boost','hp_boost','first_guard','crit_chance','type_boost','momentum','focus_crit','pp_boost','gold_boost'];
const gameplay=r=>Object.fromEntries(['phase','stageIndex','starterId','initialSeed','seed','threat','wins','actions','battleActions','coins','hero','enemy','bonuses','partnerForms','stats','encounters','upgrades','endBonus'].map(key=>[key,r[key]]));
const progression=m=>Object.fromEntries(['gold','totalRuns','totalVictories','bestScore','unlockedThreat','selectedThreat','unlockedStarters','permanentUpgrades','discoveries','expeditionHistory'].map(key=>[key,m[key]]));
try{
 for(const id of ids){
  const meta=E.baseMeta();meta.language=french?'fr':'en';meta.totalVictories=50;meta.battleSpeed=750;for(const key of Object.keys(meta.unlockedStarters))meta.unlockedStarters[key]=true;
  if(threat){Object.assign(meta,{totalVictories:100,totalRuns:12,bestScore:9,unlockedThreat:threat});}if(maximum)for(const key of Object.keys(meta.permanentUpgrades))meta.permanentUpgrades[key]=10;
  const model=simulate(2026,id,{camp,evolution,threat,cache,upgrades:meta.permanentUpgrades}),expected=structuredClone(model.run),expectedMeta=structuredClone(meta);expectedMeta.selectedThreat=threat;assert.ok(allowDefeat?['complete','defeat'].includes(expected.phase):expected.phase==='complete');E.settle(expected,expectedMeta);
  const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'no-preference'});await context.addInitScript(meta=>{Date.now=()=>2026;if(!localStorage.getItem('pokeRogueAdventureV3'))localStorage.setItem('pokeRogueAdventureV3',JSON.stringify({version:3,meta,run:null}));},meta);
  const page=await context.newPage();page.on('pageerror',e=>errors.push({id,error:e.message}));page.on('response',r=>{if(r.status()>=400)errors.push({id,error:`${r.status()} ${r.url()}`});});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3'))),click=(action,value)=>page.locator(`[data-action="${action}"]${value===undefined?'':`[data-value="${value}"]`}`).first().click();
  await page.goto('http://127.0.0.1:5173');if(threat){await click('threats');const option=page.locator(`[data-action="choose-threat"][data-value="${threat}"]`);assert.equal(await option.isDisabled(),false);assert.match(await option.textContent(),new RegExp(`Enemy HP \\+${threat*20}%`));assert.match(await option.textContent(),new RegExp(`Enemy damage \\+${threat*12}%`));await option.click();await click('close');await page.reload();await page.locator('[data-action="starter"]').first().waitFor();assert.equal((await saved()).meta.selectedThreat,threat);}await click('starter',id);assert.equal((await saved()).run.threat,threat);const deadline=Date.now()+300000,visited=new Set(),captures=new Set(),decisions=[];let lastStage=-1;
  while(Date.now()<deadline){
   let {run:r}=await saved();visited.add(r.phase);assert.ok(r.stageIndex>=0&&r.stageIndex<15);assert.ok(r.battleActions<=80);if(r.stageIndex!==lastStage){lastStage=r.stageIndex;console.log(`Starter ${id}: stage ${lastStage+1}/15`);}
   if(['complete','defeat','retired'].includes(r.phase))break;
   if(r.pendingGrowth||r.pendingAwakenings?.length||r.regionEntry){await page.waitForTimeout(75);continue;}
   const region=E.region(r).id;if(r.phase==='battle'&&!captures.has(region)){await page.screenshot({path:`${out}/${id}-${region}-battle.png`});captures.add(region);}
   if(E.needsRouteChoice(r)){await click('select-route',`${r.stageIndex}-0`);}
   else if(['starter','reward','shrine'].includes(r.phase)){
    const boon=preference.find(key=>E.canSelectBonus(r,key));decisions.push({stage:r.stageIndex,phase:r.phase,choice:boon||'leave'});if(boon)await click('bonus',boon);else await click('encounter','leave');
   }else if(r.phase==='camp'){decisions.push({stage:r.stageIndex,phase:r.phase,choice:camp});await click('encounter',camp);}
   else if(r.phase==='cache'){const choice=cache||(r.hero.hp<r.hero.maxHp*.7?'heal':'gold');decisions.push({stage:r.stageIndex,phase:r.phase,choice});await click('encounter',choice);}
   else if(r.phase==='evolution'){assert.equal(id,133);await page.screenshot({path:`${out}/${id}-evolution-choice.png`});decisions.push({stage:r.stageIndex,phase:r.phase,choice:evolution});await click('evolve',evolution);}
   else if(r.phase==='shop'){
    if(r.hero.hp<r.hero.maxHp*.9&&r.coins>=85&&!await page.locator('[data-action="buy"][data-value="full_heal"]').isDisabled()){await click('buy','full_heal');decisions.push({stage:r.stageIndex,phase:'shop',choice:'full_heal'});}
    r=(await saved()).run;if(r.coins>=70&&!await page.locator('[data-action="buy"][data-value="guard"]').isDisabled()){await click('buy','guard');decisions.push({stage:r.stageIndex,phase:'shop',choice:'guard'});}
    await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.pendingAwakenings?.length);await click('leave');
   }else await page.waitForTimeout(90);
  }
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.settled===true);await page.locator('.ending-content').waitFor();const final=await saved();await writeFile(`${out}/${id}-actual.json`,JSON.stringify(final,null,2));
  assert.deepEqual(gameplay(final.run),gameplay(expected),`Starter ${id}: UI campaign must match native seeded engine, including PP/RNG/HP and choices`);assert.deepEqual(progression(final.meta),progression(expectedMeta));
  for(const phase of ['travel','battle','reward','camp','cache','shop','shrine'])if(model.visited.includes(phase))assert.ok(visited.has(phase),`${id}: ${phase} must be played`);assert.equal(final.run.wins,expected.wins);assert.ok(final.run.settled);assert.equal(await page.locator('.vfx,.damage-number').count(),0);if(id===133&&model.visited.includes('evolution'))assert.ok(visited.has('evolution'));
  await page.screenshot({path:`${out}/${id}-${final.run.phase}.png`});await page.waitForTimeout(250);assert.deepEqual(await saved(),final);await page.reload();await page.locator('.ending-content').waitFor();assert.deepEqual(await saved(),final,'Reloading the settled ending must not grant anything twice');
  await click('finish');assert.equal((await saved()).run,null);assert.deepEqual(progression((await saved()).meta),progression(final.meta));
  const report={starter:id,partner:final.run.hero.id,phase:final.run.phase,stage:final.run.stageIndex+1,threat,maximum,actions:final.run.actions,wins:final.run.wins,gold:final.run.coins,forms:final.run.partnerForms,visited:[...visited],decisions,oracleMatched:true,reloadAndSettlement:true};reports.push(report);await writeFile(`${out}/${id}-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/group-${ids.join('-')}.json`,JSON.stringify({reports,errors},null,2));
}finally{await browser.close();}
