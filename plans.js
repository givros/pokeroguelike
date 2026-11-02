import * as E from "./engine.js";
import { SYNERGIES } from "./builds.js";
export const PLANS = [
  { id:"manual", name:"Manual decisions", asset:"trail-sign", text:"Choose every boon, spring action and merchant purchase yourself." },
  { id:"predator", name:"Predator", asset:"flurry-talons", recipe:"flurry", priorities:["attack_boost","crit_chance","type_boost","momentum","lifesteal","regeneration","defense_boost"], text:"Pursue Windscar Talons, then damage and sustain. Train at healthy springs; scout once training is no longer needed." },
  { id:"warden", name:"Warden", asset:"briar-bulwark", recipe:"bulwark", priorities:["defense_boost","first_guard","hp_boost","regeneration","attack_boost","lifesteal"], text:"Pursue Briar Bulwark, then resilience and recovery. Scout at healthy springs for a safer opening strike." },
  { id:"siphon", name:"Siphon", asset:"lifebloom-vessel", recipe:"lifebloom", priorities:["lifesteal","regeneration","hp_boost","attack_boost","defense_boost","first_guard"], text:"Pursue Lifebloom Vessel, then healing and maximum HP. Train at healthy springs to grow your recovery capacity." },
];
export function planDecision(run) {
  const plan = PLANS.find(p=>p.id===run.plan);
  if (!plan || plan.id==="manual") return null;
  const health = run.hero.hp/run.hero.maxHp;
  const depleted = run.hero.moves.some(s=>s.pp<=Math.ceil(s.maxPp*.2));
  if (["starter","reward","shrine"].includes(run.phase)) {
    const recipe = SYNERGIES.find(r=>r.id===plan.recipe);
    const missing = Object.entries(recipe.requires).filter(([id,n])=>E.count(run,id)<n).map(([id])=>id);
    const order = [...missing,...plan.priorities,"focus_crit","pp_boost","gold_boost"];
    const offers = [...run.offers].sort((a,b)=>{
      const score=id=>{const i=order.indexOf(id); return i<0?100:i;};
      return score(a)-score(b);
    });
    if (offers.length) return {action:"bonus",value:offers[0]};
    return run.phase==="shrine" ? {action:"encounter",value:"leave"} : null;
  }
  if (run.phase==="camp") return {action:"encounter",value:health<.7||depleted?"rest":plan.id==="warden"|| (plan.id==="predator"&&run.hero.level>=11)?"scout":"train"};
  if (run.phase==="cache") return {action:"encounter",value:health<.6?"heal":"gold"};
  if (run.phase==="shop") {
    if ((health<.55||depleted)&&run.coins>=85&&E.needsRecovery(run)) return {action:"buy",value:"full_heal"};
    if (health<.65&&run.coins>=30) return {action:"buy",value:"potion"};
    const key = plan.id==="warden"?"guard":"force", item=E.SHOP_ITEMS[key];
    const cap=E.BONUSES.find(b=>b.id===item.bonus).max;
    if (run.coins>=item.cost+30&&E.count(run,item.bonus)<cap) return {action:"buy",value:key};
    return {action:"leave"};
  }
  return null;
}
export function applyPlanDecision(run, decision, catalogue) {
  if (!decision) return false;
  if (decision.action==="bonus") return E.selectBonus(run,decision.value);
  if (decision.action==="encounter") return E.resolveEncounter(run,decision.value,catalogue);
  if (decision.action==="buy") return E.buy(run,decision.value);
  if (decision.action==="leave"&&run.phase==="shop") return E.depart(run);
  return false;
}
