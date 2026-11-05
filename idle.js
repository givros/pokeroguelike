import * as E from "./engine.js";
import { planDecision, applyPlanDecision } from "./plans.js";
import * as L from "./landmarks.js";
export const MAX_IDLE_MS = 8 * 60 * 60 * 1000;
const TERMINAL = new Set(["complete", "defeat", "retired"]);
export function idleStepCost(run, world) {
  if (run.introChoicePending || (run.introPending && run.introMode === 'random')) return null;
  if (TERMINAL.has(run.phase) || run.phase === "evolution") return null;
  if(run.introPending)return 3700;
  if (run.pendingGrowth || run.pendingAwakenings?.length || run.regionEntry) return 1600;
  if (L.landmarkMoving(run)) return L.remainingMotionMs(run);
  if (L.departurePending(run)) return run.landmark.duration;
  if (L.approachAvailable(run, world)) return E.encounterZone(run, world).approachMs;
  if (planDecision(run)) return 1100;
  if (E.needsRouteChoice(run)) return null;
  if (run.phase === "travel") return Math.max(1, Math.ceil(4500 * (1 - run.travelProgress)));
  if (run.phase === "arrival") return 700;
  if (run.phase === "battle") return 1500;
  if (run.phase === "victoryBeat") return 1200;
  return null;
}
function step(run, catalogue, world) {
  if(run.introPending){run.introPending=false;return;}
  if (run.pendingGrowth) { run.pendingGrowth = null; return; }
  if (run.pendingAwakenings?.length) { run.pendingAwakenings.shift(); return; }
  if (run.regionEntry) { run.regionEntry = null; return; }
  if (L.landmarkMoving(run)) { L.finishMotion(run); return; }
  if (L.departurePending(run)) { L.prepareDeparture(run); L.finishMotion(run); return; }
  if (L.approachAvailable(run, world)) { L.beginApproach(run, world); L.finishMotion(run); return; }
  const decision = planDecision(run);
  if (decision) {
    if (!applyPlanDecision(run, decision, catalogue)) throw new Error("Idle plan could not apply its choice");
    return;
  }
  if (run.phase === "travel") { run.travelProgress = 1; E.arrive(run, catalogue); }
  else if (run.phase === "arrival") E.activateStage(run, catalogue);
  else if (run.phase === "battle") E.battleStep(run, catalogue);
  else if (run.phase === "victoryBeat") E.depart(run);
}
export function advanceIdle(run, meta, catalogue, elapsedMs, world) {
  if (!run.idleEnabled || !run.plan || run.plan === "manual" || TERMINAL.has(run.phase)) return null;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.min(MAX_IDLE_MS, elapsedMs)) : 0;
  let budget = Math.min(MAX_IDLE_MS, elapsed + (run.idleCredit || 0)), transitions = 0;
  const before = { wins:run.wins, coins:run.coins, level:run.hero.level, stage:run.stageIndex+1, actions:run.actions };
  let cost = idleStepCost(run, world);
  while (cost !== null && budget >= cost && transitions < 2000) {
    budget -= cost;
    step(run, catalogue, world);
    transitions++;
    cost = idleStepCost(run, world);
  }
  run.idleCredit = cost === null ? 0 : budget;
  if (TERMINAL.has(run.phase)) {
    run.pendingGrowth = null; run.pendingAwakenings = []; run.regionEntry = null;
    E.settle(run, meta);
  }
  if (!transitions) return null;
  return { elapsed, transitions, wins:run.wins-before.wins, goldChange:run.coins-before.coins,
    levels:run.hero.level-before.level, fromStage:before.stage, toStage:run.stageIndex+1,
    actions:run.actions-before.actions, outcome:run.phase, waitingForEvolution:run.phase === "evolution" };
}
