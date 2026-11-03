import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
const catalogue={pokemon:JSON.parse(await readFile('data/pokemon.json')),moves:JSON.parse(await readFile('data/moves.json'))},out='output/map-quality';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[],errors=[];
try{
 for(const [row,width,height] of [[1,1280,720],[14,1280,720],[1,1024,768]]){
  const r=E.createRun(7,E.baseMeta(),catalogue,2026);E.selectBonus(r,r.offers[0]);r.stageIndex=row;r.regionEntry=null;E.enableBranching(r);
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2});await context.addInitScript(state=>localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(state)),{version:3,meta:{...E.baseMeta(),language:'fr'},run:r});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();const viewport=page.locator('.route-viewport'),box=await viewport.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-1000);await page.waitForTimeout(100);await page.locator('[data-action="route-center"]').click();
  const measured=await page.evaluate(()=>{
   const board=document.querySelector('.route-board'),br=board.getBoundingClientRect(),tokens=new Map([...board.querySelectorAll('[data-route-node]')].map(n=>{const b=n.getBoundingClientRect(),im=n.querySelector('img'),ib=im.getBoundingClientRect();return[n.dataset.routeNode,{x:b.x+b.width/2-br.x,y:b.y+b.height/2-br.y,r:b.width/2,opacity:getComputedStyle(n).opacity,z:getComputedStyle(n).zIndex,source:[im.naturalWidth,im.naturalHeight],display:[ib.width*devicePixelRatio,ib.height*devicePixelRatio]}];}));
   const links=[...board.querySelectorAll('line')].map(line=>{const a=tokens.get(line.dataset.from),b=tokens.get(line.dataset.to);return{from:line.dataset.from,to:line.dataset.to,start:Math.hypot(Number(line.getAttribute('x1'))-a.x,Number(line.getAttribute('y1'))-a.y)-a.r,end:Math.hypot(Number(line.getAttribute('x2'))-b.x,Number(line.getAttribute('y2'))-b.y)-b.r};});
   return{zoom:Number(document.querySelector('.route-viewport').dataset.zoom),transform:getComputedStyle(board).transform,tokens:[...tokens.values()],links,svgZ:getComputedStyle(board.querySelector('svg')).zIndex};
  });
  assert.equal(measured.zoom,2.2);assert.equal(measured.transform,'none');assert.equal(measured.svgZ,'0');
  for(const token of measured.tokens){assert.equal(token.opacity,'1');assert.ok(Number(token.z)>0);assert.ok(token.source[0]>=token.display[0]&&token.source[1]>=token.display[1],'Every illustration must retain at least one source pixel per device pixel at maximum zoom');}
  for(const link of measured.links){assert.ok(link.start>=2.5,JSON.stringify(link));assert.ok(link.end>=2.5,JSON.stringify(link));}
  await page.screenshot({path:`${out}/native-220-row-${row}-${width}.png`});results.push({row,width,height,deviceScaleFactor:2,maxZoom:measured.zoom,opaqueTokens:measured.tokens.length,vectorLinks:measured.links.length,minimumEndpointGap:Math.min(...measured.links.flatMap(l=>[l.start,l.end])),noCompositeScaling:true,nativeArtworkResolution:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();}
