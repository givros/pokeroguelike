import test from "node:test";
import assert from "node:assert/strict";
import {JourneyCheckpoint} from "../checkpoint.js";
test("journey checkpoints preserve the last complete snapshot independently of live state",()=>{
 const checkpoint=new JourneyCheckpoint();assert.equal(checkpoint.available,false);assert.equal(checkpoint.restore(),null);
 const meta={gold:10},run={hero:{hp:83},coins:0,moves:[{pp:3}]};checkpoint.capture(meta,run);
 run.hero.hp=1;run.coins=777;run.moves[0].pp=0;meta.gold=999;
 assert.deepEqual(checkpoint.restore(),{meta:{gold:10},run:{hero:{hp:83},coins:0,moves:[{pp:3}]}});
 const restored=checkpoint.restore();restored.run.hero.hp=0;assert.equal(checkpoint.restore().run.hero.hp,83);
});
test("new successful checkpoints replace the old one and can retain a camp with no expedition",()=>{
 const checkpoint=new JourneyCheckpoint();checkpoint.capture({gold:5},{coins:20});checkpoint.capture({gold:25},null);
 assert.equal(checkpoint.available,true);assert.deepEqual(checkpoint.restore(),{meta:{gold:25},run:null});
});
