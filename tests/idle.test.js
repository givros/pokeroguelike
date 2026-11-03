import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../engine.js";
import { advanceIdle, MAX_IDLE_MS } from "../idle.js";
import { validRun } from "../storage.js";
const catalogue={pokemon:JSON.parse(readFileSync("data/pokemon.json")),moves:JSON.parse(readFileSync("data/moves.json"))};
const make=(starter=4)=>{const r=E.createRun(starter,E.baseMeta(),catalogue,2026);r.plan="predator";r.idleEnabled=true;return r;};
test("idle requires explicit enablement and an automatic plan",()=>{
 for(const change of [{idleEnabled:false},{plan:"manual"}]){
  const r=Object.assign(make(),change), before=structuredClone(r);
  assert.equal(advanceIdle(r,E.baseMeta(),catalogue,MAX_IDLE_MS),null);assert.deepEqual(r,before);
 }
});
test("partial idle time carries forward without gaining an action early",()=>{
 const r=make(),m=E.baseMeta();
 assert.equal(advanceIdle(r,m,catalogue,500),null);assert.equal(r.idleCredit,500);assert.equal(r.phase,"starter");
 const result=advanceIdle(r,m,catalogue,600);assert.equal(result.transitions,1);assert.equal(r.idleCredit,0);assert.equal(r.phase,"travel");
});
test("idle uses identical seeded decisions and settles once at a finite ending",()=>{
 const r=make(),m=E.baseMeta(), clone=structuredClone(r),other=E.baseMeta();
 const report=advanceIdle(r,m,catalogue,MAX_IDLE_MS);
 assert.deepEqual(advanceIdle(clone,other,catalogue,MAX_IDLE_MS),report);assert.deepEqual(clone,r);assert.deepEqual(other,m);
 assert.equal(r.phase,"complete");assert.ok(r.settled);assert.ok(report.transitions<2000);assert.equal(validRun(r,catalogue),true);
 const before={r:structuredClone(r),m:structuredClone(m)};
 assert.equal(advanceIdle(r,m,catalogue,MAX_IDLE_MS),null);assert.deepEqual({r,m},before);
});
test("Eevee waits for the player's evolution choice and does not spend remaining time",()=>{
 const r=make(133),m=E.baseMeta();const report=advanceIdle(r,m,catalogue,MAX_IDLE_MS);
 assert.equal(report.waitingForEvolution,true);assert.equal(r.hero.id,133);assert.equal(r.phase,"evolution");assert.equal(r.idleCredit,0);
 const before=structuredClone(r);assert.equal(advanceIdle(r,m,catalogue,MAX_IDLE_MS),null);assert.deepEqual(r,before);
});
test("idle time caps at eight hours and invalid or reversed time cannot progress",()=>{
 const r=make(),before=structuredClone(r);
 assert.equal(advanceIdle(r,E.baseMeta(),catalogue,-100),null);assert.deepEqual(r,{...before,idleCredit:0});
 const a=make(),b=make();
 assert.deepEqual(advanceIdle(a,E.baseMeta(),catalogue,Infinity),null);
 assert.deepEqual(advanceIdle(a,E.baseMeta(),catalogue,MAX_IDLE_MS*100),advanceIdle(b,E.baseMeta(),catalogue,MAX_IDLE_MS));
});
test("splitting absence into saved intervals preserves HP, RNG, PP, rewards and choices",()=>{
 const a=make(),b=make(),ma=E.baseMeta(),mb=E.baseMeta();
 advanceIdle(a,ma,catalogue,60000);
 for(let i=0;i<60;i++)advanceIdle(b,mb,catalogue,1000);
 assert.deepEqual(b,a);assert.deepEqual(mb,ma);
});

test("idle seeds across all partners remain bounded and valid, including partial absences",()=>{
 for(const starter of [1,4,7,25,133,152])for(let seed=1;seed<=100;seed++){
  const r=make(starter);r.seed=seed*9001;r.initialSeed=r.seed;
  const result=advanceIdle(r,E.baseMeta(),catalogue,seed%2?50000:MAX_IDLE_MS);
  assert.equal(validRun(r,catalogue),true,`${starter}/${seed}`);
  assert.ok(!result||result.transitions<2000);
 }
});

test('away challenge progression uses the same seeded combat, threat rewards and terminal settlement',()=>{
 const r=make();r.threat=4;const m=E.baseMeta();
 const report=advanceIdle(r,m,catalogue,MAX_IDLE_MS);assert.ok(['complete','defeat'].includes(report.outcome));assert.equal(r.settled,true);
 assert.equal(m.expeditionHistory[0].threat,4);assert.equal(validRun(r,catalogue),true);
 const before={run:structuredClone(r),meta:structuredClone(m)};advanceIdle(r,m,catalogue,MAX_IDLE_MS);assert.deepEqual({run:r,meta:m},before);
});
