import * as E from "../engine.js";
import {simulate} from "./simulate.mjs";
export const ELEMENTAL_CASES = [
  ["fire",4,"fire-impact"],["water",7,"water-impact"],["grass",1,"leaf-impact"],["ice",7,"ice-impact"],
];
export function elementalBattle(type, side, starter, catalogue) {
  let run;
  if (side === "ally" && type === "ice") {
    run = simulate(2026,7,{stopAt:r=>r.stageIndex===14&&r.phase==="battle"}).run;
  } else {
    const opponent = {
      fire:{hero:1,stage:3,id:58},water:{hero:4,stage:10,id:54},grass:{hero:7,stage:1,id:43},
      ice:{hero:1,stage:12,id:131,form:3},
    }[type];
    run = E.createRun(side === "ally" ? starter : opponent.hero,E.baseMeta(),catalogue,2026);
    E.selectBonus(run,run.offers[0]);
    if (side === "ally") {run.travelProgress=1;E.arrive(run,catalogue);}
    else {
      Object.assign(run,{phase:"arrival",stageIndex:opponent.stage,regionEntry:null,scouting:{stageIndex:opponent.stage,speciesId:opponent.id}});
      if (opponent.form) {run.hero=E.fighter(opponent.form,11,catalogue);run.partnerForms=[1,2,3];}
    }
    E.activateStage(run,catalogue);
  }
  // Keep the real native moves and encounters; enlarge HP only for visual observation.
  run.pendingGrowth=null;run.pendingAwakenings=[];run.regionEntry=null;run.nextSide=side;
  run.hero.hp=run.hero.maxHp=run.enemy.hp=run.enemy.maxHp=600;
  if (side === "enemy") {run.bonuses.push("regeneration","lifesteal");run.hero.shield=1;}
  return run;
}
