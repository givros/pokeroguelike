import { activeSynergies, awakenedBy } from "./builds.js";
import { guardianAbility } from "./guardians.js";
import {selectedRouteNode,routeOptions,enableRouteGraph} from './route-graph.js';
import {gearTier,awardLegacy,salvageEquipment} from './legacy.js';
import {STARTER_BOONS, equippedStarterBoon} from './starter-boons.js';

export const STAGES = [
  { kind: "wild", name: "Woodland Edge", pool: [10, 16, 19] },
  { kind: "wild", name: "Wildflower Meadow", pool: [23, 25, 43, 152] },
  { kind: "cache", name: "Forgotten Satchel" },
  { kind: "elite", name: "Untamed Grove", pool: [12, 58, 66] },
  { kind: "camp", name: "Wayfarer Spring" },
  { kind: "boss", name: "Grove Guardian", pool: [123] },
  { kind: "wild", name: "Rocky Shore Trail", pool: [27, 37, 50, 74, 95] },
  { kind: "shop", name: "Trailside Trading Post" },
  { kind: "elite", name: "Mistbound Passage", pool: [81, 92, 104, 111] },
  { kind: "shrine", name: "Clearing of the Ancients" },
  { kind: "wild", name: "Quiet Waters", pool: [39, 41, 52, 54, 63, 129, 147] },
  { kind: "cache", name: "Treasure Beneath the Leaves" },
  { kind: "elite", name: "The Last Mountain Pass", pool: [130, 131, 143, 149] },
  { kind: "camp", name: "The Threshold of Legend" },
  { kind: "boss", name: "The Legendary Guardian", pool: [150, 149, 131] },
];
export const REGIONS = [
  { id: "woodland", name: "Verdant Woodland", from: 0, to: 5, arena: "forest-arena" },
  { id: "lake", name: "Silvermist Lake", from: 6, to: 10, arena: "mist-lake-arena" },
  { id: "sanctuary", name: "Ancient Sanctuary", from: 11, to: 14, arena: "ancient-shrine-arena" },
];
export const region = (run) => REGIONS.find((r) =>
  (run.endless?run.stageIndex%STAGES.length:run.stageIndex) >= r.from && (run.endless?run.stageIndex%STAGES.length:run.stageIndex) <= r.to) || REGIONS[0];
export const BONUSES = [
  {
    id: "hp_boost",
    category: "defense",
    name: "Endurance",
    asset: "healing-berry",
    text: "Maximum HP +20%.",
    max: 3,
  },
  {
    id: "attack_boost",
    category: "offense",
    name: "Strength",
    asset: "attack-fang",
    text: "Attack and Special Attack +15%.",
    max: 3,
  },
  {
    id: "defense_boost",
    category: "defense",
    name: "Resilience",
    asset: "defense-shell",
    text: "Defense and Special Defense +15%.",
    max: 3,
  },
  {
    id: "crit_chance",
    category: "offense",
    name: "Precision",
    asset: "critical-lens",
    text: "Critical chance +10 percentage points.",
    max: 3,
  },
  {
    id: "type_boost",
    category: "offense",
    name: "Elemental Affinity",
    asset: "affinity-crystal",
    text: "Same-type attack bonus +20 percentage points.",
    max: 2,
  },
  {
    id: "regeneration",
    category: "defense",
    name: "Living Roots",
    asset: "living-roots",
    text: "Recover 10% maximum HP after every victory.",
    max: 2,
  },
  {
    id: "lifesteal",
    category: "defense",
    name: "Ravenous Fang",
    asset: "ravenous-fang-v2",
    text: "Heal for 15% of damage dealt.",
    max: 2,
  },
  {
    id: "first_guard",
    category: "defense",
    name: "Opening Guard",
    asset: "opening-guard",
    text: "Take 50% less damage from the first hit.",
    max: 1,
  },
  {
    id: "gold_boost",
    category: "expedition",
    name: "Lucky Charm",
    asset: "gold-coins",
    text: "Battle gold +30%.",
    max: 2,
  },
  {
    id: "momentum",
    category: "offense",
    name: "Wayfarer Momentum",
    asset: "wayfarer-spur",
    text: "Damage +3% per battle action, up to +30%.",
    max: 1,
  },
  {
    id: "pp_boost",
    category: "expedition",
    name: "Second Wind",
    asset: "healing-potion",
    text: "Restore all PP and recover 20% maximum HP.",
    max: 5,
  },
  {
    id: "focus_crit",
    category: "offense",
    name: "Guardian Eye",
    asset: "guardian-eye",
    text: "Critical hits deal 25% additional damage.",
    max: 1,
  },
  ...STARTER_BOONS,
];
export const UPGRADE_DEFS = {
  maxHpBonus: {
    name: "Vitality",
    asset: "healing-berry",
    text: "+5 starting HP per rank",
    cost: 100,
  },
  attackBonus: {
    name: "Power",
    asset: "attack-fang",
    text: "+3 Attack and Special Attack per rank",
    cost: 150,
  },
  defenseBonus: {
    name: "Protection",
    asset: "defense-shell",
    text: "+3 Defense and Special Defense per rank",
    cost: 150,
  },
  criticalChance: {
    name: "Instinct",
    asset: "critical-lens",
    text: "+5 percentage points of critical chance per rank",
    cost: 200,
  },
};
export const STRUGGLE = {
  id: 0,
  name: "Struggle",
  type: "neutral",
  power: 45,
  damageClass: "physical",
  pp: 999,
};
const CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
    steel: 2,
  },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  electric: {
    water: 2,
    electric: 0.5,
    grass: 0.5,
    ground: 0,
    flying: 2,
    dragon: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 0.5,
    ground: 2,
    flying: 2,
    dragon: 2,
    steel: 0.5,
  },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: {
    grass: 2,
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0,
    fairy: 2,
  },
  ground: {
    fire: 2,
    electric: 2,
    grass: 0.5,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
    steel: 2,
  },
  flying: {
    electric: 0.5,
    grass: 2,
    fighting: 2,
    bug: 2,
    rock: 0.5,
    steel: 0.5,
  },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: {
    fire: 2,
    ice: 2,
    fighting: 0.5,
    ground: 0.5,
    flying: 2,
    bug: 2,
    steel: 0.5,
  },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    ice: 2,
    rock: 2,
    steel: 0.5,
    fairy: 2,
  },
  fairy: {
    fire: 0.5,
    fighting: 2,
    poison: 0.5,
    dragon: 2,
    dark: 2,
    steel: 0.5,
  },
};
export const effectiveness = (type, types) =>
  types.reduce((n, t) => n * (CHART[type]?.[t] ?? 1), 1);
export const count = (run, id) => run.bonuses.filter((x) => x === id).length;
export const stage = (run) => selectedRouteNode(run,STAGES)?.stage || STAGES[run.endless?run.stageIndex%STAGES.length:run.stageIndex];
export const stageAt = (run,index) => selectedRouteNode(run,STAGES,index)?.stage || STAGES[run.endless?index%STAGES.length:index];
export const enableBranching = run => enableRouteGraph(run,STAGES);
export const routeChoices = run => routeOptions(run,STAGES);
export const needsRouteChoice = run => run.routeMode==='branching'&&run.phase==='travel'&&!selectedRouteNode(run,STAGES);
export function selectRoute(run,id,catalogue) {
 if(!needsRouteChoice(run)||run.pendingGrowth||run.pendingAwakenings?.length)return false;
 const node=routeChoices(run).find(node=>node.id===id);if(!node)return false;
 run.branchPath.push(id);run.landmark=null;run.travelProgress=1;
 if(run.endless&&run.branchPath.length>256){run.branchPath.shift();run.branchStart++;}
 addLog(run,`${node.stage.name} chosen.`);return arrive(run,catalogue);
}
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function random(run) {
  let x = run.seed;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  run.seed = x >>> 0;
  return run.seed / 4294967296;
}
export const MAX_THREAT = 6;
export function threatModifiers(run) {
  const tier = Number.isInteger(run.threat) ? clamp(run.threat, 0, MAX_THREAT) : 0;
  return { tier, enemyHp: 1 + tier * 0.2, enemyDamage: 1 + tier * 0.12, gold: 1 + tier * 0.2 };
}
export function chooseThreat(meta, tier) {
  if (!Number.isInteger(tier) || tier < 0 || tier > Math.min(MAX_THREAT, meta.unlockedThreat || 0)) return false;
  meta.selectedThreat = tier;
  return true;
}
export function baseMeta() {
  return {
    totalRuns: 0,
    bestScore: 0,
    totalVictories: 0,
    gold: 0,
    unlockedThreat: 0,
    selectedThreat: 0,
    permanentUpgrades: {
      maxHpBonus: 0,
      attackBonus: 0,
      defenseBonus: 0,
      criticalChance: 0,
    },
    sound: false,
    discoveries: {},
    expeditionHistory: [],
    battleSpeed: 1500,
    language: "en",
    legacyMarks:0,bestDepth:0,learnedSkills:[],equippedSkill:null,equipment:{},equippedGear:null,captured:{},startingPartner:null,
    unlockedStarters: {
      1: true,
      4: true,
      7: true,
      25: false,
      133: false,
      152: false,
    },
  };
}
export function addLog(run, text) {
  run.log.push(text);
  run.log = run.log.slice(-60);
}
export function fighter(id, level, catalogue, upgrades = {}) {
  const s = catalogue.pokemon[id];
  if (!s) throw new Error("Unknown species " + id);
  const hp =
    Math.floor((2 * s.stats.hp * level) / 100 + level + 10) +
    40 +
    (upgrades.maxHpBonus || 0) * 5;
  const candidates = Object.values(catalogue.moves).filter(
    (m) =>
      s.learnset?.includes(m.id) &&
      m.power > 0 &&
      m.damageClass !== "status" &&
      (level >= 7 || m.power <= 65),
  );
  candidates.sort(
    (a, b) =>
      (s.types.includes(b.type) ? 100 : 0) +
      b.power -
      ((s.types.includes(a.type) ? 100 : 0) + a.power),
  );
  const selected = [],
    types = new Set();
  for (const m of candidates)
    if (!types.has(m.type)) {
      selected.push(m);
      types.add(m.type);
      if (selected.length === 4) break;
    }
  for (const m of candidates)
    if (selected.length < 4 && !selected.some((x) => x.id === m.id))
      selected.push(m);
  if (!selected.length) selected.push(STRUGGLE);
  return {
    id,
    level,
    hp,
    maxHp: hp,
    moves: selected.map((m) => ({ id: m.id, pp: m.pp, maxPp: m.pp })),
    xp: 0,
    guardUsed: false,
    shield: 0,
  };
}
function eligibleBonuses(run, includeStarterOnly = false) {
  return BONUSES.filter(
    (b) =>
      (includeStarterOnly || !b.starterOnly) && count(run, b.id) < b.max &&
      (b.id !== "pp_boost" ||
        run.hero.hp < run.hero.maxHp ||
        run.hero.moves.some((s) => s.pp < (s.maxPp || 35))),
  );
 }
export function offerBonuses(run) {
  const candidates = eligibleBonuses(run);
  const chosen = [];
  while (candidates.length && chosen.length < 3) {
    chosen.push(
      candidates.splice(Math.floor(random(run) * candidates.length), 1)[0].id,
    );
  }
  return chosen;
}

export function expandStarterOffers(run) {
  if (!run.endless || run.phase !== "starter") return;
  const eligible = eligibleBonuses(run, true).map(bonus => bonus.id);
  run.offers = [...new Set([...run.offers, ...eligible])].filter(id => eligible.includes(id));
}
export function rerollCost(run) {
  return (run.rerolls || 0) >= 3 ? null : 20 + (run.rerolls || 0) * 15;
}
export function canReroll(run) {
  const cost = rerollCost(run);
  return ["reward", "shrine"].includes(run.phase) && cost !== null && run.coins >= cost &&
    eligibleBonuses(run).some((bonus) => !run.offers.includes(bonus.id));
}
export function rerollBonuses(run) {
  if (!canReroll(run)) return false;
  const cost = rerollCost(run), old = [...run.offers];
  const alternatives = eligibleBonuses(run).filter((bonus) => !old.includes(bonus.id));
  const guaranteed = alternatives[Math.floor(random(run) * alternatives.length)].id;
  const next = offerBonuses(run).filter((id) => id !== guaranteed).slice(0, 2);
  run.offers = [guaranteed, ...next];
  if (run.shrineEmpowered && !run.offers.some((id) => canEmpowerBonus(run, id))) run.shrineEmpowered = false;
  run.coins -= cost;
  run.rerolls = (run.rerolls || 0) + 1;
  addLog(run, `Reforged the offered boons for ${cost} gold. ${3 - run.rerolls} reforges remain.`);
  return true;
}
export function createRun(id, meta, catalogue, seed = Date.now()) {
  const run = {
    version: 3,
    id: String(seed) + "-" + id,
    seed: seed >>> 0 || 1,
    initialSeed: seed >>> 0 || 1,
    starterId: id,
    threat: clamp(Math.floor(meta.selectedThreat || 0), 0, Math.min(MAX_THREAT, meta.unlockedThreat || 0)),
    partnerForms: [id],
    phase: "starter",
    stageIndex: 0,
    routeMode: "regional",
    guardianAbilities: true,
    travelProgress: 0,
    hero: fighter(id, 5, catalogue, meta.permanentUpgrades),
    enemy: null,
    bonuses: [],
    offers: [],
    rerolls: 0,
    plan: "manual",
    pendingReward: false,
    coins: meta.gold,
    wins: 0,
    actions: 0,
    battleActions: 0,
    nextSide: "ally",
    settled: false,
    log: ["A new expedition begins."],
    stats: { damage: 0, healing: 0, criticals: 0, encounters: 0, shielding: 0, absorbed: 0, reflected: 0 },
    pendingAwakenings: [],
    encounters: [],
    upgrades: { ...meta.permanentUpgrades },
  };
  run.hero.maxHp += 25;
  run.hero.hp += 25;
  run.offers = offerBonuses(run);
  return run;
}
export function enableEndless(run,meta){
 if(!run||run.endless||['complete','defeat','retired'].includes(run.phase))return false;
 enableBranching(run);const fresh=run.phase==='starter'&&run.stageIndex===0;
 run.endless=true;run.proceduralFromChapter=fresh?0:1;run.salvage={};run.captures={};run.discoveryLedger={};
 run.carriedBank=!fresh;
 for(const encounter of run.encounters||[]){const record=run.discoveryLedger[encounter.id]||={seen:0,defeated:0};record.seen++;if(encounter.won)record.defeated++;}
 run.skill=fresh?meta.equippedSkill||null:null;
 run.gear=fresh&&meta.equippedGear?{id:meta.equippedGear,tier:meta.equipment[meta.equippedGear]}:null;
 if(fresh){run.coins=0;const hp=8*gearTier(run,'charm');run.hero.maxHp+=hp;run.hero.hp+=hp;}
 if (fresh) expandStarterOffers(run);
 return true;
}
export function selectedStartingPartner(meta, catalogue) {
  const id = Number(meta.startingPartner);
  return meta.captured?.[id] > 0 && catalogue.pokemon[id] ? id : null;
}

const captureRates = { common: 0.70, rare: 0.45, legendary: 0.25 };
const speciesPools = new WeakMap();

export function captureEncounterOdds(stageIndex) {
  const progress = clamp(stageIndex / 30, 0, 1);
  const rare = 0.12 + 0.23 * progress;
  const legendary = 0.01 + 0.14 * progress;
  return { common: 1 - rare - legendary, rare, legendary };
}

export function drawCatalogueSpecies(catalogue, fraction, stageIndex = 0) {
  let pools = speciesPools.get(catalogue.pokemon);
  if (!pools) {
    pools = { common: [], rare: [], legendary: [] };
    for (const species of Object.values(catalogue.pokemon)) {
      (pools[species.rarity] ?? pools.common).push(species.id);
    }
    speciesPools.set(catalogue.pokemon, pools);
  }

  const available = Object.entries(captureEncounterOdds(stageIndex))
    .filter(([rarity]) => pools[rarity].length > 0);
  const total = available.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = fraction * total;
  for (const [rarity, weight] of available) {
    const pool = pools[rarity];
    if (roll < weight) return pool[Math.floor(roll / weight * pool.length)];
    roll -= weight;
  }
  // Floating-point rounding can put the roll exactly at the upper boundary.
  return pools[available.at(-1)[0]].at(-1);
}

export function randomStartingPartner(seed, catalogue) {
  return drawCatalogueSpecies(catalogue, random({ seed: seed >>> 0 || 1 }));
}

export function startingPartner(meta, seed, catalogue) {
  return selectedStartingPartner(meta, catalogue) ?? randomStartingPartner(seed, catalogue);
}
export const depthPressure = run => run.endless?{hp:1.18+run.stageIndex*.045,damage:1.12+run.stageIndex*.035}:{hp:1,damage:1};
function grantBonus(run, id) {
  const b = BONUSES.find((b) => b.id === id);
  if (!b || count(run, id) >= b.max) return false;
  const awakened = awakenedBy(run, id);
  run.bonuses.push(id);
  addLog(run, b.name + " acquired.");
  if (id === "hp_boost") {
    const amount = Math.ceil(run.hero.maxHp * 0.2);
    run.hero.maxHp += amount;
    run.hero.hp += amount;
  }
  if (id === "pp_boost") {
    run.hero.moves.forEach((m) => (m.pp = m.maxPp || 35));
    run.hero.hp = Math.min(
      run.hero.maxHp,
      run.hero.hp + Math.ceil(run.hero.maxHp * 0.2),
    );
  }
  for (const recipe of awakened) {
    run.pendingAwakenings = [...new Set([...(run.pendingAwakenings || []), recipe.id])];
    addLog(run, recipe.name + " awakened!");
  }
  return true;
}
export function shrineOfferingCost(run) {
  return Math.ceil(run.hero.maxHp * 0.25);
}
export function canEmpowerBonus(run, id) {
  const boon = BONUSES.find((b) => b.id === id);
  return !!boon && id !== "pp_boost" && count(run, id) + 2 <= boon.max;
}
export function canOfferVitality(run) {
  return run.phase === "shrine" && run.hero.hp > shrineOfferingCost(run) &&
    run.offers.some((id) => canEmpowerBonus(run, id));
}
export function setShrineOffering(run, enabled) {
  if (run.phase !== "shrine" || typeof enabled !== "boolean" || (enabled && !canOfferVitality(run))) return false;
  run.shrineEmpowered = enabled;
  return true;
}
export function canSelectBonus(run, id) {
  const boon = BONUSES.find((b) => b.id === id);
  return ['starter', 'reward', 'shrine'].includes(run.phase) && run.offers.includes(id) &&
    !!boon && (!boon.starterOnly || run.endless && run.phase === "starter") &&
    count(run, id) < boon.max && (!run.shrineEmpowered ||
      (run.phase === "shrine" && canEmpowerBonus(run, id) && run.hero.hp > shrineOfferingCost(run)));
}
export function selectBonus(run, id) {
  if (!canSelectBonus(run, id)) return false;
  const empowered = !!run.shrineEmpowered;
  if (empowered) {
    const cost = shrineOfferingCost(run);
    run.hero.hp -= cost;
    addLog(run, `The shrine accepts ${cost} HP for two boon ranks.`);
  }
  grantBonus(run, id);
  if (empowered) grantBonus(run, id);
  run.shrineEmpowered = false;
  const previous = run.phase;
  run.offers = [];
  run.pendingReward = false;
  if (previous === "starter") {
    run.phase = "travel";
    run.travelProgress = 0;
    if (run.routeMode === "regional") run.regionEntry = region(run).id;
  } else if (previous === "reward") run.phase = "arrival";
  else depart(run);
  return true;
}
function choiceResult(before, after, id) {
  const existing = new Set(activeSynergies(before).map(recipe => recipe.id));
  return {
    hp:after.hero.hp, maxHp:after.hero.maxHp,
    hpChange:after.hero.hp-before.hero.hp,
    maxHpChange:after.hero.maxHp-before.hero.maxHp,
    ppRestored:after.hero.moves.reduce((sum,slot)=>sum+slot.pp,0)-before.hero.moves.reduce((sum,slot)=>sum+slot.pp,0),
    gold:after.coins, rank:id ? count(after,id) : null,
    awakens:activeSynergies(after).filter(recipe=>!existing.has(recipe.id)).map(recipe=>recipe.id),
  };
}
export function previewBonus(run, id) {
  if (!canSelectBonus(run,id)) return null;
  const next = structuredClone(run);
  selectBonus(next,id);
  return choiceResult(run,next,id);
}
export function arrive(run, catalogue) {
  if (run.phase !== "travel" || run.travelProgress < 1) return false;
  if(run.routeMode==='branching'&&!selectedRouteNode(run,STAGES))return false;
  run.regionEntry = null;
  if (run.pendingEvolution && run.hero.id === 133) {
    run.phase = "evolution";
    return true;
  }
  if (run.pendingReward) {
    run.phase = "reward";
    run.offers = offerBonuses(run);
    if (!run.offers.length) {
      run.pendingReward = false;
      run.phase = "arrival";
    }
  } else run.phase = "arrival";
  return true;
}
export function chooseEvolution(run, id, catalogue) {
  if (
    run.phase !== "evolution" ||
    !run.pendingEvolution ||
    run.hero.id !== 133 ||
    ![134, 135, 136].includes(id)
  )
    return false;
  run.hero.id = id;
  run.pendingGrowth = { fromId: 133, toId: id };
  if (run.partnerForms && !run.partnerForms.includes(id)) run.partnerForms.push(id);
  run.hero.maxHp += 18;
  run.hero.hp += 18;
  run.pendingEvolution = false;
  addLog(run, `${catalogue.pokemon[id].name} evolved!`);
  refreshMoves(run, catalogue);
  if (run.pendingReward) {
    run.offers = offerBonuses(run);
    run.phase = run.offers.length ? "reward" : "arrival";
  } else run.phase = "arrival";
  return true;
}
function refreshMoves(run, catalogue) {
  const previousMoves = run.hero.moves;
  const learned = fighter(run.hero.id, run.hero.level, catalogue).moves;
  run.hero.moves = learned.map((move) => ({
    ...move,
    pp: previousMoves.find((s) => s.id === move.id)?.pp ?? move.pp,
  }));
  for (const move of learned)
    if (!previousMoves.some((s) => s.id === move.id))
      addLog(
        run,
        `${catalogue.moves[move.id]?.name || STRUGGLE.name} learned!`,
      );
}
export function refreshGrowth(run, catalogue) {
  const previousId = run.hero.id;
  const evolutions = {
    1: [2, 8], 2: [3, 11], 4: [5, 8], 5: [6, 11],
    7: [8, 8], 8: [9, 11], 25: [26, 7],
    152: [153, 7], 153: [154, 10],
  };
  // Resolve each earned threshold once, including levels earned outside battle.
  let evolution = evolutions[run.hero.id];
  while (evolution && run.hero.level >= evolution[1]) {
    run.hero.id = evolution[0];
    if (run.partnerForms && !run.partnerForms.includes(run.hero.id))
      run.partnerForms.push(run.hero.id);
    run.hero.maxHp += 12;
    run.hero.hp += 12;
    addLog(run, `${catalogue.pokemon[run.hero.id].name} evolved!`);
    evolution = evolutions[run.hero.id];
  }
  if (run.hero.id === 133 && run.hero.level >= 7) run.pendingEvolution = true;
  if (run.hero.id !== previousId)
    run.pendingGrowth = { fromId: run.pendingGrowth?.fromId || previousId, toId: run.hero.id };
  refreshMoves(run, catalogue);
}
export function activateStage(run, catalogue) {
  if (run.phase !== "arrival") return false;
  const node = stage(run);
  run.stats.encounters++;
  addLog(run, node.name + ".");
  if (["wild", "elite", "boss", "capture"].includes(node.kind)) {
    const prepared = run.scouting?.stageIndex === run.stageIndex &&
      node.kind !== "capture" && node.pool.includes(run.scouting.speciesId);
    const id = node.kind === "capture" ? drawCatalogueSpecies(catalogue, random(run), run.stageIndex) :
      prepared ? run.scouting.speciesId : node.pool[Math.floor(random(run) * node.pool.length)],
      level = Math.min(100,
        4 +
        Math.floor(run.stageIndex * 0.65) +
        (node.kind === "elite" ? 1 : node.kind === "boss" ? 2 : 0));
    run.enemy = fighter(id, level, catalogue);
    (run.encounters ||= []).push({ id, stage: run.stageIndex, level, won: false });
    if(run.endless){run.encounters=run.encounters.slice(-32);const record=run.discoveryLedger[id]||={seen:0,defeated:0};record.seen++;}
    run.enemy.maxHp = Math.max(1, Math.ceil((run.enemy.maxHp - 20) * threatModifiers(run).enemyHp));
    run.enemy.hp = run.enemy.maxHp;
    if (node.kind === "boss") {
      run.enemy.maxHp = Math.ceil(run.enemy.maxHp * 1.15);
      run.enemy.hp = run.enemy.maxHp;
    }
    if(run.endless){run.enemy.maxHp=Math.min(900000,Math.ceil(run.enemy.maxHp*depthPressure(run).hp));run.enemy.hp=run.enemy.maxHp;}
    run.hero.guardUsed = false;
    const ward = run.endless && run.skill === 'ward' ? .12 : 0;
    run.hero.shield = Math.ceil(run.hero.maxHp * Math.max(ward, equippedStarterBoon(run)?.barrier ?? 0));
    run.preparedStrike = !!prepared || (run.routeMode==='branching'&&run.preparedStrike===true);
    run.scouting = null;
    run.battleActions = 0;
    run.nextSide = "ally";
    run.phase = "battle";
    addLog(run, `${catalogue.pokemon[id].name} challenges you!`);
    const ability = guardianAbility(run);
    if (ability) addLog(run, `${catalogue.pokemon[id].name}: ${ability.name}. ${ability.text}`);
  } else {
    run.phase = node.kind;
    if (node.kind === "shrine") run.offers = offerBonuses(run);
  }
  return true;
}
function attackStats(run, attacker, defender, move, catalogue, player) {
  const a = catalogue.pokemon[attacker.id],
    d = catalogue.pokemon[defender.id],
    physical = move.damageClass === "physical";
  let atk = a.stats[physical ? "attack" : "special-attack"],
    def = d.stats[physical ? "defense" : "special-defense"];
  if (player)
    atk =
      (atk + (run.upgrades.attackBonus || 0) * 3) *
      (1 + 0.15 * count(run, "attack_boost"))*(1+.06*gearTier(run,'fang'));
  else
    def =
      (def + (run.upgrades.defenseBonus || 0) * 3) *
      (1 + 0.15 * count(run, "defense_boost"))*(1+.06*gearTier(run,'shell'));
  const stab = a.types.includes(move.type)
    ? 1.5 + (player ? 0.2 * count(run, "type_boost") : 0)
    : 1;
  return { atk, def, stab, eff: effectiveness(move.type, d.types) };
}
export function expectedDamage(
  run,
  attacker,
  defender,
  move,
  catalogue,
  player,
) {
  const { atk, def, stab, eff } = attackStats(
    run,
    attacker,
    defender,
    move,
    catalogue,
    player,
  );
  const openingBoon = equippedStarterBoon(run);
  const boonMultiplier = openingBoon?.damage?.({
    run, player, attacker, defender, move, sameType: stab > 1, effectiveness: eff,
    dangerous: ['elite', 'boss'].includes(stage(run).kind),
  }) ?? 1;
  return (
    (Math.floor(
      (((2 * attacker.level) / 5 + 2) * move.power * atk) /
        Math.max(1, def) /
        50,
    ) +
      2) *
    stab *
    eff * boonMultiplier * (player ? (run.endless&&run.skill==='adrenaline'&&attacker.hp<attacker.maxHp*.35?1.25:1) : threatModifiers(run).enemyDamage*depthPressure(run).damage) *
    (player && guardianAbility(run)?.key === "multiscale" && defender.hp === defender.maxHp ? 0.5 : 1) *
    (!player && guardianAbility(run)?.key === "swarm" && attacker.hp * 3 <= attacker.maxHp && move.type === "bug" ? 1.5 : 1)
  );
}
export function bestMove(run, catalogue, side = run.nextSide) {
  const a = side === "ally" ? run.hero : run.enemy,
    d = side === "ally" ? run.enemy : run.hero;
  const choices = a.moves
    .filter((m) => m.pp > 0)
    .map((slot) => ({ slot, move: catalogue.moves[slot.id] || STRUGGLE }))
    .filter((x) => x.move.power > 0);
  choices.sort(
    (x, y) =>
      expectedDamage(run, a, d, y.move, catalogue, side === "ally") -
      expectedDamage(run, a, d, x.move, catalogue, side === "ally"),
  );
  return choices.length &&
    expectedDamage(run, a, d, choices[0].move, catalogue, side === "ally") > 0
    ? choices[0].move
    : STRUGGLE;
}
export function battleStep(run, catalogue) {
  if (run.phase !== "battle") return null;
  if (run.battleActions >= 80) {
    run.phase = "defeat";
    addLog(
      run,
      "After 80 actions, your partner is exhausted. The battle ends.",
    );
    return { kind: "exhausted" };
  }
  const player = run.nextSide === "ally",
    a = player ? run.hero : run.enemy,
    d = player ? run.enemy : run.hero,
    move = bestMove(run, catalogue);
  const synergies = new Set(activeSynergies(run).map((recipe) => recipe.id));
  const slot = a.moves.find((s) => s.id === move.id);
  const ability = guardianAbility(run);
  const ppSpent = slot && slot.pp > 0 && !(move.id === 0 && ability?.key === "pressure")
    ? Math.min(slot.pp, player && ability?.key === "pressure" ? 2 : 1) : 0;
  if (slot) slot.pp -= ppSpent;
  const rolledCrit =
    random(run) <
    clamp(
      0.0625 +
        (player
          ? (run.upgrades.criticalChance || 0) * 0.05 +
            0.1 * count(run, "crit_chance")+.03*gearTier(run,'lens')
          : 0),
      0,
      0.75,
    );
  const criticalBlocked = player && ability?.key === "shell-armor" && rolledCrit;
  const crit = rolledCrit && !criticalBlocked;
  const guardianEffect = player && (ability?.key === "pressure" && ppSpent > 1 ||
    ability?.key === "multiscale" && d.hp === d.maxHp || criticalBlocked) ||
    !player && ability?.key === "swarm" && a.hp * 3 <= a.maxHp && move.type === "bug"
    ? ability.name : null;
  let damage =
    expectedDamage(run, a, d, move, catalogue, player) *
    (crit ? 1.5 + (player ? 0.25 * count(run, "focus_crit") : 0) : 1) *
    (0.85 + random(run) * 0.3);
  if (player && count(run, "momentum"))
    damage *= 1 + Math.min(0.3, run.battleActions * 0.03);
  const prepared = player && run.preparedStrike;
  if (prepared) {
    damage *= 1.25;
    run.preparedStrike = false;
  }
  const guarded = !player && count(run, "first_guard") && !d.guardUsed;
  if (guarded) {
    damage *= 0.5;
    d.guardUsed = true;
  }
  damage = Math.max(1, Math.floor(damage));
  const absorbed = player ? 0 : Math.min(d.shield || 0, damage);
  if (absorbed) {
    d.shield -= absorbed;
    damage -= absorbed;
    run.stats.absorbed = (run.stats.absorbed || 0) + absorbed;
  }
  let actual = Math.min(d.hp, damage);
  d.hp = Math.max(0, d.hp - damage);
  const echoDamage = player && synergies.has("flurry") ?
    Math.min(d.hp, Math.max(1, Math.floor(damage * 0.25))) : 0;
  d.hp -= echoDamage;
  actual += echoDamage;
  const reflectDamage = guarded && synergies.has("bulwark") ?
    Math.min(a.hp, Math.ceil(a.maxHp * 0.2)) : 0;
  if (reflectDamage) {
    a.hp -= reflectDamage;
    run.stats.reflected = (run.stats.reflected || 0) + reflectDamage;
    run.stats.damage += reflectDamage;
  }
  let healing = 0, shielding = 0;
  if (player && (count(run, "lifesteal")||gearTier(run,'root'))) {
    const recovery = Math.ceil(actual * (0.15 * count(run, "lifesteal")+.02*gearTier(run,'root')));
    healing = Math.min(
      a.maxHp - a.hp,
      recovery,
    );
    a.hp += healing;
    run.stats.healing += healing;
    if (synergies.has("lifebloom")) {
      shielding = Math.max(0, Math.min(Math.ceil(a.maxHp * 0.2) - (a.shield || 0), recovery - healing));
      a.shield = (a.shield || 0) + shielding;
      run.stats.shielding = (run.stats.shielding || 0) + shielding;
    }
  }
  if (move.id === 0) a.hp = Math.max(0, a.hp - Math.ceil(a.maxHp * 0.08));
  run.battleActions++;
  run.actions++;
  run.nextSide = player ? "enemy" : "ally";
  if (player) {
    run.stats.damage += actual;
    if (crit) run.stats.criticals++;
  }
  const eff = effectiveness(move.type, catalogue.pokemon[d.id].types);
  addLog(
    run,
    `${catalogue.pokemon[a.id].name}: ${move.name}, ${actual} damage${crit ? " — critical hit!" : eff > 1 ? " — super effective!" : eff < 1 ? " — resisted." : "."}${prepared ? " Prepared strike!" : ""}${echoDamage ? ` Echo: ${echoDamage}.` : ""}${absorbed ? ` Barrier absorbed ${absorbed}.` : ""}${reflectDamage ? ` Riposte: ${reflectDamage}.` : ""}${guardianEffect ? ` ${guardianEffect}${criticalBlocked ? " blocked a critical" : ability.key === "pressure" ? `: ${ppSpent} PP spent` : " active"}.` : ""}`,
  );
  const result = {
    kind: "hit",
    side: player ? "ally" : "enemy",
    move,
    damage: actual,
    healing,
    crit,
    effectiveness: eff,
    prepared: !!prepared,
    echoDamage,
    reflectDamage,
    shielding,
    absorbed,
    ppSpent,
    guardianEffect,
    criticalBlocked: !!criticalBlocked,
  };
  if (run.hero.hp <= 0) {
    run.phase = "defeat";
    addLog(run, "Your partner has fainted.");
  } else if (run.enemy.hp <= 0) winBattle(run, catalogue);
  return result;
}
function winBattle(run, catalogue) {
  if (run.phase !== "battle") return;
  run.wins++;
  run.hero.shield = 0;
  const encounter = run.encounters?.at(-1);
  if (encounter?.stage === run.stageIndex) encounter.won = true;
  if(run.endless)run.discoveryLedger[run.enemy.id].defeated++;
  const node = stage(run),
    gold = Math.floor(
      (node.kind === "boss" ? 80 : node.kind === "elite" ? 45 : 25) *
        (1 + run.hero.level * 0.1) *
        (1 + 0.3 * count(run, "gold_boost")) * threatModifiers(run).gold,
    );
  run.coins += gold;
  const boon = equippedStarterBoon(run);
  const xp = (node.kind === "boss" ? 3 : node.kind === "elite" ? 2 : 1) + (boon?.experience ?? 0);
  run.hero.xp += xp;
  while (run.hero.xp >= 2) {
    if(run.hero.level>=100){run.hero.xp=0;break;}
    run.hero.xp -= 2;
    run.hero.level++;
    run.hero.maxHp += 5;
    run.hero.hp += 5;
    addLog(run, `Reached level ${run.hero.level}!`);
  }
  refreshGrowth(run, catalogue);
  const healing = Math.ceil(
    run.hero.maxHp * (0.12 + 0.1 * count(run, "regeneration")+(run.endless&&run.skill==='renewal'?.06:0)),
  );
  run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + healing);
  run.hero.moves.forEach((slot) => {
    const base = catalogue.moves[slot.id];
    if (base) slot.pp = Math.min(base.pp, slot.pp + (boon?.ppRecovery ?? 2));
  });
  addLog(run, `Victory! +${gold} gold, +${xp} experience.`);
  run.pendingReward = true;
  if(run.endless&&['elite','boss'].includes(node.kind)){const loot=salvageEquipment(run);addLog(run,`Equipment found: ${loot.name} · tier ${loot.tier}.`);}
  if(run.endless&&node.kind==='capture'){
    const rarity = catalogue.pokemon[run.enemy.id].rarity;
    const chance = Math.min(0.85, (captureRates[rarity] ?? captureRates.common) + (boon?.captureChance ?? 0) + 0.02 * gearTier(run, 'lens'));
    run.pendingCapture={id:run.enemy.id,chance,attempted:false,caught:false};run.phase='capture';
  }else if (!run.endless&&run.stageIndex === STAGES.length - 1) {
    run.phase = "complete";
    run.pendingReward = false;
    addLog(run, "The legendary guardian falls. Expedition complete!");
  } else run.phase = "victoryBeat";
}
export function depart(run) {
  if (!["victoryBeat", "camp", "cache", "shop", "shrine", "capture"].includes(run.phase))
    return false;
  if(run.phase==='capture'&&!run.pendingCapture?.attempted)return false;
  run.pendingCapture=null;
  if (!run.endless&&run.stageIndex >= STAGES.length - 1) {
    run.phase = "complete";
    return true;
  }
  const previousRegion = region(run).id;
  run.shrineEmpowered = false;
  run.stageIndex++;
  if (run.routeMode === "regional" && region(run).id !== previousRegion)
    run.regionEntry = region(run).id;
  if (region(run).id !== previousRegion) run.landmark = null;
  run.phase = "travel";
  run.travelProgress = 0;
  run.enemy = null;
  return true;
}
export function attemptCapture(run,catalogue=null){
 if(run.phase!=='capture'||!run.pendingCapture||run.pendingCapture.attempted||run.enemy?.hp!==0)return null;
 const attempt=run.pendingCapture;attempt.attempted=true;attempt.caught=random(run)<attempt.chance;
 if(attempt.caught){run.captures[attempt.id]=(run.captures[attempt.id]||0)+1;addLog(run,`Pokémon captured: ${catalogue?.pokemon[attempt.id]?.name||attempt.id}.`);}else addLog(run,'The Pokémon escaped the capture.');
 return{...attempt};
}
export function skipCapture(run){if(run.phase!=='capture'||!run.pendingCapture||run.pendingCapture.attempted)return false;run.pendingCapture.attempted=true;return depart(run);}
function trainPartner(run, catalogue) {
  if (run.hero.level >= 100) return false;
  run.hero.level++;
  run.hero.maxHp += 5;
  run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + 5);
  refreshGrowth(run, catalogue);
}
export function previewTraining(run, catalogue) {
  const preview = { ...run, hero: structuredClone(run.hero),
    partnerForms: [...(run.partnerForms || [])], log: [] };
  trainPartner(preview, catalogue);
  return { level: preview.hero.level, maxHpGain: preview.hero.maxHp - run.hero.maxHp,
    speciesId: preview.hero.id, evolutionChoice: !!preview.pendingEvolution,
    moves: preview.hero.moves.filter((move) => !run.hero.moves.some((old) => old.id === move.id))
      .map((move) => catalogue.moves[move.id]?.name || STRUGGLE.name) };
}
export function resolveEncounter(run, choice, catalogue) {
  if (run.phase === "camp") {
    if (choice === "rest") {
      run.hero.hp = run.hero.maxHp;
      run.hero.moves.forEach((s) => (s.pp = s.maxPp || 35));
      addLog(run, "The spring restores all HP and PP.");
    } else if (choice === "train") {
      if (!catalogue || run.hero.level >= 100) return false;
      addLog(run, "Training complete: level +1.");
      trainPartner(run, catalogue);
    } else if (choice === "scout") {
      if (!catalogue) return false;
      if(run.routeMode==='branching'){
        run.preparedStrike=true;run.scouting=null;addLog(run,'Your next opening strike deals 25% more damage.');depart(run);return true;
      }
      const index = STAGES.findIndex((node, i) => i > run.stageIndex &&
        ["wild", "elite", "boss"].includes(node.kind));
      if (index < 0) return false;
      const pool = STAGES[index].pool;
      const speciesId = pool[Math.floor(random(run) * pool.length)];
      run.scouting = { stageIndex: index, speciesId };
      addLog(run, `${catalogue.pokemon[speciesId].name} scouted: your opening strike deals 25% more damage.`);
    } else return false;
  } else if (run.phase === "cache") {
    if (choice === "gold") {
      const amount = 50 + Math.floor(random(run) * 31);
      run.coins += amount;
      addLog(run, `The satchel held ${amount} gold.`);
    } else if (choice === "heal") {
      run.hero.hp = Math.min(
        run.hero.maxHp,
        run.hero.hp + Math.ceil(run.hero.maxHp * 0.5),
      );
      addLog(run, "The supplies restore 50% maximum HP.");
    } else if (choice === "study") {
      if (!catalogue || run.hero.level >= 100) return false;
      addLog(run, "Studied the field notes: level +1. The remaining supplies and gold stay behind.");
      trainPartner(run, catalogue);
    } else return false;
  } else if (run.phase === "shrine" && choice === "leave") {
    addLog(run, "You leave the shrine undisturbed.");
  } else return false;
  depart(run);
  return true;
}
export const SHOP_ITEMS = {
  potion: {
    name: "Potion",
    asset: "healing-potion",
    cost: 30,
    text: "Restore 35% maximum HP.",
    heal: 0.35,
  },
  full_heal: {
    name: "Full Recovery",
    asset: "healing-berry",
    cost: 85,
    text: "Restore all HP and PP.",
    heal: 1,
  },
  force: {
    name: "Strength Fang",
    asset: "attack-fang",
    cost: 70,
    text: "Gain a Strength boon for this expedition.",
    bonus: "attack_boost",
  },
  guard: {
    name: "Sturdy Shell",
    asset: "defense-shell",
    cost: 70,
    text: "Gain a Resilience boon for this expedition.",
    bonus: "defense_boost",
  },
};
export function buy(run, key) {
  const item = SHOP_ITEMS[key];
  if (run.phase !== "shop" || !item || run.coins < item.cost) return false;
  if (item.heal && run.hero.hp === run.hero.maxHp && key !== "full_heal")
    return false;
  if (key === "full_heal" && !needsRecovery(run)) return false;
  if (
    item.bonus &&
    count(run, item.bonus) >= BONUSES.find((b) => b.id === item.bonus).max
  )
    return false;
  run.coins -= item.cost;
  if (item.heal)
    run.hero.hp = Math.min(
      run.hero.maxHp,
      run.hero.hp + Math.ceil(run.hero.maxHp * item.heal),
    );
  if (key === "full_heal")
    run.hero.moves.forEach((s) => (s.pp = s.maxPp || 35));
  if (item.bonus) grantBonus(run, item.bonus);
  addLog(run, item.name + " purchased.");
  return true;
}
export function previewPurchase(run, key) {
  const item = SHOP_ITEMS[key];
  if (!item || run.phase !== "shop") return null;
  const next = structuredClone(run);
  if (!buy(next,key)) return null;
  return choiceResult(run,next,item.bonus);
}
export function needsRecovery(run) {
  return run.hero.hp < run.hero.maxHp ||
    run.hero.moves.some((slot) => slot.pp < slot.maxPp);
}
export function settle(run, meta) {
  if (!["defeat", "complete", "retired"].includes(run.phase) || run.settled)
    return false;
  run.settled = true;
  if(run.endless)run.pendingCapture=null;
  if(run.introPending)run.introPending=false;
  if (run.introChoicePending) run.introChoicePending = false;
  run.landmark = null;
  run.endBonus =
    run.phase === "defeat"
      ? 0
      : Math.floor(run.wins * 35 * (1 + run.hero.level * 0.1) * threatModifiers(run).gold);
  run.coins += run.endBonus;
  if(run.endless){meta.gold=run.carriedBank?run.coins:meta.gold+run.coins;awardLegacy(run,meta);for(const[id,n]of Object.entries(run.captures||{}))meta.captured[id]=(meta.captured[id]||0)+n;}
  else meta.gold = run.coins;
  meta.totalRuns++;
  meta.totalVictories += run.wins;
  meta.bestScore = Math.max(meta.bestScore, run.wins);
  if (run.phase === "complete"||(run.endless&&(run.encounters||[]).some(e=>e.won&&e.stage%STAGES.length===14)))
    meta.unlockedThreat = Math.max(meta.unlockedThreat || 0, Math.min(MAX_THREAT, threatModifiers(run).tier + 1));
  meta.discoveries ||= {};
  for (const encounter of run.endless?[]:run.encounters || []) {
    const record = meta.discoveries[encounter.id] ||= { seen: 0, defeated: 0 };
    record.seen++;
    if (encounter.won) record.defeated++;
  }
  if(run.endless)for(const[id,counts]of Object.entries(run.discoveryLedger||{})){const record=meta.discoveries[id]||={seen:0,defeated:0};record.seen+=counts.seen;record.defeated+=counts.defeated;}
  for (const id of new Set(run.partnerForms || [run.hero.id])) {
    const record = meta.discoveries[id] ||= { seen: 0, defeated: 0 };
    record.seen++;
  }
  meta.expeditionHistory = [{
    id: run.id,
    starterId: run.starterId || run.hero.id,
    partnerId: run.hero.id,
    outcome: run.phase,
    stage: run.stageIndex + 1,
    wins: run.wins,
    actions: run.actions,
    damage: run.stats.damage,
    seed: run.initialSeed || null,
    threat: threatModifiers(run).tier,
  }, ...(meta.expeditionHistory || [])].slice(0, 12);
  for (const [id, threshold] of [
    [25, 10],
    [133, 25],
    [152, 50],
  ])
    if (meta.totalVictories >= threshold) meta.unlockedStarters[id] = true;
  return true;
}
export function upgrade(meta, key) {
  const d = UPGRADE_DEFS[key],
    level = meta.permanentUpgrades[key];
  if (!d || !Number.isFinite(level) || level >= 10) return false;
  const cost = Math.round(d.cost * (1 + level * 0.5));
  if (meta.gold < cost) return false;
  meta.gold -= cost;
  meta.permanentUpgrades[key]++;
  return true;
}
export function pointOnRoute(route, t) {
  const lengths = route
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let target = clamp(t, 0, 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const f = clamp(target / lengths[i], 0, 1);
      return [
        route[i][0] + (route[i + 1][0] - route[i][0]) * f,
        route[i][1] + (route[i + 1][1] - route[i][1]) * f,
      ];
    }
    target -= lengths[i];
  }
  return [...route.at(-1)];
}
export function routeFraction(run) {
  const progress = clamp(run.travelProgress, 0, 1);
  if (run.routeMode === "regional") {
    const area = region(run);
    return (run.stageIndex - area.from + progress) / (area.to - area.from + 1);
  }
  return (run.stageIndex + progress) / STAGES.length;
}
export function travelPosition(run, route) {
  return pointOnRoute(route, routeFraction(run));
}
export function encounterZone(run, world) {
  return run.routeMode === "regional" ?
    world.regions?.[region(run).id]?.encounters?.find((node) => node.index === run.stageIndex) :
    world.encounters[run.stageIndex];
}
