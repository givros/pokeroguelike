import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
const digest=value=>createHash("sha256").update(value).digest("hex");
const manifest=JSON.parse(readFileSync("data/asset-manifest.json"));
test("new elemental impacts retain their generated sources, prompts and matching extraction QC",()=>{
 for(const name of ["fire-impact","water-impact","leaf-impact"]){
  const entry=manifest.find(a=>a.id===name);assert.ok(entry);assert.equal(entry.generator,"built-in imagegen");assert.equal(entry.frames,4);assert.ok(existsSync(entry.rawSource));
  const qc=JSON.parse(readFileSync(entry.qc));assert.equal(qc.shared_scale,true);assert.equal(qc.frames.length,4);assert.deepEqual(qc.edge_touch_frames,[]);assert.equal(qc.opaqueMagentaPixels,0);
  assert.equal(qc.sourceSha256,digest(readFileSync(entry.source)));assert.equal(qc.rawSha256,digest(readFileSync(entry.rawSource)));
  const prompt=readFileSync(entry.prompt,"utf8").replace(/\r\n/g,"\n");assert.equal(qc.promptSha256,digest(prompt));assert.match(prompt,/#FF00FF/);assert.match(prompt,/four|Four/);
 }
});
