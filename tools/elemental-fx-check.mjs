import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {ELEMENTAL_CASES,elementalBattle} from "./elemental-fixtures.mjs";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const filter=process.argv.slice(2),types=ELEMENTAL_CASES.filter(([type])=>!filter.length||filter.includes(type));
assert.ok(types.length,"No matching elemental fixtures");
try{
 for(const [type,starter,effect,moveId,sides=["ally","enemy"]] of types)for(const side of sides)for(const critical of [false,true])for(const [width,height] of [[1440,900],[1280,720],[1024,768]]){
  const r=elementalBattle(type,side,starter,c);r.seed=critical?1:123456789;
  assert.equal(E.bestMove(r,c).type,type);
  if(moveId)assert.equal(E.bestMove(r,c).id,moveId);
  assert.equal(E.battleStep(structuredClone(r),c).crit,critical);
  const name=`${effect}-${type}-${width}-${side}-${critical?"critical":"normal"}`;
  const context=await browser.newContext({viewport:{width,height}}),meta=E.baseMeta();meta.battleSpeed=750;
  await context.addInitScript(data=>{if(!localStorage.getItem("pokeRogueAdventureV3"))localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));},{version:3,meta,run:r});
  if(moveId)await context.addInitScript(()=>{window.__projectiles=[];new MutationObserver(records=>{for(const record of records)for(const n of record.addedNodes)if(n.nodeType===1){if(n.matches("img.projectile"))window.__projectiles.push(n.getAttribute("src"));for(const image of n.querySelectorAll("img.projectile"))window.__projectiles.push(image.getAttribute("src"));}}).observe(document,{subtree:true,childList:true});});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));page.on("response",res=>{if(res.status()>=400)errors.push(`${res.status()} ${res.url()}`);});
  await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(id=>{const node=document.querySelector(`.effect-sprite[data-effect="${id}"]`);if(node&&getComputedStyle(node).backgroundPosition==="100% 0%"){
   document.getAnimations().forEach(a=>a.pause());Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});return true;
  }return false;},effect,{timeout:15000});
  const sprite=page.locator(`.effect-sprite[data-effect="${effect}"]`);await sprite.screenshot({path:`output/playwright/${name}-crop.png`});
  const measured=await sprite.evaluate(async(node,effect)=>{
   const image=new Image();image.src=`assets/effects/${effect}-sheet.webp`;await image.decode();
   const canvas=document.createElement("canvas");canvas.width=canvas.height=512;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(image,512,0,512,512,0,0,512,512);const rgba=ctx.getImageData(0,0,512,512).data,r=node.getBoundingClientRect();
   const hud=[...document.querySelectorAll(".battle-card,.battle-narration")].map(n=>n.getBoundingClientRect());let covered=0;
   for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(rgba[(y*512+x)*4+3]>32){const px=r.left+(x+.5)/512*r.width,py=r.top+(y+.5)/512*r.height;if(hud.some(b=>px>b.left&&px<b.right&&py>b.top&&py<b.bottom))covered++;}
   const numbers=[...document.querySelectorAll(".damage-number")];
   const labelsOverHud=numbers.filter(n=>{const a=n.getBoundingClientRect();return hud.some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);}).map(n=>n.textContent);
   return {covered,frame:getComputedStyle(node).backgroundPosition,labels:numbers.map(n=>n.textContent),labelsOverHud};
  },effect);
  assert.equal(measured.covered,0);assert.equal(measured.frame,"100% 0%");assert.ok(measured.labels.length);assert.deepEqual(measured.labelsOverHud,[]);
  if(side==="enemy")assert.ok(measured.labels.some(label=>label.startsWith("BARRIER")));
  if(moveId)assert.deepEqual(await page.evaluate(()=>window.__projectiles),[],"This move must not send an unrelated elemental projectile during windup");
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run);await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run),saved);
  await page.screenshot({path:`output/playwright/${name}.png`});
  const frames=await sprite.evaluate(node=>{const animation=node.getAnimations().find(a=>a.effect.getKeyframes().some(k=>k.backgroundPosition));return [0,170,330,490].map(time=>{animation.currentTime=time;return getComputedStyle(node).backgroundPosition;});});assert.deepEqual(frames,["0% 0%","100% 0%","0% 100%","100% 100%"]);
  await page.locator('[data-action="pause"]').click();await page.evaluate(()=>Object.defineProperty(document,"hidden",{configurable:true,get:()=>false}));const frozen=await page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run);const heldFrame=await sprite.evaluate(n=>getComputedStyle(n).backgroundPosition);await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run),frozen);assert.equal(await sprite.evaluate(n=>getComputedStyle(n).backgroundPosition),heldFrame);
  await page.getByRole("button",{name:"Resume",exact:true}).click();await sprite.waitFor({state:"detached"});await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="retire"]').click();await page.locator('[data-action="confirm-retire"]').click();assert.equal(await page.locator(".vfx,.damage-number").count(),0);
  checks.push({type,effect,width,side,critical,...measured,frames});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`output/playwright/elemental-fx${filter.length?"-"+filter.join("-"):""}-results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({cases:checks.length,effects:[...new Set(checks.map(c=>c.effect))],maxHudPixelsCovered:Math.max(...checks.map(c=>c.covered)),errors},null,2));
}finally{await browser.close();}
