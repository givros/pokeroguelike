import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../engine.js';
import {chapterGraph,expeditionGraph} from '../route-graph.js';
import {planDecision,applyPlanDecision} from '../plans.js';
import {SKILLS,EQUIPMENT,unlockSkill,equipSkill,equipGear} from '../legacy.js';
import {validRun,normalizeMeta,readState,SAVE_KEY} from '../storage.js';
const c={pokemon:JSON.parse(readFileSync('data/pokemon.json')),moves:JSON.parse(readFileSync('data/moves.json'))};
test('random starts weight rarity, reach the full catalogue and only allow capture overrides', () => {
  const meta = E.baseMeta();
  const expected = Object.keys(c.pokemon).map(Number).sort((a, b) => a - b);
  const drawn = new Set();
  const counts = { common: 0, rare: 0, legendary: 0 };
  const samples = 131072;
  for (let sample = 1; sample <= samples; sample++) {
    const seed = Math.imul(sample, 0x9e3779b9) >>> 0;
    const id = E.startingPartner(meta, seed, c);
    drawn.add(id);
    counts[c.pokemon[id].rarity]++;
  }
  for (const [tier, chance] of Object.entries(E.captureEncounterOdds(0))) {
    assert.ok(Math.abs(counts[tier] / samples - chance) < 0.003, `Unexpected ${tier} frequency`);
  }
  assert.deepEqual([...drawn].sort((a, b) => a - b), expected);
  for (const id of drawn) assert.ok(validRun(make(id).run, c), `Starter ${id} must be resumable`);
  const random = E.startingPartner(meta, 6, c);
  meta.startingPartner = 150;
  assert.equal(E.startingPartner(meta, 6, c), random);
  meta.captured[150] = 1;
  assert.equal(E.startingPartner(meta, 6, c), 150);
  meta.startingPartner = null;
  assert.equal(E.startingPartner(meta, 6, c), random);
});
function make(id=133,seed=2026,meta=E.baseMeta()){const run=E.createRun(id,meta,c,seed);E.enableEndless(run,meta);return{run,meta};}
function step(r){r.pendingGrowth=null;r.pendingAwakenings=[];const d=planDecision(r);if(d)return applyPlanDecision(r,d,c);if(r.phase==='arrival')return E.activateStage(r,c);if(r.phase==='battle')return E.battleStep(r,c);if(r.phase==='victoryBeat')return E.depart(r);if(r.phase==='evolution')return E.chooseEvolution(r,134,c);throw Error(r.phase);}
function play(id=133,seed=24){const state=make(id,seed);state.run.plan='predator';let steps=0;while(!['defeat','complete'].includes(state.run.phase)&&steps++<6000){step(state.run);assert.ok(validRun(state.run,c),`${state.run.phase}/${state.run.stageIndex}`);}assert.equal(state.run.phase,'defeat');assert.ok(steps<6000);E.settle(state.run,state.meta);assert.ok(validRun(state.run,c));return state;}
test('endless starters offer every useful boon and expand old starter saves without changing RNG', () => {
  const {run,meta} = make(7);
  const expected = E.BONUSES.filter(boon => boon.id !== 'pp_boost').map(boon => boon.id).sort();
  assert.deepEqual([...run.offers].sort(), expected);
  assert.ok(validRun(run,c));

  const old = {...run,offers:run.offers.slice(0,3)};
  const saved = {getItem:key=>key===SAVE_KEY ? JSON.stringify({version:3,meta,run:old}) : null};
  const resumed = readState(saved,c).run;
  assert.deepEqual(resumed.offers,run.offers);
  assert.equal(resumed.seed,run.seed);
  const last = resumed.offers.at(-1);
  assert.ok(E.selectBonus(resumed,last));
  assert.equal(E.count(resumed,last),1);
  assert.equal(E.selectBonus(resumed,last),false);
});
test('starter specializations affect real damage calculations and stay out of later offers', () => {
  const {run} = make(7);
  assert.equal(run.offers.length,27);
  const water = c.moves[55], tackle = c.moves[33];
  const attacker = E.fighter(7,10,c);
  const fire = E.fighter(4,10,c), waterTarget = E.fighter(7,10,c);
  const cases = [
    ['iron_fist',tackle,attacker,fire,true,1.30],
    ['mind_focus',water,attacker,fire,true,1.30],
    ['wide_arsenal',tackle,attacker,fire,true,1.35],
    ['type_hunter',water,attacker,fire,true,1.30],
    ['armor_breaker',water,attacker,waterTarget,true,1.60],
    ['swift_opening',water,attacker,fire,true,1.40],
    ['finisher',water,attacker,{...fire,hp:1},true,1.35],
    ['last_stand',water,{...attacker,hp:1},fire,true,1.40],
    ['glass_cannon',water,attacker,fire,true,1.28],
    ['iron_hide',tackle,fire,attacker,false,0.75],
    ['mind_veil',water,fire,attacker,false,0.75],
    ['guardian_hunter',water,attacker,fire,true,1.15,3],
  ];
  for (const [id,move,a,d,player,multiplier,stageIndex=0] of cases) {
    const state = {...run,stageIndex,bonuses:[],battleActions:0};
    const baseline = E.expectedDamage(state,a,d,move,c,player);
    const changed = E.expectedDamage({...state,bonuses:[id]},a,d,move,c,player);
    assert.ok(Math.abs(changed / baseline - multiplier)<1e-10,id);
  }
  for (const phase of ['reward','shrine']) {
    const state = {...run,phase,offers:['glass_cannon']};
    assert.equal(E.canSelectBonus(state,'glass_cannon'),false);
    assert.ok(E.offerBonuses(state).every(id=>!E.BONUSES.find(boon=>boon.id===id).starterOnly));
  }
});
test('starter barrier, training, reserves and capture expertise apply through the expedition', () => {
  function encounter(boon, row=0) {
    const {run} = make(7,1041);
    assert.ok(E.selectBonus(run,boon));
    run.stageIndex=run.branchStart=row;
    assert.ok(E.selectRoute(run,`${row}-0`,c));
    assert.ok(E.activateStage(run,c));
    return run;
  }
  const shield = encounter('trail_barrier');
  assert.equal(shield.hero.shield,Math.ceil(shield.hero.maxHp*.20));
  const scholar = encounter('field_scholar');
  scholar.enemy.hp=1;
  E.battleStep(scholar,c);
  assert.equal(scholar.hero.level,6);
  const supplies = encounter('spare_pp');
  supplies.hero.moves.forEach(slot=>{slot.pp=5;});
  const used = E.bestMove(supplies,c).id;
  supplies.enemy.hp=1;
  E.battleStep(supplies,c);
  assert.equal(supplies.hero.moves.find(slot=>slot.id===used).pp,8);
  const control = encounter('defense_boost',1);
  const expert = encounter('ball_handler',1);
  for (const run of [control,expert]) {
    run.enemy.hp=1;
    E.battleStep(run,c);
    assert.equal(run.phase,'capture');
  }
  assert.equal(expert.enemy.id,control.enemy.id);
  assert.equal(expert.pendingCapture.chance,Math.min(.85,control.pendingCapture.chance+.15));
});
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
 const {run,meta}=make(7,1);
 E.selectBonus(run,run.offers[0]);
 run.stageIndex=run.branchStart=1;
 assert.ok(E.selectRoute(run,'1-0',c));
 E.activateStage(run,c);
 run.enemy.hp=1;
 E.battleStep(run,c);
 assert.equal(run.phase,'capture');
 assert.ok(E.skipCapture(run));
 run.phase='retired';
 E.settle(run,meta);
 assert.deepEqual(meta.captured,{});
});
test('rare and legendary encounters become more frequent with depth and stay capped', () => {
  const opening = E.captureEncounterOdds(0);
  const middle = E.captureEncounterOdds(15);
  const late = E.captureEncounterOdds(30);
  for (const tier of ['rare', 'legendary']) {
    assert.ok(opening[tier] > 0 && opening[tier] < middle[tier] && middle[tier] < late[tier]);
  }
  assert.deepEqual(E.captureEncounterOdds(300), late);
  assert.ok(late.common > late.rare && late.rare > late.legendary);
});
test('Pokéball encounters can reveal, capture and save every catalogue species at its rarity rate', () => {
  const {run} = make(7);
  E.selectBonus(run, run.offers[0]);
  run.stageIndex = 1;
  run.branchStart = 1;
  assert.ok(E.selectRoute(run, '1-0', c));
  assert.equal(E.stage(run).kind, 'capture');
  assert.equal(run.enemy, null);
  run.hero.moves.forEach(move => { move.pp = 0; });

  const expected = Object.keys(c.pokemon).map(Number);
  const caught = new Set();
  const captureChances = { common: 0.70, rare: 0.45, legendary: 0.25 };
  for (let sample = 1; sample <= 131072 && caught.size < expected.length; sample++) {
    const encounter = structuredClone(run);
    encounter.seed = Math.imul(sample, 0x9e3779b9) >>> 0;
    assert.ok(E.activateStage(encounter, c));
    const id = encounter.enemy.id;
    if (caught.has(id)) continue;
    assert.ok(validRun(encounter, c), `Battle with ${id} must be resumable`);
    encounter.enemy.hp = 1;
    E.battleStep(encounter, c);
    assert.equal(encounter.phase, 'capture');
    assert.equal(encounter.pendingCapture.chance, captureChances[c.pokemon[id].rarity]);
    encounter.seed = 1; // Make the single attempt succeed for each species.
    assert.ok(E.attemptCapture(encounter, c).caught);
    assert.ok(validRun(encounter, c), `Capture of ${id} must be resumable`);
    encounter.phase = 'retired';
    const meta = E.baseMeta();
    E.settle(encounter, meta);
    const restored = normalizeMeta(meta);
    assert.equal(restored.captured[id], 1);
    restored.startingPartner = id;
    assert.equal(E.startingPartner(restored, 1, c), id);
    caught.add(id);
  }
  assert.deepEqual([...caught].sort((a, b) => a - b), expected);
});
test('legacy migration does not duplicate a carried bank and malformed endless saves are rejected without throwing',()=>{
 const m=E.baseMeta();m.gold=1000;const r=E.createRun(4,m,c,2026);E.selectBonus(r,r.offers[0]);r.coins=900;E.enableEndless(r,m);assert.equal(r.proceduralFromChapter,1);r.phase='retired';E.settle(r,m);assert.equal(m.gold,900);assert.ok(validRun(r,c));
 for(const change of [{discoveryLedger:{1:null}},{captures:[]},{salvage:{bogus:1}},{gear:{id:'charm',tier:99}},{pendingCapture:{id:1,chance:2}}]){const malformed={...r,...change};assert.doesNotThrow(()=>validRun(malformed,c));assert.equal(validRun(malformed,c),false);}
});
