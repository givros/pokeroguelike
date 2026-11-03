import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {GUARDIANS} from "../guardians.js";
import {validRun} from "../storage.js";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const out="output/playwright";await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
function fixture(species){
 const r=E.createRun(7,E.baseMeta(),c,2026),index=species===123?5:14;
 Object.assign(r,{stageIndex:index,phase:"arrival",scouting:{stageIndex:index,speciesId:species}});
 E.activateStage(r,c);r.preparedStrike=false;r.regionEntry=null;r.seed=1;
 r.hero.hp=r.hero.maxHp=500;r.enemy.hp=r.enemy.maxHp=500;
 if(species===123){r.enemy.hp=150;r.nextSide="enemy";r.enemy.moves=[{id:450,pp:20,maxPp:20}];}
 return r;
}
async function open(run){
 assert.ok(validRun(run,c),"Guardian browser fixture must be a resumable expedition");
 const context=await browser.newContext({viewport:{width:1280,height:720}}),meta=E.baseMeta();meta.battleSpeed=750;
 await context.addInitScript(data=>{if(!localStorage.getItem("pokeRogueAdventureV3"))localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));},{version:3,meta,run});
 const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();
 return {context,page};
}
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run);
try{
 for(const ability of GUARDIANS){
  const r=fixture(ability.species),expected=structuredClone(r),hit=E.battleStep(expected,c);
  const {context,page}=await open(r);
  const control=page.locator('[data-action="opponent"]');assert.equal(await control.textContent(),ability.name);
  await control.click();await page.getByRole("heading",{name:c.pokemon[ability.species].name,exact:true}).waitFor();
  assert.ok((await page.locator("dialog").textContent()).includes(ability.text));
  const before=await saved(page);await page.waitForTimeout(850);assert.deepEqual(await saved(page),before);
  await page.screenshot({path:`${out}/guardian-${ability.species}-inspector.png`});
  await page.locator('[data-action="close"]').click();
  await page.waitForFunction(actions=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.actions>actions,r.actions);
  await control.click();const after=await saved(page);
  assert.equal(after.actions,expected.actions);assert.deepEqual(after.hero,expected.hero);assert.deepEqual(after.enemy,expected.enemy);assert.equal(after.seed,expected.seed);
  assert.ok(after.log.some(line=>line.includes(hit.guardianEffect)));
  if(ability.key==="multiscale")assert.match(await page.locator(".guardian-state").textContent(),/Broken/);
  if(ability.key==="shell-armor")assert.ok(after.log.some(line=>line.includes("blocked a critical")));
  await page.reload();await page.locator('[data-action="resume"]').click();await page.locator('[data-action="opponent"]').click();
  const restored=await saved(page);assert.deepEqual(restored.hero,after.hero);assert.deepEqual(restored.enemy,after.enemy);assert.equal(restored.seed,after.seed);
  await page.locator('[data-action="close"]').click();await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="guardians"]').click();assert.equal(await page.locator(".guardian-guide-entry").count(),4);
  checks.push(`${ability.name}: real damage/PP match seeded engine; inspection pauses windup; reload preserves HP/PP/RNG; guide reachable`);
  await context.close();
 }
 const old=fixture(149);delete old.guardianAbilities;const {context,page}=await open(old);
 assert.equal(await page.locator('[data-action="opponent"]').count(),0);await context.close();
 checks.push("A legacy guardian save retains its original ability-free presentation and rules");
 const camp=E.createRun(7,E.baseMeta(),c,2026);Object.assign(camp,{phase:"camp",stageIndex:13,travelProgress:1});
 const scout=await open(camp);
 await scout.page.locator('[data-action="encounter"][data-value="scout"]').click();
 const scouted=await saved(scout.page),trait=GUARDIANS.find(a=>a.species===scouted.scouting.speciesId);
 assert.ok(trait);assert.ok((await scout.page.locator(".scouting-report").textContent()).includes(trait.name));
 await scout.page.screenshot({path:`${out}/guardian-scout.png`});
 await scout.page.reload();await scout.page.locator('[data-action="resume"]').click();
 assert.ok((await scout.page.locator(".scouting-report").textContent()).includes(trait.name));await scout.context.close();
 checks.push("Scouting reveals the actual upcoming native ability on the route and preserves it after reload");
 assert.deepEqual(errors,[]);await writeFile(`${out}/guardian-results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
