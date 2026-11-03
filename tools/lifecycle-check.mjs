import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import * as E from "../engine.js";
const catalogue = {
  pokemon: JSON.parse(await readFile("data/pokemon.json", "utf8")),
  moves: JSON.parse(await readFile("data/moves.json", "utf8")),
};
const browser = await chromium.launch({ headless: true });
const checks = [],
  errors = [];
function currentBattle() {
  const r = E.createRun(4, E.baseMeta(), catalogue, 2026);
  r.starterId = 4;
  E.selectBonus(r, r.offers[0]);
  r.travelProgress = 1;
  E.arrive(r, catalogue);
  E.activateStage(r, catalogue);
  return r;
}
async function fixture(run, meta = E.baseMeta(), options = {}) {
  const c = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: "no-preference",
  });
  await c.addInitScript(
    (s) => localStorage.setItem("pokeRogueAdventureV3", JSON.stringify(s)),
    { version: 3, meta, run },
  );
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:5173");
  await p.locator(".game-screen").waitFor();
  if (run && !["complete", "defeat", "retired"].includes(run.phase))
    await p.locator('[data-action="resume"]').click();
  return { p, c };
}
const state = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("pokeRogueAdventureV3")));
try {
  let { p, c } = await fixture(null, { ...E.baseMeta(), gold: 1000 });
  await p.locator('[data-action="upgrades"]').click();
  await p.locator('[data-action="upgrade"][data-value="maxHpBonus"]').click();
  await p.locator('[data-action="close"]').first().click();
  assert.equal(await p.locator(".title-gold b").textContent(), "900");
  await p.locator('[data-action="starter"][data-value="4"]').click();
  assert.equal(
    (await state(p)).run.hero.maxHp,
    E.createRun(4, (await state(p)).meta, catalogue).hero.maxHp,
  );
  checks.push(
    "Upgrade cost, title currency and next expedition HP remain synchronized",
  );
  await c.close();
  ({ p, c } = await fixture(currentBattle()));
  await p.locator(".projectile").first().waitFor({ timeout: 10000 });
  await p.locator('[data-action="pause"]').click();
  const frozen = (await state(p)).run;
  await p.waitForTimeout(700);
  assert.deepEqual((await state(p)).run, frozen);
  await p.locator('[data-action="retire"]').click();
  await p.locator('[data-action="confirm-retire"]').click();
  assert.equal((await state(p)).run.phase, "retired");
  assert.equal(await p.locator(".vfx,.damage-number").count(), 0);
  await p.locator('[data-action="retry"]').click();
  const fresh = (await state(p)).run;
  await p.locator('[data-action="bonus"]').first().click();
  await p.waitForFunction(() => {
    const run = JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run;
    return run.phase === "travel" && !run.regionEntry && run.travelProgress > 0;
  }, {}, { timeout: 8000 });
  const after = (await state(p)).run;
  assert.equal(after.phase, "travel");
  assert.equal(after.actions, 0);
  assert.equal(after.hero.hp, after.hero.maxHp);
  assert.ok(after.travelProgress > 0);
  checks.push(
    "Retiring during an in-flight attack cancels VFX and cannot damage the next expedition",
  );
  await c.close();
  ({ p, c } = await fixture(currentBattle()));
  await p.waitForFunction(()=>{const n=document.querySelector(".actor-ally .body-art"),a=n?.getAnimations()[0],progress=a?.effect.getComputedTiming().progress;if(progress>.02&&progress<.25&&!document.querySelector(".projectile")){document.querySelector('[data-action="pause"]').click();return true;}return false;});
  assert.equal((await state(p)).run.actions,0);
  await p.locator('[data-action="retire"]').click();await p.locator('[data-action="confirm-retire"]').click();
  await p.locator('[data-action="retry"]').click();await p.locator('[data-action="bonus"]').first().click();
  await p.waitForFunction(()=>{const r=JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run;return r.phase==="travel"&&!r.regionEntry&&r.travelProgress>0;});
  assert.equal((await state(p)).run.actions,0);assert.equal((await state(p)).run.hero.hp,(await state(p)).run.hero.maxHp);
  assert.equal(await p.locator(".vfx,.damage-number").count(),0);
  checks.push("Retiring before projectile launch stops the cancelled preparation and preserves the fresh expedition");await c.close();
  const dead = currentBattle();
  dead.hero.hp = 1;
  dead.nextSide = "enemy";
  ({ p, c } = await fixture(dead));
  await p.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.settled ===
      true,
    {},
    { timeout: 10000 },
  );
  assert.equal((await state(p)).run.phase, "defeat");
  await p.screenshot({ path: "output/playwright/final-defeat-1280.png" });
  const ended = await state(p);
  await p.waitForTimeout(1300);
  assert.deepEqual(await state(p), ended);
  assert.equal(await p.locator(".vfx,.damage-number").count(), 0);
  checks.push(
    "Actual automatic defeat settles once and stops pending combat work",
  );
  await c.close();
  const closed = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  await closed.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    }),
  );
  p = await closed.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:5173");
  await p.locator('[data-action="starter"]').first().waitFor();
  assert.ok(await p.locator(".save-warning").isVisible());
  await p.locator('[data-action="starter"]').first().click();
  await p.locator('[data-action="bonus"]').first().click();
  await p.waitForFunction(
    () => document.querySelector(".game-screen")?.dataset.phase === "travel",
  );
  checks.push("Blocked browser storage warns clearly and still allows play");
  await closed.close();
  const broken = await browser.newContext();
  let attempts = 0;
  await broken.route("**/assets/generated/gold-coins.webp", (route) => {
    attempts++;
    return route.fulfill({ status: 404, body: "missing" });
  });
  p = await broken.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:5173");
  await p.locator('[data-action="reload"]').waitFor();
  await p.waitForTimeout(1200);
  assert.equal(attempts, 1);
  assert.ok(
    (await p.locator(".loading-screen").textContent()).includes("resources"),
  );
  checks.push(
    "A missing art asset produces one recoverable error and no infinite retry loop",
  );
  await broken.close();
  const evolving = E.createRun(133, E.baseMeta(), catalogue, 2026);
  evolving.starterId = 133;
  evolving.hero.level = 7;
  evolving.pendingEvolution = true;
  evolving.pendingReward = true;
  evolving.phase = "travel";
  evolving.travelProgress = 1;
  E.arrive(evolving, catalogue);
  ({ p, c } = await fixture(evolving));
  await p.screenshot({ path: "output/playwright/final-eevee-evolution.png" });
  await p.locator('[data-action="evolve"][data-value="135"]').click();
  assert.equal((await state(p)).run.hero.id, 135);
  assert.equal((await state(p)).run.phase, "reward");
  checks.push(
    "Eevee selects its official evolved form on the map without losing its reward",
  );
  await c.close();
  const moving = E.createRun(4, E.baseMeta(), catalogue, 2026);
  moving.starterId = 4;
  E.selectBonus(moving, moving.offers[0]);
  moving.travelProgress = 0.1;
  moving.regionEntry = null;
  ({ p, c } = await fixture(moving));
  await p.locator('[data-action="pause"]').click();
  const origin = (await state(p)).run.travelProgress;
  await p.locator('[data-action="close"]').first().click();
  await p.waitForTimeout(350);
  await p.locator('[data-action="pause"]').click();
  const normal = (await state(p)).run.travelProgress - origin;
  await p.locator('[data-action="close"]').first().click();
  await p.locator('[data-action="speed"][data-value="750"]').click();
  await p.locator('[data-action="pause"]').click();
  const fastOrigin = (await state(p)).run.travelProgress;
  await p.locator('[data-action="close"]').first().click();
  await p.waitForTimeout(350);
  await p.locator('[data-action="pause"]').click();
  const fast = (await state(p)).run.travelProgress - fastOrigin;
  assert.ok(fast > normal * 1.45, JSON.stringify({ normal, fast }));
  checks.push(
    "Changing travel speed accelerates the current route rather than only the next stage",
  );
  await c.close();
  assert.deepEqual(errors, []);
  await writeFile(
    "output/playwright/lifecycle-results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
