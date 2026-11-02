import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const OUT = "output/playwright";
const starterId =
  Number(process.argv.find((v) => v.startsWith("--starter="))?.split("=")[1]) ||
  4;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
});
const errors = [],
  failed = [],
  checks = [],
  visited = new Set();
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(r.url() + ": " + r.status());
});
await page.addInitScript((starter) => {
  Date.now = () => 2026;
  if ([25, 133, 152].includes(starter))
    localStorage.setItem(
      "pokeBattleProgress",
      JSON.stringify({
        totalVictories: starter === 25 ? 10 : starter === 133 ? 25 : 50,
      }),
    );
}, starterId);
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("pokeRogueAdventureV3")));
const click = async (action, value) => {
  const loc = page
    .locator(
      `[data-action="${action}"]${value !== undefined ? `[data-value="${value}"]` : ""}`,
    )
    .first();
  await loc.click({ timeout: 10000 });
};
const preference = [
  "regeneration",
  "lifesteal",
  "attack_boost",
  "defense_boost",
  "hp_boost",
  "first_guard",
  "crit_chance",
  "type_boost",
  "momentum",
  "focus_crit",
  "pp_boost",
  "gold_boost",
];
try {
  await page.goto("http://127.0.0.1:5173");
  await page.locator('[data-action="starter"]').first().waitFor();
  await page.screenshot({ path: OUT + "/final-title.png" });
  await click("help");
  assert.ok(await page.locator("dialog").isVisible());
  await click("close");
  await click("starter", starterId);
  let state = await saved();
  assert.equal(state.run.phase, "starter");
  await page.screenshot({ path: OUT + "/final-initial-bonus.png" });
  await click("speed", 750);
  await click(
    "bonus",
    preference.find((id) => state.run.offers.includes(id)),
  );
  await page.waitForFunction(() => {
    const r = JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run;
    return r.phase === "travel" && r.travelProgress > 0.2;
  });
  const p1 = await page.locator("#map-actor").getAttribute("data-x");
  await page.waitForTimeout(350);
  const p2 = await page.locator("#map-actor").getAttribute("data-x");
  assert.ok(Number(p2) > Number(p1));
  checks.push("Automatic actor displacement follows map coordinates");
  await click("pause");
  const frozen = await saved();
  const before = await page.locator("#map-actor").getAttribute("data-x");
  await page.waitForTimeout(650);
  assert.equal(await page.locator("#map-actor").getAttribute("data-x"), before);
  assert.deepEqual((await saved()).run, frozen.run);
  checks.push("Pause freezes travel and its save checkpoint");
  await page.reload();
  await page.locator('[data-action="resume"]').waitFor();
  assert.deepEqual((await saved()).run, frozen.run);
  await click("resume");
  checks.push("A partially travelled route resumes without resetting progress");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.phase ===
      "battle",
  );
  await page.screenshot({ path: OUT + "/final-battle.png" });
  await page.locator(".impact").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: OUT + "/final-impact.png" });
  checks.push(
    "Generated projectile, impact and particle art appears during real auto combat",
  );
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.actions > 0,
  );
  await click("pause");
  const battlePaused = (await saved()).run;
  await page.waitForTimeout(700);
  assert.equal((await saved()).run.actions, battlePaused.actions);
  assert.equal((await saved()).run.hero.hp, battlePaused.hero.hp);
  await page.screenshot({ path: OUT + "/final-pause.png" });
  await click("close");
  checks.push("Pause freezes combat actions and HP during an attack");
  const deadline = Date.now() + 240000;
  let lastStage = -1;
  let sawAutoDeparture = false,
    sawMapReward = false;
  let snapshots = new Set();
  while (Date.now() < deadline) {
    state = await saved();
    const r = state.run;
    visited.add(r.phase);
    if (r.stageIndex !== lastStage) {
      lastStage = r.stageIndex;
      console.log(`Stage ${r.stageIndex + 1}/15`);
    }
    assert.ok(r.stageIndex >= 0 && r.stageIndex < 15);
    assert.ok(r.battleActions <= 80);
    if (r.phase === "travel" && r.wins > 0) {
      sawAutoDeparture = true;
      if (!snapshots.has("travel")) {
        await page.screenshot({ path: OUT + "/final-after-battle-travel.png" });
        snapshots.add("travel");
      }
    }
    if (["complete", "defeat", "retired"].includes(r.phase)) break;
    if (r.phase === "evolution") {
      await page.screenshot({ path: OUT + "/final-eevee-evolution.png" });
      await click("evolve", 134);
    } else if (["reward", "shrine"].includes(r.phase)) {
      if (r.phase === "reward") {
        sawMapReward = true;
        if (!snapshots.has("reward")) {
          await page.screenshot({ path: OUT + "/final-map-reward.png" });
          snapshots.add("reward");
        }
      } else if (!snapshots.has("shrine")) {
        await page.screenshot({ path: OUT + "/final-shrine.png" });
        snapshots.add("shrine");
      }
      const chosen = preference.find((id) => r.offers.includes(id));
      if (chosen) await click("bonus", chosen);
      else await click("encounter", "leave");
    } else if (r.phase === "camp") {
      if (!snapshots.has("camp")) {
        await page.screenshot({ path: OUT + "/final-camp.png" });
        snapshots.add("camp");
      }
      await click("encounter", "rest");
    } else if (r.phase === "cache") {
      if (!snapshots.has("cache")) {
        await page.screenshot({ path: OUT + "/final-cache.png" });
        snapshots.add("cache");
      }
      await click(
        "encounter",
        r.hero.hp < r.hero.maxHp * 0.7 ? "heal" : "gold",
      );
    } else if (r.phase === "shop") {
      await page.screenshot({ path: OUT + "/final-shop.png" });
      if (r.hero.hp < r.hero.maxHp * 0.9 && r.coins >= 85)
        await click("buy", "full_heal");
      state = await saved();
      if (
        state.run.coins >= 70 &&
        state.run.bonuses.filter((x) => x === "defense_boost").length < 3
      )
        await click("buy", "guard");
      await click("leave");
    } else await page.waitForTimeout(110);
  }
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.settled ===
      true,
  );
  await page.locator('[data-action="finish"]').waitFor();
  state = await saved();
  assert.equal(
    state.run.phase,
    "complete",
    JSON.stringify({
      phase: state.run.phase,
      stage: state.run.stageIndex,
      log: state.run.log.slice(-6),
    }),
  );
  assert.ok(sawAutoDeparture && sawMapReward);
  if (starterId === 133) {
    assert.ok(visited.has("evolution"));
    checks.push(
      "Eevee evolves through an actual campaign choice before continuing its automatic journey",
    );
  }
  assert.equal(state.run.stageIndex, 14);
  assert.equal(state.run.wins, 9);
  assert.ok(
    visited.has("camp") &&
      visited.has("shop") &&
      visited.has("cache") &&
      visited.has("shrine"),
  );
  checks.push(
    "Full 15-stage journey completes via automatic combat, travel, rewards, camp, shop, caches, shrine and bosses",
  );
  await page.screenshot({ path: OUT + "/final-complete.png" });
  const completed = structuredClone(state);
  await page.waitForTimeout(1600);
  assert.deepEqual(await saved(), completed);
  assert.equal(await page.locator(".vfx,.damage-number").count(), 0);
  checks.push(
    "Final stage stops all automatic progression and releases VFX nodes",
  );
  await page.reload();
  await page.locator('[data-action="finish"]').waitFor();
  assert.deepEqual((await saved()).meta, completed.meta);
  checks.push("Reloading the ending cannot award gold or victories twice");
  await click("finish");
  await click("upgrades");
  state = await saved();
  const oldGold = state.meta.gold;
  await click("upgrade", "maxHpBonus");
  assert.equal((await saved()).meta.permanentUpgrades.maxHpBonus, 1);
  assert.equal((await saved()).meta.gold, oldGold - 100);
  await click("close");
  checks.push("Permanent upgrade purchase uses the displayed price");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: OUT + "/final-title-1280.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  checks.push(
    "Desktop composition checked at 1440x900 and 1280x720 with no page errors or missing resources",
  );
  await writeFile(
    OUT + "/adventure-results.json",
    JSON.stringify(
      {
        checks,
        visited: [...visited],
        errors,
        failed,
        starter: starterId,
        actions: completed.run.actions,
        stages: 15,
        wins: 9,
        gold: completed.meta.gold,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ checks, actions: completed.run.actions }, null, 2),
  );
} finally {
  await browser.close();
}
