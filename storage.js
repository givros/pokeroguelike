import { baseMeta, BONUSES, STAGES, clamp, region, MAX_THREAT, stageAt, expandStarterOffers } from "./engine.js";
import {validBranchState} from './route-graph.js';
import { SYNERGIES } from "./builds.js";
import {SKILLS,EQUIPMENT} from './legacy.js';
export const SAVE_KEY = "pokeRogueAdventureV3";
const LEGACY_SAVE_KEY = "pokeBattleProgress";
const SAVE_SESSION_KEY = "pokeRogueSaveSession";

export function resetSave(storage, document, port) {
  try {
    storage.removeItem(LEGACY_SAVE_KEY);
    storage.removeItem(SAVE_KEY);
    document.cookie = `${SAVE_SESSION_KEY}${port}=; Path=/; Max-Age=0; SameSite=Lax`;
    return true;
  } catch {
    return false;
  }
}

export function openSaveSession(storage, document, port) {
  const name = SAVE_SESSION_KEY + port;
  const readCookie = () => document.cookie.split(';').map(part => part.trim())
    .find(part => part.startsWith(name + '='))?.slice(name.length + 1);
  try {
    const previous = storage.getItem(SAVE_SESSION_KEY);
    const cookie = readCookie();
    const session = cookie || crypto.randomUUID();
    document.cookie = `${name}=${session}; Path=/; Max-Age=34560000; SameSite=Lax`;
    if (readCookie() !== session) return null;

    // Saves from before cookie tracking are adopted on the first visit.
    if (previous !== null && previous !== cookie) {
      storage.removeItem(SAVE_KEY);
      storage.removeItem(LEGACY_SAVE_KEY);
    }
    storage.setItem(SAVE_SESSION_KEY, session);
    return () => readCookie() === session;
  } catch {
    return null;
  }
}

function validEncounterSpecies(stage, id, catalogue) {
  if (stage?.kind === "capture") return Number.isInteger(id) && !!catalogue.pokemon[id];
  return stage?.pool?.includes(id);
}
function validEndless(r,c){
 if(r.routeMode!=='branching'||![0,1].includes(r.proceduralFromChapter)||r.phase==='complete')return false;
 if(r.skill!=null&&!SKILLS.some(s=>s.id===r.skill))return false;
 const gearMap=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([id,tier])=>EQUIPMENT.some(g=>g.id===id)&&Number.isInteger(tier)&&tier>=1&&tier<=10);
 if(!gearMap(r.salvage)||r.gear!=null&&(!EQUIPMENT.some(g=>g.id===r.gear.id)||!Number.isInteger(r.gear.tier)||r.gear.tier<1||r.gear.tier>10))return false;
 const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
 if(!record(r.captures)||!Object.entries(r.captures).every(([id,n])=>c.pokemon[id]&&Number.isSafeInteger(n)&&n>0))return false;
 if(!record(r.discoveryLedger)||!Object.entries(r.discoveryLedger).every(([id,n])=>c.pokemon[id]&&record(n)&&Number.isSafeInteger(n.seen)&&n.seen>0&&Number.isSafeInteger(n.defeated)&&n.defeated>=0&&n.defeated<=n.seen))return false;
 if(r.carriedBank!=null&&typeof r.carriedBank!=='boolean')return false;
 if(r.lootSeed!=null&&(!Number.isInteger(r.lootSeed)||r.lootSeed<1||r.lootSeed>4294967295))return false;
 if(r.legacyReward!=null&&(!record(r.legacyReward)||!Number.isSafeInteger(r.legacyReward.marks)||r.legacyReward.marks<0||!Array.isArray(r.legacyReward.equipment)||r.legacyReward.equipment.length>5||!r.legacyReward.equipment.every(g=>g&&EQUIPMENT.some(item=>item.id===g.id)&&Number.isInteger(g.tier)&&g.tier>=1&&g.tier<=10)))return false;
 if(r.pendingCapture!=null){const p=r.pendingCapture;if(r.phase!=='capture'||!c.pokemon[p.id]||p.id!==r.enemy?.id||!Number.isFinite(p.chance)||p.chance<0||p.chance>1||typeof p.attempted!=='boolean'||typeof p.caught!=='boolean'||p.caught&&!p.attempted)return false;}
 if(r.phase==='capture'&&!r.pendingCapture)return false;
 return true;
}
const integer = (n, limit = 1e8) => clamp(Math.floor(Number(n) || 0), 0, limit);
export function normalizeMeta(source) {
  const m = baseMeta();
  if (!source || typeof source !== "object") return m;
  for (const key of ["totalRuns", "bestScore", "totalVictories", "gold"])
    m[key] = integer(source[key]);
  m.unlockedThreat = source.unlockedThreat == null ? (m.bestScore >= 9 ? 1 : 0) : integer(source.unlockedThreat, MAX_THREAT);
  m.selectedThreat = integer(source.selectedThreat, m.unlockedThreat);
  for (const key of Object.keys(m.permanentUpgrades))
    m.permanentUpgrades[key] = integer(source.permanentUpgrades?.[key], 10);
  m.sound = !!source.sound;
  m.language = source.language === "fr" ? "fr" : "en";
  m.legacyMarks=integer(source.legacyMarks);m.bestDepth=integer(source.bestDepth,Number.MAX_SAFE_INTEGER);
  m.learnedSkills=SKILLS.filter(s=>Array.isArray(source.learnedSkills)&&source.learnedSkills.includes(s.id)).map(s=>s.id);
  m.equippedSkill=m.learnedSkills.includes(source.equippedSkill)?source.equippedSkill:null;
  for(const gear of EQUIPMENT){const tier=integer(source.equipment?.[gear.id],10);if(tier)m.equipment[gear.id]=tier;}
  m.equippedGear=m.equipment[source.equippedGear]?source.equippedGear:null;
  if(source.captured&&typeof source.captured==='object')for(const[id,n]of Object.entries(source.captured)){const key=integer(id,2000),amount=integer(n);if(String(key)===id&&amount)m.captured[id]=amount;}
  m.startingPartner=m.captured[source.startingPartner]?Number(source.startingPartner):null;
  if (source.discoveries && typeof source.discoveries === "object")
    for (const [key, value] of Object.entries(source.discoveries)) {
      const id = integer(key, 2000);
      if (String(id) !== key || !value || typeof value !== "object") continue;
      const seen = integer(value.seen);
      if (seen) m.discoveries[id] = { seen, defeated: Math.min(seen, integer(value.defeated)) };
    }
  if (Array.isArray(source.expeditionHistory))
    m.expeditionHistory = source.expeditionHistory.filter((r) =>
      r && typeof r.id === "string" && r.id.length < 100 &&
      ["complete", "defeat", "retired"].includes(r.outcome) &&
      Number.isInteger(r.partnerId) && r.partnerId > 0 && r.partnerId < 2000
    ).slice(0, 12).map((r) => ({
      id: r.id, starterId: integer(r.starterId, 2000), partnerId: r.partnerId,
      outcome: r.outcome, stage: Math.max(1, integer(r.stage, Number.MAX_SAFE_INTEGER)),
      wins: integer(r.wins), actions: integer(r.actions),
      damage: integer(r.damage), seed: r.seed == null ? null : integer(r.seed, 4294967295),
      threat: integer(r.threat, MAX_THREAT),
    }));
  m.battleSpeed = [750, 1500, 2000].includes(source.battleSpeed)
    ? source.battleSpeed
    : 1500;
  for (const [id, threshold] of [
    [25, 10],
    [133, 25],
    [152, 50],
  ])
    m.unlockedStarters[id] =
      m.totalVictories >= threshold || source.unlockedStarters?.[id] === true;
  return m;
}
function validFighter(m, c) {
  return (
    m &&
    Number.isInteger(m.id) &&
    Object.hasOwn(c.pokemon, m.id) &&
    Number.isInteger(m.level) &&
    m.level > 0 &&
    m.level <= 100 &&
    Number.isFinite(m.hp) &&
    m.hp >= 0 &&
    m.hp <= m.maxHp &&
    Number.isFinite(m.maxHp) &&
    m.maxHp > 0 &&
    m.maxHp < 1e6 &&
    (m.shield == null || (Number.isInteger(m.shield) && m.shield >= 0 && m.shield <= Math.ceil(m.maxHp * 0.2))) &&
    Number.isInteger(m.xp) &&
    m.xp >= 0 &&
    m.xp < 2 &&
    Array.isArray(m.moves) &&
    m.moves.length > 0 &&
    m.moves.length <= 4 &&
    m.moves.every(
      (s) =>
        s &&
        Number.isInteger(s.id) &&
        (Object.hasOwn(c.moves, s.id) || s.id === 0) &&
        Number.isInteger(s.maxPp) &&
        s.maxPp > 0 &&
        s.maxPp <= 999 &&
        Number.isInteger(s.pp) &&
        s.pp >= 0 &&
        s.pp <= s.maxPp,
    )
  );
}
export function validRun(r, c) {
  if (
    !r ||
    r.version !== 3 ||
    typeof r.id !== "string" ||
    r.id.length > 100 ||
    !Number.isSafeInteger(r.stageIndex) ||
    r.stageIndex < 0 ||
    (!r.endless&&r.stageIndex >= STAGES.length)
  )
    return false;
  if(r.routeMode==='branching'&&!validBranchState(r,STAGES))return false;
  if(r.endless!==undefined&&typeof r.endless!=='boolean')return false;
  if(r.phase==='capture'&&!r.endless)return false;
  if(r.endless&&!validEndless(r,c))return false;
  if(r.introPending!=null&&(typeof r.introPending!=='boolean'||r.introPending&&r.phase!=='starter'))return false;
  if(r.introMode!=null&&!['random','chosen'].includes(r.introMode))return false;
  if(r.introChoicePending!=null&&(typeof r.introChoicePending!=='boolean'||r.introChoicePending&&(r.phase!=='starter'||r.introPending||r.introMode!=='random')))return false;
  if (typeof r.settled !== "boolean" || typeof r.pendingReward !== "boolean" ||
    (r.pendingEvolution != null && typeof r.pendingEvolution !== "boolean")) return false;
  if (r.settled && !["complete", "defeat", "retired"].includes(r.phase)) return false;
  if (
    ![
      "starter",
      "travel",
      "arrival",
      "battle",
      "victoryBeat",
      "reward",
      "evolution",
      "camp",
      "capture",
      "cache",
      "shop",
      "shrine",
      "defeat",
      "complete",
      "retired",
    ].includes(r.phase)
  )
    return false;
  if (
    !validFighter(r.hero, c) ||
    (r.enemy != null && !validFighter(r.enemy, c)) ||
    (["battle", "victoryBeat", "complete", "capture"].includes(r.phase) &&
      !validFighter(r.enemy, c))
  )
    return false;
  if ((r.phase === "battle" && r.enemy.hp <= 0) ||
    (["victoryBeat", "complete", "capture"].includes(r.phase) && r.enemy.hp !== 0)) return false;
  if (r.phase === "complete" && r.stageIndex !== STAGES.length - 1) return false;
  if (["camp", "cache", "shop", "shrine"].includes(r.phase) &&
    stageAt(r,r.stageIndex).kind !== r.phase) return false;
  if (
    !Number.isInteger(r.seed) ||
    r.seed <= 0 ||
    r.seed > 4294967295 ||
    !Number.isFinite(r.travelProgress) ||
    r.travelProgress < 0 ||
    r.travelProgress > 1
  )
    return false;
  if (
    !["coins", "wins", "actions", "battleActions"].every(
      (k) => Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= 1e8,
    )
  )
    return false;
  if (
    r.wins > (r.endless?r.stageIndex+1:15) ||
    r.battleActions > 80 ||
    !["ally", "enemy"].includes(r.nextSide)
  )
    return false;
  if (
    !Array.isArray(r.bonuses) ||
    r.bonuses.length > 60 ||
    !r.bonuses.every((id) => BONUSES.some((b) => b.id === id))
  )
    return false;
  if (
    !Array.isArray(r.offers) ||
    r.offers.length > (r.endless && r.phase === "starter" ? BONUSES.length : 3) ||
    new Set(r.offers).size !== r.offers.length ||
    !r.offers.every((id) => BONUSES.some((b) => b.id === id && (!b.starterOnly || r.endless && r.phase === "starter")))
  )
    return false;
  if (r.idleEnabled !== undefined && typeof r.idleEnabled !== "boolean") return false;
  if (r.guardianAbilities !== undefined && typeof r.guardianAbilities !== "boolean") return false;
  if (r.idleAt != null && (!Number.isSafeInteger(r.idleAt) || r.idleAt < 0)) return false;
  if (r.idleCredit != null && (!Number.isInteger(r.idleCredit) || r.idleCredit < 0 || r.idleCredit > 28800000)) return false;
  if (r.threat !== undefined && (!Number.isInteger(r.threat) || r.threat < 0 || r.threat > MAX_THREAT)) return false;
  if (r.shrineEmpowered !== undefined && (typeof r.shrineEmpowered !== "boolean" ||
    (r.shrineEmpowered && r.phase !== "shrine"))) return false;
  if (r.landmark != null) {
    const marker = r.landmark;
    if (r.routeMode !== "regional" || !Number.isInteger(marker.stageIndex) || !STAGES[marker.stageIndex] ||
      !["cache", "camp", "shop", "shrine"].includes(STAGES[marker.stageIndex].kind) ||
      !["approaching", "at", "returning"].includes(marker.state) ||
      !Number.isFinite(marker.progress) || marker.progress < 0 || marker.progress > 1 ||
      !Number.isInteger(marker.duration) || marker.duration < 800 || marker.duration > 3000 ||
      !Array.isArray(marker.path) || marker.path.length < 2 || marker.path.length > 12 ||
      !marker.path.every(p => Array.isArray(p) && p.length === 2 && p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)) ||
      !marker.path.some(p=>p[0]!==marker.path[0][0]||p[1]!==marker.path[0][1]) ||
      (marker.state === "at" && marker.progress !== 1)) return false;
    const here = marker.stageIndex === r.stageIndex;
    if (marker.state === "approaching" && (!here || r.phase !== "arrival")) return false;
    if (marker.state === "returning" && (marker.stageIndex !== r.stageIndex - 1 || r.phase !== "travel")) return false;
    if (marker.state === "at" && !((here && ["arrival", "cache", "camp", "shop", "shrine"].includes(r.phase)) ||
      (marker.stageIndex === r.stageIndex - 1 && r.phase === "travel"))) return false;
  }
  if (r.plan !== undefined && !["manual", "predator", "warden", "siphon"].includes(r.plan)) return false;
  if (r.rerolls !== undefined && (!Number.isInteger(r.rerolls) || r.rerolls < 0 || r.rerolls > 3)) return false;
  if (["starter", "reward"].includes(r.phase) && r.offers.length === 0)
    return false;
  if (
    !Array.isArray(r.log) ||
    r.log.length > 60 ||
    !r.log.every((s) => typeof s === "string" && s.length < 1000)
  )
    return false;
  if (
    !r.upgrades ||
    !Object.keys(baseMeta().permanentUpgrades).every(
      (k) =>
        Number.isInteger(r.upgrades[k]) &&
        r.upgrades[k] >= 0 &&
        r.upgrades[k] <= 10,
    )
  )
    return false;
  if (
    !r.stats ||
    !["damage", "healing", "criticals", "encounters"].every(
      (k) => Number.isFinite(r.stats[k]) && r.stats[k] >= 0,
    )
  )
    return false;
  if (r.scouting != null && (
    !Number.isInteger(r.scouting.stageIndex) ||
    r.scouting.stageIndex < r.stageIndex ||
    !STAGES[r.scouting.stageIndex]?.pool?.includes(r.scouting.speciesId)
  )) return false;
  if (r.preparedStrike != null && typeof r.preparedStrike !== "boolean")
    return false;
  if (r.encounters != null && (!Array.isArray(r.encounters) ||
    r.encounters.length > (r.endless?32:STAGES.length) ||
    !r.encounters.every((entry, i, entries) => entry &&
      Number.isInteger(entry.stage) && entry.stage >= 0 && entry.stage <= r.stageIndex &&
      (i === 0 || entry.stage > entries[i - 1].stage) &&
      validEncounterSpecies(stageAt(r, entry.stage), entry.id, c) &&
      Number.isInteger(entry.level) && entry.level > 0 && entry.level <= 100 &&
      typeof entry.won === "boolean"))) return false;
  if (r.initialSeed != null && (!Number.isInteger(r.initialSeed) ||
    r.initialSeed <= 0 || r.initialSeed > 4294967295)) return false;
  if (r.partnerForms != null && (!Array.isArray(r.partnerForms) ||
    r.partnerForms.length > 4 ||
    new Set(r.partnerForms).size !== r.partnerForms.length ||
    !r.partnerForms.every((id) => c.pokemon[id]))) return false;
  if (r.pendingGrowth != null && (!c.pokemon[r.pendingGrowth.fromId] ||
    r.pendingGrowth.toId !== r.hero.id || r.pendingGrowth.fromId === r.pendingGrowth.toId))
    return false;
  if (r.routeMode != null && !["regional", "legacy", "branching"].includes(r.routeMode)) return false;
  if (r.regionEntry != null && (r.routeMode !== "regional" || r.phase !== "travel" ||
    r.regionEntry !== region(r).id)) return false;
  if (r.pendingAwakenings != null && (!Array.isArray(r.pendingAwakenings) ||
    r.pendingAwakenings.length > SYNERGIES.length ||
    new Set(r.pendingAwakenings).size !== r.pendingAwakenings.length ||
    !r.pendingAwakenings.every((id) => SYNERGIES.some((recipe) => recipe.id === id)))) return false;
  for (const key of ["shielding", "absorbed", "reflected"])
    if (r.stats[key] != null && (!Number.isInteger(r.stats[key]) || r.stats[key] < 0)) return false;
  return true;
}
export function readState(storage, catalogue) {
  let warning = "";
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const meta = normalizeMeta(s.meta);
      let run = validRun(s.run, catalogue) ? s.run : null;
      if (run) expandStarterOffers(run);
      if (s.run && !run)
        warning =
          "This expedition cannot be resumed. Your permanent progress has been retained.";
      if (
        run &&
        run.hero.hp === 0 &&
        !["defeat", "retired"].includes(run.phase)
      )
        run.phase = "defeat";
      return { meta, run, warning };
    }
    const legacy = JSON.parse(storage.getItem(LEGACY_SAVE_KEY) || "null");
    return { meta: normalizeMeta(legacy), run: null, warning };
  } catch {
    return {
      meta: baseMeta(),
      run: null,
      warning: "The previous save could not be read. A new camp has been prepared.",
    };
  }
}
export function writeState(storage, meta, run) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 3, meta, run }));
    return true;
  } catch {
    return false;
  }
}
