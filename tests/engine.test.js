import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import * as E from "../engine.js";
import {
  readState,
  writeState,
  validRun,
  normalizeMeta,
  SAVE_KEY,
} from "../storage.js";
import { simulate } from "../tools/simulate.mjs";
import { discoveryRecords } from "../field-guide.js";
import { impactSequence } from "../presentation.js";
const catalogue = {
  pokemon: JSON.parse(readFileSync("data/pokemon.json")),
  moves: JSON.parse(readFileSync("data/moves.json")),
};
const world = JSON.parse(readFileSync("data/world-map.json"));
const initial = (id = 7, seed = 2026) =>
  E.createRun(id, E.baseMeta(), catalogue, seed);
function battle(id = 7) {
  const r = initial(id);
  E.selectBonus(r, r.offers[0]);
  r.travelProgress = 1;
  E.arrive(r, catalogue);
  E.activateStage(r, catalogue);
  return r;
}
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) || null, setItem: (k, v) => m.set(k, v) };
};
test("the same seed produces the same automatic campaign", () => {
  assert.deepEqual(simulate(2026, 4), simulate(2026, 4));
});
test("every starter can complete a finite campaign without permanent upgrades", () => {
  for (const id of [1, 4, 7, 25, 133, 152]) {
    const result = simulate(2026, id);
    assert.equal(result.phase, "complete");
    assert.equal(result.stage, 15);
    assert.ok(result.actions < 9 * 81);
  }
});
test("1200 seeded expeditions all terminate with no unhandled state", () => {
  let complete = 0;
  for (const id of [1, 4, 7, 25, 133, 152])
    for (let i = 0; i < 200; i++) {
      const r = simulate(i * 9001 + 2026, id);
      assert.ok(["complete", "defeat"].includes(r.phase));
      assert.ok(r.transitions < 3000);
      assert.ok(r.actions <= 9 * 81);
      if (r.phase === "complete") complete++;
    }
  assert.ok(complete > 100);
});
test("type effectiveness handles double weakness, resistance and immunity", () => {
  assert.equal(E.effectiveness("fire", ["grass", "bug"]), 4);
  assert.equal(E.effectiveness("grass", ["fire", "flying"]), 0.25);
  assert.equal(E.effectiveness("electric", ["ground"]), 0);
  assert.equal(E.effectiveness("neutral", ["ghost"]), 1);
});
test("moves come from each real species learnset and have finite PP", () => {
  for (const s of Object.values(catalogue.pokemon)) {
    const f = E.fighter(s.id, 10, catalogue);
    assert.ok(f.moves.length > 0 && f.moves.length <= 4);
    for (const slot of f.moves) {
      assert.ok(slot.id === 0 || s.learnset.includes(slot.id));
      assert.equal(slot.pp, slot.maxPp);
      assert.ok(slot.pp > 0);
    }
  }
});
test("unusable PP falls back to Struggle and makes progress", () => {
  const r = battle();
  r.hero.moves.forEach((m) => (m.pp = 0));
  assert.equal(E.bestMove(r, catalogue).id, 0);
  const hp = r.enemy.hp;
  E.battleStep(r, catalogue);
  assert.ok(r.enemy.hp < hp);
});
test("an entirely immune move set also falls back to typeless Struggle", () => {
  const r = battle();
  r.enemy = E.fighter(92, 5, catalogue);
  r.hero.moves = [{ id: 33, pp: 20, maxPp: 35 }];
  assert.equal(E.bestMove(r, catalogue).id, 0);
  const hp = r.enemy.hp;
  E.battleStep(r, catalogue);
  assert.ok(r.enemy.hp < hp);
});
test("a battle hard limit ends even deliberately impossible HP fixtures", () => {
  const r = battle();
  r.hero.hp = r.hero.maxHp = 1e6;
  r.enemy.hp = r.enemy.maxHp = 1e6;
  for (let i = 0; i < 100; i++) {
    E.battleStep(r, catalogue);
    if (r.phase !== "battle") break;
  }
  assert.equal(r.phase, "defeat");
  assert.equal(r.battleActions, 80);
});
test("victory rewards cannot be applied twice", () => {
  const r = battle();
  r.enemy.hp = 1;
  E.battleStep(r, catalogue);
  assert.equal(r.phase, "victoryBeat");
  const before = structuredClone(r);
  assert.equal(E.battleStep(r, catalogue), null);
  assert.deepEqual(r, before);
});
test("departing a completed encounter is atomic", () => {
  const r = battle();
  r.enemy.hp = 1;
  E.battleStep(r, catalogue);
  assert.ok(E.depart(r));
  assert.equal(r.stageIndex, 1);
  assert.equal(r.phase, "travel");
  assert.equal(r.travelProgress, 0);
  assert.equal(E.depart(r), false);
  assert.equal(r.stageIndex, 1);
});
test("travel has a real destination trigger before the next stage activates", () => {
  const r = initial();
  E.selectBonus(r, r.offers[0]);
  assert.equal(E.arrive(r, catalogue), false);
  r.travelProgress = 1;
  assert.ok(E.arrive(r, catalogue));
  assert.equal(r.phase, "arrival");
  assert.equal(E.arrive(r, catalogue), false);
});
test("victory starts travel before offering the next bonus at arrival", () => {
  const r = battle();
  r.enemy.hp = 1;
  E.battleStep(r, catalogue);
  E.depart(r);
  assert.equal(r.phase, "travel");
  assert.ok(r.pendingReward);
  r.travelProgress = 1;
  E.arrive(r, catalogue);
  assert.equal(r.phase, "reward");
  assert.equal(r.offers.length, 3);
  assert.ok(E.selectBonus(r, r.offers[0]));
  assert.equal(r.phase, "arrival");
});
test("bonuses require an actual offer and cannot be collected twice", () => {
  const r = initial();
  const offered = r.offers[0];
  assert.equal(E.selectBonus(r, "not-a-bonus"), false);
  assert.ok(E.selectBonus(r, offered));
  assert.equal(E.selectBonus(r, offered), false);
  assert.equal(E.count(r, offered), 1);
});
test("bonus offers never exceed the stack cap", () => {
  const r = initial();
  for (const b of E.BONUSES)
    for (let i = 0; i < b.max; i++) r.bonuses.push(b.id);
  assert.deepEqual(E.offerBonuses(r), []);
  r.phase = "travel";
  r.travelProgress = 1;
  r.pendingReward = true;
  E.arrive(r, catalogue);
  assert.equal(r.phase, "arrival");
});
test("initial choices do not offer an immediate recovery with no benefit", () => {
  for (let i = 1; i <= 100; i++)
    assert.ok(!initial(7, i).offers.includes("pp_boost"));
});
test("permanent attack and defense bonuses are applied to the correct side", () => {
  const r = battle();
  const move = E.bestMove(r, catalogue);
  const before = E.expectedDamage(r, r.hero, r.enemy, move, catalogue, true);
  r.upgrades.attackBonus = 5;
  assert.ok(
    E.expectedDamage(r, r.hero, r.enemy, move, catalogue, true) > before,
  );
  r.enemy = E.fighter(150, 15, catalogue);
  const enemyMove = catalogue.moves[93];
  const hit = E.expectedDamage(r, r.enemy, r.hero, enemyMove, catalogue, false);
  r.upgrades.defenseBonus = 5;
  assert.ok(
    E.expectedDamage(r, r.enemy, r.hero, enemyMove, catalogue, false) < hit,
  );
});
test("first guard applies once per battle", () => {
  const r = battle();
  r.bonuses = ["first_guard"];
  r.nextSide = "enemy";
  E.battleStep(r, catalogue);
  assert.equal(r.hero.guardUsed, true);
  r.hero.hp = r.hero.maxHp;
  r.nextSide = "enemy";
  E.battleStep(r, catalogue);
  assert.equal(r.hero.guardUsed, true);
});
test("lifesteal heals the hero and reports actual healing", () => {
  const r = battle();
  r.bonuses = ["lifesteal"];
  r.hero.hp = 1;
  const result = E.battleStep(r, catalogue);
  assert.ok(result.healing > 0);
  assert.equal(r.hero.hp, 1 + result.healing);
});
test("shop rejects unavailable and unaffordable purchases without mutation", () => {
  const r = battle();
  const before = structuredClone(r);
  assert.equal(E.buy(r, "potion"), false);
  assert.deepEqual(r, before);
  r.phase = "shop";
  r.coins = 0;
  const copy = structuredClone(r);
  assert.equal(E.buy(r, "full_heal"), false);
  assert.deepEqual(r, copy);
});
test("shop healing and PP restoration are bounded by the actual maximum", () => {
  const r = initial();
  r.phase = "shop";
  r.coins = 100;
  r.hero.hp = 1;
  r.hero.moves.forEach((m) => (m.pp = 0));
  assert.ok(E.buy(r, "full_heal"));
  assert.equal(r.hero.hp, r.hero.maxHp);
  assert.equal(r.coins, 15);
  assert.ok(r.hero.moves.every((m) => m.pp === m.maxPp));
});

test("a full recovery cannot consume coins when both HP and PP are full", () => {
  const r = initial();
  r.phase = "shop";
  r.coins = 200;
  const before = structuredClone(r);
  assert.equal(E.needsRecovery(r), false);
  assert.equal(E.buy(r, "full_heal"), false);
  assert.deepEqual(r, before);
  r.hero.moves[0].pp--;
  assert.equal(E.needsRecovery(r), true);
  assert.equal(E.buy(r, "full_heal"), true);
  assert.equal(r.coins, 115);
  assert.equal(E.buy(r, "full_heal"), false);
});

test("camp training resolves evolution and move learning before the next fight", () => {
  const r = initial(4);
  r.phase = "camp";
  r.stageIndex = 4;
  r.hero.level = 7;
  assert.equal(E.resolveEncounter(r, "train", catalogue), true);
  assert.equal(r.hero.level, 8);
  assert.equal(r.hero.id, 5);
  assert.deepEqual(r.pendingGrowth, { fromId: 4, toId: 5 });
  assert.equal(r.phase, "travel");
  assert.equal(r.stageIndex, 5);
  assert.ok(r.hero.moves.every((m) => catalogue.pokemon[5].learnset.includes(m.id)));
  const hp = r.hero.maxHp;
  const logCount = r.log.length;
  E.refreshGrowth(r, catalogue);
  assert.equal(r.hero.maxHp, hp);
  assert.equal(r.log.length, logCount);
  assert.equal(E.resolveEncounter(r, "train", catalogue), false);
  assert.ok(validRun(r, catalogue));
});

test("training Eevee preserves its evolution choice for the next map arrival", () => {
  const r = initial(133);
  r.hero.level = 6;
  r.phase = "camp";
  r.stageIndex = 4;
  E.resolveEncounter(r, "train", catalogue);
  assert.equal(r.pendingEvolution, true);
  r.travelProgress = 1;
  E.arrive(r, catalogue);
  assert.equal(r.phase, "evolution");
  assert.ok(E.chooseEvolution(r, 135, catalogue));
  assert.equal(r.hero.id, 135);
  assert.equal(r.phase, "arrival");
});

test("scouting reveals and persists the actual next opponent without healing", () => {
  const r = initial();
  r.phase = "camp";
  r.stageIndex = 13;
  r.hero.hp = 10;
  assert.ok(E.resolveEncounter(r, "scout", catalogue));
  assert.equal(r.hero.hp, 10);
  assert.equal(r.hero.level, 5);
  assert.equal(r.scouting.stageIndex, 14);
  assert.ok(E.STAGES[14].pool.includes(r.scouting.speciesId));
  const copy = JSON.parse(JSON.stringify(r));
  assert.ok(validRun(copy, catalogue));
  const speciesId = copy.scouting.speciesId;
  copy.travelProgress = 1;
  E.arrive(copy, catalogue);
  E.activateStage(copy, catalogue);
  assert.equal(copy.enemy.id, speciesId);
  assert.equal(copy.preparedStrike, true);
  copy.hero.hp = copy.hero.maxHp;
  const without = structuredClone(copy);
  without.preparedStrike = false;
  const hit = E.battleStep(copy, catalogue);
  const normal = E.battleStep(without, catalogue);
  assert.ok(hit.damage >= normal.damage);
  assert.equal(hit.prepared, true);
  assert.equal(copy.preparedStrike, false);
  E.battleStep(copy, catalogue);
  assert.equal(E.battleStep(copy, catalogue)?.prepared, false);
});

test("invalid reconnaissance cannot inject a species outside the encounter pool", () => {
  const r = initial();
  r.scouting = { stageIndex: 14, speciesId: 4 };
  assert.equal(validRun(r, catalogue), false);
  r.scouting = { stageIndex: -1, speciesId: 150 };
  assert.equal(validRun(r, catalogue), false);
});

test("field guide records partners and encounters without double settlement", () => {
  const r = simulate(2026, 4).run;
  const meta = E.baseMeta();
  const provisional = discoveryRecords(meta, r);
  assert.equal(provisional[4].seen, 1);
  assert.equal(provisional[5].seen, 1);
  assert.equal(provisional[6].seen, 1);
  assert.equal(Object.values(provisional).reduce((n, p) => n + p.defeated, 0), 9);
  assert.deepEqual(meta.discoveries, {});
  assert.ok(E.settle(r, meta));
  assert.deepEqual(meta.discoveries, provisional);
  assert.deepEqual(discoveryRecords(meta, r), provisional);
  assert.equal(meta.expeditionHistory.length, 1);
  assert.equal(meta.expeditionHistory[0].seed, 2026);
  assert.equal(meta.expeditionHistory[0].partnerId, 6);
  assert.equal(E.settle(r, meta), false);
  assert.equal(meta.expeditionHistory.length, 1);
  assert.deepEqual(normalizeMeta(meta), meta);
});

test("expedition records stay bounded and corrupt collection counts are normalized", () => {
  const meta = E.baseMeta();
  for (let i = 1; i <= 18; i++) {
    const r = initial(7, i);
    r.phase = "retired";
    E.settle(r, meta);
  }
  assert.equal(meta.expeditionHistory.length, 12);
  assert.equal(meta.discoveries[7].seen, 18);
  const fixed = normalizeMeta({ discoveries: { 1: { seen: 3, defeated: 99 }, 4: null, invalid: {} } });
  assert.deepEqual(fixed.discoveries, { 1: { seen: 3, defeated: 3 } });
});
test("camps restore an injured Pokemon and continue to the next stage once", () => {
  const r = initial();
  r.phase = "camp";
  r.stageIndex = 4;
  r.hero.hp = 1;
  r.hero.moves.forEach((m) => (m.pp = 0));
  assert.ok(E.resolveEncounter(r, "rest"));
  assert.equal(r.hero.hp, r.hero.maxHp);
  assert.ok(r.hero.moves.every((m) => m.pp === m.maxPp));
  assert.equal(r.stageIndex, 5);
  assert.equal(E.resolveEncounter(r, "rest"), false);
});
test("cache treasure is granted exactly once", () => {
  const r = initial();
  r.phase = "cache";
  r.stageIndex = 2;
  assert.ok(E.resolveEncounter(r, "gold"));
  assert.ok(r.coins >= 50 && r.coins <= 80);
  const coins = r.coins;
  assert.equal(E.resolveEncounter(r, "gold"), false);
  assert.equal(r.coins, coins);
});
test("shrine can be left without trapping the campaign", () => {
  const r = initial();
  r.phase = "shrine";
  r.stageIndex = 9;
  r.offers = [];
  assert.ok(E.resolveEncounter(r, "leave"));
  assert.equal(r.phase, "travel");
  assert.equal(r.stageIndex, 10);
});
test("evolution and new attacks persist through campaign saves", () => {
  const r = simulate(2026, 4).run;
  assert.equal(r.hero.id, 6);
  assert.ok(r.hero.moves.some((m) => m.id === 53));
  assert.ok(validRun(JSON.parse(JSON.stringify(r)), catalogue));
});
test("the final guardian ends the campaign instead of creating a new travel loop", () => {
  const r = simulate(2026, 7).run;
  assert.equal(r.phase, "complete");
  assert.equal(r.stageIndex, 14);
  assert.equal(r.pendingReward, false);
  assert.equal(E.depart(r), false);
  assert.equal(E.battleStep(r, catalogue), null);
});
test("terminal settlement and unlocks are idempotent", () => {
  const r = simulate(2026, 4).run,
    m = E.baseMeta();
  m.totalVictories = 9;
  assert.ok(E.settle(r, m));
  assert.ok(m.unlockedStarters[25]);
  const before = structuredClone(m);
  assert.equal(E.settle(r, m), false);
  assert.deepEqual(m, before);
  assert.ok(m.gold > 0);
});
test("retiring before any victory cannot generate free currency", () => {
  const r = initial(),
    m = E.baseMeta();
  r.phase = "retired";
  E.settle(r, m);
  assert.equal(m.gold, 0);
  assert.equal(m.totalVictories, 0);
});
test("upgrades charge the displayed cost and respect the cap", () => {
  const m = E.baseMeta();
  m.gold = 1000;
  assert.ok(E.upgrade(m, "maxHpBonus"));
  assert.equal(m.gold, 900);
  assert.equal(m.permanentUpgrades.maxHpBonus, 1);
  assert.ok(E.upgrade(m, "maxHpBonus"));
  assert.equal(m.gold, 750);
  m.permanentUpgrades.maxHpBonus = 10;
  const before = m.gold;
  assert.equal(E.upgrade(m, "maxHpBonus"), false);
  assert.equal(m.gold, before);
});
test("save round trip retains RNG, HP, PP and the next automatic attacker", () => {
  const r = battle();
  E.battleStep(r, catalogue);
  const store = memory();
  assert.ok(writeState(store, E.baseMeta(), r));
  const loaded = readState(store, catalogue).run;
  assert.deepEqual(loaded, r);
  E.battleStep(r, catalogue);
  E.battleStep(loaded, catalogue);
  assert.deepEqual(loaded, r);
});
test("save round trip can resume a partially completed map traversal", () => {
  const r = initial();
  E.selectBonus(r, r.offers[0]);
  r.travelProgress = 0.473;
  const store = memory();
  writeState(store, E.baseMeta(), r);
  assert.equal(readState(store, catalogue).run.travelProgress, 0.473);
});
test("legacy progression migrates without modifying the original save", () => {
  const store = memory(),
    legacy = {
      gold: 333,
      totalRuns: 7,
      bestScore: 8,
      totalVictories: 25,
      permanentUpgrades: { maxHpBonus: 3 },
    };
  store.setItem("pokeBattleProgress", JSON.stringify(legacy));
  const loaded = readState(store, catalogue);
  assert.equal(loaded.meta.gold, 333);
  assert.equal(loaded.meta.permanentUpgrades.maxHpBonus, 3);
  assert.equal(loaded.meta.unlockedStarters[133], true);
  assert.equal(store.getItem("pokeBattleProgress"), JSON.stringify(legacy));
});
test("corrupt saves and unavailable storage fail safely", () => {
  const store = memory();
  store.setItem(SAVE_KEY, "{bad json");
  assert.equal(readState(store, catalogue).run, null);
  assert.equal(
    writeState(
      {
        setItem() {
          throw Error("quota");
        },
      },
      E.baseMeta(),
      null,
    ),
    false,
  );
  const r = initial();
  r.phase = "unknown";
  store.setItem(SAVE_KEY, JSON.stringify({ meta: { gold: 35 }, run: r }));
  const loaded = readState(store, catalogue);
  assert.equal(loaded.run, null);
  assert.equal(loaded.meta.gold, 35);
  assert.ok(loaded.warning);
});

test("malformed expedition fields never discard intact permanent progress", () => {
  const mutations = [
    (r) => { r.hero.moves = [null]; },
    (r) => { r.hero.moves[0].maxPp = 0; },
    (r) => { r.hero.moves[0].pp = 1000; },
    (r) => { r.hero.id = "__proto__"; },
    (r) => { r.hero.moves[0].id = "__proto__"; },
    (r) => { r.hero.xp = 12; },
    (r) => { r.settled = "false"; },
    (r) => { r.pendingReward = []; },
    (r) => { r.pendingEvolution = {}; },
    (r) => { r.actions = 0.5; },
    (r) => { r.enemy.hp = 0; },
    (r) => { r.phase = "shop"; },
    (r) => { r.upgrades.attackBonus = 0.5; },
    (r) => { r.pendingGrowth = { fromId: 1, toId: 150 }; },
  ];
  for (const mutate of mutations) {
    const run = battle();
    mutate(run);
    assert.doesNotThrow(() => validRun(run, catalogue));
    assert.equal(validRun(run, catalogue), false);
    const store = memory();
    store.setItem(SAVE_KEY, JSON.stringify({ meta: { gold: 321, totalVictories: 25 }, run }));
    const restored = readState(store, catalogue);
    assert.equal(restored.run, null);
    assert.equal(restored.meta.gold, 321);
    assert.equal(restored.meta.unlockedStarters[133], true);
    assert.ok(restored.warning.includes("permanent progress"));
  }
});
test("normalization rejects nonfinite values, negative balances and excess upgrade levels", () => {
  const m = normalizeMeta({
    gold: -10,
    totalVictories: Infinity,
    permanentUpgrades: { maxHpBonus: 999 },
    battleSpeed: -5,
  });
  assert.equal(m.gold, 0);
  assert.ok(Number.isFinite(m.totalVictories));
  assert.equal(m.permanentUpgrades.maxHpBonus, 10);
  assert.equal(m.battleSpeed, 1500);
});
test("all stage triggers lie exactly on the rendered route", () => {
  assert.equal(world.encounters.length, E.STAGES.length);
  for (const routeMode of ["legacy", "regional"])
    for (let index = 0; index < E.STAGES.length; index++) {
    const r = initial();
    r.routeMode = routeMode;
    r.stageIndex = index;
    r.travelProgress = 1;
    const z = E.encounterZone(r, world);
    const p = E.travelPosition(r, world.route);
    assert.ok(Math.hypot(p[0] - z.center[0], p[1] - z.center[1]) < z.radius);
    assert.equal(z.kind, E.STAGES[z.index].kind);
  }
});
test("the complete route avoids every authored prop collider", () => {
  for (let i = 0; i <= 1500; i++) {
    const [x, y] = E.pointOnRoute(world.route, i / 1500);
    assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
    for (const prop of [
      ...world.props,
      ...Object.values(world.regions || {}).flatMap((r) => r.props),
      ...Object.values(world.regions || {}).flatMap((r) => r.encounters.map((e) => e.prop).filter(Boolean)),
      ...world.encounters.map((z) => z.prop).filter(Boolean),
    ]) {
      const [cx, cy, w, h] = prop.collider;
      assert.ok(
        !(x > cx && x < cx + w && y > cy && y < cy + h),
        prop.id + " blocks the path",
      );
    }
  }
});

test("regional paths span the full map and legacy saves retain their coordinates", () => {
  const run = initial();
  for (const region of E.REGIONS) {
    run.stageIndex = region.from;
    run.travelProgress = 0;
    assert.equal(E.routeFraction(run), 0);
    assert.deepEqual(E.travelPosition(run, world.route), world.route[0]);
    run.stageIndex = region.to;
    run.travelProgress = 1;
    assert.equal(E.routeFraction(run), 1);
    assert.deepEqual(E.travelPosition(run, world.route), world.route.at(-1));
  }
  run.stageIndex = 8;
  run.travelProgress = 0.47;
  delete run.routeMode;
  assert.equal(E.routeFraction(run), 8.47 / 15);
  assert.deepEqual(E.encounterZone(run, world), world.encounters[8]);
  const store = memory();
  writeState(store, E.baseMeta(), run);
  assert.deepEqual(readState(store, catalogue).run, run);
});

test("entering a new region queues one cosmetic introduction without changing rewards", () => {
  const run = initial();
  E.selectBonus(run, run.offers[0]);
  assert.equal(run.regionEntry, "woodland");
  run.travelProgress = 1;
  E.arrive(run, catalogue);
  assert.equal(run.regionEntry, null);
  run.stageIndex = 5;
  run.phase = "victoryBeat";
  const wins = run.wins, coins = run.coins;
  E.depart(run);
  assert.equal(run.regionEntry, "lake");
  assert.equal(run.travelProgress, 0);
  assert.equal(run.coins, coins);
  assert.equal(run.wins, wins);
  assert.equal(E.depart(run), false);
});

test("every stage has a regional arena and a layered map with real assets", () => {
  for (let i = 0; i < E.STAGES.length; i++) {
    const region = E.region({ stageIndex: i });
    assert.equal(E.REGIONS.filter((r) => i >= r.from && i <= r.to).length, 1);
    assert.ok(existsSync(`assets/generated/${region.arena}.webp`));
    const map = world.regions[region.id];
    assert.ok(map.base.endsWith("-base.webp"));
    assert.ok(existsSync(map.base));
    for (const prop of map.props)
      assert.ok(existsSync(`assets/generated/${prop.asset}.webp`));
  }
});

test("elemental animation sheets retain all four equal frames and their prompts", () => {
  for (const [type, id] of [["electric", "electric-burst"], ["psychic", "spectral-pulse"],
    ["ghost", "spectral-pulse"], ["dark", "spectral-pulse"],
    ["ground", "stone-impact"], ["rock", "stone-impact"], ["steel", "stone-impact"]]) {
    assert.equal(impactSequence(type), id);
    const png = readFileSync(`assets/effects/${id}-sheet.png`);
    assert.equal(png.readUInt32BE(16), 1024);
    assert.equal(png.readUInt32BE(20), 1024);
    assert.ok(existsSync(`assets/effects/${id}-sheet.webp`));
    assert.ok(readFileSync(`assets/effects/${id}.prompt.txt`, "utf8").includes("2 by 2"));
  }
  assert.equal(impactSequence("fire"), null);
});

test("camp strategies remain finite and preserve valid saves across seeded runs", () => {
  for (const camp of ["rest", "train", "scout"])
    for (const id of [1, 4, 7, 25, 133, 152])
      for (let seed = 1; seed <= 40; seed++) {
        const result = simulate(seed * 9001 + 2026, id, { camp });
        assert.ok(["complete", "defeat"].includes(result.phase), `${camp}/${id}/${seed}`);
        assert.ok(result.actions <= 9 * 81);
        assert.ok(validRun(result.run, catalogue), `${camp}/${id}/${seed}`);
      }
});
test("all final art and prompt files exist and runtime map uses separate props", () => {
  const manifest = JSON.parse(readFileSync("data/asset-manifest.json"));
  assert.ok(manifest.length >= 22);
  for (const asset of manifest) {
    assert.ok(existsSync(asset.image));
    assert.ok(existsSync(asset.source));
    assert.ok(readFileSync(asset.prompt, "utf8").trim().length > 60);
  }
  assert.ok(world.base.endsWith("-base.webp"));
  assert.ok(world.props.length >= 7);
  assert.ok(manifest.filter((a) => a.transparent).length >= 19);
});

test("Eevee chooses a native evolution at arrival and preserves its earned reward", () => {
  for (const id of [134, 135, 136]) {
    const r = initial(133);
    r.hero.level = 7;
    r.pendingEvolution = true;
    r.pendingReward = true;
    r.phase = "travel";
    r.travelProgress = 1;
    E.arrive(r, catalogue);
    assert.equal(r.phase, "evolution");
    assert.ok(validRun(r, catalogue));
    const before = structuredClone(r);
    assert.equal(E.chooseEvolution(r, 150, catalogue), false);
    assert.deepEqual(r, before);
    assert.ok(E.chooseEvolution(r, id, catalogue));
    assert.equal(r.hero.id, id);
    assert.equal(r.phase, "reward");
    assert.equal(r.pendingEvolution, false);
    assert.ok(r.offers.length > 0);
    assert.equal(E.chooseEvolution(r, 134, catalogue), false);
  }
});

test("unlocked partners have viable native evolved forms in completed runs", () => {
  for (const [starter, form] of [
    [25, 26],
    [133, 134],
    [152, 154],
  ]) {
    const r = simulate(2026, starter).run;
    assert.equal(r.phase, "complete");
    assert.equal(r.hero.id, form);
    assert.ok(validRun(r, catalogue));
  }
});

test("all official Pokemon artwork is present and all attacks are positive damaging moves", () => {
  for (const p of Object.values(catalogue.pokemon))
    assert.ok(existsSync(p.artwork));
  for (const m of Object.values(catalogue.moves)) {
    assert.ok(m.power > 0);
    assert.notEqual(m.damageClass, "status");
    assert.ok(m.source.startsWith("https://pokeapi.co/"));
  }
});
