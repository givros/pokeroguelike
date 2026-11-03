import * as E from "../engine.js";
import {simulate} from "./simulate.mjs";
export const ELEMENTAL_CASES = [
  ["fire",4,"fire-impact"],["water",7,"water-impact"],["grass",1,"leaf-impact"],["ice",7,"ice-impact"],["poison",1,"poison-impact"],
  ["dark",7,"bite-impact",44],["bug",1,"bite-impact",450,["enemy"]],
  ["flying",1,"wind-impact",16,["enemy"]],
  ["dragon",4,"dragon-impact",225],
  ["normal",133,"contact-impact",33],
  ["normal",25,"contact-impact",98,["ally","enemy"],"quick"],
  ["fighting",133,"contact-impact",67,["enemy"]],
];
export function elementalBattle(type, side, starter, catalogue, variant) {
  let run;
  if(variant === "quick") {
    run=E.createRun(side==="ally"?25:152,E.baseMeta(),catalogue,2026);E.selectBonus(run,run.offers[0]);
    const stage=side==="ally"?6:1,id=side==="ally"?27:25;
    Object.assign(run,{phase:"arrival",stageIndex:stage,regionEntry:null,scouting:{stageIndex:stage,speciesId:id}});
    if(side==="ally")run.hero=E.fighter(25,8,catalogue);
    E.activateStage(run,catalogue);
  } else if(type === "dragon") {
    run = E.createRun(4,E.baseMeta(),catalogue,2026);E.selectBonus(run,run.offers[0]);
    Object.assign(run,{phase:"arrival",stageIndex:12,regionEntry:null,scouting:{stageIndex:12,speciesId:149}});
    run.hero=E.fighter(6,11,catalogue);run.partnerForms=[4,5,6];E.activateStage(run,catalogue);
  } else if (side === "ally" && type === "dark") {
    run = E.createRun(7,E.baseMeta(),catalogue,2026);E.selectBonus(run,run.offers[0]);
    Object.assign(run,{phase:"arrival",stageIndex:10,regionEntry:null,scouting:{stageIndex:10,speciesId:63}});
    run.hero=E.fighter(9,11,catalogue);run.partnerForms=[7,8,9];E.activateStage(run,catalogue);
  } else if (side === "ally" && type === "ice") {
    run = simulate(2026,7,{stopAt:r=>r.stageIndex===14&&r.phase==="battle"}).run;
  } else if (side === "ally" && type === "poison") {
    run = simulate(2026,1,{cache:"study",stopAt:r=>r.stageIndex===3&&r.phase==="battle"}).run;
  } else {
    const opponent = {
      fire:{hero:1,stage:3,id:58},water:{hero:4,stage:10,id:54},grass:{hero:7,stage:1,id:43},
      ice:{hero:1,stage:12,id:131,form:3},poison:{hero:152,stage:8,id:92,form:154},
      dark:{hero:1,stage:1,id:23},bug:{hero:152,stage:5,id:123},
      flying:{hero:1,stage:0,id:16},
      normal:{hero:1,stage:0,id:19},fighting:{hero:133,stage:3,id:66},
    }[type];
    run = E.createRun(side === "ally" ? starter : opponent.hero,E.baseMeta(),catalogue,2026);
    E.selectBonus(run,run.offers[0]);
    if (side === "ally") {run.travelProgress=1;E.arrive(run,catalogue);}
    else {
      Object.assign(run,{phase:"arrival",stageIndex:opponent.stage,regionEntry:null,scouting:{stageIndex:opponent.stage,speciesId:opponent.id}});
      if (opponent.form) {run.hero=E.fighter(opponent.form,11,catalogue);run.partnerForms=opponent.hero===1?[1,2,3]:[152,153,154];}
    }
    E.activateStage(run,catalogue);
  }
  // Keep the real native moves and encounters; enlarge HP only for visual observation.
  run.pendingGrowth=null;run.pendingAwakenings=[];run.regionEntry=null;run.nextSide=side;
  run.hero.hp=run.hero.maxHp=run.enemy.hp=run.enemy.maxHp=600;
  if (side === "enemy") {run.bonuses.push("regeneration","lifesteal");run.hero.shield=1;}
  return run;
}
