import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../engine.js';
import {chapterGraph,expeditionGraph} from '../route-graph.js';
import {planDecision,applyPlanDecision} from '../plans.js';
import {SKILLS,EQUIPMENT,unlockSkill,equipSkill,equipGear} from '../legacy.js';
import {validRun,normalizeMeta} from '../storage.js';
const c={pokemon:JSON.parse(readFileSync('data/pokemon.json')),moves:JSON.parse(readFileSync('data/moves.json'))};
function make(id=133,seed=2026,meta=E.baseMeta()){const run=E.createRun(id,meta,c,seed);E.enableEndless(run,meta);return{run,meta};}
function step(r){r.pendingGrowth=null;r.pendingAwakenings=[];const d=planDecision(r);if(d)return applyPlanDecision(r,d,c);if(r.phase==='arrival')return E.activateStage(r,c);if(r.phase==='battle')return E.battleStep(r,c);if(r.phase==='victoryBeat')return E.depart(r);if(r.phase==='evolution')return E.chooseEvolution(r,134,c);throw Error(r.phase);}
function play(id=133,seed=2026){const state=make(id,seed);state.run.plan='predator';let steps=0;while(!['defeat','complete'].includes(state.run.phase)&&steps++<6000){step(state.run);assert.ok(validRun(state.run,c),`${state.run.phase}/${state.run.stageIndex}`);}assert.equal(state.run.phase,'defeat');assert.ok(steps<6000);E.settle(state.run,state.meta);assert.ok(validRun(state.run,c));return state;}
test('procedural chapters bridge guardians, vary by seed/depth and keep a bounded map at distant depths',()=>{
 const {run:r}=make();const first=chapterGraph(r,E.STAGES,0),second=chapterGraph(r,E.STAGES,1);assert.ok(first.rows[14][0].next.includes('15-0'));assert.ok(second.rows[15].every(n=>n.kind==='wild'));assert.ok(first.nodes.some(n=>n.kind==='capture'));assert.notDeepEqual(first.nodes.map(n=>n.kind),second.nodes.map(n=>n.kind));
 for(const depth of [0,15,300,15000,1500000000]){r.stageIndex=depth;const graph=expeditionGraph(r,E.STAGES);assert.ok(graph.nodes.length<200);assert.ok(graph.byId.has(`${depth}-0`));assert.ok(graph.height<=2790);assert.equal(new Set(graph.nodes.map(n=>n.id)).size,graph.nodes.length);}
});
test('a real seeded endless run crosses three chapters, fails, and secures gold, skills currency, equipment and captured partners once',()=>{
 const {run:r,meta:m}=play();assert.ok(r.stageIndex>=30);assert.equal(r.phase,'defeat');assert.ok(r.wins>15);assert.ok(m.gold>0);assert.ok(m.legacyMarks>0);assert.ok(Object.keys(m.equipment).length);assert.ok(Object.keys(m.captured).length);const before=structuredClone({r,m});assert.equal(E.settle(r,m),false);assert.deepEqual({r,m},before);assert.deepEqual(normalizeMeta(m),m);
});
test('skills, equipment and stat purchases survive death and affect only the next adventure snapshot',()=>{
 const {meta:m}=play();assert.ok(unlockSkill(m,'ward'));assert.equal(unlockSkill(m,'ward'),false);assert.ok(equipSkill(m,'ward'));assert.ok(equipGear(m,'charm'));assert.ok(E.upgrade(m,'maxHpBonus'));const id=Number(Object.keys(m.captured)[0]);m.startingPartner=id;assert.equal(E.startingPartner(m,2026,c),id);
 const {run:r}=make(id,2026,m);assert.equal(r.coins,0);assert.equal(r.skill,'ward');assert.equal(r.gear.id,'charm');assert.equal(r.hero.maxHp,E.fighter(id,5,c,m.permanentUpgrades).maxHp+25+8*m.equipment.charm);const saved=structuredClone(r);m.equippedSkill='adrenaline';m.equipment.charm=10;assert.deepEqual(r,saved);assert.ok(validRun(r,c));
});
test('capture requires a defeated encounter, rolls once, supports failure/skip, and saves the result',()=>{
 let outcomes=new Set();
 for(let seed=1;seed<=30;seed++){
  const {run:r,meta:m}=make(7,seed);assert.equal(E.attemptCapture(r,c),null);E.selectBonus(r,r.offers[0]);r.stageIndex=1;r.branchStart=1;assert.ok(E.selectRoute(r,'1-0',c));E.activateStage(r,c);assert.equal(E.stage(r).kind,'capture');r.enemy.hp=1;E.battleStep(r,c);assert.equal(r.phase,'capture');assert.ok(validRun(r,c));const result=E.attemptCapture(r,c);assert.ok(result);outcomes.add(result.caught);const saved=structuredClone(r);assert.equal(E.attemptCapture(r,c),null);assert.deepEqual(r,saved);assert.ok(validRun(r,c));r.phase='retired';E.settle(r,m);assert.ok(validRun(r,c));assert.equal(m.captured[result.id]||0,result.caught?1:0);
 }
 assert.deepEqual(outcomes,new Set([true,false]));
});
test('legacy migration does not duplicate a carried bank and malformed endless saves are rejected without throwing',()=>{
 const m=E.baseMeta();m.gold=1000;const r=E.createRun(4,m,c,2026);E.selectBonus(r,r.offers[0]);r.coins=900;E.enableEndless(r,m);assert.equal(r.proceduralFromChapter,1);r.phase='retired';E.settle(r,m);assert.equal(m.gold,900);assert.ok(validRun(r,c));
 for(const change of [{discoveryLedger:{1:null}},{captures:[]},{salvage:{bogus:1}},{gear:{id:'charm',tier:99}},{pendingCapture:{id:1,chance:2}}]){const malformed={...r,...change};assert.doesNotThrow(()=>validRun(malformed,c));assert.equal(validRun(malformed,c),false);}
});
