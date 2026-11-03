import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
test("the trail header retains generated artwork, prompt and matching source/runtime provenance",()=>{
 const manifest=JSON.parse(readFileSync("data/asset-manifest.json")),asset=manifest.find(a=>a.id==="trail-banner");assert.ok(asset);assert.equal(asset.generator,"built-in imagegen");assert.equal(asset.transparent,true);
 const qc=JSON.parse(readFileSync(asset.qc)),hash=data=>createHash("sha256").update(data).digest("hex");
 assert.equal(qc.sourceSha256,hash(readFileSync(asset.source)));assert.equal(qc.rawSha256,hash(readFileSync(asset.rawSource)));assert.equal(qc.compiledSha256,hash(readFileSync(asset.image)));
 assert.equal(qc.promptSha256,hash(readFileSync(asset.prompt,"utf8").replace(/\r\n/g,"\n")));assert.equal(qc.compiledOpaqueMagentaPixels,0);
 assert.deepEqual(qc.compiledSize,asset.size);assert.ok(qc.nineSlice.left+qc.nineSlice.right<asset.size[0]);assert.ok(qc.nineSlice.top+qc.nineSlice.bottom<asset.size[1]);
});
