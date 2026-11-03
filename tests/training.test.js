import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../engine.js';
import {simulate} from '../tools/simulate.mjs';
const catalogue={pokemon:JSON.parse(readFileSync('data/pokemon.json')),moves:JSON.parse(readFileSync('data/moves.json'))};
const cache=starter=>simulate(2026,starter,{stopAt:r=>r.stageIndex===2&&r.phase==='cache'}).run;
test('field-note preview is pure and agrees with actual native growth without granting cache gold or full healing',()=>{
 const r=cache(1);r.hero.hp=20;const before=structuredClone(r),preview=E.previewTraining(r,catalogue);
 assert.deepEqual(r,before);assert.equal(preview.level,7);assert.ok(preview.moves.includes('Sludge Bomb'));
 assert.equal(E.resolveEncounter(r,'study',catalogue),true);
 assert.equal(r.hero.level,preview.level);assert.equal(r.hero.maxHp-before.hero.maxHp,preview.maxHpGain);
 assert.equal(r.hero.hp,25);assert.equal(r.coins,before.coins);assert.equal(r.phase,'travel');assert.equal(r.stageIndex,3);
 assert.ok(r.hero.moves.some(m=>m.id===188));
 const snapshot=structuredClone(r);assert.equal(E.resolveEncounter(r,'study',catalogue),false);assert.deepEqual(r,snapshot);
});
test('study requires the catalogue atomically and preserves remaining PP on retained moves',()=>{
 const r=cache(7);r.hero.moves[0].pp=1;const before=structuredClone(r);
 assert.equal(E.resolveEncounter(r,'study'),false);assert.deepEqual(r,before);
 E.resolveEncounter(r,'study',catalogue);
 for(const old of before.hero.moves){const retained=r.hero.moves.find(m=>m.id===old.id);if(retained)assert.equal(retained.pp,old.pp);}
});
test('studying at an evolution threshold triggers the earned form or the player Eevee choice',()=>{
 const r=cache(152),preview=E.previewTraining(r,catalogue);assert.equal(preview.speciesId,153);
 E.resolveEncounter(r,'study',catalogue);assert.equal(r.hero.id,153);assert.deepEqual(r.pendingGrowth,{fromId:152,toId:153});
 const eevee=cache(133);assert.equal(E.previewTraining(eevee,catalogue).evolutionChoice,true);
 E.resolveEncounter(eevee,'study',catalogue);eevee.travelProgress=1;E.arrive(eevee,catalogue);
 assert.equal(eevee.phase,'evolution');assert.equal(eevee.hero.id,133);
});
test('the early study choice changes a real seeded Bulbasaur expedition outcome',()=>{
 const healed=simulate(9001,1,{cache:'heal'}),studied=simulate(9001,1,{cache:'study'});
 assert.equal(healed.phase,'defeat');assert.equal(studied.phase,'complete');
 assert.ok(studied.run.log.some(line=>line.includes('Sludge Bomb')));
});

test('training at the level cap cannot invalidate or consume the saved encounter',()=>{
 for(const [phase,choice,stage] of [['cache','study',2],['camp','train',4]]){
  const r=cache(1);r.hero.level=100;r.phase=phase;r.stageIndex=stage;
  const before=structuredClone(r);assert.equal(E.previewTraining(r,catalogue).maxHpGain,0);
  assert.equal(E.resolveEncounter(r,choice,catalogue),false);assert.deepEqual(r,before);
 }
});
