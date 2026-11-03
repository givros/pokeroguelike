// Native species/ability pairs verified against PokéAPI's Pokémon and ability resources.
// https://pokeapi.co/docs/v2#abilities
export const GUARDIANS = Object.freeze([
  { species:123, id:68, key:"swarm", name:"Swarm", hidden:false,
    text:"Bug attacks deal 50% more damage at one-third HP or less.",
    tactic:"Prepare for its final attacks. Resilience and Opening Guard can soften the burst." },
  { species:150, id:46, key:"pressure", name:"Pressure", hidden:false,
    text:"Your attacks cost 2 PP. A move with only 1 PP can still be used. Struggle costs no PP.",
    tactic:"Restore PP before this guardian. Strength and Flurry help finish the fight with fewer attacks." },
  { species:149, id:136, key:"multiscale", name:"Multiscale", hidden:true,
    text:"Attack damage is halved while this guardian has full HP. Once wounded, it takes normal damage.",
    tactic:"The protection breaks after the first hit. Flurry adds damage without spending another PP." },
  { species:131, id:75, key:"shell-armor", name:"Shell Armor", hidden:false,
    text:"Your attacks cannot score critical hits against this guardian.",
    tactic:"Strength, Elemental Affinity and defensive builds remain effective. Precision cannot bypass this armor." },
].map(ability => Object.freeze({ ...ability,
  source:`https://pokeapi.co/api/v2/ability/${ability.id}/`,
  speciesSource:`https://pokeapi.co/api/v2/pokemon/${ability.species}/`,
})));

export function guardianAbility(run, species = run.enemy?.id, stageIndex = run.stageIndex) {
  // Old expeditions retain their original rules, including a saved battle in progress.
  if (run.guardianAbilities !== true || ![5,14].includes(stageIndex)) return null;
  if (stageIndex === 5 && species !== 123) return null;
  if (stageIndex === 14 && ![150,149,131].includes(species)) return null;
  return GUARDIANS.find(ability => ability.species === species) || null;
}

export function guardianState(run) {
  const ability = guardianAbility(run);
  if (!ability || !run.enemy) return "";
  if (run.enemy.hp <= 0) return "Defeated: ability inactive.";
  if (ability.key === "swarm") return run.enemy.hp * 3 <= run.enemy.maxHp ? "Active: Bug damage +50%." : "Dormant until one-third HP.";
  if (ability.key === "multiscale") return run.enemy.hp === run.enemy.maxHp ? "Active: full-HP protection." : "Broken: normal damage taken.";
  return "Active throughout this battle.";
}
