import { baseMeta, BONUSES, STAGES, clamp } from "./engine.js";
export const SAVE_KEY = "pokeRogueAdventureV3";
const integer = (n, limit = 1e8) => clamp(Math.floor(Number(n) || 0), 0, limit);
export function normalizeMeta(source) {
  const m = baseMeta();
  if (!source || typeof source !== "object") return m;
  for (const key of ["totalRuns", "bestScore", "totalVictories", "gold"])
    m[key] = integer(source[key]);
  for (const key of Object.keys(m.permanentUpgrades))
    m.permanentUpgrades[key] = integer(source.permanentUpgrades?.[key], 10);
  m.sound = !!source.sound;
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
    c.pokemon[m.id] &&
    Number.isInteger(m.level) &&
    m.level > 0 &&
    m.level <= 100 &&
    Number.isFinite(m.hp) &&
    m.hp >= 0 &&
    m.hp <= m.maxHp &&
    Number.isFinite(m.maxHp) &&
    m.maxHp > 0 &&
    m.maxHp < 1e6 &&
    Number.isFinite(m.xp) &&
    m.xp >= 0 &&
    Array.isArray(m.moves) &&
    m.moves.length > 0 &&
    m.moves.length <= 4 &&
    m.moves.every(
      (s) =>
        (c.moves[s.id] || s.id === 0) &&
        Number.isFinite(s.pp) &&
        s.pp >= 0 &&
        s.pp <= 999,
    )
  );
}
export function validRun(r, c) {
  if (
    !r ||
    r.version !== 3 ||
    typeof r.id !== "string" ||
    !Number.isInteger(r.stageIndex) ||
    r.stageIndex < 0 ||
    r.stageIndex >= STAGES.length
  )
    return false;
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
    (["battle", "victoryBeat", "complete"].includes(r.phase) &&
      !validFighter(r.enemy, c))
  )
    return false;
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
      (k) => Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 1e8,
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
        Number.isFinite(r.upgrades[k]) &&
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
          "Cette expédition ne peut pas être reprise. Votre progression permanente est conservée.";
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
      warning: "Sauvegarde locale inaccessible. Gardez cette fenêtre ouverte.",
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
