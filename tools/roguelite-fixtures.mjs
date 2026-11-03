import {readFileSync} from 'node:fs';
import * as E from '../engine.js';
import {planDecision,applyPlanDecision} from '../plans.js';
export const catalogue={pokemon:JSON.parse(readFileSync('data/pokemon.json')),moves:JSON.parse(readFileSync('data/moves.json'))};
export function manualDecision(run){
 if(E.needsRouteChoice(run))return{action:'route',value:`${run.stageIndex}-0`};
 return planDecision({...run,plan:'predator'});
}
export function simulateRoguelite(seed=2026,{starter=null,plan='manual',meta=E.baseMeta()}={}){
 const run=E.createRun(starter||E.startingPartner(meta,seed,catalogue),meta,catalogue,seed);E.enableEndless(run,meta);run.plan=plan;
 let steps=0;while(!['defeat','complete'].includes(run.phase)&&steps++<6000){run.pendingGrowth=null;run.pendingAwakenings=[];
  const decision=plan==='manual'?manualDecision(run):planDecision(run);
  if(decision){if(!applyPlanDecision(run,decision,catalogue))throw Error('Decision failed: '+JSON.stringify(decision));}
  else if(run.phase==='arrival')E.activateStage(run,catalogue);
  else if(run.phase==='battle')E.battleStep(run,catalogue);
  else if(run.phase==='victoryBeat')E.depart(run);
  else if(run.phase==='evolution')E.chooseEvolution(run,134,catalogue);
  else throw Error(run.phase);
 }
 if(steps>=6000)throw Error('Expedition did not stop');E.settle(run,meta);return{run,meta};
}
