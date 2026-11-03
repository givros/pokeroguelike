import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {elementalBattle} from "./elemental-fixtures.mjs";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 for(const [width,height] of [[1440,900],[1280,720],[1024,768]]){
  const context=await browser.newContext({viewport:{width,height}}),run=elementalBattle("dragon","ally",4,c);
  await context.addInitScript(data=>localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data)),{version:3,meta:E.baseMeta(),run});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();await page.locator('[data-action="pause"]').click();
  // Geometry audit only: cycle untouched source images on paused actors, independently
  // compare the measured CSS marker with the runtime projection in every windup pose.
  const measured=await page.evaluate(async()=>{
   const {BREATH_ORIGINS}=await import("/attack-origins.js"),{BattleEffects}=await import("/presentation.js"),fx=new BattleEffects(),results=[];
   const poses=[{translate:"0px 0px",rotate:"0deg",scale:"1"},{translate:"-13px 4px",rotate:"-3deg",scale:".97"},{translate:"35px -8px",rotate:"3deg",scale:"1.035"}];
   for(const side of ["ally","enemy"])for(const [id,anchor] of Object.entries(BREATH_ORIGINS)){
    const node=document.querySelector(`.actor-${side} .body-art`);node.getAnimations().forEach(a=>a.cancel());node.src=`assets/artwork/${id}.png`;node.dataset.species=id;await node.decode();
    for(const [poseIndex,pose] of poses.entries()){
     Object.assign(node.style,pose);const css=getComputedStyle(node),w=parseFloat(css.width),h=parseFloat(css.height),fit=Math.min(w/node.naturalWidth,h/node.naturalHeight);
     const marker=document.createElement("span"),pin=document.createElement("span");
     marker.style.cssText=`position:absolute;left:${node.offsetLeft}px;top:${node.offsetTop}px;width:${css.width};height:${css.height};transform:${css.transform};transform-origin:${css.transformOrigin};translate:${css.translate};rotate:${css.rotate};scale:${css.scale};visibility:hidden;pointer-events:none`;
     pin.style.cssText=`position:absolute;left:${(w-node.naturalWidth*fit)/2+anchor[0]*node.naturalWidth*fit}px;top:${(h-node.naturalHeight*fit)/2+anchor[1]*node.naturalHeight*fit}px;width:0;height:0`;
     marker.append(pin);node.parentElement.append(marker);const expected=pin.getBoundingClientRect(),scene=document.querySelector("#battle-scene").getBoundingClientRect(),actual=fx.emissionPoint(side,{id:225});
     results.push({side,id:Number(id),pose:poseIndex,error:Math.hypot(actual.x+scene.left-expected.left,actual.y+scene.top-expected.top)});marker.remove();
    }
   }
   return results;
  });
  for(const result of measured){assert.ok(result.error<.1,JSON.stringify({width,...result}));checks.push({width,...result});}await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile("output/playwright/breath-origin-results.json",JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({poses:checks.length,maxErrorPx:Math.max(...checks.map(c=>c.error)),errors}));
}finally{await browser.close();}
