import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {ELEMENTAL_CASES,elementalBattle} from "./elemental-fixtures.mjs";
import {projectileAsset} from "../presentation.js";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 for(const [type,starter] of ELEMENTAL_CASES.filter(([type])=>["fire","water","grass","ice","dragon"].includes(type)))for(const side of ["ally","enemy"])for(const [width,height] of [[1440,900],[1280,720],[1024,768]]){
  const run=elementalBattle(type,side,starter,c),meta=E.baseMeta();meta.battleSpeed=750;
  const asset=projectileAsset(E.bestMove(run,c));assert.ok(asset);
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data)),{version:3,meta,run});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(asset=>{const n=document.querySelector(`img.projectile[src$="${asset}.webp"]`),a=n?.getAnimations()[0],p=a?.effect.getComputedTiming().progress;if(p>.35&&p<.65){document.getAnimations().forEach(a=>a.pause());Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});return true;}return false;},asset);
  const projectile=page.locator(`img.projectile[src$="${asset}.webp"]`),node=await projectile.elementHandle();assert.ok(node);
  const bounds=await projectile.boundingBox();assert.ok(bounds.width>80&&bounds.height>15);assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
  assert.equal(await projectile.evaluate(n=>Math.sign(new DOMMatrix(getComputedStyle(n).transform).a)),side==="enemy"?-1:1);
  const centre=await projectile.evaluate(n=>{const r=n.getBoundingClientRect(),scene=document.querySelector("#battle-scene").getBoundingClientRect(),css=getComputedStyle(n);return {dx:r.left+r.width/2-scene.left-parseFloat(css.left),dy:r.top+r.height/2-scene.top-parseFloat(css.top)};});assert.ok(Math.abs(centre.dx)<.1&&Math.abs(centre.dy)<.1);
  const overlaps=await projectile.evaluate(n=>{const a=n.getBoundingClientRect();return [...document.querySelectorAll(".battle-card,.battle-narration")].filter(n=>{const b=n.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}).length;});assert.equal(overlaps,0);
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run);assert.equal(before.actions,run.actions);assert.equal(before.hero.hp,run.hero.hp);assert.equal(before.enemy.hp,run.enemy.hp);
  await page.locator('[data-action="pause"]').click();await page.evaluate(()=>Object.defineProperty(document,"hidden",{configurable:true,get:()=>false}));
  await page.waitForFunction(n=>n.isConnected&&n.getAnimations().every(a=>a.playState==="paused"&&!a.pending),node);
  const held=await projectile.boundingBox();await page.waitForTimeout(250);assert.deepEqual(await projectile.boundingBox(),held);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run),before);
  const style=await page.addStyleTag({content:"dialog,dialog::backdrop{visibility:hidden!important}"});await page.screenshot({path:`output/playwright/${asset}-${type}-${width}-${side}.png`});await style.evaluate(n=>n.remove());
  await page.getByRole("button",{name:"Resume",exact:true}).click();await projectile.waitFor({state:"detached"});await page.waitForFunction(count=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.actions>count,run.actions);
  await page.locator('[data-action="pause"]').click();await page.locator('[data-action="retire"]').click();await page.locator('[data-action="confirm-retire"]').click();assert.equal(await page.locator(".vfx,.damage-number").count(),0);
  checks.push({type,asset,side,width,bounds,centre,overlaps,pausedInFlight:true,cleanup:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile("output/playwright/projectile-results.json",JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({cases:checks.length,errors}));
}finally{await browser.close();}
