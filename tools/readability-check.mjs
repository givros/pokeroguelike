import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import * as E from "../engine.js";
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
const ending = simulate(2026, 4).run, endingMeta = E.baseMeta();
E.settle(ending, endingMeta);
const battle = checkpoint(14, "battle");
battle.bonuses = E.BONUSES.flatMap((b) => Array(b.max).fill(b.id));
battle.hero.maxHp = 999999;
battle.hero.hp = 888888;
battle.coins = 100000000;
const idleRun = E.createRun(4, E.baseMeta(), catalogue, 2026);
Object.assign(idleRun, { plan:"predator", idleEnabled:true, idleAt:Date.now()-3600000 });
const scenarios = [
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
  { name: "ending", run: ending, meta: endingMeta },
  { name: "guide", run: ending, meta: endingMeta, menu: "guide" },
  { name: "upgrades", run: null, meta: { ...E.baseMeta(), gold: 100000000 }, menu: "upgrades" },
  { name: "help", run: null, menu: "help" },
];
const browser = await chromium.launch({ headless: true });
const errors = [], results = [];
try {
  for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768]]) {
    for (const scenario of scenarios) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript((data) => {
        localStorage.setItem("pokeRogueAdventureV3", JSON.stringify(data));
        // Freeze simulation for layout fixtures without covering the world with Pause.
        Object.defineProperty(document, "hidden", { get: () => true });
      }, { version: 3, meta: scenario.meta || E.baseMeta(), run: scenario.run });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      await page.goto("http://127.0.0.1:5173");
      await page.locator(".game-screen").waitFor();
      const resume = page.locator('[data-action="resume"]');
      if (await resume.count()) await resume.click();
      if (scenario.menu) {
        if (scenario.run && !["builds", "plans"].includes(scenario.menu)) await page.locator('[data-action="finish"]').click();
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
        const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
        const intersect = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const collisions = [];
        for (const [a, b] of [[".hud-left", ".stage-heading"], [".stage-heading", ".hud-controls"],
          [".encounter-dock", "#map-actor .body-art"], [".relic-rail", ".battle-narration"], [".initial-bonus-dock", ".bonus-partner"]])
          if (!dialog && intersect(rect(a), rect(b))) collisions.push([a, b]);
        return { small, overflow, collisions, brokenText, textCount: text.length, minimumFont: Math.min(...text.map((n) => n.size)) };
      });
      await page.screenshot({ path: `${out}/${width}-${scenario.name}.png` });
      results.push({ width, height, scenario: scenario.name, ...measured });
      await context.close();
    }
  }
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  const failures = results.filter((r) => r.small.length || r.overflow.length || r.collisions.length || r.brokenText.length);
  console.log(JSON.stringify({ scenes: results.length, failures, errors }, null, 2));
  assert.deepEqual(errors, []);
  assert.equal(failures.length, 0);
} finally {
  await browser.close();
}
