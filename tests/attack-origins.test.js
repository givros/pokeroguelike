import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BREATH_ORIGINS,artworkAnchor} from "../attack-origins.js";
const sample={box:{left:100,top:100,width:800,height:400},width:800,height:400,naturalWidth:475,naturalHeight:475,anchor:[.25,.2]};
test("source anchors account for contain letterboxing and preserve source proportions",()=>{
 assert.deepEqual(artworkAnchor(sample),{x:400,y:180});
 assert.deepEqual(artworkAnchor({...sample,matrix:[-1,0,0,1]}),{x:600,y:180});
});
test("source anchors follow animated rotation and scale around the actual transformed centre",()=>{
 assert.deepEqual(artworkAnchor({...sample,box:{left:300,top:-100,width:400,height:800},matrix:[0,1,-1,0]}),{x:620,y:200});
 assert.deepEqual(artworkAnchor({...sample,box:{left:-300,top:-100,width:1600,height:800},matrix:[2,0,0,2]}),{x:300,y:60});
});
test("every native Dragon Breath species has an artwork source anchor",()=>{
 const pokemon=JSON.parse(readFileSync("data/pokemon.json"));
 const ids=Object.values(pokemon).filter(p=>p.learnset.includes(225)).map(p=>p.id);
 assert.deepEqual(ids.sort((a,b)=>a-b),Object.keys(BREATH_ORIGINS).map(Number).sort((a,b)=>a-b));
 for(const id of ids)for(const value of BREATH_ORIGINS[id])assert.ok(value>0&&value<1);
});
