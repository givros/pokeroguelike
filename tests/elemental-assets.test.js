import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {IMPACT_ASSETS,IMPACT_SEQUENCES,MOVE_IMPACTS,PROJECTILE_ASSETS,impactSequence,projectileAsset} from "../presentation.js";
const digest=value=>createHash("sha256").update(value).digest("hex");
const manifest=JSON.parse(readFileSync("data/asset-manifest.json"));
test("new elemental impacts retain their generated sources, prompts and matching extraction QC",()=>{
 for(const name of ["fire-impact","water-impact","leaf-impact","ice-impact","poison-impact","bite-impact","wind-impact","dragon-impact","contact-impact"]){
  const entry=manifest.find(a=>a.id===name);assert.ok(entry);assert.equal(entry.generator,"built-in imagegen");assert.equal(entry.frames,4);assert.ok(existsSync(entry.rawSource));
  const qc=JSON.parse(readFileSync(entry.qc));assert.equal(qc.shared_scale,true);assert.equal(qc.frames.length,4);assert.deepEqual(qc.edge_touch_frames,[]);assert.equal(qc.opaqueMagentaPixels,0);
  assert.equal(qc.sourceSha256,digest(readFileSync(entry.source)));assert.equal(qc.rawSha256,digest(readFileSync(entry.rawSource)));
  if(qc.compiledSha256){assert.equal(qc.compiledSha256,digest(readFileSync(entry.image)));assert.equal(qc.compiledOpaqueMagentaPixels,0);}
  const prompt=readFileSync(entry.prompt,"utf8").replace(/\r\n/g,"\n");assert.equal(qc.promptSha256,digest(prompt));assert.match(prompt,/#FF00FF/);assert.match(prompt,/four|Four/);
  if(qc.refinementPrompt){assert.equal(qc.refinementPromptSha256,digest(readFileSync(qc.refinementPrompt,"utf8").replace(/\r\n/g,"\n")));assert.equal(qc.refinementReferenceSha256,digest(readFileSync(qc.refinementReference)));}
 }
});
test("impact preload assets cover every mapped type once and reject inherited property names",()=>{
 assert.equal(new Set(IMPACT_ASSETS).size,IMPACT_ASSETS.length);
 for(const [type,asset] of Object.entries(IMPACT_SEQUENCES)){assert.equal(impactSequence(type),asset);assert.ok(IMPACT_ASSETS.includes(asset));assert.ok(existsSync(`assets/effects/${asset}-sheet.webp`));}
 for(const [id,asset] of Object.entries(MOVE_IMPACTS)){assert.equal(impactSequence("unknown",id),asset);assert.ok(IMPACT_ASSETS.includes(asset));assert.ok(existsSync(`assets/effects/${asset}-sheet.webp`));}
 for(const type of ["unknown","__proto__","toString",undefined])assert.equal(impactSequence(type),null);
});
test("native bite moves use jaws without changing other elemental feedback",()=>{
 const moves=JSON.parse(readFileSync("data/moves.json"));
 for(const id of [44,450]){assert.equal(impactSequence(moves[id].type,moves[id].id),"bite-impact");assert.equal(projectileAsset(moves[id]),null);}
 assert.equal(impactSequence("dark",999),"spectral-pulse");assert.equal(impactSequence("bug",999),null);
 assert.equal(projectileAsset(moves[52]),"fire-wisp");assert.equal(projectileAsset(moves[55]),"water-wisp");assert.equal(projectileAsset(moves[75]),"leaf-wisp");
 assert.equal(impactSequence("unknown","__proto__"),null);assert.equal(impactSequence("unknown","toString"),null);
});
test("native contact attacks use kinetic art without elemental projectiles",()=>{
 const moves=JSON.parse(readFileSync("data/moves.json"));
 for(const id of [33,98,67]){assert.equal(impactSequence(moves[id].type,id),"contact-impact");assert.equal(projectileAsset(moves[id]),null);}
});
test("Dragon Breath preloads matching generated projectile art with retained source provenance",()=>{
 const entry=manifest.find(a=>a.id==="dragon-wisp"),qc=JSON.parse(readFileSync(entry.qc));
 assert.equal(entry.generator,"built-in imagegen");assert.equal(qc.direction,"right");assert.equal(qc.opaqueMagentaPixels,0);
 assert.equal(qc.sourceSha256,digest(readFileSync(entry.source)));assert.equal(qc.rawSha256,digest(readFileSync(entry.rawSource)));
 assert.equal(qc.promptSha256,digest(readFileSync(entry.prompt,"utf8").replace(/\r\n/g,"\n")));
 assert.equal(projectileAsset(JSON.parse(readFileSync("data/moves.json"))[225]),"dragon-wisp");
 assert.equal(new Set(PROJECTILE_ASSETS).size,PROJECTILE_ASSETS.length);for(const asset of PROJECTILE_ASSETS)assert.ok(existsSync(`assets/generated/${asset}.webp`));
});
