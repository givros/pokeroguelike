import { baseMeta, BONUSES, STAGES, clamp, region, MAX_THREAT } from "./engine.js";
import { SYNERGIES } from "./builds.js";
export const SAVE_KEY = "pokeRogueAdventureV3";
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
      outcome: r.outcome, stage: Math.max(1, integer(r.stage, STAGES.length)),
      wins: integer(r.wins, STAGES.length), actions: integer(r.actions),
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
    !Number.isInteger(r.stageIndex) ||
    r.stageIndex < 0 ||
    r.stageIndex >= STAGES.length
  )
    return false;
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
    (["battle", "victoryBeat", "complete"].includes(r.phase) &&
      !validFighter(r.enemy, c))
  )
    return false;
  if ((r.phase === "battle" && r.enemy.hp <= 0) ||
    (["victoryBeat", "complete"].includes(r.phase) && r.enemy.hp !== 0)) return false;
  if (r.phase === "complete" && r.stageIndex !== STAGES.length - 1) return false;
  if (["camp", "cache", "shop", "shrine"].includes(r.phase) &&
    STAGES[r.stageIndex].kind !== r.phase) return false;
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
    r.wins > 15 ||
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
    r.offers.length > 3 ||
    new Set(r.offers).size !== r.offers.length ||
    !r.offers.every((id) => BONUSES.some((b) => b.id === id))
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
    r.encounters.length > STAGES.length ||
    !r.encounters.every((entry, i, entries) => entry &&
      Number.isInteger(entry.stage) && entry.stage >= 0 && entry.stage <= r.stageIndex &&
      (i === 0 || entry.stage > entries[i - 1].stage) &&
      STAGES[entry.stage]?.pool?.includes(entry.id) &&
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
  if (r.routeMode != null && !["regional", "legacy"].includes(r.routeMode)) return false;
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
    const legacy = JSON.parse(storage.getItem("pokeBattleProgress") || "null");
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
