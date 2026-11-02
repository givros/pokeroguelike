import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import * as E from "../engine.js";
import { simulate } from "./simulate.mjs";
const browser = await chromium.launch({ headless:true });
const errors = [], checks = [];
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem("pokeRogueAdventureV3")));
async function fixture(run) {
  const context = await browser.newContext({viewport:{width:1280,height:720}});
  await context.addInitScript(data => {
    if (!localStorage.getItem("pokeRogueAdventureV3")) localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));
  },{version:3,meta:E.baseMeta(),run});
  const page = await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:5173");
  await page.locator('[data-action="resume"]').click();
  return {page,context};
}
try {
  const reward = simulate(2026,4,{stopAt:r=>r.stageIndex===1&&r.phase==="reward"}).run;
  reward.bonuses=["attack_boost","attack_boost"]; reward.offers=["crit_chance","defense_boost","regeneration"]; reward.coins=100;
  let {page,context}=await fixture(reward);
  await page.locator('[data-action="reroll"]').click();
  const reforged=(await saved(page)).run;
  assert.equal(reforged.coins,80); assert.equal(reforged.rerolls,1);
  assert.ok(reforged.offers.some(id=>!reward.offers.includes(id)));
  await page.reload(); await page.locator('[data-action="resume"]').click();
  assert.deepEqual((await saved(page)).run.offers,reforged.offers);
  assert.match(await page.locator('[data-action="reroll"]').textContent(),/35 gold/);
  checks.push("Reforge spends the displayed cost, changes rewards and preserves offers and next price on reload");
  await context.close();
  ({page,context}=await fixture(reward));
  await page.locator('[data-action="bonus"][data-value="crit_chance"]').click();
  await page.locator('.awakening-toast').waitFor();
  const awakened=(await saved(page)).run;
  assert.deepEqual(awakened.pendingAwakenings,["flurry"]);
  await page.locator('[data-action="pause"]').click();
  const frozen=await saved(page); await page.waitForTimeout(500);
  assert.deepEqual(await saved(page),frozen);
  await page.reload(); await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(()=>!JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.pendingAwakenings.length);
  await page.locator('[data-action="pause"]').click();
  const resumed=(await saved(page)).run;
  assert.equal(resumed.bonuses.filter(id=>id==="crit_chance").length,1);
  assert.equal(resumed.coins,awakened.coins);
  checks.push("Generated relic awakening pauses and resumes after reload without granting duplicate ranks or gold");
  await context.close();
  assert.deepEqual(errors,[]);
  await mkdir("output/playwright",{recursive:true});
  await writeFile("output/playwright/build-results.json",JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} finally { await browser.close(); }
