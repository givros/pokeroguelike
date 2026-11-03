import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {GUARDIANS} from "../guardians.js";
const directory="output/pokeapi-abilities";
await mkdir(directory,{recursive:true});
async function cached(kind,key){
 const path=`${directory}/${kind}-${key}.json`;
 try{return JSON.parse(await readFile(path,"utf8"));}catch(error){if(error.code!=="ENOENT")throw error;}
 const response=await fetch(`https://pokeapi.co/api/v2/${kind}/${key}/`,{signal:AbortSignal.timeout(30000)});
 assert.ok(response.ok,`${response.status} ${response.url}`);
 const data=await response.json();await writeFile(path,JSON.stringify(data));return data;
}
const effects={swarm:[/1\/3/,/Bug-type/,/1\.5/],pressure:[/one extra PP/,/all remaining PP/],multiscale:[/half as much damage/,/full HP/],"shell-armor":[/cannot score critical hits/]};
const results=await Promise.allSettled(GUARDIANS.map(async trait=>{
 const [ability,species]=await Promise.all([cached("ability",trait.key),cached("pokemon",trait.species)]);
 assert.equal(ability.id,trait.id);assert.equal(ability.name,trait.key);
 assert.equal(ability.names.find(n=>n.language.name==="en").name,trait.name);
 const native=species.abilities.find(a=>a.ability.name===trait.key);
 assert.ok(native,`${species.name} lacks ${trait.key}`);assert.equal(native.is_hidden,trait.hidden);
 assert.equal(native.ability.url,trait.source);
 const effect=ability.effect_entries.find(e=>e.language.name==="en").effect;
 for(const pattern of effects[trait.key])assert.match(effect,pattern);
 return {species:species.name,ability:trait.name,hidden:native.is_hidden,source:trait.source,speciesSource:trait.speciesSource};
}));
const failures=results.filter(r=>r.status==="rejected");
for(const failure of failures)console.error(failure.reason);
assert.equal(failures.length,0,"Native guardian source verification failed");
const verified=results.map(r=>r.value);await writeFile(`${directory}/verification.json`,JSON.stringify(verified,null,2));
console.log(JSON.stringify({verified},null,2));
