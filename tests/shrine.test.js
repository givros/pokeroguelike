import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine.js';
import {simulate} from '../tools/simulate.mjs';
import {validRun} from '../storage.js';
import {readFileSync} from 'node:fs';
import {advanceIdle} from '../idle.js';
const c={pokemon:JSON.parse(readFileSync('data/pokemon.json')),moves:JSON.parse(readFileSync('data/moves.json'))};
function shrine(){const r=simulate(2026,4,{stopAt:r=>r.stageIndex===9&&r.phase==='shrine'}).run;r.bonuses=[];r.offers=['attack_boost','first_guard','pp_boost'];r.hero.hp=r.hero.maxHp;return r;}
test('offering intent is reversible and spends no HP, gold or RNG before a boon is selected',()=>{
 const r=shrine(),before=structuredClone(r);assert.equal(E.setShrineOffering(r,true),true);
 assert.equal(r.hero.hp,before.hero.hp);assert.equal(r.seed,before.seed);assert.equal(r.coins,before.coins);
 assert.equal(validRun(r,c),true);assert.equal(E.setShrineOffering(r,false),true);
 assert.deepEqual(r,{...before,shrineEmpowered:false});
});
test('a valid offering charges the displayed cost once and grants exactly two ranks with one awakening',()=>{
 const r=shrine();r.bonuses=['crit_chance'];const hp=r.hero.hp,cost=E.shrineOfferingCost(r),gold=r.coins,seed=r.seed;
 E.setShrineOffering(r,true);assert.equal(E.selectBonus(r,'attack_boost'),true);
 assert.equal(r.hero.hp,hp-cost);assert.equal(r.coins,gold);assert.equal(r.seed,seed);assert.equal(E.count(r,'attack_boost'),2);
 assert.deepEqual(r.pendingAwakenings,['flurry']);assert.equal(r.phase,'travel');assert.equal(r.shrineEmpowered,false);
 const before=structuredClone(r);assert.equal(E.selectBonus(r,'attack_boost'),false);assert.deepEqual(r,before);
});
test('unique, capped and instant-recovery boons cannot be empowered and rejected choices are atomic',()=>{
 const r=shrine();E.setShrineOffering(r,true);
 for(const id of ['first_guard','pp_boost','not-a-boon']){const before=structuredClone(r);assert.equal(E.selectBonus(r,id),false);assert.deepEqual(r,before);}
 r.bonuses=['attack_boost','attack_boost'];const before=structuredClone(r);assert.equal(E.selectBonus(r,'attack_boost'),false);assert.deepEqual(r,before);
});
test('the offering cannot faint the partner, and a free boon remains available after cancelling',()=>{
 const r=shrine();r.hero.hp=E.shrineOfferingCost(r);const before=structuredClone(r);
 assert.equal(E.setShrineOffering(r,true),false);assert.deepEqual(r,before);
 assert.equal(E.selectBonus(r,'first_guard'),true);assert.equal(r.hero.hp,before.hero.hp);
});
test('Endurance charges against the original maximum before compounding two HP ranks',()=>{
 const r=shrine();r.offers=['hp_boost'];r.hero.maxHp=r.hero.hp=90;E.setShrineOffering(r,true);
 assert.equal(E.selectBonus(r,'hp_boost'),true);assert.equal(r.hero.maxHp,130);assert.equal(r.hero.hp,107);
});
test('leaving a shrine clears offering intent without paying or acquiring a boon',()=>{
 const r=shrine();E.setShrineOffering(r,true);const hp=r.hero.hp;
 E.resolveEncounter(r,'leave',c);assert.equal(r.hero.hp,hp);assert.deepEqual(r.bonuses,[]);assert.equal(r.shrineEmpowered,false);assert.equal(validRun(r,c),true);
});
test('saved offering intent is honored once by an explicit away plan without selecting an ineligible boon',()=>{
 const r=shrine();r.plan='predator';r.idleEnabled=true;const hp=r.hero.hp,cost=E.shrineOfferingCost(r);E.setShrineOffering(r,true);
 const report=advanceIdle(r,E.baseMeta(),c,1100);assert.equal(report.transitions,1);assert.equal(E.count(r,'attack_boost'),2);assert.equal(r.hero.hp,hp-cost);assert.equal(r.phase,'travel');assert.equal(validRun(r,c),true);
});

test('delivered shrine landmarks have grounded footprints, road clearance and room beneath the HUD',()=>{
 const world=JSON.parse(readFileSync('data/world-map.json'));
 for(const encounters of [world.encounters,world.regions.lake.encounters]){
  const prop=encounters.find(e=>e.kind==='shrine').prop;
  assert.equal(prop.asset,'wayside-shrine');assert.equal(prop.collisionRole,'base-footprint');
  const [x,y,w,h]=prop.collider;assert.ok(y>=prop.y-prop.h);assert.ok(y+h<=prop.y+1e-9);assert.ok(prop.y-prop.h>=.115);
  for(let i=0;i<=1500;i++){const [px,py]=E.pointOnRoute(world.route,i/1500);assert.equal(px>x-.045&&px<x+w+.045&&py>y-.045&&py<y+h+.045,false);}
 }
});
test('1200 offered and unoffered seeded expeditions remain finite and save-valid',()=>{
 for(const offerVitality of [false,true])for(const starter of [1,4,7,25,133,152])for(let seed=1;seed<=100;seed++){
  const result=simulate(seed*9001,starter,{offerVitality,threat:2});assert.ok(['complete','defeat'].includes(result.phase));assert.ok(result.transitions<3000);assert.equal(validRun(result.run,c),true);
 }
});
