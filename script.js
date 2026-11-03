import * as E from "./engine.js";
import { advanceIdle } from "./idle.js";
import { PLANS, planDecision, applyPlanDecision } from "./plans.js";
import { readState, writeState } from "./storage.js";
import { BattleEffects } from "./presentation.js";
import { discoveryRecords } from "./field-guide.js";
import { GameAudio } from "./audio.js";
import { SYNERGIES, activeSynergies, awakenedBy } from "./builds.js";
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
const hasAutomaticWork = () => run && (AUTO.has(run.phase) || run.pendingGrowth || run.regionEntry || run.pendingAwakenings?.length || planDecision(run));
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
  if (run?.idleEnabled) run.idleAt = !paused && !titleMode && !TERMINAL.has(run.phase) ? Date.now() : null;
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
  const builds = activeSynergies(run);
  const combined = new Set(builds.flatMap((recipe) => Object.keys(recipe.requires)));
  const ids = [...new Set(run.bonuses)].filter((id) => !combined.has(id));
  return `<div class="relic-rail">${builds.map((recipe) =>
    button(art(recipe.asset), "builds", "", "relic awakened-relic").replace("<button ", `<button title="${esc(recipe.name + ": " + recipe.text)}" aria-label="${esc(recipe.name)}" `)
  ).join("")}${ids
    .map((id) => {
      const b = E.BONUSES.find((b) => b.id === id);
      return `<button class="relic" type="button" data-action="journal" aria-label="${esc(b.name + ": " + b.text)}" title="${esc(b.name + ": " + b.text)}">${art(b.asset)}${E.count(run, id) > 1 ? `<b>${E.count(run, id)}</b>` : ""}</button>`;
    })
    .join("")}</div>`;
}
function heroCard() {
  const h = { ...run.hero, id: visualHeroId() };
  return `<div class="map-hero-card paper-panel">${mon(h.id)}<div><strong>${catalogue.pokemon[h.id].name}</strong><small>Level ${h.level}${run.plan && run.plan !== "manual" ? ` · <button class="plan-link" data-action="plans">${PLANS.find(p=>p.id===run.plan).name}</button>` : ""}</small><span class="map-hp-value">${h.hp} / ${h.maxHp} HP</span>${health(h)}</div></div>`;
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
 <div class="title-actions">${button(`${art("affinity-crystal")}Permanent upgrades`, "upgrades", "", "paper-panel")}${button(`${art("guardian-crest")}${meta.selectedThreat ? `Threat ${meta.selectedThreat}` : "Normal trail"}`, "threats", "", "paper-panel")}${button("Field guide", "guide", "", "paper-panel")}${button("How to play", "help", "", "paper-panel")}</div></div>`;
}
function battleCard(m, side) {
  const s = catalogue.pokemon[m.id];
  const barrier = side === "ally" && activeSynergies(run).some((recipe) => recipe.id === "lifebloom");
  return `<section class="battle-card ${side}-card ${barrier ? "has-barrier" : ""} paper-panel"><div class="fighter-name"><strong>${s.name}</strong><span>Lv. ${m.level}</span></div><div class="fighter-meta"><small data-fighter-types>${s.types.map((t) => NAME_TYPES[t] || t).join(" / ")}</small>${barrier ? `<span class="barrier-label">Barrier <b data-barrier-value>${m.shield || 0}</b></span>` : ""}</div><div class="fighter-hp">${health(m)}<span>${m.hp} / ${m.maxHp}</span></div>${barrier ? `<div class="barrier-track"><div class="barrier-fill" style="width:${((m.shield || 0) / Math.ceil(m.maxHp * 0.2)) * 100}%"></div></div>` : ""}</section>`;
}
function battleView() {
  const h = { ...run.hero, id: visualHeroId() },
    e = run.enemy;
  return `<div id="battle-scene" style="--battle-arena:url(assets/generated/${E.region(run).arena}.webp)"><div id="battle-camera"><div class="arena-shade"></div><div class="actor actor-ally ${h.hp <= 0 ? "fainted" : ""}">${mon(h.id, "body-art")}</div><div class="actor actor-enemy ${e.hp <= 0 ? "fainted" : ""}">${mon(e.id, "body-art")}</div></div><div id="battle-cards">${battleCard(h, "ally")}${battleCard(e, "enemy")}</div><div class="battle-kind">${E.stage(run).kind === "boss" ? "GUARDIAN" : E.stage(run).kind === "elite" ? "ELITE ENCOUNTER" : "AUTOMATIC BATTLE"}<small id="turn-label">Action ${run.battleActions + 1}${run.plan && run.plan !== "manual" ? ` · ${PLANS.find(p=>p.id===run.plan).name}` : ""}</small></div>${buffRail()}<div class="battle-narration paper-panel" aria-live="polite">${esc(narration || run.log.at(-1))}</div>${run.phase === "victoryBeat" ? '<div class="victory-banner">VICTORY</div>' : ""}</div>`;
}
function worldProp(p) {
  return `<img class="map-prop" src="assets/generated/${p.asset}.webp" alt="" style="left:${p.x * 100}%;top:${p.y * 100}%;width:${p.w * 100}%;height:${p.h * 100}%;z-index:${p.layer === "ground" ? 30 : Math.round(p.y * 1000)}" draggable="false">`;
}
function destinationProp() {
  const prop = E.encounterZone(run, world)?.prop;
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
      const empowered = run.phase === "shrine" && run.shrineEmpowered;
      const eligible = !empowered || E.canEmpowerBonus(run, id);
      const rank = Math.min(b.max, E.count(run, id) + (empowered ? 2 : 1));
      const current = new Set(activeSynergies(run).map((recipe) => recipe.id));
      const next = empowered ? activeSynergies({ ...run, bonuses:[...run.bonuses,id,id] }).filter((recipe)=>!current.has(recipe.id)) : awakenedBy(run, id);
      const description = empowered ? eligible ? `Gain two ranks. Each rank: ${b.text}` : "This boon cannot gain two ranks. Cancel the offering to take one rank." : b.text;
      return choice(b.asset, b.name + (b.max > 1 ? ` · ${b.id === "pp_boost" ? "use " : ""}${rank}/${b.max}` : ""),
        description + (eligible && next.length ? ` Awakens ${next.map((recipe) => recipe.name).join(", ")}!` : ""), action, id, !eligible);
    })
    .join("");
}
function offeringControl() {
  const enabled = !!run.shrineEmpowered;
  const cost = E.shrineOfferingCost(run);
  const hint = enabled ? `Pay ${cost} HP when choosing a compatible boon. Click here to cancel.` : E.canOfferVitality(run) ? `Offer ${cost} HP for two ranks of a compatible boon.` : run.hero.hp <= cost ? `More than ${cost} HP required.` : "No offered boon can gain two ranks.";
  return `<div class="shrine-footer"><button type="button" class="shrine-offering" data-action="offering" data-value="${enabled ? "off" : "on"}" aria-pressed="${enabled}" ${!enabled && !E.canOfferVitality(run) ? "disabled" : ""}>${art("offering-bowl")}<span><strong>Vitality offering: ${enabled ? "On" : "Off"}</strong><small>${hint}</small></span></button>${button("Continue without a boon", "encounter", "leave", "dock-builds")}</div>`;
}
function trainingDescription() {
  if (run.hero.level >= 100) return "Maximum level reached.";
  const preview = E.previewTraining(run, catalogue);
  const growth = preview.speciesId !== run.hero.id ? ` Evolves into ${catalogue.pokemon[preview.speciesId].name}.` : preview.evolutionChoice ? " Choose an evolution next." : "";
  const moves = preview.moves.length ? ` Learn ${preview.moves.join(", ")}.` : "";
  return `Level +1, maximum HP +${preview.maxHpGain}.${growth}${moves}`;
}
function rerollControl() {
  const cost = E.rerollCost(run);
  const label = cost === null ? "Reforges exhausted · 3/3" : `Reforge boons · ${cost} gold · ${3 - (run.rerolls || 0)} left`;
  return `<button class="dock-builds reforge-control" data-action="reroll" ${E.canReroll(run) ? "" : "disabled"}>${label}</button>`;
}
function encounterDock() {
  if (run.pendingGrowth || run.pendingAwakenings?.length) return "";
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
        "field-notes",
      "guardian-crest",
      "offering-bowl",
      "wayside-shrine",
        "Train",
        trainingDescription(),
        "encounter",
        "train",
        run.hero.level >= 100,
      ) +
      choice(
        "critical-lens",
        "Scout ahead",
        "Reveal the next foe. Opening hit +25%. Skip rest and training.",
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
      ) + choice("field-notes", "Study the field notes", trainingDescription(), "encounter", "study", run.hero.level >= 100);
  }
  if (run.phase === "shrine") {
    title = "A gift from the ancients";
    content = bonusChoices();
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
  const note = run.log.at(-1) !== E.stage(run).name + "." ? run.log.at(-1) : "";
  return title
    ? `<section class="encounter-dock paper-panel"><h2>${title}</h2><div class="dock-choices">${content}</div>${run.phase === "shrine" ? offeringControl() : ""}${["reward", "shrine"].includes(run.phase) ? `<div class="reward-tools">${button("View build combinations", "builds", "", "dock-builds")}${rerollControl()}</div>` : ""}${note ? `<p class="dock-note">${esc(note)}</p>` : ""}</section>`
    : "";
}
function starterBonusView() {
  return `<div class="starter-bonus-scene">${mon(run.hero.id, "bonus-partner")}<section class="initial-bonus-dock paper-panel"><small>PREPARE YOUR EXPEDITION</small><h2>Choose your first boon</h2><div class="dock-choices">${bonusChoices()}</div><div class="reward-tools">${button("View build combinations", "builds", "", "dock-builds")}${button("Expedition plan", "plans", "", "dock-builds")}</div><p>Your partner fights automatically. Your choices shape the journey.</p></section></div>`;
}
function endingView() {
  const won = run.phase === "complete";
  return `<div class="ending-scene"><div class="ending-shade"></div>${mon(run.hero.id, "ending-partner")}<section class="ending-content"><small>${won ? "THE GUARDIANS YIELD" : "EVERY JOURNEY LEAVES A MARK"}</small><h1>${won ? "Expedition complete" : "The journey ends"}</h1><p>${won ? "Your partner crossed the trail and defeated its final guardian." : run.phase === "retired" ? "Your partner returns to camp with everything discovered along the way." : "Your partner gave everything. A new journey awaits."}</p><div class="ending-stats"><span><b>${run.wins}</b>victories</span><span><b>${run.stageIndex + 1} / ${E.STAGES.length}</b>stages</span><span><b>${run.coins}</b>gold retained</span></div>${won ? `<p>${run.threat ? `Threat ${run.threat} cleared. ` : ""}${(run.threat || 0) < E.MAX_THREAT ? `Threat ${Math.min(E.MAX_THREAT, (run.threat || 0)+1)} is available.` : "The highest threat has been conquered."}</p>${button("Choose your next challenge", "threats", "", "paper-panel challenge-next")}` : ""}<div class="ending-actions">${button("Return to camp", "finish", "", "paper-panel main-button")}${button("New expedition", "retry", "", "paper-panel")}</div></section></div>`;
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
    if (heading) heading.textContent = `${run.threat ? `THREAT ${run.threat}` : E.region(run).name.toUpperCase()} · ${String(run.stageIndex + 1).padStart(2, "0")} / ${E.STAGES.length}`;
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
      card.querySelector("[data-fighter-types]").textContent = catalogue.pokemon[
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
      const barrier = card.querySelector("[data-barrier-value]");
      if (barrier) {
        barrier.textContent = m.shield || 0;
        card.querySelector(".barrier-fill").style.width =
          ((m.shield || 0) / Math.ceil(m.maxHp * 0.2)) * 100 + "%";
      }
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
    `<section>${catalogue.pokemon[r.partnerId] ? mon(r.partnerId) : ""}<div><strong>${r.outcome === "complete" ? "Guardian defeated" : r.outcome === "defeat" ? "Partner exhausted" : "Returned to camp"}</strong><small>${r.threat ? `Threat ${r.threat} · ` : ""}Stage ${r.stage} / ${E.STAGES.length} · ${r.wins} victories · ${r.actions} actions</small></div></section>`
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
function buildCombinationsView() {
  const active = new Set(run ? activeSynergies(run).map((recipe) => recipe.id) : []);
  return `<h2>Build combinations</h2><p>Collect the listed boon ranks to awaken a relic. Each relic changes how your partner fights for the rest of this expedition.</p><div class="build-recipes">${SYNERGIES.map((recipe) =>
    `<section class="build-recipe ${active.has(recipe.id) ? "is-awakened" : ""}">${art(recipe.asset)}<div><small>${recipe.style.toUpperCase()}${active.has(recipe.id) ? " · AWAKENED" : ""}</small><h3>${recipe.name}</h3><p>${recipe.text}</p><div class="build-requirements">${Object.entries(recipe.requires).map(([id, rank]) => {
      const boon = E.BONUSES.find((b) => b.id === id);
      return `<span class="${run && E.count(run, id) >= rank ? "fulfilled" : ""}">${art(boon.asset)}${boon.name} ${run ? Math.min(rank, E.count(run, id)) + "/" : ""}${rank}</span>`;
    }).join("")}</div></div></section>`
  ).join("")}</div>`;
}
function audioControl() {
  const supported = !!(globalThis.AudioContext || globalThis.webkitAudioContext);
  return `<button class="paper-panel sound-control" data-action="sound" aria-pressed="${meta.sound}" ${supported ? "" : "disabled"}>${supported ? `Sound: ${meta.sound ? "On" : "Off"}` : "Sound unavailable"}</button>`;
}
function plansView() {
  return `<h2>Expedition plan</h2><p>Choose a strategy for this expedition. An active plan selects boons, supplies and spring actions, and may spend expedition gold at the merchant. Reforges and Eevee’s evolution remain your decisions.</p><div class="plan-options">${PLANS.map(plan=>choice(plan.asset, plan.name + ((run.plan || "manual") === plan.id ? " · Selected" : ""), plan.text, "set-plan", plan.id)).join("")}</div><p>Plans run while this game is visible. Pause or switch to Manual at any time.</p>${button(`Away progression: ${run.idleEnabled ? "On" : "Off"}`, "idle-toggle", "", "paper-panel", !run.plan || run.plan === "manual")}<p>When enabled, your plan can progress after this window is hidden or closed, for up to eight hours. Pause stops away progression. Eevee waits for your evolution choice. Each expedition ends at victory or defeat; another expedition requires your choice.</p>`;
}
function idleSummaryView() {
  const report = idleReport;
  return `<h2>While you were away</h2><p>Your ${PLANS.find(p=>p.id===run.plan).name} plan guided this expedition${run.threat ? ` at Threat ${run.threat}` : ""}.</p><div class="idle-results"><p><strong>Stages</strong> ${report.fromStage} to ${report.toStage}</p><p><strong>Victories</strong> ${report.wins}</p><p><strong>Gold change</strong> ${report.goldChange >= 0 ? "+" : ""}${report.goldChange}</p><p><strong>Levels gained</strong> ${report.levels}</p><p><strong>Battle actions</strong> ${report.actions}</p></div><p>${report.waitingForEvolution ? "Eevee is waiting for your evolution choice." : TERMINAL.has(run.phase) ? "This expedition has ended. Its rewards have been retained once." : "Your partner is ready to continue."}</p><p>Gold change includes merchant purchases and any ending reward.</p>${button("Continue", "close", "", "paper-panel main-button")}`;
}
function threatView() {
  const active = run && !TERMINAL.has(run.phase);
  return `<h2>Trail challenge</h2><p>Clear the normal trail to unlock Threat 1. Each cleared threat unlocks the next, up to Threat ${E.MAX_THREAT}. Choose between a safer expedition and stronger foes with richer rewards.</p>${active ? "<p>Finish or end your current expedition before changing its challenge.</p>" : ""}<div class="threat-options">${Array.from({length:E.MAX_THREAT+1},(_,tier)=>{
    const locked = tier > meta.unlockedThreat;
    const title = (tier ? `Threat ${tier}` : "Normal trail") + (meta.selectedThreat === tier ? " - Selected" : "");
    const description = locked ? `Locked. Clear ${tier === 1 ? "the normal trail" : `Threat ${tier-1}`} first.` : tier ? `Enemy HP +${tier*20}%. Enemy damage +${tier*12}%. Battle and ending gold +${tier*20}%.` : "The original trail. Standard enemy strength and gold rewards.";
    return choice(tier ? "guardian-crest" : "trail-sign", title, description, "choose-threat", tier, locked || active);
  }).join("")}</div><p>Your selected challenge is saved for new expeditions. An expedition keeps its starting threat, including away progression.</p>`;
}
function menuContent() {
  if (modal === "threats") return threatView();
  if (modal === "idle-summary" && idleReport) return idleSummaryView();
  if (modal === "plans" && run) return plansView();
  if (modal === "builds") return buildCombinationsView();
  if (modal === "guide") return fieldGuideView();
  if (modal === "partner" && run) return partnerView();
  if (modal === "pause")
    return `<h2>Pause</h2><p>Battle and travel are paused.</p>${audioControl()}<div class="pause-actions">${button("Resume", "close", "", "paper-panel main-button")}${button("Expedition plan", "plans", "", "paper-panel")}${button("Partner & moves", "partner", "", "paper-panel")}${button("Expedition boons", "journal", "", "paper-panel")}${button("Field guide", "guide", "", "paper-panel")}${button("How to play", "help", "", "paper-panel")}${button("Return to camp", "retire", "", "paper-panel", TERMINAL.has(run.phase))}</div>`;
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
  return `<h2>The wayfarer handbook</h2><div class="help-copy"><h3>An autobattler roguelike</h3><p>Your partner automatically selects its strongest available move against the opponent, accounting for power, types and remaining PP. Prepare your build between battles and watch your choices play out.</p><h3>Fifteen stages, three regions</h3><p>After every victory your partner automatically travels to the next destination. Choose a new boon on arrival. Woodland, lake and sanctuary encounters include caches, springs, a merchant, elites and two guardians.</p><h3>Build your strategy</h3><p>Combine damage, defense, critical hits, regeneration and lifesteal. At springs, choose between full recovery, training or scouting the next opponent for a stronger opening strike. PP are finite; Struggle prevents an unusable move set from blocking battle. Battles end after at most 80 actions.</p><h3>Offer vitality at the shrine</h3><p>Take one free boon, or offer 25% maximum HP to gain two ranks of a compatible boon. The offering cannot faint your partner. Unique boons and instant recovery cannot be empowered. Activate or cancel freely; HP is paid only when you choose the boon.</p><h3>Challenge the guardians</h3><p>Clear the normal trail to unlock Threat 1. Each completed threat unlocks the next, up to Threat 6. Stronger enemies grant more battle and ending gold. Choose the threat in camp before starting; each expedition keeps its starting challenge.</p><h3>Grow and begin again</h3><p>Your partner levels up, learns moves and evolves. The original three partners evolve at levels 8 and 11; Pikachu and Chikorita also have evolved forms. Eevee chooses an evolution at level 7. Retained gold buys permanent upgrades. Pikachu, Eevee and Chikorita unlock after 10, 25 and 50 victories. The field guide records your discoveries and recent expeditions.</p><p class="muted">Escape pauses the game. Your journey saves on this device and can resume during battle or travel. Open Partner &amp; moves from Pause to inspect HP, PP and the next automatic move.</p></div>`;
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
  idleReport = null;
  paused = false;
  if (run?.idleEnabled) { run.idleCredit = 0; persist(); }
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
let idleReport = null;
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
      zone = E.encounterZone(run, world);
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
async function playRegionEntry(token) {
  const scene = q("#map-scene");
  if (scene) {
    const area = E.region(run), entry = document.createElement("section");
    const description = {
      woodland: "Sunlit paths beneath the old canopy.",
      lake: "Follow the silver shore into rising mist.",
      sanctuary: "Ancient stone remembers every traveler.",
    }[area.id];
    entry.className = "region-entry";
    entry.innerHTML = `<small>REGION ${E.REGIONS.indexOf(area) + 1} OF ${E.REGIONS.length}</small><h2>${area.name}</h2><p>${description}</p>`;
    scene.append(entry);
    const duration = effects.reduced ? 500 : 1800;
    effects.animate(entry, [
      { opacity: 0 }, { opacity: 1, offset: 0.15 },
      { opacity: 1, offset: 0.75 }, { opacity: 0 },
    ], { duration, easing: "linear" });
    if (!await wait(duration, token)) return false;
    entry.remove();
  }
  if (!live(token)) return false;
  run.regionEntry = null;
  persist();
  return true;
}
async function playAwakening(token) {
  const id = run.pendingAwakenings[0];
  const recipe = SYNERGIES.find((candidate) => candidate.id === id);
  const scene = q("#map-scene") || q("#battle-scene");
  if (scene && recipe) {
    const toast = document.createElement("section");
    toast.className = "vfx awakening-toast";
    toast.innerHTML = `${art(recipe.asset)}<small>BUILD AWAKENED</small><strong>${recipe.name}</strong>`;
    scene.append(toast);
    audio.play("evolve");
    effects.animate(toast, [
      { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, offset: 0.2 },
      { opacity: 1, offset: 0.8 }, { opacity: 0, scale: 1.05 },
    ], { duration: effects.reduced ? 1 : 1700, easing: "linear" });
    if (!await wait(effects.reduced ? 500 : 1700, token)) return false;
    toast.remove();
  }
  if (!live(token)) return false;
  run.pendingAwakenings = run.pendingAwakenings.filter((pending) => pending !== id);
  persist();
  return true;
}
async function pump() {
  if (running || titleMode || !run || fatal) return;
  running = true;
  const token = epoch;
  let transitions = 0;
  try {
    while (live(token) && hasAutomaticWork()) {
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
      if (run.pendingAwakenings?.length) {
        if (!await playAwakening(token)) break;
        render();
        continue;
      }
      if (run.regionEntry) {
        if (!await playRegionEntry(token)) break;
        render();
        continue;
      }
      const decision = planDecision(run);
      if (decision) {
        narration = `${PLANS.find(p=>p.id===run.plan).name} plan is choosing the next step…`;
        if (!await wait(1100, token)) break;
        if (planDecision(run)?.action !== decision.action || planDecision(run)?.value !== decision.value) continue;
        if (!applyPlanDecision(run, decision, catalogue)) throw new Error("The expedition plan could not apply its choice.");
        persist();
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
      hasAutomaticWork() &&
      !paused &&
      !document.hidden
    )
      queueMicrotask(pump);
  }
}
async function dispatch(action, value) {
  if (action === "choose-threat" && modal === "threats" && (!run || TERMINAL.has(run.phase))) {
    if (E.chooseThreat(meta, Number(value))) { persist(); render(); }
    return;
  }
  if (action === "idle-toggle" && run && modal === "plans" && run.plan !== "manual") {
    run.idleEnabled = !run.idleEnabled;
    run.idleCredit = 0;
    persist();
    renderMenu();
    return;
  }
  if (action === "plans" && run && !TERMINAL.has(run.phase)) { openMenu("plans"); return; }
  if (action === "set-plan" && run && modal === "plans" && PLANS.some(p=>p.id===value)) {
    run.plan = value;
    if (value === "manual") { run.idleEnabled = false; run.idleAt = null; run.idleCredit = 0; }
    E.addLog(run, `${PLANS.find(p=>p.id===value).name} expedition plan selected.`);
    persist();
    closeMenu();
    render();
    pump();
    return;
  }
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
  if (["help", "upgrades", "journal", "retire", "guide", "partner", "builds", "threats"].includes(action)) {
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
    if (run?.idleEnabled) run.idleCredit = 0;
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
  if (action === "reroll") {
    if (E.rerollBonuses(run)) {
      audio.play("reward");
      persist();
      render();
    }
    return;
  }
  if (action === "offering") {
    if (E.setShrineOffering(run, value === "on")) { persist(); render(); }
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
      pump();
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
function catchUpAbsence() {
  if (!run?.idleEnabled || !Number.isFinite(run.idleAt)) return;
  const elapsed = Date.now() - run.idleAt;
  run.idleAt = null;
  const report = advanceIdle(run, meta, catalogue, elapsed);
  if (report) {
    idleReport = report;
    titleMode = false;
    paused = true;
    modal = "idle-summary";
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && run?.idleEnabled && !paused && !titleMode) {
    epoch++;
    effects.clear();
    persist();
  } else if (!document.hidden && run?.idleEnabled) {
    catchUpAbsence();
    if (!idleReport) run.idleCredit = 0;
    persist();
    render();
  }
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
      "flurry-talons",
      "briar-bulwark",
      "lifebloom-vessel",
      "living-roots",
      "ravenous-fang-v2",
      "opening-guard",
      "wayfarer-spur",
      "guardian-eye",
      "field-notes",
      "guardian-crest",
      "offering-bowl",
      "wayside-shrine",
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
    catchUpAbsence();
    persist();
    render();
  } catch (error) {
    app.innerHTML = `<div class="loading-screen"><h1>POKÉROGUE</h1><p>The game could not load its resources.</p><p>${esc(error.message)}</p><button data-action="reload">Retry</button></div>`;
  }
}
boot();
