import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out='output/mobile/acceptance';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[],errors=[];
try{for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[568,320],[844,390]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await context.addInitScript(()=>Date.now=()=>2026);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');
 await page.locator('[data-action="language"][data-value="fr"]').tap();
 async function inspect(name){const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,text:[...document.querySelectorAll('button,h1,h2,p')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height&&getComputedStyle(e).visibility!=='hidden').filter(e=>parseFloat(getComputedStyle(e).fontSize)<14).map(e=>e.textContent.slice(0,80))}));assert.equal(metrics.overflow,false,`${width} ${name}: overflow`);assert.deepEqual(metrics.text,[],`${width} ${name}: tiny text`);await page.screenshot({path:`${out}/${name}-${width}.png`});}
 await inspect('title');for(const action of ['legacy','partners']){await page.locator(`[data-action="${action}"]`).tap();await inspect(action);const close=page.locator('dialog [data-action="close"]').first();await close.tap();}
 await page.locator('[data-action="random-start"]').tap();await page.waitForTimeout(400);await inspect('roulette');await page.locator('[data-action="bonus"]').first().waitFor();await inspect('bonus');await page.locator('[data-action="bonus"]').first().tap();const map=page.locator('.route-viewport');await map.waitFor();await inspect('map');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run),box=await map.boundingBox(),cdp=await context.newCDPSession(page);
 const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id,radiusX:2,radiusY:2}))});
 const x=box.x+box.width/2,y=box.y+box.height/2,z=Number(await map.getAttribute('data-zoom'));
 await touch('touchStart',[[x-30,y],[x+30,y]]);for(let n=1;n<=6;n++)await touch('touchMove',[[x-30-n*5,y],[x+30+n*5,y]]);await touch('touchEnd',[]);assert.ok(Number(await map.getAttribute('data-zoom'))>z*1.5,'pinch zoom');
 await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y-55]]);await touch('touchEnd',[]);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run),before,'touch must not select or consume RNG');
 results.push({width,height,noPageOverflow:true,textAtLeast14:true,menusCloseReachable:true,pinchZoom:true,dragPreservesRun:true});await context.close();
}assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));}finally{await browser.close();}
