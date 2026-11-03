const FOOT = [0.014, 0.025];
const inside = (p,b) => p[0]>=b[0] && p[0]<=b[0]+b[2] && p[1]>=b[1] && p[1]<=b[1]+b[3];
const overlap = (a,b) => a[0]<b[0]+b[2] && a[0]+a[2]>b[0] && a[1]<b[1]+b[3] && a[1]+a[3]>b[1];
export function segmentHitsBox(a,b,box) {
  let enter=0,exit=1;
  for(let axis=0;axis<2;axis++){
    const d=b[axis]-a[axis],lo=box[axis],hi=lo+box[axis+2];
    if(Math.abs(d)<1e-12){if(a[axis]<lo||a[axis]>hi)return false;continue;}
    let t0=(lo-a[axis])/d,t1=(hi-a[axis])/d;if(t0>t1)[t0,t1]=[t1,t0];
    enter=Math.max(enter,t0);exit=Math.min(exit,t1);if(enter>exit)return false;
  }
  return true;
}
export function paddedObstacles(props) {
  return props.map(p=>[p.collider[0]-FOOT[0],p.collider[1]-FOOT[1],p.collider[2]+2*FOOT[0],p.collider[3]+2*FOOT[1]]);
}
const distance = (a,b,aspect) => Math.hypot(b[0]-a[0],(b[1]-a[1])/aspect);
const inBounds = p=>p[0]>=.035&&p[0]<=.965&&p[1]>=.15&&p[1]<=.9;
function shortestPath(start,end,boxes,aspect) {
  if(!inBounds(start)||!inBounds(end)||boxes.some(b=>inside(start,b)||inside(end,b)))return null;
  const nodes=[start,end];
  for(const [x,y,w,h] of boxes)for(const p of [[x-.003,y-.003],[x+w+.003,y-.003],[x-.003,y+h+.003],[x+w+.003,y+h+.003]])
    if(inBounds(p)&&!boxes.some(b=>inside(p,b)))nodes.push(p);
  const links=nodes.map(()=>[]);
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(!boxes.some(b=>segmentHitsBox(nodes[i],nodes[j],b))){
    const cost=distance(nodes[i],nodes[j],aspect);links[i].push([j,cost]);links[j].push([i,cost]);
  }
  const costs=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();costs[0]=0;
  while(visited.size<nodes.length){
    let best=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(best<0||costs[i]<costs[best]))best=i;
    if(best<0||!Number.isFinite(costs[best]))return null;
    if(best===1){const result=[];for(let i=1;i>=0;i=previous[i])result.unshift(nodes[i]);return {path:result,cost:costs[1]};}
    visited.add(best);for(const [next,cost]of links[best])if(costs[best]+cost<costs[next]){costs[next]=costs[best]+cost;previous[next]=best;}
  }
  return null;
}
function clearStandingView(point,scenery) {
  const actor=[point[0]-.045,point[1]-.16,.09,.16];
  const hud=[[.02,.1,.28,.22],[.70,0,.28,.115],[.32,0,.36,.12],[0,.515,1,.485]];
  return !hud.some(b=>overlap(actor,b))&&!scenery.some(p=>overlap(actor,[p.x-p.w/2,p.y-p.h,p.w,p.h]));
}
export function approachFor(zone,scenery,aspect=16/9) {
  const prop=zone.prop;if(!prop)return null;
  const x=prop.x,y=prop.y,side=prop.w/2+.045;
  const targets=[[x+side,y],[x-side,y],[x,y+.06],[x+side*.75,y+.055],[x-side*.75,y+.055],
    [x+side,y+.06],[x-side,y+.06],[x,y+.09],
    [x+prop.w*.35,y+.12],[x-prop.w*.35,y+.12],
    [x+prop.w*.25,y+.12],[x-prop.w*.25,y+.12],[x,y+.14]];
  const boxes=paddedObstacles([...scenery,prop]),paths=[];
  for(const target of targets){
    if(!clearStandingView(target,scenery))continue;
    const result=shortestPath(zone.center,target,boxes,aspect);
    if(result&&result.path.length<=12)paths.push(result);
  }
  paths.sort((a,b)=>a.cost-b.cost);
  if(!paths.length)throw new Error(`No collision-clear approach for ${zone.id} (${zone.kind})`);
  const best=paths[0];
  return {approachPath:best.path,interactionPoint:best.path.at(-1),approachMs:Math.round(Math.max(800,Math.min(3000,best.cost*6500)))};
}
export function attachApproaches(world) {
  for(const biome of Object.values(world.regions||{}))for(const zone of biome.encounters){
    const scenery=[...biome.props,...biome.encounters.filter(other=>other!==zone&&other.prop).map(other=>other.prop)];
    if(zone.prop)Object.assign(zone,approachFor(zone,scenery,world.size.width/world.size.height));
  }
  return world;
}
