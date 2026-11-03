import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import * as E from "../engine.js";
import * as L from "../landmarks.js";
import { simulate } from "./simulate.mjs";

const out = "output/playwright/readability";
await mkdir(out, { recursive: true });
const catalogue = {
  pokemon: JSON.parse(await readFile("data/pokemon.json", "utf8")),
  moves: JSON.parse(await readFile("data/moves.json", "utf8")),
};
const checkpoint = (stage, phase, starter = 4) => simulate(2026, starter, {
  stopAt: (r) => r.stageIndex === stage && r.phase === phase,
}).run;
const world = JSON.parse(await readFile("data/world-map.json", "utf8"));
function halt(stage) {
  const run = simulate(2026,4,{stopAt:r=>r.stageIndex===stage&&r.phase==="arrival"}).run;
  run.pendingGrowth=null; run.pendingAwakenings=[]; run.regionEntry=null;
  L.beginApproach(run,world); L.finishMotion(run); E.activateStage(run,catalogue);
  return run;
}
const ending = simulate(2026, 4).run, endingMeta = E.baseMeta();
E.settle(ending, endingMeta);
const battle = checkpoint(14, "battle");
battle.bonuses = E.BONUSES.flatMap((b) => Array(b.max).fill(b.id));
battle.hero.maxHp = 999999;
battle.hero.hp = 888888;
battle.coins = 100000000;
const idleRun = E.createRun(4, E.baseMeta(), catalogue, 2026);
Object.assign(idleRun, { plan:"predator", idleEnabled:true, idleAt:Date.now()-3600000 });
const threatBattle = simulate(2026,4,{threat:6,stopAt:r=>r.phase==="battle"}).run;
const empoweredShrine = checkpoint(9,"shrine");
Object.assign(empoweredShrine,{bonuses:[],offers:["attack_boost","regeneration","first_guard"],shrineEmpowered:true});
empoweredShrine.hero.hp=empoweredShrine.hero.maxHp;
const legacyShrine = structuredClone(empoweredShrine); legacyShrine.routeMode="legacy"; legacyShrine.shrineEmpowered=false;
function guardian(species) {
  const index = species === 123 ? 5 : 14;
  const run = simulate(2026,4,{stopAt:r=>r.stageIndex===index && r.phase==="arrival"}).run;
  run.pendingGrowth=null; run.pendingAwakenings=[]; run.regionEntry=null;
  run.scouting={stageIndex:index,speciesId:species}; E.activateStage(run,catalogue);
  return run;
}
const scoutedGuardian = checkpoint(13,"camp");
E.resolveEncounter(scoutedGuardian,"scout",catalogue);
const healthOffering = halt(9);
Object.assign(healthOffering,{bonuses:[],offers:["hp_boost","attack_boost","regeneration"],shrineEmpowered:true});
healthOffering.hero.maxHp=healthOffering.hero.hp=90;
const merchantAwakening = halt(7);
Object.assign(merchantAwakening,{bonuses:["attack_boost","crit_chance","defense_boost","first_guard"],coins:100000000});
merchantAwakening.hero.maxHp=999999;merchantAwakening.hero.hp=888888;merchantAwakening.hero.moves.forEach(s=>s.pp=0);
const scenarios = [
  {name:"health-offering-preview",run:healthOffering},
  {name:"merchant-awakening-preview",run:merchantAwakening},
  {name:"scouted-guardian",run:scoutedGuardian},
  ...[123,150,149,131].flatMap(id=>[
    {name:`guardian-${id}`,run:guardian(id)},
    {name:`inspect-${id}`,run:guardian(id),menu:"opponent"},
  ]),
  {name:"guardian-guide",run:guardian(123),menu:"guardians"},
  ...[2,4,7,9,11,13].map(stage=>({name:`halt-${stage+1}`,run:halt(stage)})),
  { name:"legacy-shrine", run:legacyShrine },
  { name:"shrine-offering", run:empoweredShrine },
  { name: "threats", run:null, menu:"threats", meta:{...E.baseMeta(),unlockedThreat:6,selectedThreat:6} },
  { name: "threat-battle", run:threatBattle },
  { name: "idle-summary", run: idleRun },
  { name: "title", run: null },
  { name: "preparation", run: E.createRun(4, E.baseMeta(), catalogue, 2026) },
  { name: "plans", run: E.createRun(4, E.baseMeta(), catalogue, 2026), menu: "plans" },
  { name: "builds", run: E.createRun(4, E.baseMeta(), catalogue, 2026), menu: "builds" },
  { name: "reward", run: checkpoint(1, "reward") },
  { name: "camp", run: checkpoint(4, "camp") },
  { name: "cache", run: checkpoint(2, "cache") },
  { name: "shop", run: checkpoint(7, "shop") },
  { name: "shrine", run: checkpoint(9, "shrine") },
  { name: "evolution", run: simulate(2026, 133, { stopAt: (r) => r.phase === "evolution" }).run },
  { name: "combat-values", run: battle },
  { name: "partner", run: battle, menu: "partner" },
  { name: "journal", run: battle, menu: "journal" },
  { name: "pause", run: battle, menu: "pause" },
  { name: "retire", run: battle, menu: "retire" },
  { name: "ending", run: ending, meta: endingMeta },
  { name: "guide", run: ending, meta: endingMeta, menu: "guide" },
  { name: "upgrades", run: null, meta: { ...E.baseMeta(), gold: 100000000 }, menu: "upgrades" },
  { name: "help", run: null, menu: "help" },
];
const french=process.argv.includes("--fr");
const scenarioFilter = process.argv.slice(2).filter(arg=>arg!=="--fr");
// Keep native scrollbars visible when inspecting long game windows.
const browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ["--hide-scrollbars"] });
const errors = [], results = [];
try {
  for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768]]) {
    for (const scenario of scenarios) {
      if (scenarioFilter.length && !scenarioFilter.includes(scenario.name)) continue;
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript((data) => {
        localStorage.setItem("pokeRogueAdventureV3", JSON.stringify(data));
        // Freeze simulation for layout fixtures without covering the world with Pause.
        Object.defineProperty(document, "hidden", { get: () => true });
      }, { version: 3, meta: {...(scenario.meta || E.baseMeta()),language:french?"fr":"en"}, run: scenario.run });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      await page.goto("http://127.0.0.1:5173");
      await page.locator(".game-screen[data-phase]").waitFor();
      const resume = page.locator('[data-action="resume"]');
      if (await resume.count()) await resume.click();
      if (scenario.run && !["complete","defeat","retired"].includes(scenario.run.phase) && scenario.name !== "idle-summary")
        assert.equal(await page.locator(".game-screen.mode-title").count(),0,`${scenario.name}: expedition must be resumed before layout checks`);
      if (scenario.menu) {
        if (scenario.run && ["complete", "defeat", "retired"].includes(scenario.run.phase)) await page.locator('[data-action="finish"]').click();
        const control = page.locator(`[data-action="${scenario.menu}"]`).first();
        if (!await control.count()) await page.locator('[data-action="pause"]').click();
        await page.locator(`[data-action="${scenario.menu}"]`).first().click();
      }
      await page.locator("img").evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const measured = await page.evaluate(() => {
        const screen = document.querySelector(".game-screen").getBoundingClientRect();
        const dialog = document.querySelector("dialog");
        const root = dialog || document.querySelector(".game-screen");
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const small = [], overflow = [], text = [], brokenText = [];
        let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent.trim()) continue;
          const parent = node.parentElement, style = getComputedStyle(parent);
          if (!parent.getClientRects().length || style.visibility === "hidden") continue;
          const label = node.textContent.trim();
          if (label.includes("\uFFFD")) brokenText.push(label);
          const size = Number.parseFloat(style.fontSize);
          if (size < 14) small.push({ label, size });
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            // The movable map and bounded journal deliberately clip their offscreen content.
            const clip=parent.closest('.route-viewport,.route-journal,.route-partner')?.getBoundingClientRect();
            if(clip&&(rect.bottom<=clip.top||rect.top>=clip.bottom||rect.right<=clip.left||rect.left>=clip.right))continue;
            if (dialog) {
              const bounds = dialog.getBoundingClientRect();
              if (rect.left < bounds.left + 20 || rect.right > bounds.right - 20)
                overflow.push({ label, reason: "outside dialog reading width" });
            } else if (rect.left < screen.left - 1 || rect.right > screen.right + 1 ||
              rect.top < screen.top - 1 || rect.bottom > screen.bottom + 1)
              overflow.push({ label, reason: "outside game view", x: rect.x, y: rect.y, width: rect.width, height: rect.height });
          }
          text.push({ label, size });
        }
        const rect = (selector) => {const node=document.querySelector(selector);return node&&getComputedStyle(node).visibility!=="hidden"?node.getBoundingClientRect():null;};
        const intersect = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const collisions = [];
        for (const [a, b] of [[".hud-left", ".stage-heading"], [".stage-heading", ".hud-controls"],
          [".encounter-dock", "#map-actor .body-art"], [".relic-rail", ".battle-narration"], [".initial-bonus-dock", ".bonus-partner"]])
          if (!dialog && intersect(rect(a), rect(b))) collisions.push([a, b]);
        if (!dialog) for (const asset of ["wayside-shrine", "merchant-cart", "rest-spring", "supply-chest"]) {
          const prop = rect(`.map-prop[src$="${asset}.webp"]`);
          if (prop) for (const selector of [".hud-controls", ".hud-left", ".stage-heading", ".map-hero-card", ".encounter-dock"])
            if (intersect(prop, rect(selector))) collisions.push([asset, selector]);
        }
        const actions = new Set(["select-route","route-zoom","route-center","language","choose-threat","idle-toggle","plans","set-plan","sound","close","reload","recover","save-notice","retry-save","dismiss-save-notice","pause","help","upgrades","journal","retire","guide","partner","opponent","guardians","builds","threats","speed","upgrade","starter","resume","confirm-retire","finish","retry","evolve","reroll","offering","bonus","encounter","buy","leave"]);
        const unknownActions = [...root.querySelectorAll("[data-action]")].filter(node=>!actions.has(node.dataset.action)).map(node=>({action:node.dataset.action,label:node.textContent.trim()}));
        return { small, overflow, collisions, brokenText, unknownActions, textCount: text.length, minimumFont: Math.min(...text.map((n) => n.size)) };
      });
      await page.screenshot({ path: `${out}/${french?"fr-":""}${width}-${scenario.name}.png` });
      const scrolling = await page.evaluate(() => {
        const dialog = document.querySelector("dialog");
        const content = dialog?.querySelector(".menu-content");
        if (!content || content.scrollHeight <= content.clientHeight) return null;
        for (const list of dialog.querySelectorAll(".log-list")) list.scrollTop = list.scrollHeight;
        content.scrollTop = content.scrollHeight;
        const walker = document.createTreeWalker(dialog.querySelector(".menu-content"), NodeFilter.SHOW_TEXT);
        let node, last;
        while ((node = walker.nextNode())) if (node.textContent.trim()) last = node;
        const range = document.createRange();
        range.selectNodeContents(last);
        const text = range.getBoundingClientRect(), frame = dialog.getBoundingClientRect();
        const close = dialog.querySelector(".menu-close").getBoundingClientRect();
        return { lastText:last.textContent.trim(), reachable:text.top >= frame.top && text.bottom <= frame.bottom - 20,
          closeVisible:close.top >= frame.top && close.bottom <= frame.bottom };
      });
      if (scrolling) {
        assert.ok(scrolling.reachable, `${width} ${scenario.name}: final text unreachable: ${scrolling.lastText}`);
        assert.ok(scrolling.closeVisible, `${width} ${scenario.name}: Close hidden after scrolling`);
        await page.waitForFunction(french => document.querySelector(".menu-scroll-note")?.textContent === (french?"Remontez pour relire":"Scroll up to review"),french);
        await page.screenshot({ path: `${out}/${french?"fr-":""}${width}-${scenario.name}-scrolled.png` });
      }
      measured.scrolling = scrolling;
      results.push({ width, height, scenario: scenario.name, ...measured });
      await context.close();
    }
  }
  await writeFile(`${out}/${french?"fr-":""}${scenarioFilter.length ? "focused-" + scenarioFilter.join("-") : "results"}.json`, JSON.stringify({ results, errors }, null, 2));
  const failures = results.filter((r) => r.small.length || r.overflow.length || r.collisions.length || r.brokenText.length || r.unknownActions.length);
  console.log(JSON.stringify({ scenes: results.length, failures, errors }, null, 2));
  assert.ok(results.length, "No matching readability scenarios");
  assert.deepEqual(errors, []);
  assert.equal(failures.length, 0);
} finally {
  await browser.close();
}
