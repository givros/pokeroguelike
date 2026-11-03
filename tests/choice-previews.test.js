import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as E from "../engine.js";
import {simulate} from "../tools/simulate.mjs";
const c={pokemon:JSON.parse(readFileSync("data/pokemon.json")),moves:JSON.parse(readFileSync("data/moves.json"))};
function fixture(phase){const r=simulate(2026,4,{stopAt:r=>r.phase===phase}).run;r.pendingGrowth=null;r.pendingAwakenings=[];return r;}
function matches(preview,r){
 assert.equal(preview.hp,r.hero.hp);assert.equal(preview.maxHp,r.hero.maxHp);assert.equal(preview.gold,r.coins);
}
test("reading every offered boon preview repeatedly cannot change resources, RNG or progression",()=>{
 for(const phase of ["starter","reward","shrine"]){
  const r=fixture(phase),before=structuredClone(r);
  for(let i=0;i<20;i++)for(const id of r.offers){const preview=E.previewBonus(r,id);assert.ok(preview);const next=structuredClone(r);assert.ok(E.selectBonus(next,id));matches(preview,next);}
  assert.deepEqual(r,before);
 }
});
test("Endurance preview includes the original-maximum offering cost and compounded HP gain",()=>{
 const r=fixture("shrine");Object.assign(r,{bonuses:[],offers:["hp_boost"]});r.hero.hp=r.hero.maxHp=90;
 E.setShrineOffering(r,true);const before=structuredClone(r),preview=E.previewBonus(r,"hp_boost");
 assert.equal(preview.maxHp,130);assert.equal(preview.hp,107);assert.equal(preview.hpChange,17);assert.equal(preview.maxHpChange,40);assert.equal(preview.rank,2);assert.deepEqual(r,before);
 E.selectBonus(r,"hp_boost");matches(preview,r);
});
test("Second Wind preview counts the HP actually recovered and missing PP, including caps",()=>{
 for(const missing of [1,15,60]){
  const r=fixture("reward");r.offers=["pp_boost"];r.bonuses=[];r.hero.maxHp=90;r.hero.hp=90-missing;
  r.hero.moves.forEach(slot=>slot.pp=Math.max(0,slot.maxPp-3));const pp=r.hero.moves.reduce((sum,s)=>sum+s.maxPp-s.pp,0);
  const preview=E.previewBonus(r,"pp_boost");assert.equal(preview.hpChange,Math.min(missing,18));assert.equal(preview.ppRestored,pp);
  E.selectBonus(r,"pp_boost");matches(preview,r);
 }
});
test("previews announce only newly completed relic recipes",()=>{
 const r=fixture("reward");r.bonuses=["attack_boost","crit_chance"];r.offers=["attack_boost"];
 assert.deepEqual(E.previewBonus(r,"attack_boost").awakens,["flurry"]);
 r.bonuses.push("attack_boost");assert.deepEqual(E.previewBonus(r,"attack_boost").awakens,[]);
 r.bonuses.push("attack_boost");assert.equal(E.previewBonus(r,"attack_boost"),null);
});
test("merchant previews match real healing, exact prices, ranks and awakening without spending",()=>{
 for(const key of Object.keys(E.SHOP_ITEMS)){
  const r=fixture("shop");r.coins=200;r.bonuses=["attack_boost","crit_chance","defense_boost","first_guard"];
  r.hero.hp=Math.ceil(r.hero.maxHp*.8);r.hero.moves.forEach(s=>s.pp=1);
  const before=structuredClone(r),preview=E.previewPurchase(r,key);assert.ok(preview);assert.equal(preview.gold,200-E.SHOP_ITEMS[key].cost);
  if(key==="force")assert.deepEqual(preview.awakens,["flurry"]);
  if(key==="guard")assert.deepEqual(preview.awakens,["bulwark"]);
  assert.deepEqual(r,before);assert.equal(E.buy(r,key),true);matches(preview,r);
 }
});
test("unavailable previews preserve state, while PP-only full recovery remains available",()=>{
 const r=fixture("shop");r.hero.hp=r.hero.maxHp;r.hero.moves.forEach(s=>s.pp=s.maxPp);
 const before=structuredClone(r);assert.equal(E.previewPurchase(r,"potion"),null);assert.equal(E.previewPurchase(r,"full_heal"),null);assert.equal(E.previewPurchase(r,"unknown"),null);assert.deepEqual(r,before);
 r.hero.moves[0].pp--;const preview=E.previewPurchase(r,"full_heal");assert.equal(preview.hpChange,0);assert.equal(preview.ppRestored,1);
 r.coins=0;assert.equal(E.previewPurchase(r,"force"),null);
 const s=fixture("shrine");s.offers=["first_guard","attack_boost"];E.setShrineOffering(s,true);const copy=structuredClone(s);
 assert.equal(E.previewBonus(s,"first_guard"),null);assert.equal(E.previewBonus(s,"unknown"),null);assert.deepEqual(s,copy);
});
