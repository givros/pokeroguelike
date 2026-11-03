import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import * as L from "../landmarks.js";
import {validRun} from "../storage.js";
import {simulate} from "./simulate.mjs";
import {readingContrast} from "./reading-contrast.mjs";
const c={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))},world=JSON.parse(await readFile("data/world-map.json"));
const fixtures=[];
for(const region of E.REGIONS){const run=E.createRun(4,E.baseMeta(),c,2026);Object.assign(run,{phase:"travel",stageIndex:region.from,travelProgress:.5,regionEntry:null});fixtures.push({name:region.id,run});}
for(const stage of [2,4,7,9,11,13]){
 const run=simulate(2026,4,{stopAt:r=>r.stageIndex===stage&&r.phase==="arrival"}).run;Object.assign(run,{pendingGrowth:null,pendingAwakenings:[],regionEntry:null});assert.ok(L.beginApproach(run,world));run.landmark.progress=.5;fixtures.push({name:`approach-${stage}`,run});
 const returning=structuredClone(run);returning.phase="travel";returning.stageIndex++;returning.landmark.state="returning";fixtures.push({name:`return-${stage}`,run:returning});
}
const legacy=structuredClone(fixtures[0].run);legacy.routeMode="legacy";fixtures.push({name:"legacy",run:legacy});
const baseline=process.argv.includes("--baseline"),out=`output/playwright/travel-caption${baseline?"-before":""}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 for(const [width,height] of baseline?[[1280,720]]:[[1440,900],[1280,720],[1024,768]])for(const fixture of baseline?fixtures.slice(0,1):fixtures){
  assert.ok(validRun(fixture.run,c),fixture.name);const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>{localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));Object.defineProperty(document,"hidden",{get:()=>true});},{version:3,meta:E.baseMeta(),run:fixture.run});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();await page.locator(".travel-caption").waitFor();await page.locator("img").evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  const layout=await page.locator(".travel-caption").evaluate(root=>{const box=root.getBoundingClientRect(),screen=document.querySelector(".game-screen").getBoundingClientRect(),failures=[];for(const n of root.querySelectorAll("strong,span")){const range=document.createRange();range.selectNodeContents(n);if(parseFloat(getComputedStyle(n).fontSize)<14)failures.push("small text");for(const r of range.getClientRects())if(r.left<box.left||r.right>box.right||r.top<box.top||r.bottom>box.bottom)failures.push(n.textContent);}return {failures,inBounds:box.left>=screen.left+8&&box.right<=screen.right-8&&box.bottom<=screen.bottom-8};});if(!baseline)assert.ok(layout.inBounds);assert.deepEqual(layout.failures,[]);
  await page.screenshot({path:`${out}/${fixture.name}-${width}.png`});const contrast=await readingContrast(page,".travel-caption");if(!baseline)assert.ok(contrast.minimum>=4.5,JSON.stringify({width,name:fixture.name,contrast}));
  checks.push({name:fixture.name,width,minimumContrast:contrast.minimum,samples:contrast.samples});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({cases:checks.length,minimumContrast:Math.min(...checks.map(c=>c.minimumContrast)),errors}));
}finally{await browser.close();}
