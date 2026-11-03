export const SKILLS = Object.freeze([
 {id:'adrenaline',name:'Adrenaline',asset:'flurry-talons',cost:3,text:'Deal 25% more damage while below 35% HP.'},
 {id:'ward',name:'Spirit Ward',asset:'briar-bulwark',cost:5,text:'Begin each battle with a barrier equal to 12% maximum HP.'},
 {id:'renewal',name:'Renewal',asset:'living-roots',cost:5,text:'Recover an additional 6% maximum HP after victories.'},
]);
export const EQUIPMENT = Object.freeze([
 {id:'fang',name:"Hunter's Fang",asset:'attack-fang',text:'Attack and Special Attack +6% per tier.'},
 {id:'shell',name:"Warden's Shell",asset:'defense-shell',text:'Defense and Special Defense +6% per tier.'},
 {id:'charm',name:'Vitality Charm',asset:'healing-berry',text:'Starting maximum HP +8 per tier.'},
 {id:'root',name:'Bloodroot Talisman',asset:'living-roots',text:'Heal for 2% of damage dealt per tier.'},
 {id:'lens',name:'Keen Lens',asset:'critical-lens',text:'Critical chance +3 percentage points per tier.'},
]);
export const gearTier = (run,id) => run.endless&&run.gear?.id===id ? run.gear.tier : 0;
export function unlockSkill(meta,id){const skill=SKILLS.find(s=>s.id===id);if(!skill||meta.learnedSkills.includes(id)||meta.legacyMarks<skill.cost)return false;meta.legacyMarks-=skill.cost;meta.learnedSkills.push(id);if(!meta.equippedSkill)meta.equippedSkill=id;return true;}
export function equipSkill(meta,id){if(id!==''&&!meta.learnedSkills.includes(id))return false;meta.equippedSkill=id||null;return true;}
export function equipGear(meta,id){if(id!==''&&!meta.equipment[id])return false;meta.equippedGear=id||null;return true;}
export function salvageEquipment(run){
 let x=(run.lootSeed||run.initialSeed||run.seed)^0xa511e9b3;x^=x<<13;x^=x>>>17;x^=x<<5;run.lootSeed=x>>>0||1;
 const item=EQUIPMENT[run.lootSeed%EQUIPMENT.length],tier=Math.min(10,1+Math.floor(run.stageIndex/15));
 run.salvage[item.id]=Math.max(run.salvage[item.id]||0,tier);return{...item,tier};
}
export function awardLegacy(run,meta){
 const earned=run.wins>0||run.phase==='defeat'&&run.actions>0?Math.max(1,Math.floor(run.wins/2)+Math.floor((run.stageIndex+1)/4)):0;
 let duplicates=0;const secured=[];
 for(const [id,tier]of Object.entries(run.salvage||{})){if((meta.equipment[id]||0)>=tier)duplicates++;else{meta.equipment[id]=tier;secured.push({id,tier});}}
 run.legacyReward={marks:earned+duplicates,equipment:secured};meta.legacyMarks+=earned+duplicates;meta.bestDepth=Math.max(meta.bestDepth||0,run.stageIndex+1);
 if(!meta.equippedGear&&secured.length)meta.equippedGear=secured[0].id;
}
