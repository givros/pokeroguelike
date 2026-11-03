import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {simulate} from './simulate.mjs';
import * as E from '../engine.js';
const pokemon=JSON.parse(await readFile('data/pokemon.json'));
const browser=await chromium.launch({headless:true}),results=[];
const all=process.argv.includes('--all'),windback=process.argv.includes('--windback'),pose=windback?1/3:2/3;
await mkdir('output/playwright/motion-layout',{recursive:true});
try{
 for(const [width,height] of (all?[[1440,900],[1280,720],[1024,768]]:[[1024,768]]))for(const barrier of (all?[false,true]:[true])){
  const run=simulate(2026,4,{stopAt:r=>r.phase==='battle'}).run;if(barrier)run.bonuses=['regeneration','lifesteal'];
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>{localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(data));Object.defineProperty(document,'hidden',{get:()=>true});},{version:3,meta:E.baseMeta(),run});
  const page=await context.newPage();await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();
  await page.evaluate(async()=>{const {BattleEffects}=await import('/presentation.js');window.motionEffects=new BattleEffects();window.motionEffects.setPaused(true);window.alphaCache={};});
  for(const id of Object.keys(pokemon)){
   const measured=await page.evaluate(async ({id,pose})=>{
    const effects=window.motionEffects;effects.clear();
    const sides=['ally','enemy'],values=[];
    for(const side of sides){const img=document.querySelector(`.actor-${side} .body-art`);img.src=`assets/artwork/${id}.png`;img.dataset.species=id;await img.decode();}
    await effects.windup('ally',{type:'normal'},async()=>true,1000);
    await effects.windup('enemy',{type:'normal'},async()=>true,1000);
    for(const animation of effects.animations){
     await animation.ready;let low=0,high=animation.effect.getTiming().duration;
     for(let i=0;i<24;i++){const mid=(low+high)/2;animation.currentTime=mid;if(animation.effect.getComputedTiming().progress<pose)low=mid;else high=mid;}
     animation.currentTime=(low+high)/2;
    }
    await new Promise(resolve=>requestAnimationFrame(resolve));
    for(const side of sides){
     const img=document.querySelector(`.actor-${side} .body-art`);
     let cached=window.alphaCache[id];
     if(!cached){const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,points=[];
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>32)points.push(x+.5,y+.5);
      cached=window.alphaCache[id]={points:new Float32Array(points),width:canvas.width,height:canvas.height};}
     const cs=getComputedStyle(img),r=img.parentElement.getBoundingClientRect(),w=parseFloat(cs.width),h=parseFloat(cs.height),fit=Math.min(w/cached.width,h/cached.height),dx=(w-cached.width*fit)/2,dy=(h-cached.height*fit)/2;
     const [ox,oy]=cs.transformOrigin.split(' ').map(parseFloat),[tx,ty]=cs.translate==='none'?[0,0]:cs.translate.split(' ').map(parseFloat),sc=cs.scale==='none'?[1,1]:cs.scale.split(' ').map(Number);
     const matrix=new DOMMatrix().translate(r.left+img.offsetLeft+ox,r.top+img.offsetTop+oy).translate(tx,ty||0).rotate(parseFloat(cs.rotate)||0).scale(sc[0],sc[1]||sc[0]).multiply(new DOMMatrix(cs.transform==='none'?undefined:cs.transform)).translate(-ox,-oy);
     const collisions=[];
     for(const selector of ['.ally-card','.enemy-card','.battle-narration']){
      const b=document.querySelector(selector).getBoundingClientRect();let hit=null;
      for(let i=0;i<cached.points.length;i+=2){const x=dx+cached.points[i]*fit,y=dy+cached.points[i+1]*fit,px=matrix.a*x+matrix.c*y+matrix.e,py=matrix.b*x+matrix.d*y+matrix.f;
       if(px>b.left&&px<b.right&&py>b.top&&py<b.bottom){hit={x:px,y:py};break;}}
      if(hit)collisions.push({selector,pixel:hit});
     }
     values.push({side,translate:cs.translate,rotate:cs.rotate,scale:cs.scale,collisions});
    }return values;
   },{id,pose});
   results.push({width,height,barrier,id:Number(id),measured});
   if(measured.some(v=>v.collisions.length)||Number(id)===4||Number(id)===150)await page.screenshot({path:`output/playwright/motion-layout/${width}-${barrier}-${id}-${windback?"windback":"lunge"}.png`});
  }
  await context.close();
 }
 const failures=results.filter(r=>r.measured.some(m=>m.collisions.length));
 await writeFile(`output/playwright/motion-layout/${all?'all':'focused'}-${windback?'windback':'lunge'}-results.json`,JSON.stringify({results,failures},null,2));
 console.log(JSON.stringify({scenes:results.length,failureCount:failures.length,failures:failures.slice(0,10).map(f=>({width:f.width,barrier:f.barrier,id:f.id,collisions:f.measured.filter(m=>m.collisions.length).map(m=>({side:m.side,with:m.collisions.map(c=>c.selector)}))}))},null,2));assert.equal(failures.length,0);
}finally{await browser.close();}
