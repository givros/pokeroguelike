import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {mapArtworkGrounding,mapArtworkStyle,applyMapArtwork} from "../artwork-layout.js";
const pokemon=JSON.parse(readFileSync("data/pokemon.json")),layout=JSON.parse(readFileSync("data/artwork-layout.json"));
test("grounding metadata matches every unchanged original HD illustration",()=>{
 assert.deepEqual(Object.keys(layout).sort(),Object.keys(pokemon).sort());
 for(const [id,entry] of Object.entries(layout)){
  const [width,height]=entry.size,[left,top,right,bottom]=entry.bounds;
  assert.ok(width>0&&height>0&&left>=0&&top>=0&&right>left&&bottom>top&&right<=width&&bottom<=height);
  assert.equal(entry.sha256,createHash("sha256").update(readFileSync(pokemon[id].artwork)).digest("hex"));
 }
});
test("visible feet meet the route anchor for square, wide and tall source frames",()=>{
 for(const entry of [...Object.values(layout),{size:[800,400],bounds:[10,10,790,350]},{size:[400,800],bounds:[10,10,390,700]}])for(const aspect of [1,.8,1.2]){
  const {offset,pivot}=mapArtworkGrounding(entry,aspect),[w,h]=entry.size;
  const scale=Math.min(aspect/w,1/h),visibleBottom=1-h*scale+entry.bounds[3]*scale+offset/100;
  assert.ok(Math.abs(visibleBottom-1)<1e-12);assert.equal(pivot,100-offset);
 }
});
test("map grounding changes independent layout variables and retains a safe fallback",()=>{
 assert.deepEqual(mapArtworkGrounding(null),{offset:0,pivot:100});
 const values=new Map(),actor={style:{setProperty:(key,value)=>values.set(key,value)}};
 applyMapArtwork(actor,layout[6]);assert.equal(values.size,2);assert.ok(Number.parseFloat(values.get("--map-art-offset"))>14);
 assert.match(mapArtworkStyle(layout[6]),/^--map-art-offset:[\d.]+%;--map-art-pivot:[\d.]+%;$/);
 assert.doesNotThrow(()=>applyMapArtwork(null,layout[6]));
});
