import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../engine.js';
import {normalizeMeta, validRun} from '../storage.js';
import {simulate} from '../tools/simulate.mjs';
const c={pokemon:JSON.parse(readFileSync('data/pokemon.json')),moves:JSON.parse(readFileSync('data/moves.json'))};
function battle(threat){const m=E.baseMeta();m.unlockedThreat=6;E.chooseThreat(m,threat);const r=E.createRun(4,m,c,2026);E.selectBonus(r,r.offers[0]);r.regionEntry=null;r.travelProgress=1;E.arrive(r,c);E.activateStage(r,c);return r;}
test('threat selection is bounded by earned unlocks and snapshotted for the expedition',()=>{
 const m=E.baseMeta(),before=structuredClone(m);
 for(const value of [-1,1,7,NaN,1.5])assert.equal(E.chooseThreat(m,value),false);
 assert.deepEqual(m,before);m.unlockedThreat=3;assert.equal(E.chooseThreat(m,2),true);
 const r=E.createRun(4,m,c,2026);E.chooseThreat(m,0);assert.equal(r.threat,2);
 assert.equal(validRun(r,c),true);r.threat=7;assert.equal(validRun(r,c),false);
});
test('normal threat preserves old enemy stats, RNG and combat calculations',()=>{
 const a=battle(0),b=structuredClone(a);delete b.threat;
 assert.deepEqual(E.threatModifiers(a),{tier:0,enemyHp:1,enemyDamage:1,gold:1});
 assert.deepEqual(E.battleStep(a,c),E.battleStep(b,c));assert.equal(a.seed,b.seed);assert.deepEqual(a.hero,b.hero);assert.deepEqual(a.enemy,b.enemy);
});
test('threat changes real enemy HP and damage while preserving move choice and player power',()=>{
 const a=battle(0),b=battle(2);assert.equal(b.enemy.id,a.enemy.id);assert.equal(b.enemy.maxHp,Math.ceil(a.enemy.maxHp*1.4));
 const move=E.bestMove(a,c,'enemy');assert.equal(E.expectedDamage(b,b.enemy,b.hero,move,c,false),E.expectedDamage(a,a.enemy,a.hero,move,c,false)*1.24);
 const playerMove=E.bestMove(a,c,'ally');assert.equal(E.expectedDamage(b,b.hero,b.enemy,playerMove,c,true),E.expectedDamage(a,a.hero,a.enemy,playerMove,c,true));
 a.nextSide=b.nextSide='enemy';a.hero.maxHp=b.hero.maxHp=1000;a.hero.hp=b.hero.hp=1000;
 assert.ok(E.battleStep(b,c).damage>E.battleStep(a,c).damage);
});
test('victories pay the displayed battle reward multiplier and completion unlocks only the next tier once',()=>{
 const a=battle(0),b=battle(2);a.enemy.hp=b.enemy.hp=1;E.battleStep(a,c);E.battleStep(b,c);assert.ok(b.coins>a.coins);
 const m=E.baseMeta();Object.assign(b,{phase:'complete',stageIndex:14});b.enemy.hp=0;
 assert.equal(E.settle(b,m),true);assert.equal(m.unlockedThreat,3);assert.equal(m.selectedThreat,0);assert.equal(m.expeditionHistory[0].threat,2);
 const before=structuredClone(m);assert.equal(E.settle(b,m),false);assert.deepEqual(m,before);
 for(const phase of ['defeat','retired']){const r=battle(5),meta=E.baseMeta();r.phase=phase;E.settle(r,meta);assert.equal(meta.unlockedThreat,0);}
});
test('old completed saves unlock the first challenge; selected difficulty cannot exceed restored unlocks',()=>{
 assert.equal(normalizeMeta({bestScore:9}).unlockedThreat,1);assert.equal(normalizeMeta({bestScore:8}).unlockedThreat,0);
 assert.equal(normalizeMeta({unlockedThreat:2,selectedThreat:6}).selectedThreat,2);
 assert.equal(normalizeMeta({unlockedThreat:100}).unlockedThreat,6);
 const m=E.baseMeta(),r=battle(6);Object.assign(r,{phase:'complete',stageIndex:14});r.enemy.hp=0;E.settle(r,m);assert.equal(m.unlockedThreat,6);
});
test('4200 seeded challenge expeditions retain finite battles and valid deterministic saves',()=>{
 for(let threat=0;threat<=6;threat++)for(const starter of [1,4,7,25,133,152])for(let seed=1;seed<=100;seed++){
  const r=simulate(seed*9001,starter,{threat,plan:'siphon'});assert.ok(['complete','defeat'].includes(r.phase));assert.ok(r.transitions<3000);assert.equal(validRun(r.run,c),true);
 }
 assert.deepEqual(simulate(2026,4,{threat:3,plan:'warden'}),simulate(2026,4,{threat:3,plan:'warden'}));
});
