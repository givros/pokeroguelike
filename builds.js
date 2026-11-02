export const SYNERGIES = [
  {
    id: "flurry", name: "Windscar Talons", asset: "flurry-talons",
    requires: { attack_boost: 2, crit_chance: 1 },
    text: "Every strike echoes for 25% extra damage. The echo costs no PP.",
    style: "Predator",
  },
  {
    id: "bulwark", name: "Briar Bulwark", asset: "briar-bulwark",
    requires: { defense_boost: 2, first_guard: 1 },
    text: "Opening Guard also returns 20% of the foe's maximum HP as a riposte.",
    style: "Warden",
  },
  {
    id: "lifebloom", name: "Lifebloom Vessel", asset: "lifebloom-vessel",
    requires: { regeneration: 1, lifesteal: 1 },
    text: "Excess lifesteal becomes a barrier, up to 20% of your maximum HP. The barrier lasts for this battle.",
    style: "Siphon",
  },
];

export function activeSynergies(run) {
  const stacks = new Map();
  for (const id of run.bonuses) stacks.set(id, (stacks.get(id) || 0) + 1);
  return SYNERGIES.filter((recipe) => Object.entries(recipe.requires)
    .every(([id, amount]) => (stacks.get(id) || 0) >= amount));
}

export function awakenedBy(run, id) {
  const existing = new Set(activeSynergies(run).map((recipe) => recipe.id));
  return activeSynergies({ bonuses: [...run.bonuses, id] })
    .filter((recipe) => !existing.has(recipe.id));
}
