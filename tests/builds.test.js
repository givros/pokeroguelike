import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../engine.js";
import { SYNERGIES, activeSynergies, awakenedBy } from "../builds.js";
import { validRun, readState, writeState } from "../storage.js";
const catalogue = {
  pokemon: JSON.parse(readFileSync("data/pokemon.json")),
  moves: JSON.parse(readFileSync("data/moves.json")),
};
function battle() {
  const run = E.createRun(7, E.baseMeta(), catalogue, 2026);
  E.selectBonus(run, run.offers[0]);
  run.bonuses = [];
  run.travelProgress = 1;
  E.arrive(run, catalogue);
  E.activateStage(run, catalogue);
  return run;
}
test("build recipes require their exact ranks and expose the next awakening", () => {
  const run = battle();
  for (const recipe of SYNERGIES) {
    run.bonuses = Object.entries(recipe.requires).flatMap(([id, n]) => Array(n).fill(id));
    assert.deepEqual(activeSynergies(run).map((s) => s.id), [recipe.id]);
    const last = run.bonuses.pop();
    assert.deepEqual(activeSynergies(run), []);
    assert.deepEqual(awakenedBy(run, last).map((s) => s.id), [recipe.id]);
  }
});
test("Flurry adds real damage without consuming a second PP or action", () => {
  const run = battle();
  run.bonuses = ["attack_boost", "attack_boost", "crit_chance"];
  const move = E.bestMove(run, catalogue);
  const slot = run.hero.moves.find((m) => m.id === move.id), pp = slot.pp;
  const before = run.enemy.hp;
  const result = E.battleStep(run, catalogue);
  assert.ok(result.echoDamage > 0);
  assert.equal(result.damage, before - run.enemy.hp);
  assert.equal(run.stats.damage, result.damage);
  assert.equal(slot.pp, pp - 1);
  assert.equal(run.battleActions, 1);
  assert.equal(run.nextSide, "enemy");
});
test("a lethal primary hit does not echo into a defeated foe or award twice", () => {
  const run = battle();
  run.bonuses = ["attack_boost", "attack_boost", "crit_chance"];
  run.enemy.hp = 1;
  const hit = E.battleStep(run, catalogue);
  assert.equal(hit.echoDamage, 0);
  assert.equal(hit.damage, 1);
  const won = structuredClone(run);
  assert.equal(E.battleStep(run, catalogue), null);
  assert.deepEqual(run, won);
});
test("Briar Bulwark ripostes once when Opening Guard absorbs the first hit", () => {
  const run = battle();
  run.bonuses = ["defense_boost", "defense_boost", "first_guard"];
  run.nextSide = "enemy";
  const before = run.enemy.hp;
  const hit = E.battleStep(run, catalogue);
  assert.equal(hit.reflectDamage, Math.ceil(run.enemy.maxHp * 0.2));
  assert.equal(run.enemy.hp, before - hit.reflectDamage);
  assert.equal(run.stats.reflected, hit.reflectDamage);
  assert.equal(run.stats.damage, hit.reflectDamage);
  E.battleStep(run, catalogue);
  assert.equal(E.battleStep(run, catalogue).reflectDamage, 0);
});
test("a simultaneous riposte knockout retains the existing defeat priority", () => {
  const run = battle();
  run.bonuses = ["defense_boost", "defense_boost", "first_guard"];
  run.nextSide = "enemy";
  run.hero.hp = 1;
  run.enemy.hp = 1;
  E.battleStep(run, catalogue);
  assert.equal(run.hero.hp, 0);
  assert.equal(run.enemy.hp, 0);
  assert.equal(run.phase, "defeat");
  assert.equal(run.wins, 0);
});
test("Lifebloom turns only excess lifesteal into a capped damage-absorbing barrier", () => {
  const run = battle();
  run.bonuses = ["regeneration", "lifesteal", "lifesteal"];
  const cap = Math.ceil(run.hero.maxHp * 0.2);
  run.hero.shield = cap - 1;
  const result = E.battleStep(run, catalogue);
  assert.equal(result.healing, 0);
  assert.equal(result.shielding, 1);
  assert.equal(run.hero.shield, cap);
  const hp = run.hero.hp;
  const incoming = E.battleStep(run, catalogue);
  assert.ok(incoming.absorbed > 0);
  assert.equal(run.hero.hp, hp - incoming.damage);
  assert.equal(run.hero.shield, cap - incoming.absorbed);
  assert.equal(run.stats.absorbed, incoming.absorbed);
  assert.ok(validRun(run, catalogue));
});
test("wounded partners heal before gaining a barrier and winning clears the barrier", () => {
  const run = battle();
  run.bonuses = ["regeneration", "lifesteal"];
  run.hero.hp = 10;
  const hit = E.battleStep(run, catalogue);
  assert.ok(hit.healing > 0);
  assert.equal(hit.shielding, 0);
  run.nextSide = "ally";
  run.hero.shield = 5;
  run.enemy.hp = 1;
  E.battleStep(run, catalogue);
  assert.equal(run.phase, "victoryBeat");
  assert.equal(run.hero.shield, 0);
});
test("reward and shop awakenings are atomic and are not replayed by extra ranks", () => {
  const run = battle();
  run.phase = "reward";
  run.bonuses = ["attack_boost", "attack_boost"];
  run.offers = ["crit_chance"];
  assert.ok(E.selectBonus(run, "crit_chance"));
  assert.deepEqual(run.pendingAwakenings, ["flurry"]);
  assert.equal(E.selectBonus(run, "crit_chance"), false);
  run.pendingAwakenings = [];
  run.phase = "reward";
  run.offers = ["crit_chance"];
  E.selectBonus(run, "crit_chance");
  assert.deepEqual(run.pendingAwakenings, []);
  run.phase = "shop";
  run.stageIndex = 7;
  run.coins = 200;
  run.bonuses = ["defense_boost", "first_guard"];
  assert.ok(E.buy(run, "guard"));
  assert.deepEqual(run.pendingAwakenings, ["bulwark"]);
  assert.equal(run.coins, 130);
});
test("new barrier state resumes with identical RNG, HP, PP and next damage", () => {
  const run = battle();
  run.bonuses = ["regeneration", "lifesteal"];
  E.battleStep(run, catalogue);
  const store = new Map();
  const storage = { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value) };
  writeState(storage, E.baseMeta(), run);
  const copy = readState(storage, catalogue).run;
  assert.deepEqual(copy, run);
  assert.deepEqual(E.battleStep(copy, catalogue), E.battleStep(run, catalogue));
  assert.deepEqual(copy, run);
});
test("even all completed builds cannot bypass the finite battle action limit", () => {
  const run = battle();
  run.bonuses = E.BONUSES.flatMap((b) => Array(b.max).fill(b.id));
  run.hero.hp = run.hero.maxHp = 100000;
  run.enemy.hp = run.enemy.maxHp = 100000;
  for (let i = 0; i < 100 && run.phase === "battle"; i++) E.battleStep(run, catalogue);
  assert.equal(run.phase, "defeat");
  assert.equal(run.battleActions, 80);
});

test("reforges cost expedition gold, guarantee a changed offer and stop after three", () => {
  const run = battle(); run.phase = "reward"; run.offers = E.offerBonuses(run); run.coins = 200;
  for (const cost of [20, 35, 50]) {
    const old = [...run.offers], gold = run.coins, actions = run.battleActions;
    assert.equal(E.rerollCost(run), cost);
    assert.equal(E.rerollBonuses(run), true);
    assert.ok(run.offers.some((id) => !old.includes(id)));
    assert.equal(new Set(run.offers).size, run.offers.length);
    assert.equal(run.coins, gold - cost);
    assert.equal(run.battleActions, actions);
  }
  const before = JSON.stringify(run);
  assert.equal(E.rerollBonuses(run), false);
  assert.equal(JSON.stringify(run), before);
});
test("unavailable reforges are atomic, and saved RNG reproduces offers", () => {
  const run = battle(); run.coins = 100;
  const before = JSON.stringify(run);
  assert.equal(E.rerollBonuses(run), false);
  assert.equal(JSON.stringify(run), before);
  run.phase = "shrine"; run.stageIndex = 9; run.offers = E.offerBonuses(run); run.coins = 0;
  const poor = JSON.stringify(run);
  assert.equal(E.rerollBonuses(run), false);
  assert.equal(JSON.stringify(run), poor);
  run.coins = 100;
  const restored = structuredClone(run);
  E.rerollBonuses(run); E.rerollBonuses(restored);
  assert.deepEqual(restored, run);
  assert.equal(validRun(run, catalogue), true);
});
