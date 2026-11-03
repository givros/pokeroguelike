import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import * as E from "../engine.js";
const baseline=process.argv.includes("--baseline"),scouted=process.argv.includes("--scouted");
const out=`output/playwright/map-visibility${baseline?"-before":scouted?"-scouted":""}`;
await mkdir(out,{recursive:true});
const catalogue={pokemon:JSON.parse(await readFile("data/pokemon.json")),moves:JSON.parse(await readFile("data/moves.json"))};
const world=JSON.parse(await readFile("data/world-map.json"));
const forms=[1,2,3,4,5,6,7,8,9,25,26,133,134,135,136,152,153,154];
const browser=await chromium.launch({headless:true}),results=[],errors=[];
try{
 for(const [width,height] of [[1440,900],[1280,720],[1024,768]])for(const region of E.REGIONS){
  const run=E.createRun(4,E.baseMeta(),catalogue,2026);Object.assign(run,{phase:"travel",stageIndex:region.from,travelProgress:.5,regionEntry:null});
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(data=>{localStorage.setItem("pokeRogueAdventureV3",JSON.stringify(data));Object.defineProperty(document,"hidden",{get:()=>true});},{version:3,meta:E.baseMeta(),run});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:5173");await page.locator('[data-action="resume"]').click();
  await page.locator("img").evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
  // Audit the largest live caption separately from the frozen map-only save fixture.
  if(scouted)await page.locator(".travel-caption").evaluate(root=>{const report=document.createElement("span");report.className="scouting-report";report.textContent="Scouted: Dragonite · Multiscale · Opening strike +25%";root.append(report);});
  const measured=await page.evaluate(async({forms,route,approaches,baseline})=>{
   const {pointOnRoute}=await import("/engine.js");
   const layout=baseline?null:await fetch("/data/artwork-layout.json").then(r=>r.json());
   const {applyMapArtwork}=baseline?{}:await import("/artwork-layout.js");
   const actor=document.querySelector("#map-actor"),image=actor.querySelector(".body-art"),scene=document.querySelector(".map-canvas");
   image.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=0;});
   const bounds=scene.getBoundingClientRect(),canvas=document.createElement("canvas");canvas.width=Math.round(bounds.width);canvas.height=Math.round(bounds.height);
   const context=canvas.getContext("2d",{willReadFrequently:true});
   const props=[...scene.querySelectorAll(".map-prop")],hud=[...document.querySelectorAll(".map-hero-card,.hud-left,.stage-heading,.hud-controls,.travel-caption")].map(el=>el.getBoundingClientRect());
   const samples=[];
   function sample(path,progress,motion,reverse=false){
    const t=reverse?1-progress:progress,point=pointOnRoute(path,t),a=pointOnRoute(path,Math.max(0,t-.002)),b=pointOnRoute(path,Math.min(1,t+.002));
    const dx=(b[0]-a[0])*(reverse?-1:1);samples.push({point,progress,motion,facing:dx<-1e-6?1:-1});
   }
   for(let step=0;step<=100;step++)sample(route,step/100,"trail");
   if(!baseline)for(const zone of approaches)for(const reverse of [false,true])for(let step=0;step<=50;step++)sample(zone.approachPath,step/50,`${zone.id}-${reverse?"return":"approach"}`,reverse);
   const records=[];
   for(const id of forms){
    image.src=`assets/artwork/${id}.png`;image.dataset.species=id;await image.decode();
    if(layout)applyMapArtwork(actor,layout[id]);
    const source=document.createElement("canvas");source.width=image.naturalWidth;source.height=image.naturalHeight;
    const sourceContext=source.getContext("2d",{willReadFrequently:true});sourceContext.drawImage(image,0,0);
    const rgba=sourceContext.getImageData(0,0,source.width,source.height).data;
    let bottom=0;for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(rgba[(y*source.width+x)*4+3]>32)bottom=Math.max(bottom,y+1);
    let worst={occlusion:0,hudOcclusion:0,progress:0,props:[]},maxGroundError=0;
    for(const {point,progress,motion,facing} of samples){
     actor.style.left=`${point[0]*100}%`;actor.style.top=`${point[1]*100}%`;actor.style.zIndex=Math.round(point[1]*1000);
     actor.style.setProperty("--map-facing",facing);
     const r=image.getBoundingClientRect(),scale=Math.min(r.width/source.width,r.height/source.height);
     const flip=new DOMMatrix(getComputedStyle(image).transform).a<0;
     if((flip?-1:1)!==facing*([2,9,147,150].includes(Number(id))?-1:1))throw new Error(`Wrong native map facing for ${id}`);
     const left=r.left+(r.width-source.width*scale)/2,top=r.bottom-source.height*scale;
     maxGroundError=Math.max(maxGroundError,Math.abs(top+bottom*scale-(bounds.top+point[1]*bounds.height)));
     context.clearRect(0,0,canvas.width,canvas.height);const front=[];
     for(const prop of props)if(Number(prop.style.zIndex)>Number(actor.style.zIndex)){
      const p=prop.getBoundingClientRect(),fit=Math.min(p.width/prop.naturalWidth,p.height/prop.naturalHeight),w=prop.naturalWidth*fit,h=prop.naturalHeight*fit;
      context.drawImage(prop,p.left-bounds.left+(p.width-w)/2,p.bottom-bounds.top-h,w,h);front.push(prop.src.split("/").at(-1));
     }
     const ix=Math.max(0,Math.floor(left-bounds.left)),iy=Math.max(0,Math.floor(top-bounds.top)),iw=Math.min(canvas.width-ix,Math.ceil(source.width*scale)+2),ih=Math.min(canvas.height-iy,Math.ceil(source.height*scale)+2);
     const cover=context.getImageData(ix,iy,iw,ih).data;
     let opaque=0,hidden=0,coveredByHud=0;
     for(let y=0;y<source.height*scale;y++)for(let x=0;x<source.width*scale;x++){
      const sx=Math.floor(x/scale),sy=Math.floor(y/scale);if(rgba[(sy*source.width+sx)*4+3]<=32)continue;
      opaque++;const px=left+(flip?source.width*scale-1-x:x),py=top+y;
      const cx=Math.floor(px-bounds.left)-ix,cy=Math.floor(py-bounds.top)-iy;
      if(cx>=0&&cx<iw&&cy>=0&&cy<ih&&cover[(cy*iw+cx)*4+3]>160)hidden++;
      if(hud.some(b=>px>b.left&&px<b.right&&py>b.top&&py<b.bottom))coveredByHud++;
     }
     const occlusion=hidden/opaque,hudOcclusion=coveredByHud/opaque;
     if(occlusion>worst.occlusion||hudOcclusion>worst.hudOcclusion)worst={occlusion:Math.max(worst.occlusion,occlusion),hudOcclusion:Math.max(worst.hudOcclusion,hudOcclusion),progress,motion,props:front};
    }
    records.push({id,poses:samples.length,maxGroundError,...worst});
   }
   return records;
  },{forms,route:world.route,approaches:world.regions[region.id].encounters.filter(zone=>zone.approachPath),baseline});
  results.push({width,height,region:region.id,measured});
  await page.screenshot({path:`${out}/${width}-${region.id}.png`});await context.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2));
 const records=results.flatMap(r=>r.measured.map(m=>({width:r.width,region:r.region,...m})));
 console.log(JSON.stringify({poses:records.reduce((sum,r)=>sum+r.poses,0),maxGroundError:Math.max(...records.map(r=>r.maxGroundError)),worstOcclusion:[...records].sort((a,b)=>b.occlusion-a.occlusion).slice(0,5),hudCollisions:records.filter(r=>r.hudOcclusion>.01),errors},null,2));
 assert.deepEqual(errors,[]);
 if(!baseline){assert.ok(records.every(r=>r.maxGroundError<1.1),"Map feet must meet their route anchors");assert.ok(records.every(r=>r.occlusion<.25),"Scenery hides too much of the partner");assert.ok(records.every(r=>r.hudOcclusion<.01),"HUD hides the travelling partner");}
}finally{await browser.close();}
