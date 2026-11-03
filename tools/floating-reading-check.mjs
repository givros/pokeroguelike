import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {readingContrast} from "./reading-contrast.mjs";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))},fixtures=[];
for(const region of E.REGIONS){
 const map=E.createRun(4,E.baseMeta(),c,2026);Object.assign(map,{phase:"travel",stageIndex:region.from,travelProgress:.5,regionEntry:null});fixtures.push({name:`map-${region.id}`,run:map,selectors:[".stage-heading"]});
 const stage=region.to,run=E.createRun(4,E.baseMeta(),c,2026);E.selectBonus(run,run.offers[0]);Object.assign(run,{phase:"arrival",stageIndex:stage,regionEntry:null});E.activateStage(run,c);run.plan="predator";fixtures.push({name:`battle-${region.id}`,run,selectors:[".stage-heading",".battle-kind"]});
}
fixtures.push({name:"title",run:null,selectors:[".title-brand",".title-stats",".starter-heading",".starter-line"]});
fixtures.push({name:"title-progress",run:null,meta:{...E.baseMeta(),gold:100000000,totalVictories:100000000,bestScore:100000000},selectors:[".title-brand",".title-stats",".starter-heading",".starter-line",".title-actions"]});
const resume=E.createRun(4,E.baseMeta(),c,2026);fixtures.push({name:"resume",run:resume,title:true,selectors:[".title-brand",".title-stats",".starter-heading",".starter-line"]});
const baseline=process.argv.includes("--baseline"),out=`output/playwright/floating-reading${baseline?"-before":""}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 for(const [width,height] of baseline?[[1280,720]]:[[1440,900],[1280,720],[1024,768]])for(const fixture of fixtures){
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>{localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));Object.defineProperty(document,"hidden",{get:()=>true});},{version:3,meta:fixture.meta||E.baseMeta(),run:fixture.run});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.goto("http://127.0.0.1:5173");await page.locator(".game-screen[data-phase]").waitFor();if(fixture.run&&!fixture.title)await page.locator('[data-action="resume"]').click();await page.locator("img").evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  await page.screenshot({path:`${out}/${fixture.name}-${width}.png`});
  if(!baseline){const layout=await page.evaluate(()=>{
   const failures=[],screen=document.querySelector(".game-screen").getBoundingClientRect(),root=document.querySelector(".stage-heading")||document.querySelector(".title-scene"),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
   while(n=walker.nextNode())if(n.textContent.trim()){const css=getComputedStyle(n.parentElement),range=document.createRange();range.selectNodeContents(n);if(parseFloat(css.fontSize)<14)failures.push(`Small: ${n.textContent}`);for(const r of range.getClientRects())if(r.width&&(r.left<screen.left+8||r.right>screen.right-8||r.top<screen.top+8||r.bottom>screen.bottom-8))failures.push(`Clipped: ${n.textContent}`);}
   const heading=document.querySelector(".stage-heading");if(heading){const a=heading.getBoundingClientRect();for(const selector of [".hud-left",".hud-controls",".ally-card",".enemy-card"]){const b=document.querySelector(selector)?.getBoundingClientRect();if(b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)failures.push(`Header overlaps ${selector}`);}}
   const resume=document.querySelector(".resume-adventure");if(resume){const b=resume.getBoundingClientRect(),stats=document.querySelector(".title-stats"),w=document.createTreeWalker(stats,NodeFilter.SHOW_TEXT);while(n=w.nextNode())if(n.textContent.trim()){const r=document.createRange();r.selectNodeContents(n);for(const a of r.getClientRects())if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)failures.push(`Resume covers ${n.textContent}`);}}
   return failures;
  });assert.deepEqual(layout,[],JSON.stringify({name:fixture.name,width}));}
  for(const selector of fixture.selectors){const contrast=await readingContrast(page,selector,{includeButtons:true});assert.ok(contrast.samples.length);if(!baseline)assert.ok(contrast.minimum>=4.5,JSON.stringify({name:fixture.name,width,selector,contrast}));checks.push({name:fixture.name,width,selector,...contrast});}
  await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({fields:checks.length,minimumContrast:Math.min(...checks.map(c=>c.minimum)),weakFields:checks.filter(c=>c.minimum<4.5).map(({name,width,selector,minimum})=>({name,width,selector,minimum})),errors}));
}finally{await browser.close();}
