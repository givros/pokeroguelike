import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 for(const starter of [4,7,1]){
  const r=E.createRun(starter,E.baseMeta(),c,2026);E.selectBonus(r,r.offers[0]);r.travelProgress=1;E.arrive(r,c);E.activateStage(r,c);r.hero.hp=r.hero.maxHp=r.enemy.hp=r.enemy.maxHp=600;
  r.bonuses=["attack_boost","attack_boost","crit_chance","regeneration","lifesteal"];
  const context=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:"reduce"});
  await context.addInitScript(data=>{if(!localStorage.getItem("pokeRogueAdventureV3"))localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));},{version:3,meta:E.baseMeta(),run:r});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.actions>0);await page.waitForTimeout(150);
  const number=page.locator(".damage-number").first(),node=await number.elementHandle();assert.ok(node);assert.ok(await number.isVisible());
  const before=await number.boundingBox();await page.waitForTimeout(220);const after=await number.boundingBox();assert.ok(after);assert.ok(Math.abs(before.y-after.y)<.1);assert.ok(Math.abs(before.width-after.width)<.1);
  assert.equal(await page.locator(".effect-sprite,.projectile,.particle").count(),0);
  await page.screenshot({path:`output/playwright/reduced-feedback-${starter}.png`});await page.locator('[data-action="pause"]').click();
  const opacity=await number.evaluate(n=>getComputedStyle(n).opacity);await page.waitForTimeout(250);assert.equal(await number.evaluate(n=>getComputedStyle(n).opacity),opacity);
  await page.getByRole("button",{name:"Resume",exact:true}).click();await page.waitForFunction(n=>!n.isConnected,node);await page.locator('[data-action="pause"]').click();await page.locator('[data-action="retire"]').click();await page.locator('[data-action="confirm-retire"]').click();assert.equal(await page.locator(".vfx,.damage-number").count(),0);
  checks.push({starter,stationaryReadableForMs:370,pauseAndCleanup:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile("output/playwright/reduced-feedback-results.json",JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
