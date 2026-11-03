import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {simulate} from "./simulate.mjs";
import {validRun} from "../storage.js";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run);
async function open(run){
 assert.ok(validRun(run,c));const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 await context.addInitScript(data=>{if(!localStorage.getItem("pokeRogueAdventureV3"))localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));},{version:3,meta:E.baseMeta(),run});
 page.on("pageerror",error=>errors.push(error.message));await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();return {page,context};
}
function fixture(phase){const r=simulate(2026,4,{stopAt:r=>r.phase===phase}).run;r.pendingGrowth=null;r.pendingAwakenings=[];return r;}
try{
 const shrine=fixture("shrine");Object.assign(shrine,{bonuses:[],offers:["hp_boost","attack_boost","regeneration"]});shrine.hero.hp=shrine.hero.maxHp=90;
 let {page,context}=await open(shrine);await page.locator('[data-action="offering"]').click();
 const choice=page.locator('[data-action="bonus"][data-value="hp_boost"]');assert.match(await choice.textContent(),/Maximum HP \+40 to 130.*107\/130/);
 const untouched=await saved(page);await choice.hover();await choice.focus();await page.waitForTimeout(200);assert.deepEqual(await saved(page),untouched);
 await page.screenshot({path:"output/playwright/choice-offering-preview.png"});await choice.click();await page.locator('[data-action="pause"]').click();
 let after=await saved(page);assert.equal(after.hero.maxHp,130);assert.equal(after.hero.hp,107);assert.equal(E.count(after,"hp_boost"),2);assert.equal(after.shrineEmpowered,false);
 await page.reload();await page.locator('[data-action="resume"]').click();await page.locator('[data-action="pause"]').click();after=await saved(page);assert.equal(after.hero.hp,107);assert.equal(after.hero.maxHp,130);
 checks.push("Offered Endurance shows its exact compounded max HP and net health; hover/focus spend nothing; choosing and reloading match the preview once");await context.close();

 const recovery=fixture("reward");recovery.offers=["pp_boost","hp_boost","attack_boost"];recovery.hero.maxHp=90;recovery.hero.hp=50;recovery.hero.moves.forEach(s=>s.pp=1);
 const expected=E.previewBonus(recovery,"pp_boost");({page,context}=await open(recovery));
 assert.match(await page.locator('[data-action="bonus"][data-value="pp_boost"]').textContent(),new RegExp(`Restore 18 HP and ${expected.ppRestored} PP`));
 await page.locator('[data-action="bonus"][data-value="pp_boost"]').click();await page.locator('[data-action="pause"]').click();after=await saved(page);assert.equal(after.hero.hp,68);assert.ok(after.hero.moves.every(s=>s.pp===s.maxPp));await context.close();
 checks.push("Second Wind shows the actual capped HP and missing PP restoration before selection");

 const shop=fixture("shop");shop.coins=200;shop.bonuses=["attack_boost","crit_chance","defense_boost","first_guard"];shop.hero.hp=Math.floor(shop.hero.maxHp*.7);
 ({page,context}=await open(shop));const force=page.locator('[data-action="buy"][data-value="force"]');
 assert.match(await force.textContent(),/Strength 2\/3.*Awakens Windscar Talons.*130 gold left/);
 const before=await saved(page);await force.hover();await page.waitForTimeout(200);assert.deepEqual(await saved(page),before);
 await page.screenshot({path:"output/playwright/choice-merchant-preview.png"});await force.click();await page.locator(".awakening-toast").waitFor();
 await page.locator('[data-action="pause"]').click();after=await saved(page);assert.equal(after.coins,130);assert.equal(E.count(after,"attack_boost"),2);assert.deepEqual(after.pendingAwakenings,["flurry"]);
 await page.reload();await page.locator('[data-action="resume"]').click();
 await page.waitForFunction(()=>!JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.pendingAwakenings.length);
 await force.waitFor();assert.doesNotMatch(await force.textContent(),/Awakens/);assert.match(await force.textContent(),/60 gold left/);
 await force.click();assert.equal(await force.isDisabled(),true);assert.match(await force.textContent(),/Maximum Strength rank reached/);assert.equal((await saved(page)).coins,60);
  await page.screenshot({path:"output/playwright/choice-merchant-limits.png"});
 checks.push("Merchant announces recipe awakening, next rank and remaining gold; purchase charges once through reload; later previews refresh and capped items explain why they are disabled");await context.close();
 assert.deepEqual(errors,[]);await writeFile("output/playwright/choice-preview-results.json",JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
