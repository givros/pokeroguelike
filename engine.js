export const STAGES = [
  { kind: "wild", name: "Lisière de la forêt", pool: [10, 16, 19] },
  { kind: "wild", name: "Prairie fleurie", pool: [23, 25, 43, 152] },
  { kind: "cache", name: "Sacoche oubliée" },
  { kind: "elite", name: "Le bosquet farouche", pool: [12, 58, 66] },
  { kind: "camp", name: "Source des voyageurs" },
  { kind: "boss", name: "Gardien du bosquet", pool: [123] },
  { kind: "wild", name: "Sentier rocailleux", pool: [27, 37, 74, 95] },
  { kind: "shop", name: "Échoppe du sentier" },
  { kind: "elite", name: "Le passage des brumes", pool: [81, 92, 104, 111] },
  { kind: "shrine", name: "Clairière des anciens" },
  { kind: "wild", name: "Rives paisibles", pool: [39, 41, 52, 54, 63, 129] },
  { kind: "cache", name: "Trésor sous les feuilles" },
  { kind: "elite", name: "Le dernier défilé", pool: [130, 131, 143, 149] },
  { kind: "camp", name: "Au seuil de la légende" },
  { kind: "boss", name: "Le gardien légendaire", pool: [150, 149, 131] },
];
export const BONUSES = [
  {
    id: "hp_boost",
    name: "Endurance",
    asset: "healing-berry",
    text: "PV maximum +20 %.",
    max: 3,
  },
  {
    id: "attack_boost",
    name: "Force",
    asset: "attack-fang",
    text: "Attaque et attaque spéciale +15 %.",
    max: 3,
  },
  {
    id: "defense_boost",
    name: "Robustesse",
    asset: "defense-shell",
    text: "Défense et défense spéciale +15 %.",
    max: 3,
  },
  {
    id: "crit_chance",
    name: "Précision",
    asset: "critical-lens",
    text: "Chance de critique +10 points.",
    max: 3,
  },
  {
    id: "type_boost",
    name: "Affinité élémentaire",
    asset: "affinity-crystal",
    text: "Bonus de même type renforcé de 20 %.",
    max: 2,
  },
  {
    id: "regeneration",
    name: "Racines vivantes",
    asset: "healing-berry",
    text: "Récupère 10 % des PV après chaque victoire.",
    max: 2,
  },
  {
    id: "lifesteal",
    name: "Croc vorace",
    asset: "attack-fang",
    text: "Soigne 15 % des dégâts infligés.",
    max: 2,
  },
  {
    id: "first_guard",
    name: "Carapace protectrice",
    asset: "defense-shell",
    text: "Le premier coup reçu est réduit de 50 %.",
    max: 1,
  },
  {
    id: "gold_boost",
    name: "Porte-bonheur",
    asset: "gold-coins",
    text: "Or des combats +30 %.",
    max: 2,
  },
  {
    id: "momentum",
    name: "Élan du voyageur",
    asset: "affinity-crystal",
    text: "Dégâts +3 % par action de combat, maximum +30 %.",
    max: 1,
  },
  {
    id: "pp_boost",
    name: "Second souffle",
    asset: "healing-potion",
    text: "Restaure tous les PP et rend 20 % des PV.",
    max: 5,
  },
  {
    id: "focus_crit",
    name: "Œil du gardien",
    asset: "critical-lens",
    text: "Les coups critiques infligent 25 % de dégâts supplémentaires.",
    max: 1,
  },
];
export const UPGRADE_DEFS = {
  maxHpBonus: {
    name: "Vitalité",
    asset: "healing-berry",
    text: "+5 PV de départ par niveau",
    cost: 100,
  },
  attackBonus: {
    name: "Puissance",
    asset: "attack-fang",
    text: "+3 aux deux attaques par niveau",
    cost: 150,
  },
  defenseBonus: {
    name: "Protection",
    asset: "defense-shell",
    text: "+3 aux deux défenses par niveau",
    cost: 150,
  },
  criticalChance: {
    name: "Instinct",
    asset: "critical-lens",
    text: "+5 points de critique par niveau",
    cost: 200,
  },
};
export const STRUGGLE = {
  id: 0,
  name: "Lutte",
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
export const stage = (run) => STAGES[run.stageIndex];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function random(run) {
  let x = run.seed;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  run.seed = x >>> 0;
  return run.seed / 4294967296;
}
export function baseMeta() {
  return {
    totalRuns: 0,
    bestScore: 0,
    totalVictories: 0,
    gold: 0,
    permanentUpgrades: {
      maxHpBonus: 0,
      attackBonus: 0,
      defenseBonus: 0,
      criticalChance: 0,
    },
    sound: false,
    battleSpeed: 1500,
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
  };
}
export function offerBonuses(run) {
  const candidates = BONUSES.filter(
    (b) =>
      count(run, b.id) < b.max &&
      (b.id !== "pp_boost" ||
        run.hero.hp < run.hero.maxHp ||
        run.hero.moves.some((s) => s.pp < (s.maxPp || 35))),
  );
  const chosen = [];
  while (candidates.length && chosen.length < 3) {
    chosen.push(
      candidates.splice(Math.floor(random(run) * candidates.length), 1)[0].id,
    );
  }
  return chosen;
}
export function createRun(id, meta, catalogue, seed = Date.now()) {
  const run = {
    version: 3,
    id: String(seed) + "-" + id,
    seed: seed >>> 0 || 1,
    phase: "starter",
    stageIndex: 0,
    travelProgress: 0,
    hero: fighter(id, 5, catalogue, meta.permanentUpgrades),
    enemy: null,
    bonuses: [],
    offers: [],
    pendingReward: false,
    coins: meta.gold,
    wins: 0,
    actions: 0,
    battleActions: 0,
    nextSide: "ally",
    settled: false,
    log: ["Une nouvelle expédition commence."],
    stats: { damage: 0, healing: 0, criticals: 0, encounters: 0 },
    upgrades: { ...meta.permanentUpgrades },
  };
  run.hero.maxHp += 25;
  run.hero.hp += 25;
  run.offers = offerBonuses(run);
  return run;
}
export function selectBonus(run, id) {
  if (
    !["starter", "reward", "shrine"].includes(run.phase) ||
    !run.offers.includes(id)
  )
    return false;
  const b = BONUSES.find((b) => b.id === id);
  if (!b || count(run, id) >= b.max) return false;
  run.bonuses.push(id);
  addLog(run, b.name + " obtenu.");
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
  const previous = run.phase;
  run.offers = [];
  run.pendingReward = false;
  if (previous === "starter") {
    run.phase = "travel";
    run.travelProgress = 0;
  } else if (previous === "reward") run.phase = "arrival";
  else depart(run);
  return true;
}
export function arrive(run, catalogue) {
  if (run.phase !== "travel" || run.travelProgress < 1) return false;
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
  run.hero.maxHp += 18;
  run.hero.hp += 18;
  run.pendingEvolution = false;
  addLog(run, `${catalogue.pokemon[id].name} : évolution accomplie !`);
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
        `${catalogue.moves[move.id]?.name || STRUGGLE.name} apprise !`,
      );
}
export function activateStage(run, catalogue) {
  if (run.phase !== "arrival") return false;
  const node = stage(run);
  run.stats.encounters++;
  addLog(run, node.name + ".");
  if (["wild", "elite", "boss"].includes(node.kind)) {
    const id = node.pool[Math.floor(random(run) * node.pool.length)],
      level =
        4 +
        Math.floor(run.stageIndex * 0.65) +
        (node.kind === "elite" ? 1 : node.kind === "boss" ? 2 : 0);
    run.enemy = fighter(id, level, catalogue);
    run.enemy.maxHp -= 20;
    run.enemy.hp = run.enemy.maxHp;
    if (node.kind === "boss") {
      run.enemy.maxHp = Math.ceil(run.enemy.maxHp * 1.15);
      run.enemy.hp = run.enemy.maxHp;
    }
    run.hero.guardUsed = false;
    run.battleActions = 0;
    run.nextSide = "ally";
    run.phase = "battle";
    addLog(run, `${catalogue.pokemon[id].name} vous défie !`);
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
      (1 + 0.15 * count(run, "attack_boost"));
  else
    def =
      (def + (run.upgrades.defenseBonus || 0) * 3) *
      (1 + 0.15 * count(run, "defense_boost"));
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
  return (
    (Math.floor(
      (((2 * attacker.level) / 5 + 2) * move.power * atk) /
        Math.max(1, def) /
        50,
    ) +
      2) *
    stab *
    eff
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
      "Le combat est interrompu après 80 actions. Votre Pokémon est épuisé.",
    );
    return { kind: "exhausted" };
  }
  const player = run.nextSide === "ally",
    a = player ? run.hero : run.enemy,
    d = player ? run.enemy : run.hero,
    move = bestMove(run, catalogue);
  const slot = a.moves.find((s) => s.id === move.id);
  if (slot && slot.pp > 0) slot.pp--;
  const crit =
    random(run) <
    clamp(
      0.0625 +
        (player
          ? (run.upgrades.criticalChance || 0) * 0.05 +
            0.1 * count(run, "crit_chance")
          : 0),
      0,
      0.75,
    );
  let damage =
    expectedDamage(run, a, d, move, catalogue, player) *
    (crit ? 1.5 + (player ? 0.25 * count(run, "focus_crit") : 0) : 1) *
    (0.85 + random(run) * 0.3);
  if (player && count(run, "momentum"))
    damage *= 1 + Math.min(0.3, run.battleActions * 0.03);
  if (!player && count(run, "first_guard") && !d.guardUsed) {
    damage *= 0.5;
    d.guardUsed = true;
  }
  damage = Math.max(1, Math.floor(damage));
  const actual = Math.min(d.hp, damage);
  d.hp = Math.max(0, d.hp - damage);
  let healing = 0;
  if (player && count(run, "lifesteal")) {
    healing = Math.min(
      a.maxHp - a.hp,
      Math.ceil(actual * 0.15 * count(run, "lifesteal")),
    );
    a.hp += healing;
    run.stats.healing += healing;
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
    `${catalogue.pokemon[a.id].name} : ${move.name}, ${actual} dégâts${crit ? " — critique !" : eff > 1 ? " — super efficace !" : eff < 1 ? " — résisté." : "."}`,
  );
  const result = {
    kind: "hit",
    side: player ? "ally" : "enemy",
    move,
    damage: actual,
    healing,
    crit,
    effectiveness: eff,
  };
  if (run.hero.hp <= 0) {
    run.phase = "defeat";
    addLog(run, "Votre Pokémon est K.O.");
  } else if (run.enemy.hp <= 0) winBattle(run, catalogue);
  return result;
}
function winBattle(run, catalogue) {
  if (run.phase !== "battle") return;
  run.wins++;
  const node = stage(run),
    gold = Math.floor(
      (node.kind === "boss" ? 80 : node.kind === "elite" ? 45 : 25) *
        (1 + run.hero.level * 0.1) *
        (1 + 0.3 * count(run, "gold_boost")),
    );
  run.coins += gold;
  const xp = node.kind === "boss" ? 3 : node.kind === "elite" ? 2 : 1;
  run.hero.xp += xp;
  while (run.hero.xp >= 2) {
    run.hero.xp -= 2;
    run.hero.level++;
    run.hero.maxHp += 5;
    run.hero.hp += 5;
    addLog(run, `Niveau ${run.hero.level} atteint !`);
  }
  const evolutions = {
    1: [2, 8],
    2: [3, 11],
    4: [5, 8],
    5: [6, 11],
    7: [8, 8],
    8: [9, 11],
    25: [26, 7],
    152: [153, 7],
    153: [154, 10],
  };
  const evolution = evolutions[run.hero.id];
  if (evolution && run.hero.level >= evolution[1]) {
    run.hero.id = evolution[0];
    run.hero.maxHp += 12;
    run.hero.hp += 12;
    addLog(
      run,
      `${catalogue.pokemon[run.hero.id].name} : évolution accomplie !`,
    );
  }
  if (run.hero.id === 133 && run.hero.level >= 7) run.pendingEvolution = true;
  refreshMoves(run, catalogue);
  const healing = Math.ceil(
    run.hero.maxHp * (0.12 + 0.1 * count(run, "regeneration")),
  );
  run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + healing);
  run.hero.moves.forEach((slot) => {
    const base = catalogue.moves[slot.id];
    if (base) slot.pp = Math.min(base.pp, slot.pp + 2);
  });
  addLog(run, `Victoire ! +${gold} pièces, +${xp} expérience.`);
  run.pendingReward = true;
  if (run.stageIndex === STAGES.length - 1) {
    run.phase = "complete";
    run.pendingReward = false;
    addLog(run, "Le gardien légendaire est vaincu. Expédition accomplie !");
  } else run.phase = "victoryBeat";
}
export function depart(run) {
  if (!["victoryBeat", "camp", "cache", "shop", "shrine"].includes(run.phase))
    return false;
  if (run.stageIndex >= STAGES.length - 1) {
    run.phase = "complete";
    return true;
  }
  run.stageIndex++;
  run.phase = "travel";
  run.travelProgress = 0;
  run.enemy = null;
  return true;
}
export function resolveEncounter(run, choice) {
  if (run.phase === "camp") {
    if (choice === "rest") {
      run.hero.hp = run.hero.maxHp;
      run.hero.moves.forEach((s) => (s.pp = s.maxPp || 35));
      addLog(run, "La source restaure tous les PV et PP.");
    } else if (choice === "train") {
      run.hero.level++;
      run.hero.maxHp += 5;
      run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + 5);
      addLog(run, "Entraînement terminé : niveau +1.");
    } else return false;
  } else if (run.phase === "cache") {
    if (choice === "gold") {
      const amount = 50 + Math.floor(random(run) * 31);
      run.coins += amount;
      addLog(run, `La sacoche contenait ${amount} pièces.`);
    } else if (choice === "heal") {
      run.hero.hp = Math.min(
        run.hero.maxHp,
        run.hero.hp + Math.ceil(run.hero.maxHp * 0.5),
      );
      addLog(run, "Les provisions rendent 50 % des PV.");
    } else return false;
  } else if (run.phase === "shrine" && choice === "leave") {
    addLog(run, "Vous laissez le sanctuaire en paix.");
  } else return false;
  depart(run);
  return true;
}
export const SHOP_ITEMS = {
  potion: {
    name: "Potion",
    asset: "healing-potion",
    cost: 30,
    text: "Rend 35 % des PV.",
    heal: 0.35,
  },
  full_heal: {
    name: "Soin complet",
    asset: "healing-berry",
    cost: 85,
    text: "Restaure tous les PV et PP.",
    heal: 1,
  },
  force: {
    name: "Croc de force",
    asset: "attack-fang",
    cost: 70,
    text: "Ajoute un bonus Force à cette expédition.",
    bonus: "attack_boost",
  },
  guard: {
    name: "Coquille solide",
    asset: "defense-shell",
    cost: 70,
    text: "Ajoute un bonus Robustesse à cette expédition.",
    bonus: "defense_boost",
  },
};
export function buy(run, key) {
  const item = SHOP_ITEMS[key];
  if (run.phase !== "shop" || !item || run.coins < item.cost) return false;
  if (item.heal && run.hero.hp === run.hero.maxHp && key !== "full_heal")
    return false;
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
  if (item.bonus) run.bonuses.push(item.bonus);
  addLog(run, item.name + " acheté.");
  return true;
}
export function settle(run, meta) {
  if (!["defeat", "complete", "retired"].includes(run.phase) || run.settled)
    return false;
  run.settled = true;
  run.endBonus =
    run.phase === "defeat"
      ? 0
      : Math.floor(run.wins * 35 * (1 + run.hero.level * 0.1));
  run.coins += run.endBonus;
  meta.gold = run.coins;
  meta.totalRuns++;
  meta.totalVictories += run.wins;
  meta.bestScore = Math.max(meta.bestScore, run.wins);
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
export function travelPosition(run, route) {
  return pointOnRoute(
    route,
    (run.stageIndex + clamp(run.travelProgress, 0, 1)) / STAGES.length,
  );
}
