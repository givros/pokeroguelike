import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {validRun} from "../storage.js";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const run=E.createRun(4,E.baseMeta(),c,2026);
Object.assign(run,{phase:"camp",stageIndex:13,travelProgress:1,hero:E.fighter(5,10,c),partnerForms:[4,5],regionEntry:null});
assert.ok(validRun(run,c));
const meta=E.baseMeta();meta.battleSpeed=750;
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const context=await browser.newContext({viewport:{width:1280,height:720}});
await context.addInitScript(data=>{if(!localStorage.getItem("pokeRogueAdventureV3"))localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));},{version:3,meta,run});
const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run);
async function foot(){
 return page.evaluate(()=>{
  const actor=document.querySelector("#map-actor"),image=actor.querySelector(".body-art"),scene=document.querySelector(".map-canvas").getBoundingClientRect();
  const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let bottom=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>32)bottom=Math.max(bottom,y+1);
  const r=image.getBoundingClientRect(),scale=Math.min(r.width/canvas.width,r.height/canvas.height);
  const anchor=scene.top+Number(actor.dataset.y)*scene.height,feet=r.bottom-(canvas.height-bottom)*scale;
  return {error:feet-anchor,x:Number(actor.dataset.x),y:Number(actor.dataset.y),src:image.src,scale:getComputedStyle(image).scale};
 });
}
try{
 await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();
 await page.locator('[data-action="encounter"][data-value="train"]').click();
 await page.waitForFunction(()=>document.querySelector("#map-actor .body-art")?.src.endsWith("/6.png"));
 await page.locator('[data-action="pause"]').click();
 const during=await foot(),growth=await saved();assert.ok(Math.abs(during.error)<1.1);assert.equal(growth.hero.id,6);assert.equal(growth.hero.level,11);assert.ok(growth.pendingGrowth);
 await page.waitForTimeout(400);assert.deepEqual(await saved(),growth);
 await page.reload();await page.locator('[data-action="resume"]').click();
 await page.waitForFunction(()=>document.querySelector("#map-actor .body-art")?.src.endsWith("/6.png"));
 const replay=await foot();assert.ok(Math.abs(replay.error)<1.1);assert.equal((await saved()).hero.maxHp,growth.hero.maxHp);
 await page.waitForFunction(()=>!JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.pendingGrowth);
 const motion=[];for(let i=0;i<5;i++){motion.push(await foot());await page.waitForTimeout(90);}
 assert.ok(motion.at(-1).x>motion[0].x);assert.ok(motion.every(frame=>Math.abs(frame.error)<6));
 await page.screenshot({path:"output/playwright/map-grounded-charizard.png"});
 await page.locator('[data-action="pause"]').click();const stopped=await saved();await page.waitForTimeout(300);assert.deepEqual(await saved(),stopped);
 checks.push("Actual Charmeleon-to-Charizard evolution keeps the visible feet at the map anchor during the source-image swap");
 checks.push("Pause and reload replay the cosmetic growth without granting HP/levels again; grounding is retained");
 checks.push("Real subsequent walking advances along the saved route; visible feet stay within the deliberate walking bob of the moving anchor");
 assert.deepEqual(errors,[]);await writeFile("output/playwright/map-grounding-results.json",JSON.stringify({checks,during,replay,motion,errors},null,2));console.log(JSON.stringify({checks,during,replay,motion,errors},null,2));
}finally{await browser.close();}
