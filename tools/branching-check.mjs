import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import * as E from '../engine.js';
import {routeGraph} from '../route-graph.js';
import {validRun} from '../storage.js';
const catalogue={pokemon:JSON.parse(await readFile('data/pokemon.json')),moves:JSON.parse(await readFile('data/moves.json'))};
const out='output/branching';await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],results=[];
const key='pokeRogueAdventureV3';
function fixture(row=0){const r=E.createRun(7,E.baseMeta(),catalogue,2026);E.selectBonus(r,r.offers[0]);r.stageIndex=row;r.regionEntry=null;E.enableBranching(r);return r;}
async function open(run,size){const context=await browser.newContext({viewport:size});await context.addInitScript(state=>{if(!localStorage.getItem('pokeRogueAdventureV3'))localStorage.setItem('pokeRogueAdventureV3',JSON.stringify(state));},{version:3,meta:E.baseMeta(),run});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await page.locator('[data-action="resume"]').click();await page.locator('.route-scene').waitFor();return {page,context};}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
try{
 for(const size of [{width:1440,height:900},{width:1280,height:720},{width:1024,height:768}]){
  const {page,context}=await open(fixture(),size),before=(await saved(page)).run;
  assert.equal(await page.locator('.walking,.map-canvas').count(),0);assert.equal(await page.locator('.route-node.available').count(),4);
  const bounds=await page.locator('.route-viewport.overview').boundingBox();for(const id of ['0-0','14-0']){const b=await page.locator(`[data-route-node="${id}"]`).boundingBox();assert.ok(b.y>=bounds.y&&b.y+b.height<=bounds.y+bounds.height,`${size.width}: endpoints visible`);}
  await page.locator('[data-route-node="14-0"]').click({force:true});assert.deepEqual((await saved(page)).run,before,'Future node cannot skip the trail');
  await page.locator('[data-route-node="1-3"]').hover();assert.match(await page.locator('#route-preview').innerText(),/Spring/);
  await page.screenshot({path:`${out}/overview-${size.width}.png`});
  await page.locator('[data-action="route-zoom"]').click();await page.locator('.route-viewport.detailed').waitFor();await page.screenshot({path:`${out}/detail-${size.width}.png`});
  await page.locator('[data-action="route-zoom"]').click();await page.locator('[data-route-node="0-0"]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run.encounters.length===1);const battle=(await saved(page)).run;assert.deepEqual(battle.branchPath,['0-0']);assert.ok(['battle','victoryBeat'].includes(battle.phase));assert.ok(validRun(battle,catalogue));
  await page.waitForFunction(()=>{const r=JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run;return r.phase==='travel'&&r.stageIndex===1;});
  const next=(await saved(page)).run;assert.equal(next.landmark,null);assert.equal(next.regionEntry,null);assert.deepEqual(next.branchPath,['0-0']);assert.ok(await page.locator('.route-node.available').count());const fingerprint=JSON.stringify(next);await page.waitForTimeout(800);assert.equal(JSON.stringify((await saved(page)).run),fingerprint,'Route selection has no automatic walking or RNG changes');
  await page.reload();await page.locator('[data-action="resume"]').click();await page.locator('.route-node.available').first().waitFor();assert.deepEqual((await saved(page)).run.branchPath,next.branchPath);assert.equal((await saved(page)).run.seed,next.seed);await page.screenshot({path:`${out}/after-battle-${size.width}.png`});
  results.push({size,wholeRouteVisible:true,noWalking:true,futureRejected:true,hoverPreview:true,zoom:true,battleEntry:true,reloadPath:true});await context.close();
 }
 for(const [row,lane,type] of [[1,3,'camp'],[1,1,'cache'],[4,2,'shop'],[8,1,'shrine'],[3,2,'elite'],[3,3,'mystery']]){
  const run=fixture(row),node=routeGraph(run.branchSeed,E.STAGES).byId.get(`${row}-${lane}`);assert.equal(node.kind,type);const {page,context}=await open(run,{width:1280,height:720});await page.locator(`[data-route-node="${node.id}"]`).click();await page.waitForFunction(kind=>{const r=JSON.parse(localStorage.getItem('pokeRogueAdventureV3')).run;return kind==='wild'||kind==='elite'?['battle','victoryBeat'].includes(r.phase):r.phase===kind;},node.stage.kind);const selected=(await saved(page)).run;assert.equal(E.stage(selected).kind,node.stage.kind);assert.ok(validRun(selected,catalogue));await page.screenshot({path:`${out}/selected-${type}.png`});results.push({type,revealed:node.stage.kind,selected:node.id});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();}
