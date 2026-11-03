import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../engine.js';
import {routeGraph,validBranchState} from '../route-graph.js';
import {validRun} from '../storage.js';
import {idleStepCost} from '../idle.js';
import {planDecision,applyPlanDecision} from '../plans.js';
const catalogue={pokemon:JSON.parse(readFileSync('data/pokemon.json')),moves:JSON.parse(readFileSync('data/moves.json'))};
function fresh(seed=2026){const r=E.createRun(7,E.baseMeta(),catalogue,seed);E.enableBranching(r);return r;}
test('seeded route topology has connected starts, mandatory guardians, no dead ends and a preserved canonical route',()=>{
 for(let seed=1;seed<=500;seed++){
  const graph=routeGraph(seed,E.STAGES),seen=new Set(graph.rows[0].map(n=>n.id));
  for(let row=0;row<14;row++)for(const n of graph.rows[row]){assert.ok(seen.has(n.id));assert.ok(n.next.length);assert.ok(n.next.every(id=>graph.byId.get(id)?.row===row+1));for(const id of n.next)seen.add(id);}
  assert.equal(seen.size,graph.nodes.length);assert.deepEqual(graph.rows[5].map(n=>n.stage.kind),['boss']);assert.deepEqual(graph.rows[14].map(n=>n.stage.kind),['boss']);
  for(let row=0;row<14;row++)assert.ok(graph.rows[row][0].next.includes(`${row+1}-0`));
 }
});
test('manual routing waits, rejects skips and repeated clicks, enters directly and preserves graph RNG independence',()=>{
 const r=fresh(),seed=r.seed;assert.ok(validRun(r,catalogue));E.selectBonus(r,r.offers[0]);assert.equal(r.seed,seed);assert.ok(E.needsRouteChoice(r));assert.equal(idleStepCost(r),null);const before=JSON.stringify(r);
 assert.equal(E.selectRoute(r,'14-0',catalogue),false);assert.equal(JSON.stringify(r),before);r.travelProgress=1;assert.equal(E.arrive(r,catalogue),false);r.travelProgress=0;
 assert.ok(E.selectRoute(r,'0-1',catalogue));assert.equal(r.phase,'arrival');assert.equal(r.seed,seed);assert.deepEqual(r.branchPath,['0-1']);assert.equal(E.selectRoute(r,'0-1',catalogue),false);assert.ok(validRun(r,catalogue));
});
test('migration preserves current battles, RNG, HP, PP and old encounters without replaying travel',()=>{
 const r=E.createRun(4,E.baseMeta(),catalogue,31);E.selectBonus(r,r.offers[0]);r.travelProgress=1;E.arrive(r,catalogue);E.activateStage(r,catalogue);E.battleStep(r,catalogue);
 const before=structuredClone(r);assert.ok(E.enableBranching(r));assert.deepEqual(r.hero,before.hero);assert.deepEqual(r.enemy,before.enemy);assert.equal(r.seed,before.seed);assert.deepEqual(r.encounters,before.encounters);assert.equal(r.phase,before.phase);assert.ok(validRun(r,catalogue));assert.equal(E.enableBranching(r),false);
});
test('branch save validation rejects broken connections, missing selection and invalid path history',()=>{
 const r=fresh();E.selectBonus(r,r.offers[0]);assert.ok(validBranchState(r,E.STAGES));const bad=structuredClone(r);bad.stageIndex=2;assert.equal(validBranchState(bad,E.STAGES),false);bad.stageIndex=0;bad.phase='arrival';assert.equal(validBranchState(bad,E.STAGES),false);bad.phase='travel';bad.branchPath=['1-0'];assert.equal(validBranchState(bad,E.STAGES),false);
});
test('600 varied branching expeditions and optional plans remain finite and save-valid after every transition',()=>{
 const preference=['regeneration','lifesteal','attack_boost','defense_boost','hp_boost','first_guard','crit_chance','type_boost','momentum','focus_crit','pp_boost','gold_boost'];
 for(let seed=1;seed<=600;seed++){
  const r=fresh(seed);if(seed%4)r.plan=['manual','predator','warden','siphon'][seed%4];let steps=0;
  while(!['complete','defeat'].includes(r.phase)&&steps++<1600){
   r.pendingGrowth=null;r.pendingAwakenings=[];
   const decision=planDecision(r);
   if(decision)assert.ok(applyPlanDecision(r,decision,catalogue));
   else if(E.needsRouteChoice(r)){const choices=E.routeChoices(r);assert.ok(E.selectRoute(r,choices[(seed+r.stageIndex)%choices.length].id,catalogue));}
   else if(['starter','reward','shrine'].includes(r.phase)){const id=preference.find(id=>E.canSelectBonus(r,id));if(id)assert.ok(E.selectBonus(r,id));else assert.ok(E.resolveEncounter(r,'leave',catalogue));}
   else if(r.phase==='arrival')assert.ok(E.activateStage(r,catalogue));
   else if(r.phase==='battle')E.battleStep(r,catalogue);
   else if(r.phase==='victoryBeat'||r.phase==='shop')assert.ok(E.depart(r));
   else if(r.phase==='camp')assert.ok(E.resolveEncounter(r,'rest',catalogue));
   else if(r.phase==='cache')assert.ok(E.resolveEncounter(r,'study',catalogue));
   else throw Error(r.phase);
   assert.ok(validRun(r,catalogue),`seed ${seed}, phase ${r.phase}, row ${r.stageIndex}, path ${r.branchPath}`);
  }
  assert.ok(steps<1600);assert.ok(['complete','defeat'].includes(r.phase));
 }
});
