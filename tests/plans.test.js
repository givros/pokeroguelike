import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../engine.js";
import { PLANS, planDecision, applyPlanDecision } from "../plans.js";
import { simulate } from "../tools/simulate.mjs";
import { validRun } from "../storage.js";
const catalogue={pokemon:JSON.parse(readFileSync("data/pokemon.json")),moves:JSON.parse(readFileSync("data/moves.json"))};
const run=()=>E.createRun(7,E.baseMeta(),catalogue,2026);
test("plans are explicit, pure decisions; manual and terminal states never automate",()=>{
  const r=run(), before=JSON.stringify(r);
  assert.equal(r.plan,"manual"); assert.equal(planDecision(r),null); assert.equal(JSON.stringify(r),before);
  for(const plan of PLANS) for(const phase of ["battle","travel","evolution","complete","defeat","retired"]) {
    r.plan=plan.id; r.phase=phase; assert.equal(planDecision(r),null);
  }
});
test("each strategy targets its incomplete recipe before secondary boons",()=>{
  const r=run(); r.offers=["attack_boost","defense_boost","regeneration"];
  for(const [plan,bonus] of [["predator","attack_boost"],["warden","defense_boost"],["siphon","regeneration"]]) {
    r.plan=plan; assert.deepEqual(planDecision(r),{action:"bonus",value:bonus});
  }
  r.plan="predator"; r.bonuses=["attack_boost","attack_boost"]; r.offers=["attack_boost","crit_chance"];
  assert.equal(planDecision(r).value,"crit_chance");
});
test("spring and supply choices react to health and PP; shop purchases remain finite",()=>{
  const r=run(); r.plan="warden"; r.phase="camp";
  assert.equal(planDecision(r).value,"scout");
  r.hero.hp=Math.floor(r.hero.maxHp*.5); assert.equal(planDecision(r).value,"rest");
  r.hero.hp=r.hero.maxHp; r.hero.moves[0].pp=0; assert.equal(planDecision(r).value,"rest");
  r.phase="shop"; r.coins=1000;
  let decisions=0;
  while(r.phase==="shop"&&decisions++<15) assert.equal(applyPlanDecision(r,planDecision(r),catalogue),true);
  assert.ok(decisions<15); assert.equal(r.phase,"travel"); assert.ok(r.coins>=30);
});
test("1800 seeded plan expeditions stay finite, deterministic and save-valid",()=>{
  for(const plan of ["predator","warden","siphon"]) for(const starter of [1,4,7,25,133,152]) for(let seed=1;seed<=100;seed++) {
    const result=simulate(seed*9001,starter,{plan});
    assert.ok(["complete","defeat"].includes(result.phase)); assert.ok(result.transitions<3000);
    assert.equal(validRun(result.run,catalogue),true,`${plan}/${starter}/${seed}`);
    assert.equal(result.run.rerolls,0);
  }
  assert.deepEqual(simulate(2026,4,{plan:"predator"}),simulate(2026,4,{plan:"predator"}));
});
