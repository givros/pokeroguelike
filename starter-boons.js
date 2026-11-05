export const STARTER_BOONS = [
  {
    id: "iron_fist", name: "Iron Fist", asset: "attack-fang", category: "offense",
    text: "Physical damage +30%. Special damage −15%.",
    damage: ({player, move}) => !player ? 1 : move.damageClass === "physical" ? 1.30 : 0.85,
  },
  {
    id: "mind_focus", name: "Mind Focus", asset: "affinity-crystal", category: "offense",
    text: "Special damage +30%. Physical damage −15%.",
    damage: ({player, move}) => !player ? 1 : move.damageClass === "special" ? 1.30 : 0.85,
  },
  {
    id: "wide_arsenal", name: "Wide Arsenal", asset: "field-notes", category: "offense",
    text: "Moves outside your Pokémon’s types deal 35% more damage. Same-type moves deal 10% less.",
    damage: ({player, sameType, move}) => !player || move.id === 0 ? 1 : sameType ? 0.90 : 1.35,
  },
  {
    id: "type_hunter", name: "Weak Point", asset: "critical-lens", category: "offense",
    text: "Super-effective attacks deal 30% more damage.",
    damage: ({player, effectiveness}) => player && effectiveness > 1 ? 1.30 : 1,
  },
  {
    id: "armor_breaker", name: "Armor Breaker", asset: "attack-fang", category: "offense",
    text: "Resisted attacks deal 60% more damage.",
    damage: ({player, effectiveness}) => player && effectiveness > 0 && effectiveness < 1 ? 1.60 : 1,
  },
  {
    id: "swift_opening", name: "Swift Opening", asset: "wayfarer-spur", category: "offense",
    text: "Deal 40% more damage on the first action of each battle.",
    damage: ({player, run}) => player && run.battleActions === 0 ? 1.40 : 1,
  },
  {
    id: "finisher", name: "Finisher", asset: "ravenous-fang-v2", category: "offense",
    text: "Deal 35% more damage to opponents at or below 35% HP.",
    damage: ({player, defender}) => player && defender.hp <= defender.maxHp * .35 ? 1.35 : 1,
  },
  {
    id: "last_stand", name: "Last Stand", asset: "opening-guard", category: "offense",
    text: "Deal 40% more damage while your Pokémon is at or below 30% HP.",
    damage: ({player, attacker}) => player && attacker.hp <= attacker.maxHp * .30 ? 1.40 : 1,
  },
  {
    id: "glass_cannon", name: "Glass Cannon", asset: "affinity-crystal", category: "offense",
    text: "Deal 28% more damage and take 18% more damage.",
    damage: ({player}) => player ? 1.28 : 1.18,
  },
  {
    id: "trail_barrier", name: "Trail Barrier", asset: "briar-bulwark", category: "defense",
    text: "Begin each battle with a barrier equal to 20% of maximum HP.",
    barrier: .20,
  },
  {
    id: "iron_hide", name: "Iron Hide", asset: "defense-shell", category: "defense",
    text: "Take 25% less physical damage and 10% more special damage.",
    damage: ({player, move}) => player ? 1 : move.damageClass === "physical" ? 0.75 : 1.10,
  },
  {
    id: "mind_veil", name: "Mind Veil", asset: "opening-guard", category: "defense",
    text: "Take 25% less special damage and 10% more physical damage.",
    damage: ({player, move}) => player ? 1 : move.damageClass === "special" ? 0.75 : 1.10,
  },
  {
    id: "guardian_hunter", name: "Guardian Hunter", asset: "guardian-eye", category: "defense",
    text: "Against elites and guardians, deal 15% more damage and take 20% less.",
    damage: ({player, dangerous}) => !dangerous ? 1 : player ? 1.15 : 0.80,
  },
  {
    id: "field_scholar", name: "Field Scholar", asset: "field-notes", category: "expedition",
    text: "Gain one extra experience point after every victory.",
    experience: 1,
  },
  {
    id: "spare_pp", name: "Spare Reserves", asset: "healing-potion", category: "expedition",
    text: "Restore 4 PP per move after every victory instead of 2.",
    ppRecovery: 4,
  },
  {
    id: "ball_handler", name: "Capture Expert", asset: "capture-ball", category: "expedition",
    text: "Capture chance +15 percentage points, up to 85%.",
    captureChance: .15,
  },
].map(boon => ({...boon, max:1, starterOnly:true}));

const byId = new Map(STARTER_BOONS.map(boon => [boon.id, boon]));

export function equippedStarterBoon(run) {
  return byId.get(run.bonuses.find(id => byId.has(id)));
}
