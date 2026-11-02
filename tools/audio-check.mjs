import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(() => {
  Date.now = () => 2026;
  window.__audioContexts = [];
  window.__audioSources = 0;
  window.__audioGains = [];
  const NativeAudio = window.AudioContext;
  window.AudioContext = class extends NativeAudio {
    constructor(...args) { super(...args); window.__audioContexts.push(this); }
    createGain() {
      const gain = super.createGain();
      window.__audioGains.push(gain);
      return gain;
    }
    createOscillator() {
      const source = super.createOscillator(), start = source.start.bind(source);
      source.start = (...args) => { window.__audioSources++; start(...args); };
      return source;
    }
  };
});
const page = await context.newPage(), errors = [], checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = (action, value) => page.locator(`[data-action="${action}"]${value ? `[data-value="${value}"]` : ""}`).first().click();
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("pokeRogueAdventureV3")));
try {
  await page.goto("http://127.0.0.1:5173");
  await click("starter", "4");
  await click("bonus");
  await click("pause");
  assert.equal(await page.evaluate(() => window.__audioContexts.length), 0);
  await click("sound");
  await page.waitForFunction(() => document.querySelector('[data-action="sound"]').getAttribute("aria-pressed") === "true");
  assert.equal((await saved()).meta.sound, true);
  assert.equal(await page.evaluate(() => window.__audioContexts[0].state), "running");
  await page.screenshot({ path: "output/playwright/audio-setting.png" });
  await click("close");
  await click("speed", "750");
  await page.waitForFunction(() => window.__audioSources > 2, {}, { timeout: 15000 });
  checks.push("Default play allocates no audio context; explicit sound opt-in produces finite voices during actual gameplay");

  await click("pause");
  await page.waitForTimeout(180);
  assert.ok(await page.evaluate(() => window.__audioGains[0].gain.value < 0.001));
  await click("sound");
  await page.waitForFunction(() => document.querySelector('[data-action="sound"]').getAttribute("aria-pressed") === "false");
  const sources = await page.evaluate(() => window.__audioSources);
  const actions = (await saved()).run.actions;
  await click("close");
  await page.waitForTimeout(1700);
  assert.equal(await page.evaluate(() => window.__audioSources), sources);
  assert.ok((await saved()).run.actions > actions);
  checks.push("Pause fades the master channel to silence; muting stops sound while automatic combat continues");

  await click("pause");
  await click("sound");
  await page.waitForFunction(() => document.querySelector('[data-action="sound"]').getAttribute("aria-pressed") === "true");
  assert.equal(await page.evaluate(() => window.__audioContexts.length), 1);
  await page.reload();
  await page.locator('[data-action="resume"]').waitFor();
  assert.equal((await saved()).meta.sound, true);
  assert.equal(await page.evaluate(() => window.__audioContexts.length), 0);
  await click("resume");
  await page.waitForFunction(() => window.__audioContexts.length === 1);
  checks.push("Sound preference persists, reuses its context when toggled and waits for a gesture after reload");

  const signal = await page.evaluate(async () => {
    const { GameAudio } = await import("/audio.js");
    const bank = new GameAudio();
    await bank.unlock(true);
    const analyzer = bank.context.createAnalyser();
    bank.master.connect(analyzer);
    const data = new Float32Array(analyzer.fftSize);
    let peak = 0;
    bank.play("victory");
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      analyzer.getFloatTimeDomainData(data);
      for (const value of data) peak = Math.max(peak, Math.abs(value));
    }
    for (let i = 0; i < 100; i++) bank.play("hit", "electric", true);
    const maximumVoices = bank.voices.size;
    bank.stop();
    const remainingVoices = bank.voices.size;
    analyzer.disconnect();
    await bank.context.close();
    return { peak, maximumVoices, remainingVoices };
  });
  assert.ok(signal.peak > 0.001 && signal.peak < 0.95, JSON.stringify(signal));
  assert.ok(signal.maximumVoices <= 16);
  assert.equal(signal.remainingVoices, 0);
  checks.push("Rendered audio signal is non-silent and bounded; repeated effects cap active voices and release them on stop");
  assert.deepEqual(errors, []);
  const report = { checks, signal, errors };
  await writeFile("output/playwright/audio-results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
