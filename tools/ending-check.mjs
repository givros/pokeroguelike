import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
import {simulate} from "./simulate.mjs";
const catalogue={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const complete=simulate(2026,4).run,completeMeta=E.baseMeta();E.settle(complete,completeMeta);
const defeat=E.createRun(4,E.baseMeta(),catalogue,2026);E.selectBonus(defeat,defeat.offers[0]);defeat.travelProgress=1;E.arrive(defeat,catalogue);E.activateStage(defeat,catalogue);defeat.hero.hp=1;defeat.nextSide="enemy";E.battleStep(defeat,catalogue);assert.equal(defeat.phase,"defeat");
const defeatMeta=E.baseMeta();E.settle(defeat,defeatMeta);
const retired=simulate(2026,4,{stopAt:r=>r.stageIndex===13&&r.phase==="camp"}).run;retired.phase="retired";const retiredMeta=E.baseMeta();E.settle(retired,retiredMeta);
const maximum=structuredClone(complete),maximumMeta=structuredClone(completeMeta);Object.assign(maximum,{threat:6,coins:100000000});Object.assign(maximumMeta,{unlockedThreat:6,selectedThreat:6});
const blastoise=simulate(2026,7).run,blastoiseMeta=E.baseMeta();assert.equal(blastoise.hero.id,9);E.settle(blastoise,blastoiseMeta);
const ivysaur=simulate(2026,1,{cache:"study",stopAt:r=>r.hero.id===2&&r.phase!=="battle"}).run;assert.equal(ivysaur.hero.id,2);Object.assign(ivysaur,{phase:"retired",pendingGrowth:null,pendingAwakenings:[]});const ivysaurMeta=E.baseMeta();E.settle(ivysaur,ivysaurMeta);
const cases=[{name:"complete",run:complete,meta:completeMeta},{name:"defeat",run:defeat,meta:defeatMeta},{name:"retired",run:retired,meta:retiredMeta},{name:"maximum",run:maximum,meta:maximumMeta},{name:"blastoise",run:blastoise,meta:blastoiseMeta},{name:"ivysaur",run:ivysaur,meta:ivysaurMeta}];
const baseline=process.argv.includes("--baseline"),out=`output/playwright/endings${baseline?"-before":""}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 for(const [width,height] of baseline?[[1440,900]]:[[1440,900],[1280,720],[1024,768]])for(const fixture of baseline?cases.slice(0,1):cases){
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>{localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));Object.defineProperty(document,"hidden",{get:()=>true});},{version:3,meta:fixture.meta,run:fixture.run});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.goto("http://127.0.0.1:5173");await page.locator(".ending-content").waitFor();await page.locator("img").evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  const layout=await page.evaluate(()=>{
   const root=document.querySelector(".ending-content"),screen=document.querySelector(".game-screen").getBoundingClientRect(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),texts=[],failures=[];let n;
   while(n=walker.nextNode())if(n.textContent.trim()){
    const parent=n.parentElement,css=getComputedStyle(parent),range=document.createRange();range.selectNodeContents(n);
    for(const r of range.getClientRects())if(r.width&&r.height){if(r.left<screen.left+8||r.right>screen.right-8||r.top<screen.top+8||r.bottom>screen.bottom-8||parseFloat(css.fontSize)<14)failures.push(n.textContent);if(!parent.closest("button"))texts.push({text:n.textContent,color:css.color,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}});}
   }
   return {texts,failures};
  });assert.deepEqual(layout.failures,[]);
  await page.screenshot({path:`${out}/${fixture.name}-${width}.png`});
  const hide=await page.addStyleTag({content:".ending-content,.ending-content *{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0 transparent!important}"});const background=await page.screenshot();await hide.evaluate(n=>n.remove());
  const contrast=await page.evaluate(async({background,texts})=>{
   const image=new Image();image.src=background;await image.decode();const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
   return texts.map(t=>{const foreground=luminance(t.color.match(/[\d.]+/g).slice(0,3).map(Number));let minimum=Infinity;for(let y=Math.floor(t.rect.top);y<Math.ceil(t.rect.bottom);y++)for(let x=Math.floor(t.rect.left);x<Math.ceil(t.rect.right);x++){const i=(y*canvas.width+x)*4,bg=luminance([pixels[i],pixels[i+1],pixels[i+2]]);minimum=Math.min(minimum,(Math.max(foreground,bg)+.05)/(Math.min(foreground,bg)+.05));}return {text:t.text,minimum};});
  },{background:`data:image/png;base64,${background.toString("base64")}`,texts:layout.texts});
  const minimumContrast=Math.min(...contrast.map(t=>t.minimum));if(!baseline)assert.ok(minimumContrast>=4.5,JSON.stringify({name:fixture.name,width,contrast}));
  if(!baseline){
   const heroCoverage=await page.evaluate(async()=>{
    const n=document.querySelector(".ending-partner"),src=n.src,species=n.dataset.species,forms=[1,2,3,4,5,6,7,8,9,25,26,133,134,135,136,152,153,154],results=[];
    for(const id of forms){n.src=`assets/artwork/${id}.png`;n.dataset.species=id;await n.decode();const canvas=document.createElement("canvas");canvas.width=n.naturalWidth;canvas.height=n.naturalHeight;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(n,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let minX=canvas.width,maxX=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>32){minX=Math.min(minX,x);maxX=Math.max(maxX,x);}
     const b=n.getBoundingClientRect(),fit=Math.min(b.width/n.naturalWidth,b.height/n.naturalHeight),flip=new DOMMatrix(getComputedStyle(n).transform).a<0,right=b.left+(b.width-n.naturalWidth*fit)/2+(flip?n.naturalWidth-minX:maxX+1)*fit;
     results.push({id,gap:document.querySelector(".ending-content").getBoundingClientRect().left-right});
    }n.src=src;n.dataset.species=species;await n.decode();return results;
   });for(const r of heroCoverage)assert.ok(r.gap>=8,JSON.stringify({width,...r}));
   const gold=fixture.meta.gold;if(fixture.name==="complete"){await page.locator('[data-action="retry"]').click();assert.equal(await page.locator(".game-screen").getAttribute("data-phase"),"starter");}
   else if(fixture.name==="maximum"){await page.locator('[data-action="threats"]').click();assert.equal(await page.locator("dialog[open]").count(),1);}
   else {await page.locator('[data-action="finish"]').click();assert.equal(await page.locator(".game-screen.mode-title").count(),1);}
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("pokeRogueAdventureV3")).meta.gold),gold);
  }
  checks.push({name:fixture.name,width,minimumContrast,contrast});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({cases:checks.length,minimumContrast:Math.min(...checks.map(c=>c.minimumContrast)),errors}));
}finally{await browser.close();}
