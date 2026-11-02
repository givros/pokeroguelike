import { readFileSync } from "node:fs";
import * as E from "../engine.js";
const catalogue = {
  pokemon: JSON.parse(readFileSync("data/pokemon.json")),
  moves: JSON.parse(readFileSync("data/moves.json")),
};
export function simulate(seed, starter = 7, options = {}) {
  const r = E.createRun(starter, E.baseMeta(), catalogue, seed);
  let transitions = 0;
  const visited = [];
  while (
    !["complete", "defeat", "retired"].includes(r.phase) &&
    !options.stopAt?.(r) &&
    transitions++ < 3000
  ) {
    // Acknowledge the cosmetic scene beat; it never grants gameplay rewards.
    if (r.pendingGrowth) r.pendingGrowth = null;
    if (r.regionEntry) r.regionEntry = null;
    if (r.pendingAwakenings?.length) r.pendingAwakenings = [];
    visited.push(r.phase);
    switch (r.phase) {
      case "evolution":
        E.chooseEvolution(r,134,catalogue);
        break;
      case "starter":
      case "reward":
      case "shrine": {
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
        const id = preference.find((id) => r.offers.includes(id));
        if (id) E.selectBonus(r, id);
        else E.resolveEncounter(r, "leave");
        break;
      }
      case "travel":
        r.travelProgress = 1;
        E.arrive(r, catalogue);
        break;
      case "arrival":
        E.activateStage(r, catalogue);
        break;
      case "battle":
        E.battleStep(r, catalogue);
        break;
      case "victoryBeat":
        E.depart(r);
        break;
      case "camp":
        E.resolveEncounter(r, options.camp || "rest", catalogue);
        break;
      case "cache":
        E.resolveEncounter(r, r.hero.hp < r.hero.maxHp * 0.7 ? "heal" : "gold");
        break;
      case "shop":
        if (r.hero.hp < r.hero.maxHp * 0.9) E.buy(r, "full_heal");
        if (r.coins >= 70) E.buy(r, "guard");
        E.depart(r);
        break;
      default:
        throw new Error("Unhandled phase " + r.phase);
    }
  }
  return {
    phase: r.phase,
    stage: r.stageIndex + 1,
    wins: r.wins,
    actions: r.actions,
    transitions,
    visited,
    run: r,
  };
}
if (process.argv[1]?.endsWith("simulate.mjs")) {
  for (const starter of [1, 4, 7]) {
    const runs = Array.from({ length: 200 }, (_, i) =>
      simulate(i * 9001 + 2026, starter),
    );
    console.log(
      JSON.stringify({
        starter,
        wins: runs.filter((r) => r.phase === "complete").length,
        meanStage: runs.reduce((s, r) => s + r.stage, 0) / runs.length,
        maxActions: Math.max(...runs.map((r) => r.actions)),
        stuck: runs.filter((r) => r.transitions >= 3000).length,
        firstWinningSeed:
          runs.findIndex((r) => r.phase === "complete") * 9001 + 2026,
      }),
    );
  }
}
