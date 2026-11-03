import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {simulate} from './simulate.mjs';
import * as E from '../engine.js';
const pokemon=JSON.parse(await readFile('data/pokemon.json'));
const browser=await chromium.launch({headless:true}),results=[];
await mkdir('output/playwright/silhouettes',{recursive:true});
try{
 for(const [width,height] of [[1440,900],[1280,720],[1024,768]])for(const barrier of [false,true]){
  const run=simulate(2026,4,{stopAt:r=>r.phase==='battle'}).run;
  if(barrier)run.bonuses=['regeneration','lifesteal'];
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>{localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data));Object.defineProperty(document,'hidden',{get:()=>true});},{version:3,meta:E.baseMeta(),run});
  const page=await context.newPage();await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();
  for(const id of Object.keys(pokemon)){
   const measured=await page.evaluate(async id=>{
    const sides=['ally','enemy'],values=[];
    for(const side of sides){
     const img=document.querySelector(`.actor-${side} .body-art`);img.src=`assets/artwork/${id}.png`;await img.decode();
     const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
     const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
     const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=0,y1=0;
     for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
     const r=img.getBoundingClientRect(),scale=Math.min(r.width/canvas.width,r.height/canvas.height),left=r.left+(r.width-canvas.width*scale)/2,top=r.top+(r.height-canvas.height*scale)/2;
     const box={left:left+(side==='ally'?canvas.width-x1:x0)*scale,right:left+(side==='ally'?canvas.width-x0:x1)*scale,top:top+y0*scale,bottom:top+y1*scale};
     const collisions=[];
     for(const selector of ['.ally-card','.enemy-card','.battle-narration']){
      const b=document.querySelector(selector).getBoundingClientRect();
      if(box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top)collisions.push(selector);
     }
     values.push({side,box,collisions});
    }return values;
   },id);
   results.push({width,height,barrier,id:Number(id),measured});
   if(measured.some(v=>v.collisions.length))await page.screenshot({path:`output/playwright/silhouettes/${width}-${barrier}-${id}.png`});
  }
  await context.close();
 }
 const failures=results.filter(r=>r.measured.some(m=>m.collisions.length));
 await writeFile('output/playwright/silhouettes/results.json',JSON.stringify({results,failures},null,2));
 console.log(JSON.stringify({scenes:results.length,failures:failures.map(f=>({width:f.width,barrier:f.barrier,id:f.id,collisions:f.measured.filter(m=>m.collisions.length).map(m=>({side:m.side,with:m.collisions}))}))},null,2));
 assert.equal(failures.length,0);
}finally{await browser.close();}
