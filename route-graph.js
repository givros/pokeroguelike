const cache = new Map();
const alternatives = [
 ['wild','wild','wild'],['cache','wild','camp'],['wild','shrine','cache'],['camp','elite','mystery'],
 ['wild','shop','cache'],[],['cache','wild','mystery'],['elite','camp','cache'],['shrine','wild','camp'],
 ['camp','mystery','wild'],['shop','elite','cache'],['wild','camp','mystery'],['camp','elite','shrine'],['shop','cache','wild'],[],
];
export const ROUTE_KINDS = Object.freeze({
 wild:{name:'Battle',asset:'attack-fang',text:'Fight a wild Pokémon. Earn experience, gold and a new boon.'},
 elite:{name:'Elite',asset:'ravenous-fang-v2',text:'A stronger opponent, with greater rewards. Prepare your build.'},
 boss:{name:'Guardian',asset:'guardian-crest',text:'A guardian blocks every path. Defeat it to continue.'},
 camp:{name:'Spring',asset:'rest-spring',text:'Recover HP and PP, train, or prepare your next opening strike.'},
 cache:{name:'Supplies',asset:'supply-chest',text:'Choose gold, recovery or field notes for an extra level.'},
 shop:{name:'Merchant',asset:'merchant-cart',text:'Spend expedition gold on recovery and boons for this run.'},
 shrine:{name:'Shrine',asset:'offering-bowl',text:'Receive a boon. Offer vitality for two compatible ranks.'},
 mystery:{name:'Unknown',asset:'guardian-eye',text:'An uncertain encounter: a battle, supplies, a spring or a shrine.'},
});
export function routeGraph(seed, stages) {
 const key=seed>>>0;if(cache.has(key))return cache.get(key);
 // Route generation must never consume the expedition's combat/loot RNG.
 let randomState=(key^0x6d2b79f5)>>>0;
 const random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return (randomState>>>0)/4294967296;};
 const nodes=[],rows=[];
 for(let row=0;row<stages.length;row++){
  const base=stages[row],kinds=base.kind==='boss'?['boss']:[base.kind,...alternatives[row]],area=row<=5?'Woodland':row<=10?'Silvermist':'Sanctuary';
  const biomeStages=stages.slice(row<=5?0:row<=10?6:11,row<=5?6:row<=10?11:15);
  const wildPool=[...new Set(biomeStages.filter(s=>s.kind==='wild').flatMap(s=>s.pool))];
  const elitePool=biomeStages.find(s=>s.kind==='elite')?.pool||stages[3].pool;
  rows[row]=kinds.map((kind,lane)=>{
   const actual=kind==='mystery'?['wild','cache','camp','shrine'][Math.floor(random()*4)]:kind;
   const stage=lane===0?{...base,pool:base.pool?[...base.pool]:undefined}:{kind:actual,name:`${area} ${ROUTE_KINDS[actual].name}`,pool:actual==='wild'?[...(wildPool.length?wildPool:stages[6].pool)]:actual==='elite'?[...elitePool]:undefined};
   const node={id:`${row}-${lane}`,row,lane,x:kinds.length===1?.5:.13+lane*.246+(random()-.5)*.035,y:70+(stages.length-1-row)*60,kind,stage,next:[]};nodes.push(node);return node;
  });
 }
 for(let row=0;row<rows.length-1;row++){
  const next=rows[row+1];
  for(const node of rows[row]){
   const near=[...next].sort((a,b)=>Math.abs(a.x-node.x)-Math.abs(b.x-node.x));node.next.push(near[0].id);
   if(near[1]&&(random()>.3||rows[row].length===1))node.next.push(near[1].id);
   if(rows[row].length===1)node.next=next.map(n=>n.id);
  }
  // Retain the original itinerary as one valid path through the new graph.
  rows[row][0].next=[...new Set([...rows[row][0].next,next[0].id])];
  for(const child of next)if(!rows[row].some(n=>n.next.includes(child.id))){const parent=[...rows[row]].sort((a,b)=>Math.abs(a.x-child.x)-Math.abs(b.x-child.x))[0];parent.next.push(child.id);}
 }
 const graph={nodes,rows,height:stages.length*60+90,byId:new Map(nodes.map(n=>[n.id,n]))};
 if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,graph);return graph;
}
export function selectedRouteNode(run, stages, row=run.stageIndex) {
 if(run.routeMode!=='branching'||!Array.isArray(run.branchPath))return null;
 const graph=routeGraph(run.branchSeed,stages);return run.branchPath.map(id=>graph.byId.get(id)).find(n=>n?.row===row)||null;
}
export function routeOptions(run, stages) {
 if(run.routeMode!=='branching'||run.phase!=='travel'||selectedRouteNode(run,stages))return [];
 const graph=routeGraph(run.branchSeed,stages),previous=graph.byId.get(run.branchPath?.at(-1));
 return (graph.rows[run.stageIndex]||[]).filter(node=>!previous||previous.next.includes(node.id));
}
export function enableRouteGraph(run, stages) {
 if(!run||run.routeMode==='branching'||['complete','defeat','retired'].includes(run.phase))return false;
 run.branchSeed=run.initialSeed||run.seed;run.branchStart=run.phase==='starter'?0:run.stageIndex;run.branchPath=[];
 if(!['starter','travel'].includes(run.phase))run.branchPath.push(routeGraph(run.branchSeed,stages).rows[run.stageIndex][0].id);
 run.routeMode='branching';run.landmark=null;run.regionEntry=null;run.travelProgress=run.branchPath.length?1:0;return true;
}
export function validBranchState(run, stages) {
 if(!Number.isInteger(run.branchSeed)||run.branchSeed<=0||run.branchSeed>4294967295||!Number.isInteger(run.branchStart)||run.branchStart<0||run.branchStart>run.stageIndex||!Array.isArray(run.branchPath)||run.branchPath.length>stages.length)return false;
 const graph=routeGraph(run.branchSeed,stages);let previous;
 for(let i=0;i<run.branchPath.length;i++){const node=graph.byId.get(run.branchPath[i]);if(!node||node.row!==run.branchStart+i||(previous&&!previous.next.includes(node.id)))return false;previous=node;}
 if(previous&&previous.row>run.stageIndex)return false;
 if(!previous&&run.stageIndex!==run.branchStart)return false;
 if(run.phase==='starter'&&(run.branchStart!==0||run.branchPath.length))return false;
 if(!['starter','travel','retired'].includes(run.phase)&&previous?.row!==run.stageIndex)return false;
 if(run.phase==='travel'&&previous&&previous.row<run.stageIndex-1)return false;
 return !run.landmark&&!run.regionEntry;
}
