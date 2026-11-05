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
 capture:{name:'Unknown Pokémon',asset:'capture-ball',text:'A hidden Pokémon awaits. Defeat it for a chance to capture it and unlock it as a future partner.'},
});
export function routeGraph(seed, stages, procedural=false) {
 const key=`${seed>>>0}:${procedural}`;if(cache.has(key))return cache.get(key);
 // Route generation must never consume the expedition's combat/loot RNG.
 let randomState=((seed>>>0)^0x6d2b79f5)>>>0;
 const random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return (randomState>>>0)/4294967296;};
 const nodes=[],rows=[];
 for(let row=0;row<stages.length;row++){
  const base=stages[row],kinds=base.kind==='boss'?['boss']:procedural?(row===0?['wild','wild','wild','wild']:Array.from({length:3+Math.floor(random()*3)},()=>['wild','wild','elite','capture','capture','camp','cache','shop','shrine','mystery'][Math.floor(random()*10)])):[base.kind,...alternatives[row]],area=row<=5?'Woodland':row<=10?'Silvermist':'Sanctuary';
  if(procedural&&row===1)kinds[0]='capture';
  if(procedural&&row<3)for(let i=0;i<kinds.length;i++)if(kinds[i]==='elite')kinds[i]='wild';
  const biomeStages=stages.slice(row<=5?0:row<=10?6:11,row<=5?6:row<=10?11:15);
  const wildPool=[...new Set(biomeStages.filter(s=>s.kind==='wild').flatMap(s=>s.pool))];
  const elitePool=biomeStages.find(s=>s.kind==='elite')?.pool||stages[3].pool;
  rows[row]=kinds.map((kind,lane)=>{
   const actual=kind==='mystery'?['wild','cache','camp','shrine'][Math.floor(random()*4)]:kind;
   const stage=lane===0&&!procedural||base.kind==='boss'?{...base,pool:base.pool?[...base.pool]:undefined}:{kind:actual,name:`${area} ${ROUTE_KINDS[actual].name}`,pool:actual==='wild'?[...(wildPool.length?wildPool:stages[6].pool)]:actual==='elite'?[...elitePool]:undefined};
   if(procedural&&row===0)stage.pool=[...base.pool];
   const node={id:`${row}-${lane}`,row,lane,x:kinds.length===1?.5:.13+lane*(procedural?.74/(kinds.length-1):.246)+(random()-.5)*.035,y:70+(stages.length-1-row)*60,kind,stage,next:[]};nodes.push(node);return node;
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
 const graph=chapterGraph(run,stages,Math.floor(row/stages.length));return run.branchPath.map(id=>graph.byId.get(id)).find(n=>n?.row===row)||null;
}
export function routeOptions(run, stages) {
 if(run.routeMode!=='branching'||run.phase!=='travel'||selectedRouteNode(run,stages))return [];
 const graph=chapterGraph(run,stages,Math.floor(run.stageIndex/stages.length)),last=run.branchPath?.at(-1),previous=last?chapterGraph(run,stages,Math.floor(Number(last.split('-')[0])/stages.length)).byId.get(last):null;
 return (graph.rows[run.stageIndex]||[]).filter(node=>!previous||previous.next.includes(node.id));
}
export function enableRouteGraph(run, stages) {
 if(!run||run.routeMode==='branching'||['complete','defeat','retired'].includes(run.phase))return false;
 run.branchSeed=run.initialSeed||run.seed;run.branchStart=run.phase==='starter'?0:run.stageIndex;run.branchPath=[];
 if(!['starter','travel'].includes(run.phase))run.branchPath.push(routeGraph(run.branchSeed,stages).rows[run.stageIndex][0].id);
 run.routeMode='branching';run.landmark=null;run.regionEntry=null;run.travelProgress=run.branchPath.length?1:0;return true;
}
export function validBranchState(run, stages) {
 if(!Number.isInteger(run.branchSeed)||run.branchSeed<=0||run.branchSeed>4294967295||!Number.isInteger(run.branchStart)||run.branchStart<0||run.branchStart>run.stageIndex||!Array.isArray(run.branchPath)||run.branchPath.length>(run.endless?256:stages.length))return false;
 let previous;
 for(let i=0;i<run.branchPath.length;i++){const row=run.branchStart+i,node=chapterGraph(run,stages,Math.floor(row/stages.length)).byId.get(run.branchPath[i]);if(!node||node.row!==row||(previous&&!previous.next.includes(node.id)))return false;previous=node;}
 if(previous&&previous.row>run.stageIndex)return false;
 if(!previous&&run.stageIndex!==run.branchStart)return false;
 if(run.phase==='starter'&&(run.branchStart!==0||run.branchPath.length))return false;
 if(!['starter','travel','retired'].includes(run.phase)&&previous?.row!==run.stageIndex)return false;
 if(run.phase==='travel'&&previous&&previous.row<run.stageIndex-1)return false;
 return !run.landmark&&!run.regionEntry;
}

const chapters=new Map();
export function chapterGraph(run,stages,chapter=0){
 if(!run.endless)return routeGraph(run.branchSeed,stages);
 const procedural=chapter>=(run.proceduralFromChapter||0),key=`${run.branchSeed}:${chapter}:${procedural}`;
 if(chapters.has(key))return chapters.get(key);
 const seed=chapter===0?run.branchSeed:((run.branchSeed^Math.imul(chapter,0x9e3779b9))>>>0)||1,base=routeGraph(seed,stages,procedural),offset=chapter*stages.length;
 const nodes=base.nodes.map(n=>({...n,id:`${n.row+offset}-${n.lane}`,row:n.row+offset,next:n.next.map(id=>`${Number(id.split('-')[0])+offset}-${id.split('-')[1]}`)}));
 const last=nodes.find(n=>n.row===offset+stages.length-1);last.next=Array.from({length:4},(_,i)=>`${offset+stages.length}-${i}`);
 const rows={};for(const n of nodes)(rows[n.row]||=[]).push(n);
 const graph={nodes,rows,height:base.height,byId:new Map(nodes.map(n=>[n.id,n]))};if(chapters.size>=64)chapters.delete(chapters.keys().next().value);chapters.set(key,graph);return graph;
}
export function expeditionGraph(run,stages){
 if(!run.endless)return routeGraph(run.branchSeed,stages);
 const current=Math.floor(run.stageIndex/stages.length),first=Math.max(0,current-1),last=current+1,maxRow=(last+1)*stages.length-1,nodes=[],rows={};
 for(let chapter=first;chapter<=last;chapter++)for(const n of chapterGraph(run,stages,chapter).nodes){const node={...n,y:70+(maxRow-n.row)*60};nodes.push(node);(rows[node.row]||=[]).push(node);}
 const byId=new Map(nodes.map(n=>[n.id,n]));for(const n of nodes)n.next=n.next.filter(id=>byId.has(id));
 return{nodes,rows,byId,height:(last-first+1)*stages.length*60+90};
}
