import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {elementalBattle} from "./elemental-fixtures.mjs";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 for(const mode of ["before-launch","in-flight","complete"]){
  const context=await browser.newContext({viewport:{width:1280,height:720}});
  await context.addInitScript(data=>localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data)),{version:3,meta:E.baseMeta(),run:elementalBattle("dragon","ally",4,c)});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();await page.locator('[data-action="pause"]').click();
  const result=await page.evaluate(async mode=>{
   const {BattleEffects}=await import("/presentation.js"),fx=new BattleEffects();fx.setPaused(true);
   const before=localStorage.getItem("pokeRogueAdventureV3");let waits=0,replacement,replacementAnimation;
   const completed=await fx.windup("ally",{id:225,type:"dragon"},async()=>{
    waits++;const cancelling=mode==="before-launch"&&waits===1||mode==="in-flight"&&waits===2;
    if(cancelling){
     if(mode==="before-launch"){const scene=document.querySelector("#battle-scene");scene.replaceWith(scene.cloneNode(true));}
     replacement=fx.image("leaf-wisp",{x:500,y:300},80,"replacement-effect");
     replacementAnimation=fx.animate(replacement,[{opacity:1},{opacity:.8}],{duration:1000});return false;
    }
    return true;
   },750);
   const result={mode,completed,waits,projectiles:document.querySelectorAll(".projectile").length,
    replacementRetained:!!replacement?.isConnected,replacementAnimationRetained:fx.animations.has(replacementAnimation),
    trackedAnimations:fx.animations.size,stateUnchanged:localStorage.getItem("pokeRogueAdventureV3")===before};
   fx.clear();result.cleaned=document.querySelectorAll(".vfx,.damage-number").length===0;return result;
  },mode);
  assert.equal(result.completed,mode==="complete");assert.equal(result.waits,mode==="before-launch"?1:2);assert.equal(result.projectiles,mode==="complete"?1:0);
  assert.equal(result.replacementRetained,mode!=="complete");assert.equal(result.replacementAnimationRetained,mode!=="complete");assert.equal(result.trackedAnimations,mode==="complete"?2:1);
  assert.ok(result.stateUnchanged&&result.cleaned);checks.push(result);await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile("output/playwright/windup-cancellation-results.json",JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
