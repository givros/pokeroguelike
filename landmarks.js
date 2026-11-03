import { pointOnRoute, travelPosition, encounterZone, region } from './engine.js';
export const landmarkMoving = run => !!run.landmark && ['approaching','returning'].includes(run.landmark.state);
export function mapPosition(run, route) {
  const marker=run.landmark;
  if(marker){
    const progress=marker.state==='at'?1:marker.state==='returning'?1-marker.progress:marker.progress;
    return pointOnRoute(marker.path,progress);
  }
  return travelPosition(run,route);
}
export function approachAvailable(run,world) {
  return !!world&&run.routeMode==='regional'&&run.phase==='arrival'&&!run.landmark&&!!encounterZone(run,world)?.approachPath;
}
export function beginApproach(run,world) {
  if(!approachAvailable(run,world))return false;
  const zone=encounterZone(run,world);
  run.landmark={stageIndex:run.stageIndex,state:'approaching',progress:0,path:zone.approachPath.map(p=>[...p]),duration:zone.approachMs};
  return true;
}
export function departurePending(run) {
  return !!run.landmark&&run.phase==='travel'&&run.landmark.stageIndex===run.stageIndex-1&&run.landmark.state==='at';
}
export function prepareDeparture(run) {
  if(!departurePending(run))return false;
  const previous={...run,stageIndex:run.landmark.stageIndex};
  if(region(previous).id!==region(run).id)run.landmark=null;
  else {run.landmark.state='returning';run.landmark.progress=0;}
  return true;
}
export function finishMotion(run) {
  if(!landmarkMoving(run))return false;
  if(run.landmark.state==='approaching'){run.landmark.state='at';run.landmark.progress=1;}
  else run.landmark=null;
  return true;
}
export function remainingMotionMs(run) {
  return run.landmark?Math.max(1,Math.ceil(run.landmark.duration*(1-run.landmark.progress))):0;
}

export function mapFacing(run, world) {
  const marker=run.landmark;
  if(marker?.state==='at'){
    const prop=encounterZone({...run,stageIndex:marker.stageIndex},world)?.prop;
    const x=marker.path.at(-1)[0];
    return prop&&prop.x<x-1e-4?1:-1;
  }
  let a,b;
  if(marker){
    const p=marker.state==='returning'?1-marker.progress:marker.progress;
    a=pointOnRoute(marker.path,Math.max(0,p-.002));b=pointOnRoute(marker.path,Math.min(1,p+.002));
    if(marker.state==='returning')[a,b]=[b,a];
  }else{
    a=travelPosition({...run,travelProgress:Math.max(0,run.travelProgress-.002)},world.route);
    b=travelPosition({...run,travelProgress:Math.min(1,run.travelProgress+.002)},world.route);
  }
  return b[0]<a[0]-1e-6?1:-1;
}
