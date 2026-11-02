import * as E from "./engine.js";
import { readState, writeState } from "./storage.js";
import { BattleEffects } from "./presentation.js";
import { discoveryRecords } from "./field-guide.js";
import { GameAudio } from "./audio.js";
const app = document.getElementById("app");
const effects = new BattleEffects();
const audio = new GameAudio();
let saveStorage;
try {
  saveStorage = window.localStorage;
} catch {
  saveStorage = {
    getItem() {
      throw new Error("Storage unavailable");
    },
    setItem() {
      throw new Error("Storage unavailable");
    },
  };
}
let catalogue,
  world,
  meta,
  run = null,
  titleMode = true,
  modal = null,
  menuReturnFocus = null,
  paused = false,
  running = false,
  epoch = 0,
  speed = 1500,
  warning = "",
  fatal = "",
  narration = "",
  saveAt = 0;
const AUTO = new Set(["travel", "arrival", "battle", "victoryBeat"]);
const TERMINAL = new Set(["complete", "defeat", "retired"]);
const STARTERS = [1, 4, 7, 25, 133, 152];
const NAME_TYPES = {
  grass: "Grass",
  poison: "Poison",
  fire: "Fire",
  flying: "Flying",
  water: "Water",
  normal: "Normal",
  electric: "Electric",
  bug: "Bug",
  ground: "Ground",
  rock: "Rock",
  psychic: "Psychic",
  ghost: "Ghost",
  ice: "Ice",
  fighting: "Fighting",
  dragon: "Dragon",
  steel: "Steel",
  dark: "Dark",
  fairy: "Fairy",
};
const q = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const art = (asset, cls = "", alt = "") =>
  `<img class="item-art ${cls}" src="assets/generated/${asset}.webp" alt="${esc(alt)}" draggable="false">`;
const mon = (id, cls = "") =>
  `<img class="pokemon-art ${cls}" src="${catalogue.pokemon[id].artwork}" alt="${esc(catalogue.pokemon[id].name)}" draggable="false">`;
const visualHeroId = () => run.pendingGrowth?.fromId || run.hero.id;
const button = (label, action, value = "", cls = "", disabled = false) =>
  `<button class="${cls}" data-action="${action}" data-value="${value}" ${disabled ? "disabled" : ""}>${label}</button>`;
function persist() {
  if (!writeState(saveStorage, meta, run))
    warning = "Saving is unavailable. Keep this window open to retain your expedition.";
}
function health(m) {
  return `<div class="health-frame"><div class="health-fill ${m.hp / m.maxHp < 0.25 ? "danger" : m.hp / m.maxHp < 0.5 ? "low" : ""}" style="width:${(m.hp / m.maxHp) * 100}%"></div></div>`;
}
function hud() {
  const stage = E.stage(run);
  return `<header class="game-hud"><div class="hud-left paper-panel">${art("gold-coins")}<strong id="hud-coins">${run.coins}</strong><span class="hud-score">${run.wins} ${run.wins === 1 ? "victory" : "victories"}</span></div><div class="stage-heading"><small>THE GUARDIAN TRAIL · ${String(run.stageIndex + 1).padStart(2, "0")} / ${E.STAGES.length}</small><strong>${stage.name}</strong></div><div class="hud-controls"><div class="speed-select paper-panel">${[
    ["Slow", 2000],
    ["Normal", 1500],
    ["Fast", 750],
  ]
    .map(([label, v]) =>
      button(label, "speed", v, speed === v ? "selected" : ""),
    )
    .join(
      "",
    )}</div>${button("Pause", "pause", "", "paper-panel pause-button")}</div></header>`;
}
function buffRail() {
  const ids = [...new Set(run.bonuses)];
  return `<div class="relic-rail">${ids
    .map((id) => {
      const b = E.BONUSES.find((b) => b.id === id);
      return `<span class="relic" title="${b.name} : ${b.text}">${art(b.asset)}${E.count(run, id) > 1 ? `<b>${E.count(run, id)}</b>` : ""}</span>`;
    })
    .join("")}</div>`;
}
function heroCard() {
  const h = { ...run.hero, id: visualHeroId() };
  return `<div class="map-hero-card paper-panel">${mon(h.id)}<div><strong>${catalogue.pokemon[h.id].name}</strong><small>Level ${h.level} · ${h.hp} / ${h.maxHp} HP</small>${health(h)}</div></div>`;
}
function titleView() {
  const saved = run && !TERMINAL.has(run.phase);
  return `<div class="title-scene"><div class="title-shade"></div><div class="title-brand"><small>ROGUELIKE · AUTOMATIC BATTLES</small><h1>POKÉ<span>ROGUE</span></h1><p>THE GUARDIAN TRAIL</p></div><div class="title-stats"><span>Record <b>${meta.bestScore}</b></span><span>Victories <b>${meta.totalVictories}</b></span><span class="title-gold">${art("gold-coins")}<b>${meta.gold}</b></span></div>
 ${saved ? `<div class="resume-adventure">${button(`Resume expedition · stage ${run.stageIndex + 1}`, "resume", "", "paper-panel main-button")}</div>` : ""}
 <h2 class="starter-heading">${saved ? "Or choose a new partner" : "Choose your partner"}</h2><div class="starter-line">${STARTERS.map(
   (id) => {
     const s = catalogue.pokemon[id],
       locked = !meta.unlockedStarters[id],
       threshold = { 25: 10, 133: 25, 152: 50 }[id];
     return button(
       `${mon(id)}<strong>${s.name}</strong><small>${s.types.map((t) => NAME_TYPES[t] || t).join(" / ")}</small>${locked ? `<span class="starter-lock">${art("brass-lock")}<span>${threshold} victories</span></span>` : ""}`,
       "starter",
       id,
       `starter-pokemon ${locked ? "locked" : ""}`,
       locked,
     );
   },
 ).join("")}</div>
 <div class="title-actions">${button(`${art("affinity-crystal")}Permanent upgrades`, "upgrades", "", "paper-panel")}${button("Field guide", "guide", "", "paper-panel")}${button("How to play", "help", "", "paper-panel")}</div></div>`;
}
function battleCard(m, side) {
  const s = catalogue.pokemon[m.id];
  return `<section class="battle-card ${side}-card paper-panel"><div class="fighter-name"><strong>${s.name}</strong><span>Lv. ${m.level}</span></div><small>${s.types.map((t) => NAME_TYPES[t] || t).join(" / ")}</small><div class="fighter-hp">${health(m)}<span>${m.hp} / ${m.maxHp}</span></div></section>`;
}
function battleView() {
  const h = { ...run.hero, id: visualHeroId() },
    e = run.enemy;
  return `<div id="battle-scene" style="--battle-arena:url(assets/generated/${E.region(run).arena}.webp)"><div id="battle-camera"><div class="arena-shade"></div><div class="actor actor-ally ${h.hp <= 0 ? "fainted" : ""}">${mon(h.id, "body-art")}</div><div class="actor actor-enemy ${e.hp <= 0 ? "fainted" : ""}">${mon(e.id, "body-art")}</div></div><div id="battle-cards">${battleCard(h, "ally")}${battleCard(e, "enemy")}</div><div class="battle-kind">${E.stage(run).kind === "boss" ? "GUARDIAN" : E.stage(run).kind === "elite" ? "ELITE ENCOUNTER" : "AUTOMATIC BATTLE"}<small id="turn-label">Action ${run.battleActions + 1}</small></div>${buffRail()}<div class="battle-narration paper-panel" aria-live="polite">${esc(narration || run.log.at(-1))}</div>${run.phase === "victoryBeat" ? '<div class="victory-banner">VICTORY</div>' : ""}</div>`;
}
function worldProp(p) {
  return `<img class="map-prop" src="assets/generated/${p.asset}.webp" alt="" style="left:${p.x * 100}%;top:${p.y * 100}%;width:${p.w * 100}%;height:${p.h * 100}%;z-index:${Math.round(p.y * 1000)}" draggable="false">`;
}
function destinationProp() {
  const prop = world.encounters[run.stageIndex]?.prop;
  return prop ? worldProp(prop) : "";
}
function mapView() {
  const [x, y] = E.travelPosition(run, world.route);
  const biome = world.regions?.[E.region(run).id] || world;
  return `<div id="map-scene"><div class="map-canvas"><img class="map-foundation" src="${biome.base}" alt="${esc(E.region(run).name)}">${biome.props.map(worldProp).join("")}${destinationProp()}<div id="map-actor" class="map-actor ${run.phase === "travel" && !run.pendingGrowth ? "walking" : ""}" style="left:${x * 100}%;top:${y * 100}%;z-index:${Math.round(y * 1000)}" data-x="${x}" data-y="${y}">${mon(visualHeroId(), "body-art")}</div></div>${heroCard()}${run.phase === "travel" && !run.pendingGrowth ? `<div class="travel-caption"><strong>${catalogue.pokemon[run.hero.id].name} travels to the next destination</strong><span>On the way to ${esc(E.stage(run).name)}</span></div>` : ""}${encounterDock()}</div>`;
}
function choice(asset, title, text, action, value, disabled = false) {
  return button(
    `${art(asset)}<span><strong>${title}</strong><small>${text}</small></span>`,
    action,
    value,
    "dock-choice",
    disabled,
  );
}
function bonusChoices(action = "bonus") {
  return run.offers
    .map((id) => {
      const b = E.BONUSES.find((b) => b.id === id);
      return choice(b.asset, b.name, b.text, action, id);
    })
    .join("");
}
function encounterDock() {
  if (run.pendingGrowth) return "";
  let title = "",
    content = "";
  if (run.phase === "evolution") {
    title = "Your Eevee is ready to evolve";
    content = [134, 135, 136]
      .map((id) =>
        button(
          `${mon(id, "evolution-art")}<span><strong>${catalogue.pokemon[id].name}</strong><small>${catalogue.pokemon[id].types.map((t) => NAME_TYPES[t] || t).join(" / ")} · Your choice lasts for this expedition.</small></span>`,
          "evolve",
          id,
          "dock-choice",
        ),
      )
      .join("");
  }
  if (run.phase === "reward") {
    title = "Another victory, a new boon";
    content = bonusChoices();
  }
  if (run.phase === "camp") {
    title = "A moment at the spring";
    content =
      choice(
        "rest-spring",
        "Rest",
        "Restore all HP and PP.",
        "encounter",
        "rest",
      ) +
      choice(
        "attack-fang",
        "Train",
        "Gain a level and 5 maximum HP.",
        "encounter",
        "train",
      ) +
      choice(
        "critical-lens",
        "Scout ahead",
        "Reveal the next opponent. Your opening strike deals 25% more damage. Forgo healing and training.",
        "encounter",
        "scout",
      );
  }
  if (run.phase === "cache") {
    title = "A discovery along the trail";
    content =
      choice(
        "gold-coins",
        "Take the gold",
        "Find 50 to 80 gold.",
        "encounter",
        "gold",
      ) +
      choice(
        "healing-potion",
        "Take the supplies",
        "Restore 50% maximum HP.",
        "encounter",
        "heal",
      );
  }
  if (run.phase === "shrine") {
    title = "A gift from the ancients";
    content =
      bonusChoices() +
      choice(
        "trail-sign",
        "Continue",
        "Leave the shrine undisturbed.",
        "encounter",
        "leave",
      );
  }
  if (run.phase === "shop") {
    title = "The wayfarer trading post";
    content =
      Object.entries(E.SHOP_ITEMS)
        .map(([key, s]) =>
          choice(
            s.asset,
            s.name + " · " + s.cost + " gold",
            s.text,
            "buy",
            key,
            run.coins < s.cost ||
              (s.bonus &&
                E.count(run, s.bonus) >=
                  E.BONUSES.find((b) => b.id === s.bonus).max) ||
              (key === "potion" && run.hero.hp === run.hero.maxHp) ||
              (key === "full_heal" && !E.needsRecovery(run)),
          ),
        )
        .join("") + button("Continue the journey", "leave", "", "dock-leave");
  }
  return title
    ? `<section class="encounter-dock paper-panel"><h2>${title}</h2><div class="dock-choices">${content}</div><p class="dock-note">${esc(run.log.at(-1))}</p></section>`
    : "";
}
function starterBonusView() {
  return `<div class="starter-bonus-scene">${mon(run.hero.id, "bonus-partner")}<section class="initial-bonus-dock paper-panel"><small>PREPARE YOUR EXPEDITION</small><h2>Choose your first boon</h2><div class="dock-choices">${bonusChoices()}</div><p>Your partner fights automatically. Your choices shape the journey.</p></section></div>`;
}
function endingView() {
  const won = run.phase === "complete";
  return `<div class="ending-scene"><div class="ending-shade"></div>${mon(run.hero.id, "ending-partner")}<section class="ending-content"><small>${won ? "THE GUARDIANS YIELD" : "EVERY JOURNEY LEAVES A MARK"}</small><h1>${won ? "Expedition complete" : "The journey ends"}</h1><p>${won ? "Your partner crossed the trail and defeated its final guardian." : run.phase === "retired" ? "Your partner returns to camp with everything discovered along the way." : "Your partner gave everything. A new journey awaits."}</p><div class="ending-stats"><span><b>${run.wins}</b>victories</span><span><b>${run.stageIndex + 1} / ${E.STAGES.length}</b>stages</span><span><b>${run.coins}</b>gold retained</span></div><div class="ending-actions">${button("Return to camp", "finish", "", "paper-panel main-button")}${button("New expedition", "retry", "", "paper-panel")}</div></section></div>`;
}
function render() {
  effects.clear();
  const mode = titleMode
    ? "title"
    : run.phase === "starter"
      ? "starter"
      : TERMINAL.has(run.phase)
        ? "ending"
        : run.enemy && ["battle", "victoryBeat"].includes(run.phase)
          ? "battle"
          : "map";
  app.innerHTML = `<div class="game-screen mode-${mode} ${paused ? "paused" : ""}" data-phase="${run?.phase || "title"}">${mode === "title" ? titleView() : mode === "ending" ? endingView() : `${hud()}${mode === "starter" ? starterBonusView() : mode === "battle" ? battleView() : mapView()}`}${warning ? `<div class="save-warning">${esc(warning)}</div>` : ""}${fatal ? `<div class="fatal-panel paper-panel"><h2>The journey was interrupted</h2><p>${esc(fatal)}</p>${button("Resume from the last save", "reload", "", "main-button")}</div>` : ""}<div id="menu-host"></div></div>`;
  if (!titleMode && run) {
    const heading = q(".stage-heading small");
    if (heading) heading.textContent = `${E.region(run).name.toUpperCase()} · ${String(run.stageIndex + 1).padStart(2, "0")} / ${E.STAGES.length}`;
    if (run.scouting) {
      const caption = q(".travel-caption");
      if (caption) {
        const report = document.createElement("span");
        report.className = "scouting-report";
        report.textContent = `Scouted: ${catalogue.pokemon[run.scouting.speciesId].name} · Opening strike +25%`;
        caption.append(report);
      }
    }
  }
  if (modal) renderMenu();
}
function updateBattle() {
  for (const [side, m] of [
    ["ally", { ...run.hero, id: visualHeroId() }],
    ["enemy", run.enemy],
  ]) {
    const card = q("." + side + "-card");
    if (card) {
      card.querySelector(".fighter-name>strong").textContent =
        catalogue.pokemon[m.id].name;
      card.querySelector(".fighter-name>span").textContent = "Lv. " + m.level;
      card.querySelector(":scope>small").textContent = catalogue.pokemon[
        m.id
      ].types
        .map((t) => NAME_TYPES[t] || t)
        .join(" / ");
      const fill = card.querySelector(".health-fill");
      fill.style.width = (m.hp / m.maxHp) * 100 + "%";
      fill.classList.toggle("danger", m.hp / m.maxHp < 0.25);
      fill.classList.toggle(
        "low",
        m.hp / m.maxHp >= 0.25 && m.hp / m.maxHp < 0.5,
      );
      card.querySelector(".fighter-hp>span").textContent =
        m.hp + " / " + m.maxHp;
    }
  }
  const turn = q("#turn-label");
  if (turn) turn.textContent = "Action " + (run.battleActions + 1);
  const narr = q(".battle-narration");
  if (narr) narr.textContent = narration || run.log.at(-1);
  const coins = q("#hud-coins");
  if (coins) coins.textContent = run.coins;
  for (const [side, m] of [
    ["ally", { ...run.hero, id: visualHeroId() }],
    ["enemy", run.enemy],
  ]) {
    const actor = q(".actor-" + side);
    if (actor) {
      actor.classList.toggle("fainted", m.hp <= 0);
      const image = actor.querySelector(".body-art");
      if (!image.src.endsWith("/" + m.id + ".png")) {
        image.src = catalogue.pokemon[m.id].artwork;
        image.alt = catalogue.pokemon[m.id].name;
      }
    }
  }
}
function updateTravel() {
  const actor = q("#map-actor");
  if (!actor) return;
  const [x, y] = E.travelPosition(run, world.route);
  actor.style.left = x * 100 + "%";
  actor.style.top = y * 100 + "%";
  actor.style.zIndex = Math.round(y * 1000);
  actor.dataset.x = x;
  actor.dataset.y = y;
}
function fieldGuideView() {
  const records = discoveryRecords(meta, run);
  const known = Object.values(catalogue.pokemon).filter((p) => records[p.id]);
  return `<h2>Field guide</h2><p class="guide-intro">${known.length} / ${Object.keys(catalogue.pokemon).length} species discovered. Meet wild Pokémon and explore each partner's evolution line.</p><div class="guide-species">${known.map((p) =>
    `<section class="guide-entry">${mon(p.id)}<div><strong>${esc(p.name)}</strong><small>${p.types.map((t) => NAME_TYPES[t] || t).join(" / ")}</small><small>Seen ${records[p.id].seen} · Defeated ${records[p.id].defeated}</small></div></section>`
  ).join("") || '<p>No discoveries yet. Choose a partner to begin your journey.</p>'}</div><h3>Recent expeditions</h3><div class="expedition-history">${meta.expeditionHistory.map((r) =>
    `<section>${catalogue.pokemon[r.partnerId] ? mon(r.partnerId) : ""}<div><strong>${r.outcome === "complete" ? "Guardian defeated" : r.outcome === "defeat" ? "Partner exhausted" : "Returned to camp"}</strong><small>Stage ${r.stage} / ${E.STAGES.length} · ${r.wins} victories · ${r.actions} actions</small></div></section>`
  ).join("") || '<p>Your completed expeditions will appear here.</p>'}</div>`;
}
function partnerView() {
  const h = run.hero, p = catalogue.pokemon[h.id];
  const next = run.enemy && run.phase === "battle" ? E.bestMove(run, catalogue, "ally").id : null;
  return `<h2>${esc(p.name)}</h2><div class="partner-profile">${mon(h.id)}<div><strong>Level ${h.level}</strong><p>${h.hp} / ${h.maxHp} HP · ${h.xp} / 2 experience</p>${health(h)}<p>${p.types.map((t) => NAME_TYPES[t] || t).join(" / ")}</p></div></div><h3>Automatic moves</h3><p>Your partner chooses the strongest available move against the current opponent. PP recover after victories and at springs.</p><div class="partner-moves">${h.moves.map((slot) => {
    const move = catalogue.moves[slot.id] || E.STRUGGLE;
    return `<section class="partner-move ${slot.id === next ? "next-move" : ""}"><div><strong>${esc(move.name)}</strong><small>${NAME_TYPES[move.type] || move.type} · ${move.damageClass} · Power ${move.power}</small></div><span>${slot.pp} / ${slot.maxPp} PP${slot.id === next ? '<small>Next automatic choice</small>' : ""}</span></section>`;
  }).join("")}</div><p>Expedition: ${run.stats.damage} damage dealt · ${run.stats.criticals} critical hits.</p>`;
}
function audioControl() {
  const supported = !!(globalThis.AudioContext || globalThis.webkitAudioContext);
  return `<button class="paper-panel sound-control" data-action="sound" aria-pressed="${meta.sound}" ${supported ? "" : "disabled"}>${supported ? `Sound: ${meta.sound ? "On" : "Off"}` : "Sound unavailable"}</button>`;
}
function menuContent() {
  if (modal === "guide") return fieldGuideView();
  if (modal === "partner" && run) return partnerView();
  if (modal === "pause")
    return `<h2>Pause</h2><p>Battle and travel are paused.</p>${audioControl()}<div class="pause-actions">${button("Resume", "close", "", "paper-panel main-button")}${button("Partner & moves", "partner", "", "paper-panel")}${button("Expedition boons", "journal", "", "paper-panel")}${button("Field guide", "guide", "", "paper-panel")}${button("How to play", "help", "", "paper-panel")}${button("Return to camp", "retire", "", "paper-panel", TERMINAL.has(run.phase))}</div>`;
  if (modal === "retire" || modal === "replace")
    return `<h2>Return to camp?</h2><p>This expedition will end. Your gold and victories will be retained.</p><div class="pause-actions">${button("Continue the journey", "close", "", "paper-panel main-button")}${button("End expedition", "confirm-retire", pendingStarter || "", "", "")}</div>`;
  if (modal === "upgrades")
    return `<h2>Permanent upgrades</h2><p class="menu-money">${art("gold-coins")}${meta.gold} gold</p><div class="upgrade-list">${Object.entries(
      E.UPGRADE_DEFS,
    )
      .map(([key, d]) => {
        const n = meta.permanentUpgrades[key],
          cost = Math.round(d.cost * (1 + n * 0.5));
        return choice(
          d.asset,
          d.name + " · rank " + n + "/10",
          d.text + (n < 10 ? " · " + cost + " gold" : ""),
          "upgrade",
          key,
          n >= 10 || meta.gold < cost || (!!run && !TERMINAL.has(run.phase)),
        );
      })
      .join(
        "",
      )}</div>${run && !TERMINAL.has(run.phase) ? '<p class="muted">Finish your expedition before purchasing permanent upgrades.</p>' : ""}`;
  if (modal === "journal")
    return `<h2>Expedition boons</h2><div class="journal-bonuses">${
      [...new Set(run.bonuses)]
        .map((id) => {
          const b = E.BONUSES.find((b) => b.id === id);
          return `<div>${art(b.asset)}<span><strong>${b.name}${E.count(run, id) > 1 ? " ×" + E.count(run, id) : ""}</strong><small>${b.text}</small></span></div>`;
        })
        .join("") || "<p>No boons acquired yet.</p>"
    }</div><h3>Battle journal</h3><div class="log-list">${run.log.map((s) => `<p>${esc(s)}</p>`).join("")}</div>`;
  return `<h2>The wayfarer handbook</h2><div class="help-copy"><h3>An autobattler roguelike</h3><p>Your partner automatically selects its strongest available move against the opponent, accounting for power, types and remaining PP. Prepare your build between battles and watch your choices play out.</p><h3>Fifteen stages, three regions</h3><p>After every victory your partner automatically travels to the next destination. Choose a new boon on arrival. Woodland, lake and sanctuary encounters include caches, springs, a merchant, elites and two guardians.</p><h3>Build your strategy</h3><p>Combine damage, defense, critical hits, regeneration and lifesteal. At springs, choose between full recovery, training or scouting the next opponent for a stronger opening strike. PP are finite; Struggle prevents an unusable move set from blocking battle. Battles end after at most 80 actions.</p><h3>Grow and begin again</h3><p>Your partner levels up, learns moves and evolves. The original three partners evolve at levels 8 and 11; Pikachu and Chikorita also have evolved forms. Eevee chooses an evolution at level 7. Retained gold buys permanent upgrades. Pikachu, Eevee and Chikorita unlock after 10, 25 and 50 victories. The field guide records your discoveries and recent expeditions.</p><p class="muted">Escape pauses the game. Your journey saves on this device and can resume during battle or travel. Open Partner &amp; moves from Pause to inspect HP, PP and the next automatic move.</p></div>`;
}
function renderMenu() {
  const host = q("#menu-host");
  if (!host) return;
  host.innerHTML = modal
    ? `<dialog aria-labelledby="menu-heading"><div class="menu-top">${button("Close", "close", "", "menu-close paper-panel")}</div><div class="menu-content">${menuContent()}${modal === "help" ? audioControl() : ""}</div></dialog>`
    : "";
  if (modal) {
    const d = host.querySelector("dialog");
    d.querySelector("h2").id = "menu-heading";
    d.showModal();
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeMenu();
    });
  }
}
function openMenu(name) {
  if (!modal) menuReturnFocus = document.activeElement;
  modal = name;
  paused = true;
  if (meta) persist();
  effects.setPaused(true);
  audio.setPaused(true);
  q(".game-screen")?.classList.add("paused");
  renderMenu();
}
function closeMenu() {
  modal = null;
  paused = false;
  effects.setPaused(document.hidden);
  audio.setPaused(document.hidden);
  audio.play("select");
  q(".game-screen")?.classList.remove("paused");
  renderMenu();
  if (menuReturnFocus?.isConnected) menuReturnFocus.focus({ preventScroll: true });
  menuReturnFocus = null;
  pump();
}
let pendingStarter = null;
function begin(id) {
  epoch++;
  effects.clear();
  audio.stop();
  audio.setPaused(false);
  run = E.createRun(id, meta, catalogue, Date.now());
  run.starterId = id;
  titleMode = false;
  modal = null;
  paused = false;
  fatal = "";
  narration = "";
  persist();
  render();
}
function live(token) {
  return token === epoch && run && !titleMode && !fatal;
}
async function wait(ms, token) {
  let previous = performance.now(),
    elapsed = 0;
  while (elapsed < ms && live(token)) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(40, ms - elapsed)),
    );
    const now = performance.now();
    if (!paused && !document.hidden) elapsed += Math.min(100, now - previous);
    previous = now;
  }
  return live(token);
}
async function travel(token) {
  let previous = performance.now();
  while (live(token) && run.phase === "travel" && run.travelProgress < 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const now = performance.now();
    if (!paused && !document.hidden) {
      run.travelProgress = Math.min(
        1,
        run.travelProgress +
          Math.min(100, now - previous) / ((4500 * speed) / 1500),
      );
      updateTravel();
      if (now - saveAt > 500) {
        persist();
        saveAt = now;
      }
    }
    previous = now;
  }
  if (live(token) && run.phase === "travel") {
    run.travelProgress = 1;
    const position = E.travelPosition(run, world.route),
      zone = world.encounters[run.stageIndex];
    if (
      !zone ||
      Math.hypot(position[0] - zone.center[0], position[1] - zone.center[1]) >
        zone.radius
    )
      throw new Error(
        "The route destination does not match its encounter.",
      );
    E.arrive(run, catalogue);
    persist();
    render();
  }
}
async function playGrowth(token) {
  const growth = run.pendingGrowth;
  if (!growth) return true;
  const node = q(".actor-ally .body-art") || q("#map-actor .body-art");
  if (node) {
    audio.play("evolve");
    const name = catalogue.pokemon[growth.toId].name;
    const label = document.createElement("span");
    label.className = "vfx evolution-caption";
    label.textContent = `${catalogue.pokemon[growth.fromId].name} is evolving…`;
    node.closest("#battle-scene,#map-scene").append(label);
    q(".victory-banner")?.remove();
    const completed = await effects.evolve(node, catalogue.pokemon[growth.toId].artwork,
      name, (ms) => wait(ms, token));
    if (!completed || !live(token)) return false;
    label.textContent = `${name} joins your journey!`;
    if (!await wait(650, token)) return false;
    label.remove();
  }
  if (!live(token)) return false;
  run.pendingGrowth = null;
  persist();
  return true;
}
async function pump() {
  if (running || titleMode || !run || fatal) return;
  running = true;
  const token = epoch;
  let transitions = 0;
  try {
    while (live(token) && (AUTO.has(run.phase) || run.pendingGrowth)) {
      if (++transitions > 500)
        throw new Error(
          "The automatic sequence was stopped to prevent an unexpected loop.",
        );
      if (paused || document.hidden) {
        await wait(30, token);
        continue;
      }
      if (run.pendingGrowth && !["battle", "victoryBeat"].includes(run.phase)) {
        if (!await playGrowth(token)) break;
        render();
        continue;
      }
      if (run.phase === "travel") {
        await travel(token);
        continue;
      }
      if (run.phase === "arrival") {
        E.activateStage(run, catalogue);
        narration = "";
        persist();
        render();
        if (run.phase === "battle") await wait(700, token);
        continue;
      }
      if (run.phase === "battle") {
        const side = run.nextSide,
          move = E.bestMove(run, catalogue),
          actor = side === "ally" ? run.hero : run.enemy;
        narration =
          catalogue.pokemon[actor.id].name + " uses " + move.name + "!";
        audio.play("windup", move.type);
        updateBattle();
        const duration = Math.max(450, speed * 0.65);
        await effects.windup(side, move, (ms) => wait(ms, token), duration);
        if (!live(token) || run.phase !== "battle") break;
        const result = E.battleStep(run, catalogue);
        narration = run.log.at(-1);
        persist();
        updateBattle();
        if (result) {
          effects.impact(result);
          if (result.kind === "hit") audio.play("hit", result.move.type, result.crit);
          if (["victoryBeat", "complete"].includes(run.phase)) audio.play("victory");
          if (run.phase === "defeat") audio.play("defeat");
        }
        await wait(Math.max(430, speed - duration * 0.7), token);
        if (!live(token)) break;
        if (TERMINAL.has(run.phase)) {
          if (run.pendingGrowth && !await playGrowth(token)) break;
          E.settle(run, meta);
          persist();
          render();
          break;
        }
        continue;
      }
      if (run.phase === "victoryBeat") {
        render();
        await wait(1200, token);
        if (!live(token)) break;
        if (run.pendingGrowth && !await playGrowth(token)) break;
        E.depart(run);
        persist();
        render();
      }
    }
  } catch (error) {
    if (token === epoch) {
      fatal = error.message || "An unexpected error interrupted the journey.";
      paused = true;
      effects.clear();
      persist();
      render();
    }
  } finally {
    running = false;
    if (
      run &&
      !titleMode &&
      !fatal &&
      (AUTO.has(run.phase) || run.pendingGrowth) &&
      !paused &&
      !document.hidden
    )
      queueMicrotask(pump);
  }
}
async function dispatch(action, value) {
  if (action === "sound") {
    meta.sound = !meta.sound;
    persist();
    const enabled = meta.sound;
    await audio.unlock(enabled);
    for (const control of app.querySelectorAll('[data-action="sound"]')) {
      control.textContent = `Sound: ${meta.sound ? "On" : "Off"}`;
      control.setAttribute("aria-pressed", String(meta.sound));
    }
    return;
  }
  if (meta?.sound) void audio.unlock(true);
  if (action === "close") {
    closeMenu();
    return;
  }
  if (action === "reload") {
    location.reload();
    return;
  }
  if (action === "pause") {
    openMenu("pause");
    return;
  }
  if (["help", "upgrades", "journal", "retire", "guide", "partner"].includes(action)) {
    openMenu(action);
    return;
  }
  if (action === "speed") {
    if (![750, 1500, 2000].includes(Number(value))) return;
    speed = Number(value);
    meta.battleSpeed = speed;
    persist();
    document
      .querySelectorAll('[data-action="speed"]')
      .forEach((b) =>
        b.classList.toggle("selected", Number(b.dataset.value) === speed),
      );
    return;
  }
  if (action === "upgrade") {
    if (run && !TERMINAL.has(run.phase)) return;
    if (E.upgrade(meta, value)) {
      persist();
      const gold = q(".title-gold b");
      if (gold) gold.textContent = meta.gold;
      renderMenu();
    }
    return;
  }
  if (action === "starter") {
    const id = Number(value);
    if (!STARTERS.includes(id) || !meta.unlockedStarters[id]) return;
    if (run && !TERMINAL.has(run.phase)) {
      pendingStarter = id;
      openMenu("replace");
      return;
    }
    begin(id);
    return;
  }
  if (action === "resume") {
    titleMode = false;
    paused = false;
    render();
    pump();
    return;
  }
  if (action === "confirm-retire") {
    if (!run || TERMINAL.has(run.phase)) {
      closeMenu();
      return;
    }
    epoch++;
    audio.stop();
    run.phase = "retired";
    E.settle(run, meta);
    persist();
    const next = modal === "replace" ? pendingStarter : null;
    modal = null;
    paused = false;
    pendingStarter = null;
    if (next) begin(next);
    else {
      render();
    }
    return;
  }
  if (action === "finish") {
    epoch++;
    audio.stop();
    run = null;
    titleMode = true;
    modal = null;
    paused = false;
    persist();
    render();
    return;
  }
  if (action === "retry") {
    const starter =
      run.starterId ||
      { 2: 1, 3: 1, 5: 4, 6: 4, 8: 7, 9: 7 }[run.hero.id] ||
      run.hero.id;
    begin(STARTERS.includes(starter) ? starter : 1);
    return;
  }
  if (modal || !run || titleMode || paused || fatal) return;
  if (action === "evolve") {
    if (E.chooseEvolution(run, Number(value), catalogue)) {
      persist();
      render();
      pump();
    }
    return;
  }
  if (action === "bonus") {
    if (E.selectBonus(run, value)) {
      audio.play("reward");
      persist();
      render();
      pump();
    }
    return;
  }
  if (action === "encounter") {
    if (E.resolveEncounter(run, value, catalogue)) {
      audio.play("reward");
      persist();
      render();
      pump();
    }
    return;
  }
  if (action === "buy") {
    if (E.buy(run, value)) {
      audio.play("reward");
      persist();
      render();
    }
    return;
  }
  if (action === "leave" && run.phase === "shop") {
    E.depart(run);
    persist();
    render();
    pump();
  }
}
app.addEventListener("click", (e) => {
  const node = e.target.closest("[data-action]");
  if (node && !node.disabled) {
    e.preventDefault();
    dispatch(node.dataset.action, node.dataset.value);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key === "Escape") {
    e.preventDefault();
    modal
      ? closeMenu()
      : run && !titleMode
        ? openMenu("pause")
        : openMenu("help");
  }
});
document.addEventListener("visibilitychange", () => {
  effects.setPaused(paused || document.hidden);
  audio.setPaused(paused || document.hidden);
  if (!document.hidden) pump();
});
window.addEventListener("pagehide", () => {
  if (meta) persist();
});
async function boot() {
  try {
    const response = await Promise.all(
      ["data/pokemon.json", "data/moves.json", "data/world-map.json"].map(
        async (path) => {
          const r = await fetch(path, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) throw new Error("Missing resource: " + path);
          return r.json();
        },
      ),
    );
    catalogue = { pokemon: response[0], moves: response[1] };
    world = response[2];
    const state = readState(saveStorage, catalogue);
    meta = state.meta;
    run = state.run;
    warning = state.warning;
    speed = meta.battleSpeed || 1500;
    if (run && TERMINAL.has(run.phase)) {
      E.settle(run, meta);
      titleMode = false;
    }
    const required = [
      "forest-arena",
      "mist-lake-arena",
      "ancient-shrine-arena",
      "woodland-trail-base",
      "lake-trail-base",
      "silver-willow",
      "lakeside-reeds",
      "sanctuary-trail-base",
      "sanctuary-arch",
      "broken-sanctuary-column",
      "parchment-panel",
      "gold-coins",
      "healing-berry",
      "attack-fang",
      "defense-shell",
      "critical-lens",
      "affinity-crystal",
      "healing-potion",
      "brass-lock",
      "woodland-tree",
      "mossy-rocks",
      "trail-sign",
      "fire-wisp",
      "water-wisp",
      "leaf-wisp",
      "impact-burst",
      "merchant-cart",
      "rest-spring",
      "supply-chest",
    ];
    const sources = [
      ...required.map((name) => "assets/generated/" + name + ".webp"),
      ...["electric-burst", "spectral-pulse", "stone-impact", "evolution-aura"].map((name) =>
        "assets/effects/" + name + "-sheet.webp"),
      ...Object.values(catalogue.pokemon).map((p) => p.artwork),
    ];
    await Promise.all(
      sources.map((src) => {
        const i = new Image();
        i.src = src;
        let timer;
        return Promise.race([
          i.decode(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Artwork unavailable: " + src)),
              8000,
            );
          }),
        ]).finally(() => clearTimeout(timer));
      }),
    );
    persist();
    render();
  } catch (error) {
    app.innerHTML = `<div class="loading-screen"><h1>POKÉROGUE</h1><p>The game could not load its resources.</p><p>${esc(error.message)}</p><button data-action="reload">Retry</button></div>`;
  }
}
boot();
