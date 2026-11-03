import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {validRun} from "../storage.js";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const fixtures=[{id:2,side:"ally",starter:1,form:2,level:8,forms:[1,2],stage:5,foe:123},
 {id:9,side:"ally",starter:7,form:9,level:11,forms:[7,8,9],stage:14,foe:149},
 {id:147,side:"enemy",starter:7,form:9,level:11,forms:[7,8,9],stage:10,foe:147},
 {id:150,side:"enemy",starter:4,form:6,level:11,forms:[4,5,6],stage:14,foe:150}];
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 for(const fixture of fixtures)for(const [width,height] of [[1440,900],[1280,720],[1024,768]]){
  const run=E.createRun(fixture.starter,E.baseMeta(),c,2026);E.selectBonus(run,run.offers[0]);
  Object.assign(run,{phase:"arrival",stageIndex:fixture.stage,regionEntry:null,scouting:{stageIndex:fixture.stage,speciesId:fixture.foe},hero:E.fighter(fixture.form,fixture.level,c),partnerForms:fixture.forms});
  E.activateStage(run,c);run.nextSide=fixture.side;run.hero.hp=run.hero.maxHp=run.enemy.hp=run.enemy.maxHp=600;assert.ok(validRun(run,c));
  const meta=E.baseMeta();meta.battleSpeed=4500;const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data)),{version:3,meta,run});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(side=>{const n=document.querySelector(`.actor-${side} .body-art`),a=n?.getAnimations()[0],p=a?.effect.getComputedTiming().progress;if(p>.08&&p<.25){document.querySelector('[data-action="pause"]').click();return true;}return false;},fixture.side);
  const node=page.locator(`.actor-${fixture.side} .body-art`);assert.equal(Number(await node.getAttribute("data-species")),fixture.id);
  const axis=await node.evaluate(n=>Math.sign(new DOMMatrix(getComputedStyle(n).transform).a));assert.equal(axis,fixture.side==="ally"?1:-1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).run.actions),0);
  const style=await page.addStyleTag({content:"dialog,dialog::backdrop{visibility:hidden!important}"});await page.screenshot({path:`output/playwright/facing-${fixture.id}-${width}.png`});await style.evaluate(n=>n.remove());
  checks.push({id:fixture.id,side:fixture.side,width,axis,nativeMove:E.bestMove(run,c).name});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile("output/playwright/facing-runtime-results.json",JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({cases:checks.length,errors}));
}finally{await browser.close();}
