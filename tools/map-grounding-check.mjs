import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {validRun} from "../storage.js";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const meta=E.baseMeta();meta.battleSpeed=750;
const browser=await chromium.launch({headless:true}),errors=[],checks=[],records=[];
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run);
async function foot(page){
 return page.evaluate(()=>{
  const actor=document.querySelector("#map-actor"),image=actor.querySelector(".body-art"),scene=document.querySelector(".map-canvas").getBoundingClientRect();
  const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let bottom=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>32)bottom=Math.max(bottom,y+1);
  const r=image.getBoundingClientRect(),scale=Math.min(r.width/canvas.width,r.height/canvas.height);
  const anchor=scene.top+Number(actor.dataset.y)*scene.height,feet=r.bottom-(canvas.height-bottom)*scale;
  return {error:feet-anchor,x:Number(actor.dataset.x),y:Number(actor.dataset.y),src:image.src,species:Number(image.dataset.species),flip:Math.sign(new DOMMatrix(getComputedStyle(image).transform).a),scale:getComputedStyle(image).scale};
 });
}
try{
 for(const [starter,from,to,level,stage,forms] of [[4,5,6,10,13,[4,5]],[7,8,9,10,13,[7,8]],[1,1,2,7,4,[1]]]){
 const run=E.createRun(starter,E.baseMeta(),c,2026);
 Object.assign(run,{phase:"camp",stageIndex:stage,travelProgress:1,hero:E.fighter(from,level,c),partnerForms:forms,regionEntry:null});assert.ok(validRun(run,c));
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 await context.addInitScript(data=>{if(!localStorage.getItem("pokeRogueAdventureV3"))localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));},{version:3,meta,run});
 const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();
 await page.locator('[data-action="encounter"][data-value="train"]').click();
 await page.waitForFunction(id=>document.querySelector("#map-actor .body-art")?.src.endsWith(`/${id}.png`),to);
 await page.locator('[data-action="pause"]').click();
 const during=await foot(page),growth=await saved(page);assert.ok(Math.abs(during.error)<1.1);assert.equal(during.species,to);assert.equal(growth.hero.id,to);assert.equal(growth.hero.level,level+1);assert.ok(growth.pendingGrowth);
 await page.waitForTimeout(400);assert.deepEqual(await saved(page),growth);
 await page.reload();await page.locator('[data-action="resume"]').click();
 await page.waitForFunction(id=>document.querySelector("#map-actor .body-art")?.src.endsWith(`/${id}.png`),to);
 const replay=await foot(page);assert.ok(Math.abs(replay.error)<1.1);assert.equal(replay.species,to);assert.equal((await saved(page)).hero.maxHp,growth.hero.maxHp);
 await page.waitForFunction(()=>!JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.pendingGrowth);
 const motion=[];for(let i=0;i<5;i++){motion.push(await foot(page));await page.waitForTimeout(90);}
 assert.ok(Math.abs(motion.at(-1).x-motion[0].x)>.0001);assert.ok(motion.every(frame=>Math.abs(frame.error)<6));
 for(let i=1;i<motion.length;i++){const dx=motion[i].x-motion[i-1].x;if(Math.abs(dx)>1e-7)assert.equal(motion[i].flip,(dx>0?-1:1)*([2,9].includes(to)?-1:1));}
 await page.screenshot({path:`output/playwright/map-grounded-${to}.png`});
 await page.locator('[data-action="pause"]').click();const stopped=await saved(page);await page.waitForTimeout(300);assert.deepEqual(await saved(page),stopped);
 checks.push(`Actual ${from}-to-${to} evolution updates artwork identity and visible feet during the source-image swap; subsequent movement faces its actual direction`);
 records.push({from,to,during,replay,motion});await context.close();
 }
 checks.push("Pause and reload replay the cosmetic growth without granting HP/levels again; grounding is retained");
 checks.push("Real subsequent walking advances along the saved route; visible feet stay within the deliberate walking bob of the moving anchor");
 assert.deepEqual(errors,[]);await writeFile("output/playwright/map-grounding-results.json",JSON.stringify({checks,records,errors},null,2));console.log(JSON.stringify({checks,records,errors},null,2));
}finally{await browser.close();}
