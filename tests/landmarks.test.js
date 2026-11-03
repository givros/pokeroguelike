import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../engine.js';
import * as L from '../landmarks.js';
import {simulate} from '../tools/simulate.mjs';
import {paddedObstacles,segmentHitsBox,approachFor} from '../tools/approach-paths.mjs';
import {validRun,readState,writeState} from '../storage.js';
import {advanceIdle} from '../idle.js';
const world=JSON.parse(readFileSync('data/world-map.json')),c={pokemon:JSON.parse(readFileSync('data/pokemon.json')),moves:JSON.parse(readFileSync('data/moves.json'))};
function arrival(){const r=simulate(2026,4,{stopAt:r=>r.stageIndex===2&&r.phase==='arrival'}).run;r.pendingGrowth=null;r.pendingAwakenings=[];r.regionEntry=null;return r;}
test('all six regional approaches avoid expanded prop footprints and have valid interaction endpoints',()=>{
 let count=0;
 for(const biome of Object.values(world.regions))for(const zone of biome.encounters.filter(z=>z.prop)){
  count++;assert.deepEqual(zone.approachPath[0],zone.center);assert.deepEqual(zone.approachPath.at(-1),zone.interactionPoint);
  assert.ok(zone.approachMs>=800&&zone.approachMs<=3000);assert.ok(zone.approachPath.length<=12);
  const boxes=paddedObstacles([...biome.props,...biome.encounters.filter(z=>z.prop).map(z=>z.prop)]);
  for(let i=1;i<zone.approachPath.length;i++)for(const b of boxes)assert.equal(segmentHitsBox(zone.approachPath[i-1],zone.approachPath[i],b),false,zone.id);
 }
 assert.equal(count,6);
});
test('approach planner takes a real detour around a blocking object',()=>{
 const zone={id:'test',kind:'cache',center:[.2,.5],prop:{x:.7,y:.5,w:.1,h:.1,collider:[.66,.46,.08,.04]}};
 const obstacle={x:.45,y:.65,w:.1,h:.3,collider:[.4,.35,.1,.3]};
 const result=approachFor(zone,[obstacle]);assert.ok(result.approachPath.length>2);
 for(let i=1;i<result.approachPath.length;i++)for(const box of paddedObstacles([obstacle,zone.prop]))assert.equal(segmentHitsBox(result.approachPath[i-1],result.approachPath[i],box),false);
});
test('saved approach and return are position-continuous and cannot grant gameplay rewards',()=>{
 const r=arrival(),before=structuredClone(r);assert.equal(L.beginApproach(r,world),true);assert.deepEqual(L.mapPosition(r,world.route),E.travelPosition(before,world.route));
 assert.equal(L.beginApproach(r,world),false);r.landmark.progress=.4;
 const memory={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};writeState(memory,E.baseMeta(),r);
 const restored=readState(memory,c).run;assert.deepEqual(restored,r);assert.deepEqual(L.mapPosition(restored,world.route),L.mapPosition(r,world.route));
 L.finishMotion(r);assert.deepEqual(L.mapPosition(r,world.route),r.landmark.path.at(-1));assert.equal(r.coins,before.coins);assert.equal(r.seed,before.seed);assert.deepEqual(r.stats,before.stats);
 E.activateStage(r,c);assert.equal(r.phase,'cache');const endpoint=L.mapPosition(r,world.route);E.resolveEncounter(r,'heal',c);
 assert.equal(validRun(r,c),true);L.prepareDeparture(r);assert.deepEqual(L.mapPosition(r,world.route),endpoint);r.landmark.progress=1;L.finishMotion(r);
 assert.equal(r.landmark,null);assert.deepEqual(L.mapPosition(r,world.route),E.travelPosition(before,world.route));
});
test('retirement cleans up a partial approach, while old route saves retain their coordinates',()=>{
 const r=arrival();L.beginApproach(r,world);r.landmark.progress=.3;r.phase='retired';E.settle(r,E.baseMeta());assert.equal(r.landmark,null);assert.equal(validRun(r,c),true);
 const old=arrival();delete old.routeMode;const before=structuredClone(old);assert.equal(L.beginApproach(old,world),false);assert.deepEqual(old,before);assert.deepEqual(L.mapPosition(old,world.route),E.travelPosition(old,world.route));
});
test('malformed or stage-inconsistent landmark saves are rejected without weakening fighter validation',()=>{
 for(const change of [{progress:2},{duration:0},{path:[[.5,.5]]},{state:'teleporting'},{stageIndex:1}]){
  const r=arrival();L.beginApproach(r,world);Object.assign(r.landmark,change);assert.equal(validRun(r,c),false);
 }
});
test('away catch-up finishes a saved partial approach once before activating the encounter',()=>{
 const r=arrival();L.beginApproach(r,world);r.landmark.progress=.4;r.plan='predator';r.idleEnabled=true;const hp=r.hero.hp,seed=r.seed,stats=structuredClone(r.stats);
 advanceIdle(r,E.baseMeta(),c,L.remainingMotionMs(r),world);assert.equal(r.landmark.state,'at');assert.equal(r.phase,'arrival');assert.equal(r.hero.hp,hp);assert.equal(r.seed,seed);assert.deepEqual(r.stats,stats);
 advanceIdle(r,E.baseMeta(),c,700,world);assert.equal(r.phase,'cache');assert.equal(validRun(r,c),true);
});
