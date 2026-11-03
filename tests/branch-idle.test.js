import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../engine.js';
import {advanceIdle,MAX_IDLE_MS} from '../idle.js';
import {validRun} from '../storage.js';
const catalogue={pokemon:JSON.parse(readFileSync('data/pokemon.json')),moves:JSON.parse(readFileSync('data/moves.json'))};
function expedition(starter,plan,threat){const meta=E.baseMeta();meta.language='fr';meta.unlockedThreat=6;meta.selectedThreat=threat;const run=E.createRun(starter,meta,catalogue,2026);E.enableBranching(run);Object.assign(run,{plan,idleEnabled:true});return{run,meta};}
test('branching absence is deterministic across saved intervals for all partners, strategies and normal/highest threats',()=>{
 for(const starter of [1,4,7,25,133,152])for(const plan of ['predator','warden','siphon'])for(const threat of [0,6]){
  const a=expedition(starter,plan,threat),b=structuredClone(a),intervals=[137,4863,1100,1500,700,3200,8500];
  advanceIdle(a.run,a.meta,catalogue,60000);let left=60000,i=0;
  while(left){const elapsed=Math.min(left,intervals[i++%intervals.length]);advanceIdle(b.run,b.meta,catalogue,elapsed);left-=elapsed;assert.ok(validRun(b.run,catalogue));}
  assert.deepEqual(b,a,`${starter}/${plan}/${threat}: split time must retain identical path, RNG, HP, PP, loot and settlement`);
  advanceIdle(a.run,a.meta,catalogue,MAX_IDLE_MS);assert.ok(['complete','defeat','evolution'].includes(a.run.phase));assert.ok(validRun(a.run,catalogue));
  if(a.run.phase!=='evolution'){assert.equal(a.meta.totalRuns,1);const saved=structuredClone(a);assert.equal(advanceIdle(a.run,a.meta,catalogue,MAX_IDLE_MS),null);assert.deepEqual(a,saved);}
 }
});
test('branching Eevee waits indefinitely for the human choice, then resumes the selected encounter exactly once',()=>{
 const state=expedition(133,'predator',0),{run,meta}=state;advanceIdle(run,meta,catalogue,MAX_IDLE_MS);assert.equal(run.phase,'evolution');const path=[...run.branchPath],saved=structuredClone(state);
 assert.equal(advanceIdle(run,meta,catalogue,MAX_IDLE_MS),null);assert.deepEqual(state,saved);assert.ok(E.chooseEvolution(run,135,catalogue));assert.deepEqual(run.branchPath,path);
 advanceIdle(run,meta,catalogue,MAX_IDLE_MS);assert.ok(['complete','defeat'].includes(run.phase));assert.equal(meta.totalRuns,1);assert.ok(validRun(run,catalogue));assert.equal(run.hero.id,135);
});
