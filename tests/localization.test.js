import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {configureTranslations,setLocale,translate} from '../localization.js';
import {baseMeta,BONUSES,UPGRADE_DEFS,STAGES} from '../engine.js';
import {SYNERGIES} from '../builds.js';
import {GUARDIANS} from '../guardians.js';
import {PLANS} from '../plans.js';
import {ROUTE_KINDS} from '../route-graph.js';
import {normalizeMeta} from '../storage.js';
const messages=JSON.parse(readFileSync('data/locales/fr.json'));configureTranslations(messages);
test('French catalogue covers all gameplay descriptions, official species and native moves',()=>{
 setLocale('fr');const source=[...BONUSES,...Object.values(UPGRADE_DEFS),...SYNERGIES,...GUARDIANS,...PLANS,...Object.values(ROUTE_KINDS)];
 for(const entry of source)for(const key of ['name','text','tactic'])if(entry[key])assert.ok(Object.hasOwn(messages.translations,entry[key]),`${entry[key]} must have an authored translation`);
 for(const path of ['data/pokemon.json','data/moves.json'])for(const entry of Object.values(JSON.parse(readFileSync(path))))assert.ok(Object.hasOwn(messages.translations,entry.name),entry.name);
 for(const entry of STAGES)assert.notEqual(translate(entry.name),entry.name);
 assert.equal(translate('Bulbasaur'),'Bulbizarre');assert.equal(translate('Thunder Shock'),'Éclair');assert.equal(translate('Bulbasaur uses Vine Whip!'),'Bulbizarre utilise Fouet Lianes !');
});
test('dynamic French previews and logs preserve every gameplay number and exact English fallback',()=>{
 const values=['Maximum HP +18 to 108. HP after choice: 100/108.','Restore 17 HP and 2 PP.','Pay 42 HP when choosing a compatible boon. Click here to cancel.','Victory! +86 gold, +3 experience.','Enemy HP +120%. Enemy damage +72%. Battle and ending gold +120%.','Reforged the offered boons for 35 gold. 1 reforges remain.','Charizard: Flamethrower, 57 damage — critical hit!','Stage 7 / 15','CRITICAL -123'];
 for(const source of values){setLocale('fr');const french=translate(source);assert.notEqual(french,source);assert.deepEqual(french.match(/\d+/g),source.match(/\d+/g));setLocale('en');assert.equal(translate(source),source);}
 assert.equal(translate('2 / 30 PP'),'2 / 30 PP');setLocale('fr');assert.equal(translate('1 boon ranks'),'1 rang de bonus');
});
test('language preference is saved safely and does not change the gameplay defaults',()=>{
 assert.equal(baseMeta().language,'en');assert.equal(normalizeMeta({language:'fr'}).language,'fr');assert.equal(normalizeMeta({language:'de'}).language,'en');assert.equal(normalizeMeta({}).language,'en');
});
