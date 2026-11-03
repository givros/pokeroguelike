import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as E from "../engine.js";
import {GUARDIANS,guardianAbility,guardianState} from "../guardians.js";
import {validRun,readState,writeState} from "../storage.js";
import {advanceIdle,MAX_IDLE_MS} from "../idle.js";
import {simulate} from "../tools/simulate.mjs";
const c={pokemon:JSON.parse(readFileSync("data/pokemon.json")),moves:JSON.parse(readFileSync("data/moves.json"))};
function battle(species=150){
 const r=E.createRun(7,E.baseMeta(),c,2026);
 Object.assign(r,{phase:"arrival",stageIndex:species===123?5:14,scouting:{stageIndex:species===123?5:14,speciesId:species}});
 E.activateStage(r,c);r.preparedStrike=false;r.seed=1;
 r.hero.hp=r.hero.maxHp=10000;r.enemy.hp=r.enemy.maxHp=10000;
 return r;
}
const legacy=r=>{const b=structuredClone(r);delete b.guardianAbilities;return b;};

test("guardians use verified native ability pairs, including Dragonite's hidden ability",()=>{
 assert.deepEqual(GUARDIANS.map(a=>[a.species,a.id,a.hidden]),[[123,68,false],[150,46,false],[149,136,true],[131,75,false]]);
 for(const a of GUARDIANS){const r=battle(a.species);assert.equal(guardianAbility(r),a);assert.match(a.source,/^https:\/\/pokeapi.co\/api\/v2\/ability\//);assert.equal(guardianAbility(legacy(r)),null);r.stageIndex=12;assert.equal(guardianAbility(r),null);}
 const r=battle();r.guardianAbilities="yes";assert.equal(validRun(r,c),false);
});
test("Pressure consumes two PP for one action, with the final one PP still usable",()=>{
 for(const pp of [1,2,3]){
  const r=battle();r.hero.moves=[{id:55,pp,maxPp:25}];const b=legacy(r);
  const a=E.battleStep(r,c),old=E.battleStep(b,c);
  assert.equal(r.hero.moves[0].pp,Math.max(0,pp-2));assert.equal(a.ppSpent,Math.min(pp,2));
  assert.equal(a.damage,old.damage);assert.equal(r.seed,b.seed);assert.equal(r.actions,1);assert.equal(r.battleActions,1);
 }
});
test("Pressure cannot spend PP on Struggle or charge a Flurry echo twice",()=>{
 const r=battle();r.hero.moves.forEach(s=>s.pp=0);const a=E.battleStep(r,c);assert.equal(a.move.id,0);assert.equal(a.ppSpent,0);assert.ok(r.hero.moves.every(s=>s.pp===0));
 const natural=battle();natural.hero.moves=[{id:0,pp:999,maxPp:999}];assert.equal(E.battleStep(natural,c).ppSpent,0);assert.equal(natural.hero.moves[0].pp,999);
 const f=battle();f.bonuses=["attack_boost","attack_boost","crit_chance"];
 const move=E.bestMove(f,c),slot=f.hero.moves.find(s=>s.id===move.id),pp=slot.pp,hit=E.battleStep(f,c);
 assert.ok(hit.echoDamage>0);assert.equal(pp-slot.pp,2);assert.equal(f.battleActions,1);
});
test("Multiscale halves only full-HP attack damage and breaks after the first hit",()=>{
 const r=battle(149),b=legacy(r),move=E.bestMove(r,c);
 assert.equal(E.expectedDamage(r,r.hero,r.enemy,move,c,true),E.expectedDamage(b,b.hero,b.enemy,move,c,true)*.5);
 assert.match(guardianState(r),/Active/);
 const a=E.battleStep(r,c),old=E.battleStep(b,c);assert.ok(Math.abs(a.damage-old.damage/2)<=1);assert.equal(a.guardianEffect,"Multiscale");
 assert.match(guardianState(r),/Broken/);r.nextSide=b.nextSide="ally";
 assert.equal(E.battleStep(r,c).damage,E.battleStep(b,c).damage);assert.equal(r.seed,b.seed);
});
test("Multiscale preserves the Flurry fraction and does not reduce direct Bulwark ripostes",()=>{
 const r=battle(149);r.bonuses=["attack_boost","attack_boost","crit_chance"];
 const hit=E.battleStep(r,c);assert.equal(hit.echoDamage,Math.max(1,Math.floor((hit.damage-hit.echoDamage)*.25)));
 const b=battle(149);b.bonuses=["defense_boost","defense_boost","first_guard"];b.nextSide="enemy";
 const riposte=E.battleStep(b,c);assert.equal(riposte.reflectDamage,Math.ceil(b.enemy.maxHp*.2));assert.match(guardianState(b),/Broken/);
});
test("Shell Armor prevents a rolled critical while consuming the same RNG sequence",()=>{
 const r=battle(131),b=legacy(r);r.bonuses=b.bonuses=["focus_crit"];
 const a=E.battleStep(r,c),old=E.battleStep(b,c);
 assert.equal(old.crit,true);assert.equal(a.crit,false);assert.equal(a.criticalBlocked,true);assert.equal(a.guardianEffect,"Shell Armor");assert.equal(r.stats.criticals,0);assert.equal(r.seed,b.seed);assert.ok(old.damage>a.damage);
});
test("Swarm boosts only Bug moves at the exact one-third threshold",()=>{
 for(const hp of [99,100,101])for(const id of [450,98]){
  const r=battle(123);r.nextSide="enemy";r.enemy.maxHp=300;r.enemy.hp=hp;r.enemy.moves=[{id,pp:20,maxPp:20}];const b=legacy(r),move=c.moves[id],active=hp<=100&&move.type==="bug";
  assert.equal(E.expectedDamage(r,r.enemy,r.hero,move,c,false),E.expectedDamage(b,b.enemy,b.hero,move,c,false)*(active?1.5:1));
  const hit=E.battleStep(r,c);assert.equal(hit.guardianEffect,active?"Swarm":null);assert.equal(hit.ppSpent,1);
 }
});
test("wild combat remains identical with guardian rules enabled or absent",()=>{
 const r=battle(123);r.stageIndex=0;const b=legacy(r);
 for(let i=0;i<4;i++)assert.deepEqual(E.battleStep(r,c),E.battleStep(b,c));
 assert.deepEqual(r.hero,b.hero);assert.deepEqual(r.enemy,b.enemy);assert.equal(r.seed,b.seed);
});
test("guardian rules survive save/reload without rescaling HP or duplicating PP costs",()=>{
 for(const a of GUARDIANS){
  const r=battle(a.species);E.battleStep(r,c);const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  assert.ok(writeState(storage,E.baseMeta(),r));const loaded=readState(storage,c).run;assert.deepEqual(loaded,r);
  assert.deepEqual(E.battleStep(loaded,c),E.battleStep(r,c));assert.deepEqual(loaded,r);
 }
});
test("new guardian expeditions remain winnable for every starter through preparation",()=>{
 for(const id of [1,4,7,25,133,152]){const r=simulate(2026,id,{camp:"train"});assert.equal(r.phase,"complete");assert.equal(r.stage,15);assert.ok(r.actions<9*81);}
 // Scyther's low-HP burst makes preparation meaningful for this grass partner.
 assert.equal(simulate(2026,1).phase,"defeat");assert.equal(simulate(2026,1,{cache:"study"}).phase,"complete");
});
test("guardians use the same PP/damage rules during bounded away progression",()=>{
 for(const a of GUARDIANS){
  const r=battle(a.species),m=E.baseMeta();r.plan="warden";r.idleEnabled=true;
  const clone=structuredClone(r),meta=structuredClone(m);
  advanceIdle(r,m,c,MAX_IDLE_MS);advanceIdle(clone,meta,c,10000);advanceIdle(clone,meta,c,MAX_IDLE_MS);
  assert.deepEqual(clone,r);assert.deepEqual(meta,m);assert.ok(["complete","defeat"].includes(r.phase));assert.ok(validRun(r,c));
 }
});
