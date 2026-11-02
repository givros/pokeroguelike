import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import * as E from "../engine.js";
import { simulate } from "./simulate.mjs";

const out = "output/playwright";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], checks = [];
const saved = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("pokeRogueAdventureV3")));
async function fixture(run, meta = E.baseMeta(), width = 1440, height = 900) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript((data) => {
    if (!localStorage.getItem("pokeRogueAdventureV3"))
      localStorage.setItem("pokeRogueAdventureV3", JSON.stringify(data));
  }, { version: 3, meta, run });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto("http://127.0.0.1:5173");
  await page.locator(".game-screen").waitFor();
  if (run && !["complete", "defeat", "retired"].includes(run.phase))
    await page.locator('[data-action="resume"]').click();
  return { page, context };
}
async function click(page, action, value) {
  await page.locator(`[data-action="${action}"]${value ? `[data-value="${value}"]` : ""}`).first().click();
}
const checkpoint = (stageIndex, phase) => simulate(2026, 4, {
  stopAt: (r) => r.stageIndex === stageIndex && r.phase === phase,
}).run;
try {
  let { page, context } = await fixture(checkpoint(4, "camp"));
  assert.equal((await saved(page)).run.hero.level, 7);
  await page.screenshot({ path: `${out}/expansion-camp.png` });
  await click(page, "encounter", "train");
  assert.equal((await saved(page)).run.hero.id, 5);
  assert.equal((await saved(page)).run.hero.level, 8);
  await click(page, "pause");
  await click(page, "partner");
  assert.equal(await page.locator(".partner-move").count(), (await saved(page)).run.hero.moves.length);
  await page.screenshot({ path: `${out}/expansion-partner.png` });
  const frozen = await saved(page);
  await page.waitForTimeout(500);
  assert.deepEqual(await saved(page), frozen);
  checks.push("Camp training evolves the actual level-seven partner and the move inspector pauses travel");
  await context.close();

  ({ page, context } = await fixture(checkpoint(4, "camp")));
  await click(page, "encounter", "train");
  await page.locator(".evolving").waitFor();
  assert.ok((await page.locator("#map-actor .body-art").getAttribute("src")).endsWith("/4.png"));
  const growthState = (await saved(page)).run;
  assert.equal(growthState.hero.id, 5);
  assert.deepEqual(growthState.pendingGrowth, { fromId: 4, toId: 5 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/expansion-evolution-glow.png` });
  await click(page, "pause");
  await page.reload();
  await click(page, "resume");
  await page.waitForFunction(() => {
    const r = JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run;
    return !r.pendingGrowth && r.travelProgress > 0;
  }, {}, { timeout: 10000 });
  await click(page, "pause");
  const grown = (await saved(page)).run;
  assert.equal(grown.hero.id, 5);
  assert.equal(grown.hero.maxHp, growthState.hero.maxHp);
  assert.equal(grown.wins, growthState.wins);
  assert.equal(grown.coins, growthState.coins);
  assert.equal(await page.locator(".evolving,.evolution-caption").count(), 0);
  checks.push("Evolution uses official before/after artwork, resumes its scene beat after reload, and never grants stats twice");
  await context.close();

  ({ page, context } = await fixture(checkpoint(13, "camp"), E.baseMeta(), 1280, 720));
  await click(page, "encounter", "scout");
  await click(page, "pause");
  const scouted = (await saved(page)).run.scouting;
  assert.equal(scouted.stageIndex, 14);
  await page.screenshot({ path: `${out}/expansion-scout-map.png` });
  await page.reload();
  await click(page, "resume");
  await click(page, "speed", "750");
  await page.waitForFunction(() => document.querySelector(".game-screen")?.dataset.phase === "battle");
  await click(page, "pause");
  assert.equal((await saved(page)).run.enemy.id, scouted.speciesId);
  assert.ok((await page.locator("#battle-camera").evaluate((n) => getComputedStyle(n).backgroundImage)).includes("ancient-shrine-arena.webp"));
  await click(page, "close");
  await page.screenshot({ path: `${out}/expansion-sanctuary-battle.png` });
  checks.push("Scouting survives reload and reveals the actual guardian in the sanctuary arena");
  await context.close();

  ({ page, context } = await fixture(checkpoint(6, "battle")));
  await click(page, "pause");
  assert.ok((await page.locator("#battle-camera").evaluate((n) => getComputedStyle(n).backgroundImage)).includes("mist-lake-arena.webp"));
  await click(page, "close");
  await page.screenshot({ path: `${out}/expansion-lake-battle.png` });
  await context.close();
  ({ page, context } = await fixture(checkpoint(7, "shop")));
  assert.ok((await page.locator(".map-foundation").getAttribute("src")).includes("lake-trail-base"));
  assert.equal(await page.locator('.map-prop[src*="silver-willow"]').count(), 3);
  await page.screenshot({ path: `${out}/expansion-lake-map.png` });
  await click(page, "pause");
  await click(page, "guide");
  assert.ok(await page.locator(".guide-entry").count() >= 6);
  await page.screenshot({ path: `${out}/expansion-guide.png` });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").count(), 0);
  assert.equal((await saved(page)).run.phase, "shop");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), "pause");
  checks.push("Lake art and layered willow props load, live discoveries appear, and Escape restores the encounter");
  await context.close();

  const completed = simulate(2026, 4).run;
  const meta = E.baseMeta();
  E.settle(completed, meta);
  ({ page, context } = await fixture(completed, meta));
  await click(page, "finish");
  await click(page, "guide");
  assert.equal(await page.locator(".expedition-history > section").count(), 1);
  await page.screenshot({ path: `${out}/expansion-history.png` });
  await page.locator("dialog").evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const closeBounds = await page.locator('[data-action="close"]').boundingBox();
  assert.ok(closeBounds.y >= 0 && closeBounds.y + closeBounds.height < 900);
  await page.screenshot({ path: `${out}/expansion-history-bottom.png` });
  await click(page, "close");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), "guide");
  await click(page, "guide");
  const before = (await saved(page)).meta;
  await page.reload();
  await click(page, "guide");
  assert.deepEqual((await saved(page)).meta, before);
  assert.equal(await page.locator(".expedition-history > section").count(), 1);
  checks.push("Completed discoveries and expedition history survive returning to camp and reloading exactly once");
  await context.close();
  for (const [starter, stageIndex, effect] of [
    [25, 0, "electric-burst"], [4, 6, "stone-impact"], [133, 14, "spectral-pulse"],
  ]) {
    const battle = simulate(2026, starter, { stopAt: (r) => r.stageIndex === stageIndex && r.phase === "battle" }).run;
    assert.equal(battle.phase, "battle");
    ({ page, context } = await fixture(battle));
    const sprite = page.locator(`.effect-sprite[data-effect="${effect}"]`);
    await sprite.waitFor({ timeout: 15000 });
    await page.waitForFunction((id) => {
      const node = document.querySelector(`.effect-sprite[data-effect="${id}"]`);
      return node && getComputedStyle(node).backgroundPosition === "100% 0%";
    }, effect, { timeout: 10000 });
    await page.screenshot({ path: `${out}/expansion-${effect}.png` });
    await click(page, "pause");
    await sprite.evaluate((node) => Promise.all(node.getAnimations().map((a) => a.ready)));
    const frame = await sprite.evaluate((n) => getComputedStyle(n).backgroundPosition);
    const state = await saved(page);
    await page.waitForTimeout(350);
    assert.equal(await sprite.evaluate((n) => getComputedStyle(n).backgroundPosition), frame);
    assert.deepEqual(await saved(page), state);
    await click(page, "close");
    await page.waitForTimeout(700);
    assert.equal(await sprite.count(), 0);
    checks.push(`${effect}: actual automatic attack shows the generated sprite sequence, pauses and cleans up`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/expansion-results.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
