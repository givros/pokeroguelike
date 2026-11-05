import * as E from "./engine.js";
import * as L from "./landmarks.js";
import {RouteCamera} from "./route-camera.js";
import {configureTranslations,setLocale,PresentationLocalizer,frenchName} from "./localization.js";
import { expeditionGraph, ROUTE_KINDS } from "./route-graph.js";
import { mapArtworkStyle, applyMapArtwork } from "./artwork-layout.js";
import { JourneyCheckpoint } from "./checkpoint.js";
import { GUARDIANS, guardianAbility, guardianState } from "./guardians.js";
import { advanceIdle } from "./idle.js";
import { PLANS, planDecision, applyPlanDecision } from "./plans.js";
import { openSaveSession, readState, resetSave, writeState } from "./storage.js";
import { BattleEffects, IMPACT_ASSETS, PROJECTILE_ASSETS } from "./presentation.js";
import { discoveryRecords } from "./field-guide.js";
import { GameAudio } from "./audio.js";
import { SYNERGIES, activeSynergies } from "./builds.js";
import {SKILLS,EQUIPMENT,unlockSkill,equipSkill,equipGear} from "./legacy.js";
const app = document.getElementById("app");
const localizer = new PresentationLocalizer(app);
const effects = new BattleEffects();
const audio = new GameAudio();
const checkpoint = new JourneyCheckpoint();
let saveStorage;
let saveSessionIsCurrent;
const routeCamera = new RouteCamera();
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
    removeItem() {},
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
  saveAvailable = true,
  fatal = "",
  narration = "",
  saveAt = 0;
const workWaiters = new Set();
const AUTO = new Set(["travel", "arrival", "battle", "victoryBeat"]);
let captureReveal = null;
const captureAnimating = () => captureReveal !== null && run?.pendingCapture === captureReveal;
const hasAutomaticWork = () => run && !run.introChoicePending && (run.introPending || captureAnimating() || (AUTO.has(run.phase) && !E.needsRouteChoice(run)) || run.pendingGrowth || run.regionEntry || run.pendingAwakenings?.length || L.landmarkMoving(run) || planDecision(run));
const TERMINAL = new Set(["complete", "defeat", "retired"]);
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
const phoneLayout = () => matchMedia("(max-width: 980px)").matches;
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
const mon = (id, cls = "", loading = "eager") =>
  `<img class="pokemon-art ${cls}" data-species="${id}" src="${catalogue.pokemon[id].artwork}" alt="${esc(catalogue.pokemon[id].name)}" loading="${loading}" draggable="false">`;
const visualHeroId = () => run.pendingGrowth?.fromId || run.hero.id;
const button = (label, action, value = "", cls = "", disabled = false) =>
  `<button class="${cls}" data-action="${action}" data-value="${value}" ${disabled ? "disabled" : ""}>${label}</button>`;
function keepSaveSession() {
  if (!saveSessionIsCurrent || saveSessionIsCurrent()) return true;
  location.reload();
  return false;
}
function persist() {
  if (fatal || !meta || !keepSaveSession()) return false;
  if (run?.idleEnabled) run.idleAt = !paused && !titleMode && !TERMINAL.has(run.phase) ? Date.now() : null;
  checkpoint.capture(meta,run);
  saveAvailable = writeState(saveStorage, meta, run);
  syncSaveNotice();
  return saveAvailable;
}
function saveMessage() {
  return saveAvailable ? warning : "Saving is unavailable. Keep this window open to retain your expedition.";
}
function saveAdvice() {
  return saveAvailable ? "Your current progress has been saved on this device." : "The current checkpoint is still held in this window.";
}
function saveNoticeView() {
  const message = saveMessage();
  return message ? `<button class="save-warning paper-panel" data-action="save-notice" aria-label="Save notice: ${esc(message)}">${art("field-notes")}<span>Save notice</span></button>` : "";
}
function syncSaveNotice() {
  const root = q(".game-screen");
  if (!root || fatal) return;
  const notice = root.querySelector(".save-warning"), message = saveMessage();
  if (!message) notice?.remove();
  else if (notice) notice.setAttribute("aria-label",`Save notice: ${message}`);
  else root.insertAdjacentHTML("beforeend",saveNoticeView());
  const copy = q("[data-save-message]"), advice = q("[data-save-advice]"), dismiss = q('[data-action="dismiss-save-notice"]');
  if (copy) copy.textContent = message || "Saving is working.";
  if (advice) advice.textContent = saveAdvice();
  if (dismiss) dismiss.hidden = !saveAvailable || !warning;
  if (modal === "save-notice") updateMenuScroll();
}
function interruptJourney(error) {
  if (!keepSaveSession()) return;
  invalidateWork();
  fatal = error?.message || "An unexpected error interrupted the journey.";
  modal = null;
  paused = true;
  effects.clear();
  audio.setPaused(true);
  const safe = checkpoint.restore();
  if (safe?.run?.idleEnabled) {
    safe.run.idleAt = null;
    checkpoint.capture(safe.meta,safe.run);
    saveAvailable = writeState(saveStorage,safe.meta,safe.run);
  }
  render();
}
function recoverJourney() {
  const state = checkpoint.restore();
  if (!state) return;
  invalidateWork();
  effects.clear();
  meta = state.meta;
  setLocale(meta.language);
  run = state.run;
  fatal = "";
  narration = "";
  speed = meta.battleSpeed || 1500;
  titleMode = !run;
  paused = !!run && !TERMINAL.has(run.phase);
  modal = paused ? "pause" : null;
  if (run && TERMINAL.has(run.phase)) E.settle(run,meta);
  audio.setPaused(paused);
  persist();
  render();
}
function recoveryView() {
  return `<dialog class="fatal-panel paper-panel" role="alertdialog" aria-labelledby="recovery-heading"><img class="recovery-emblem" src="assets/generated/guardian-crest.webp" alt=""><h2 id="recovery-heading">The journey was interrupted</h2><p>The current step could not finish. Restore your last checkpoint to continue.</p>${!saveAvailable ? '<p>Your checkpoint is held in this window. Restore it without reloading.</p>' : ""}<div class="recovery-actions">${checkpoint.available ? button("Restore checkpoint","recover","","paper-panel main-button") : ""}${saveAvailable ? button("Reload game","reload","","paper-panel") : ""}</div><details class="recovery-details"><summary>Technical details</summary><p>${esc(fatal)}</p></details></dialog>`;
}
function health(m) {
  return `<div class="health-frame"><div class="health-fill ${m.hp / m.maxHp < 0.25 ? "danger" : m.hp / m.maxHp < 0.5 ? "low" : ""}" style="width:${(m.hp / m.maxHp) * 100}%"></div></div>`;
}
function battleKindView() {
  if (!run.enemy || !["battle","victoryBeat"].includes(run.phase)) return "";
  return `<div class="battle-kind">${E.stage(run).kind === "boss" ? "GUARDIAN" : E.stage(run).kind === "elite" ? "ELITE ENCOUNTER" : "AUTOMATIC BATTLE"}<small id="turn-label">Action ${run.battleActions + 1}${run.plan && run.plan !== "manual" ? ` · ${PLANS.find(p=>p.id===run.plan).name}` : ""}</small></div>`;
}
function hud() {
  const stage = E.stage(run);
  const stageName = stage.kind === 'capture' && ['battle', 'capture'].includes(run.phase)
    ? 'Capture encounter' : stage.name;
  return `<header class="game-hud"><div class="hud-left paper-panel">${art("gold-coins")}<strong id="hud-coins">${run.coins}</strong><span class="hud-score">${run.wins} ${run.wins === 1 ? "victory" : "victories"}</span></div><div class="stage-heading"><small>THE GUARDIAN TRAIL · ${String(run.stageIndex + 1).padStart(2, "0")} / ${E.STAGES.length}</small><strong>${E.needsRouteChoice(run)?"Choose your route":stageName}</strong>${battleKindView()}</div><div class="hud-controls"><div class="speed-select paper-panel">${[
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
  const selected = E.selectedStartingPartner(meta, catalogue);
  return `<div class="title-scene"><div class="title-shade"></div>${languageControl()}${button('Start over from scratch','reset-save','','paper-panel reset-save-button title-reset')}<div class="title-brand"><small>ENDLESS ROGUELITE · AUTOMATIC BATTLES</small><h1>POKÉ<span>ROGUE</span></h1><p>THE GUARDIAN TRAIL</p></div><div class="title-stats"><span>Best depth <b>${meta.bestDepth}</b></span><span>Legacy marks <b>${meta.legacyMarks}</b></span><span class="title-gold">${art('gold-coins')}<b>${meta.gold}</b></span></div>
  ${saved?`<div class="resume-adventure">${button(`Resume expedition · depth ${run.stageIndex+1}`,'resume','','paper-panel main-button')}</div>`:''}
  <section class="expedition-launch">${selected?mon(selected,'launch-partner'):art('capture-ball','launch-ball')}<h2>${selected?catalogue.pokemon[selected].name:'A random partner awaits'}</h2><p>${selected?'Your captured partner joins the next expedition.':'Your partner is revealed when the expedition begins.'}</p><div class="launch-actions${selected ? ' launch-actions-pair' : ''}">${selected ? button('Start with this partner','chosen-start','','paper-panel main-button') : ''}${button('Draw at random','random-start','','paper-panel main-button')}</div></section>
  <div class="title-actions">${button(`${art('offering-bowl')}Legacy camp`,'legacy','','paper-panel')}${button(`${art('capture-ball')}Partner collection`,'partners','','paper-panel')}${button('Field guide','guide','','paper-panel')}${button('How to play','help','','paper-panel')}</div></div>`;
}
const rarityLabels = { common: 'Common', rare: 'Rare', legendary: 'Legendary', mythical: 'Mythical' };
const rarityOf = species => species.mythical ? 'mythical' : species.rarity ?? 'common';

function rarityBadge(rarity) {
  return `<span class="roll-rarity" data-reveal-rarity="${rarity}">${rarityLabels[rarity]}</span>`;
}

function specialCaptureRarity(attempt) {
  if (!attempt?.caught) return null;
  const species = catalogue.pokemon[attempt.id];
  return species.rarity === 'legendary' ? rarityOf(species) : null;
}

const rollWinnerIndex = 14;

function starterChoices() {
  const owned = Object.keys(meta.captured).map(id => catalogue.pokemon[id]).filter(Boolean);
  return `<section class="roll-choices" data-roll-choices ${run.introChoicePending ? '' : 'hidden'}>
    ${button('Keep this draw','accept-starter-draw','','paper-panel main-button')}
    <div class="roll-collection"><h3>Captured partners</h3>
      ${owned.length ? `<div class="roll-collection-list">${owned.map(({id,name}) =>
        button(`${mon(id, '', 'lazy')}<span>${esc(name)}</span>`,'choose-captured-starter',id,'roll-captured-partner')
      ).join('')}</div>` : '<p>No partners captured yet.</p>'}
    </div>
  </section>`;
}

function starterRollView(){
 const chosen = run.introMode === 'chosen';
 const reel = { seed: ((run.initialSeed ^ 0x1b873593) >>> 0) || 1 };
 const picks = Array.from({length:rollWinnerIndex + 5}, () => E.drawCatalogueSpecies(catalogue, E.random(reel)));
 picks[rollWinnerIndex] = run.hero.id;
 return `<section id="partner-roll" class="partner-roll-scene${chosen ? '' : ' roll-with-choices'}"><div class="title-shade"></div><div class="partner-roll-content"><h1>${chosen?'Your partner is ready':'Your next partner'}</h1>${chosen?mon(run.hero.id,'chosen-reveal'):`<div class="roll-window paper-panel"><div class="roll-strip">${picks.map((id,index)=>`<div class="roll-item" data-roll-index="${index}">${mon(id)}<strong>${catalogue.pokemon[id].name}</strong></div>`).join('')}</div><div class="roll-marker">${art('capture-ball')}</div></div>`}<div class="roll-result" role="status" aria-atomic="true"><h2 data-roll-result>${chosen?catalogue.pokemon[run.hero.id].name:'Selecting your partner…'}</h2>${chosen?'':'<span class="roll-rarity" data-roll-rarity></span>'}</div>${chosen ? '' : starterChoices()}</div></section>`;
}

function battleCard(m, side) {
  const s = catalogue.pokemon[m.id];
  const barrier = side === "ally" && (run.skill==='ward'||E.count(run,'trail_barrier')||activeSynergies(run).some((recipe) => recipe.id === "lifebloom"));
  const ability = side === "enemy" ? guardianAbility(run) : null;
  return `<section class="battle-card ${side}-card ${barrier ? "has-barrier" : ""} paper-panel"><div class="fighter-name"><strong>${s.name}</strong><span>Lv. ${m.level}</span></div><div class="fighter-meta"><small data-fighter-types>${s.types.map((t) => NAME_TYPES[t] || t).join(" / ")}</small>${ability ? button(ability.name, "opponent", "", "guardian-ability") : ""}${barrier ? `<span class="barrier-label">Barrier <b data-barrier-value>${m.shield || 0}</b></span>` : ""}</div><div class="fighter-hp">${health(m)}<span>${m.hp} / ${m.maxHp}</span></div>${barrier ? `<div class="barrier-track"><div class="barrier-fill" style="width:${((m.shield || 0) / Math.ceil(m.maxHp * 0.2)) * 100}%"></div></div>` : ""}</section>`;
}
function battleView() {
  const h = { ...run.hero, id: visualHeroId() },
    e = run.enemy;
  const species = catalogue.pokemon[e.id];
  const reading = run.phase === 'battle' && run.battleActions === 0 && !narration
    ? `<span>${esc(species.name)} challenges you!</span>${rarityBadge(rarityOf(species))}`
    : esc(narration || run.log.at(-1));
  return `<div id="battle-scene" style="--battle-arena:url(assets/generated/${E.region(run).arena}.webp)"><div id="battle-camera"><div class="arena-shade"></div><div class="actor actor-ally ${h.hp <= 0 ? "fainted" : ""}">${mon(h.id, "body-art")}</div><div class="actor actor-enemy ${e.hp <= 0 ? "fainted" : ""}">${mon(e.id, "body-art")}</div></div><div id="battle-cards">${battleCard(h, "ally")}${battleCard(e, "enemy")}</div>${buffRail()}<div class="battle-narration paper-panel" aria-live="polite">${reading}</div>${run.phase === "victoryBeat" ? '<div class="victory-banner">VICTORY</div>' : ""}</div>`;
}
function worldProp(p) {
  return `<img class="map-prop" src="assets/generated/${p.asset}.webp" alt="" style="left:${p.x * 100}%;top:${p.y * 100}%;width:${p.w * 100}%;height:${p.h * 100}%;z-index:${p.layer === "ground" ? 30 : Math.round(p.y * 1000)}" draggable="false">`;
}
function destinationProp() {
  if (run.routeMode === "regional") {
    const biome = world.regions?.[E.region(run).id];
    if (biome) return biome.encounters.filter(zone=>zone.prop).map(zone=>worldProp(zone.prop)).join("");
  }
  const prop = E.encounterZone(run, world)?.prop;
  return prop ? worldProp(prop) : "";
}
function routeView() {
  const graph=expeditionGraph(run,E.STAGES), choices=E.routeChoices(run), available=new Set(choices.map(n=>n.id)), path=new Set(run.branchPath);
  const ready=E.needsRouteChoice(run)&&!run.pendingGrowth&&!run.pendingAwakenings?.length;
  const focus=choices[0]||graph.byId.get(run.branchPath.at(-1))||graph.rows[run.stageIndex][0];
  const lines=graph.nodes.flatMap(n=>n.next.map(id=>{const target=graph.byId.get(id);return `<line data-from="${n.id}" data-to="${id}" class="${path.has(n.id)&&path.has(id)?'traversed':''}" x1="${n.x*600}" y1="${n.y}" x2="${target.x*600}" y2="${target.y}"/>`;})).join('');
  const nodes=graph.nodes.map(n=>{
    const visited=path.has(n.id),info=ROUTE_KINDS[visited?n.stage.kind:n.kind],current=visited&&n.row===run.stageIndex;
    return `<button class="route-node ${n.kind==='boss'?'route-boss':''} ${visited?'visited':''} ${current?'current':''} ${available.has(n.id)&&ready?'available':''}" data-route-node="${n.id}" data-action="select-route" data-value="${n.id}" style="left:${n.x*100}%;top:${n.y/graph.height*100}%" aria-label="Stage ${n.row+1}: ${info.name}${visited?', visited':available.has(n.id)?', available':', unreachable'}" aria-disabled="${!(ready&&available.has(n.id))}">${art(info.asset)}<span class="route-node-caption">${info.name}</span></button>`;
  }).join('');
  const h=run.hero,dock=encounterDock();
  return `<div id="map-scene" class="route-scene"><div class="route-layout" ${dock?"inert":""}><aside class="route-partner paper-panel"><small>YOUR PARTNER</small><div id="map-actor" class="route-avatar">${mon(visualHeroId(),'body-art')}</div><h2>${catalogue.pokemon[h.id].name}</h2><p>Level ${h.level}</p><strong>${h.hp} / ${h.maxHp} HP</strong>${health(h)}<p>${run.wins} victories<br>${run.bonuses.length} boon ranks</p>${button('Partner & moves','partner','','route-inspect')}${run.preparedStrike?'<p>Opening strike +25%</p>':''}</aside><section class="route-map"><div class="route-map-heading"><strong>${ready?'Choose your next encounter':'Your expedition route'}</strong><span>${run.endless?"New paths unfold as you advance · no final stage":"Paths ascend toward the guardian"}</span></div><div class="route-viewport pannable" tabindex="0" aria-label="Expedition routes; drag to move, wheel to zoom"><div class="route-board" style="height:${graph.height}px"><svg viewBox="0 0 600 ${graph.height}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}<span class="route-start">EXPEDITION START</span></div></div><div class="route-map-footer"><div class="route-camera-controls">${button("Zoom out","route-zoom","out","route-zoom")}<span data-map-zoom>110%</span>${button("Zoom in","route-zoom","in","route-zoom")}${button("Recenter","route-center","","route-zoom")}</div><span class="desktop-route-hint">${ready?'Select a glowing connected encounter to continue.':'The selected encounter is in progress.'}</span><span class="mobile-route-hint">Tap a token to inspect it.</span></div></section><aside class="route-journal paper-panel" aria-live="polite"><small>ENCOUNTER</small><div id="route-preview">${routePreview(focus)}</div><div class="route-key"><p>Golden trail: your chosen path</p><p>Glowing tokens: available choices</p><p>Drag the map to explore. Use the wheel or zoom buttons to inspect a route.</p></div></aside></div>${dock}</div>`;
}
function routePreview(node) {
  const info=ROUTE_KINDS[run.branchPath.includes(node.id)?node.stage.kind:node.kind];
  return `${art(info.asset)}<h2>${info.name}</h2><p class="route-preview-depth">Stage ${node.row+1} / ${run.endless?"∞":E.STAGES.length}</p><p class="route-preview-description">${info.text}</p>${E.routeChoices(run).some(choice=>choice.id===node.id)?button("Enter encounter","enter-route",node.id,"route-enter"):""}`;
}
function mapView() {
  if (run.routeMode === 'branching') return routeView();
  const [x, y] = L.mapPosition(run, world.route);
  const biome = world.regions?.[E.region(run).id] || world;
  const walking = (run.phase === "travel" || L.landmarkMoving(run)) && !run.pendingGrowth && !run.regionEntry;
  const activity = run.landmark?.state === "approaching" ? "approaches the next halt" : run.landmark?.state === "returning" ? "returns to the trail" : "travels to the next destination";
  return `<div id="map-scene"><div class="map-canvas"><img class="map-foundation" src="${biome.base}" alt="${esc(E.region(run).name)}">${biome.props.map(worldProp).join("")}${destinationProp()}<div id="map-actor" class="map-actor ${walking ? "walking" : ""}" style="left:${x * 100}%;top:${y * 100}%;z-index:${Math.round(y * 1000)};--map-facing:${L.mapFacing(run, world)};${mapArtworkStyle(catalogue.artworkLayout[visualHeroId()])}" data-x="${x}" data-y="${y}">${mon(visualHeroId(), "body-art")}</div></div>${heroCard()}${walking ? `<div class="travel-caption paper-panel"><strong>${catalogue.pokemon[run.hero.id].name} ${activity}</strong><span>On the way to ${esc(E.stage(run).name)}</span></div>` : ""}${encounterDock()}</div>`;
}

const encounterScenes = {
  cache: { backdrop: 'ancient-shrine-arena', prop: 'supply-chest' },
  shop: { backdrop: 'forest-arena', prop: 'merchant-cart' },
  camp: { backdrop: 'mist-lake-arena', prop: 'rest-spring' },
};

function landmarkSceneView(entering) {
  const {backdrop, prop} = encounterScenes[run.phase];
  const id = visualHeroId();
  return `<div id="landmark-scene" class="landmark-scene${entering ? ' landmark-entry' : ''}" style="--landmark-backdrop:url('assets/generated/${backdrop}.webp')">
    <div class="landmark-layout">
      <div class="landmark-stage" aria-hidden="true">
        <div id="map-actor" class="landmark-visitor" style="${mapArtworkStyle(catalogue.artworkLayout[id])}">${mon(id, 'body-art')}</div>
        <div class="landmark-prop landmark-prop-${run.phase}">${art(prop)}</div>
      </div>
      ${encounterDock()}
    </div>
  </div>`;
}

function captureSceneView() {
  const attempt = run.pendingCapture;
  const animating = captureAnimating();
  const captured = attempt.caught && !animating;
  const rarity = captured ? specialCaptureRarity(attempt) : null;
  const id = visualHeroId();
  return `<div id="landmark-scene" class="landmark-scene capture-scene${rarity ? ' roll-special' : ''}" ${rarity ? `data-reveal-rarity="${rarity}"` : ''} style="--landmark-backdrop:url('assets/generated/${E.region(run).arena}.webp')">
    <div class="landmark-layout">
      <div class="landmark-stage" aria-hidden="true">
        <div id="map-actor" class="landmark-visitor" style="${mapArtworkStyle(catalogue.artworkLayout[id])}">${mon(id, 'body-art')}</div>
        <div class="capture-spot">
          <div class="capture-wild" ${captured ? 'hidden' : ''}>${mon(attempt.id)}</div>
          <div class="capture-ball-position" ${!captured && !animating ? 'hidden' : ''}>
            <div class="capture-portrait">${art('capture-ball')}</div>
          </div>
        </div>
      </div>
      ${encounterDock()}
    </div>
  </div>`;
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
function bonusChoices(action = "bonus", offers = run.offers) {
  return offers
    .map((id) => {
      const b = E.BONUSES.find((b) => b.id === id);
      const empowered = run.phase === "shrine" && run.shrineEmpowered;
      const eligible = !empowered || E.canEmpowerBonus(run, id);
      const rank = Math.min(b.max, E.count(run, id) + (empowered ? 2 : 1));
      const preview = E.previewBonus(run,id);
      let description = empowered ? eligible ? `Gain two ranks. Each rank: ${b.text}` : "This boon cannot gain two ranks. Cancel the offering to take one rank." : b.text;
      if (preview && id === "hp_boost") description = `${empowered ? "Gain two ranks. " : ""}Maximum HP +${preview.maxHpChange} to ${preview.maxHp}. HP after choice: ${preview.hp}/${preview.maxHp}.`;
      else if (preview && id === "pp_boost") description = `Restore ${preview.hpChange} HP and ${preview.ppRestored} PP.`;
      else if (preview && empowered) description += ` HP after choice: ${preview.hp}/${preview.maxHp}.`;
      if (preview?.awakens.length) description += ` Awakens ${preview.awakens.map(key=>SYNERGIES.find(recipe=>recipe.id===key).name).join(", ")}!`;
      return choice(b.asset, b.name + (b.max > 1 ? ` · ${b.id === "pp_boost" ? "use " : ""}${rank}/${b.max}` : ""),
        description, action, id, !preview);
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
function purchaseDescription(key, preview) {
  const item = E.SHOP_ITEMS[key];
  if (!preview) {
    if (item.bonus) {
      const boon = E.BONUSES.find(boon=>boon.id===item.bonus);
      if (E.count(run,item.bonus) >= boon.max) return `Maximum ${boon.name} rank reached.`;
    }
    if (key === "potion" && run.hero.hp === run.hero.maxHp) return "HP are already full.";
    if (key === "full_heal" && !E.needsRecovery(run)) return "HP and PP are already full.";
    if (run.coins < item.cost) return `Need ${item.cost-run.coins} more gold.`;
    return "Unavailable here.";
  }
  let text;
  if (item.bonus) {
    const boon = E.BONUSES.find(boon=>boon.id===item.bonus);
    text = `${boon.name} ${preview.rank}/${boon.max}. ${boon.text}`;
  } else text = `Restore ${preview.hpChange} HP${key === "full_heal" ? ` and ${preview.ppRestored} PP` : ""}.`;
  if (preview.awakens.length) text += ` Awakens ${preview.awakens.map(id=>SYNERGIES.find(recipe=>recipe.id===id).name).join(", ")}!`;
  return `${text} ${preview.gold} gold left.`;
}
function encounterDock() {
  if (run.pendingGrowth || run.pendingAwakenings?.length) return "";
  if(run.phase==='capture'&&run.pendingCapture){
    const attempt = run.pendingCapture;
    const name = esc(catalogue.pokemon[attempt.id].name);
    const animating = captureAnimating();
    const rarity = animating ? null : specialCaptureRarity(attempt);
    const title = animating ? 'Capture in progress' : !attempt.attempted ? 'A defeated Pokémon can be captured' : attempt.caught ? 'Capture successful' : 'The Pokémon escaped';
    const resultText = attempt.caught
      ? 'This partner is secured. After returning to camp, it can be selected for another expedition.'
      : 'The capture failed. Your victory rewards are still yours.';
    const actions = animating
      ? '<p data-capture-reading role="status">Throwing the Pokéball…</p>'
      : attempt.attempted
        ? `<p>${resultText}</p>${button('Continue the journey','capture-continue','','paper-panel')}`
        : `<p>One attempt. Capture chance: ${Math.round(attempt.chance*100)}%.</p>${choice('capture-ball','Attempt capture','Successful captures unlock this Pokémon as a future starting partner.','capture-attempt','')}${button('Leave without capturing','capture-skip','','dock-builds')}`;
    return `<section class="encounter-dock paper-panel capture-dock"><h2>${title}</h2><div class="capture-name"><strong>${name}</strong>${rarity ? rarityBadge(rarity) : ''}</div><div class="capture-actions">${actions}</div></section>`;
  }
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
        "Train",
        trainingDescription(),
        "encounter",
        "train",
        run.hero.level >= 100,
      ) +
      choice(
        "critical-lens",
        "Scout ahead",
        run.routeMode === "branching" ? "Prepare your next battle: opening hit +25%. Skip rest and training." : "Reveal the next foe and its ability. Opening hit +25%. Skip rest and training.",
        "encounter",
        "scout",
      );
  }
  if (run.phase === "cache") {
    title = "The supply chest";
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
        .map(([key, s]) => {
          const preview = E.previewPurchase(run,key);
          return choice(
            s.asset,
            s.name + " · " + s.cost + " gold",
            purchaseDescription(key,preview),
            "buy",
            key,
            !preview,
          );
        })
        .join("") + button("Continue the journey", "leave", "", "dock-leave");
  }
  const note = run.log.at(-1) !== E.stage(run).name + "." ? run.log.at(-1) : "";
  return title
    ? `<section class="encounter-dock paper-panel"><h2>${title}</h2><div class="dock-choices">${content}</div>${run.phase === "shrine" ? offeringControl() : ""}${["reward", "shrine"].includes(run.phase) ? `<div class="reward-tools">${button("View build combinations", "builds", "", "dock-builds")}${rerollControl()}</div>` : ""}${note ? `<p class="dock-note">${esc(note)}</p>` : ""}</section>`
    : "";
}
let starterBoonCategory = 'all';
const boonCategories = {all:'All boons',offense:'Offense',defense:'Defense',expedition:'Expedition'};

function starterBoonChoices() {
  const offers = starterBoonCategory === 'all' ? run.offers : run.offers.filter(id =>
    E.BONUSES.find(boon => boon.id === id)?.category === starterBoonCategory);
  return bonusChoices('bonus', offers);
}

function starterBonusView() {
  const options = Object.entries(boonCategories).map(([value,label]) =>
    `<option value="${value}"${starterBoonCategory === value ? ' selected' : ''}>${label}</option>`
  ).join('');
  return `<div class="starter-bonus-scene"><section class="initial-bonus-dock paper-panel" aria-labelledby="starter-boon-title"><h2 id="starter-boon-title">Choose your first boon</h2><div class="starter-boon-toolbar"><span><b>${run.offers.length}</b> <span>boons available</span></span><select data-starter-boon-category aria-label="Boon category">${options}</select></div><div class="dock-choices">${starterBoonChoices()}</div><div class="reward-tools">${button("View build combinations", "builds", "", "dock-builds")}${button("Expedition plan", "plans", "", "dock-builds")}</div></section></div>`;
}
function legacySummary(){
 const reward=run.legacyReward;if(!reward)return '';
 return `<section class="legacy-summary"><strong>Legacy marks +${reward.marks}</strong><p>Best depth ${meta.bestDepth}. Your permanent progress is ready for the next adventure.</p><div class="secured-equipment">${reward.equipment.map(drop=>{const item=EQUIPMENT.find(i=>i.id===drop.id);return `<span>${art(item.asset)}${item.name} · Tier ${drop.tier}</span>`;}).join('')||'<span>No new equipment secured.</span>'}</div><p>Captured partners: ${Object.keys(run.captures||{}).map(id=>catalogue.pokemon[id].name).join(', ')||'None this expedition.'}</p>${button('Prepare the next adventure','legacy','','paper-panel')}</section>`;
}
function endingView() {
  const won = run.phase === "complete";
  return `<div class="ending-scene"><div class="ending-shade"></div>${mon(run.hero.id, "ending-partner")}<section class="ending-content"><small>${won ? "THE GUARDIANS YIELD" : "EVERY JOURNEY LEAVES A MARK"}</small><h1>${won ? "Expedition complete" : "The journey ends"}</h1><p>${won ? "Your partner crossed the trail and defeated its final guardian." : run.phase === "retired" ? "Your partner returns to camp with everything discovered along the way." : "Your partner gave everything. A new journey awaits."}</p><div class="ending-stats"><span><b>${run.wins}</b>victories</span><span><b>${run.stageIndex + 1}${run.endless?"":" / "+E.STAGES.length}</b>stages</span><span><b>${run.coins.toLocaleString("en-US")}</b>gold retained</span></div>${won ? `<p>${run.threat ? `Threat ${run.threat} cleared. ` : ""}${(run.threat || 0) < E.MAX_THREAT ? `Threat ${Math.min(E.MAX_THREAT, (run.threat || 0)+1)} is available.` : "The highest threat has been conquered."}</p>${button("Choose your next challenge", "threats", "", "paper-panel challenge-next")}` : ""}${run.endless?legacySummary():""}<div class="ending-actions">${button("Return to camp", "finish", "", "paper-panel main-button")}${button("New expedition", "retry", "", "paper-panel")}</div></section></div>`;
}
function render() {
  effects.clear();
  routeCamera.detach();
  menuReturnFocus = null;
  if (fatal) {
    app.innerHTML = `<div class="game-screen recovery-screen">${recoveryView()}</div>`;
    localizer.refresh();
    const dialog = q(".fatal-panel");
    dialog.showModal();
    dialog.addEventListener("cancel",event=>event.preventDefault());
    dialog.querySelector("button")?.focus();
    return;
  }
  const mode = titleMode
    ? "title"
    : run.introPending || run.introChoicePending ? "roll" : run.phase === "starter"
      ? "starter"
      : TERMINAL.has(run.phase)
        ? "ending"
        : run.enemy && ["battle", "victoryBeat"].includes(run.phase)
          ? "battle"
          : run.phase === 'capture' ? 'capture' : Object.hasOwn(encounterScenes, run.phase) ? "landmark" : "map";
  app.innerHTML = `<div class="game-screen mode-${mode} ${paused ? "paused" : ""}" data-phase="${run?.phase || "title"}">${mode === "title" ? titleView() : mode === "ending" ? endingView() : `${hud()}${mode === "roll"?starterRollView():mode === "starter" ? starterBonusView() : mode === "battle" ? battleView() : mode === 'capture' ? captureSceneView() : mode === "landmark" ? landmarkSceneView(!q('#landmark-scene')) : mapView()}`}${saveNoticeView()}<div id="menu-host"></div></div>`;
  if (!titleMode && run) {
    const heading = q(".stage-heading small");
    if (heading) heading.textContent = run.endless?`ENDLESS · DEPTH ${run.stageIndex+1}`:`${run.threat ? `THREAT ${run.threat}` : E.region(run).name.toUpperCase()} · ${String(run.stageIndex + 1).padStart(2, "0")} / ${E.STAGES.length}`;
    if (run.scouting) {
      const caption = q(".travel-caption");
      if (caption) {
        const report = document.createElement("span");
        report.className = "scouting-report";
        const ability = guardianAbility(run, run.scouting.speciesId, run.scouting.stageIndex);
        report.textContent = `Scouted: ${catalogue.pokemon[run.scouting.speciesId].name}${ability ? ` · ${ability.name}` : ""} · Opening strike +25%`;
        caption.append(report);
      }
    }
  }
  if (mode === 'roll' && run.introChoicePending) showStarterResult(q('#partner-roll'));
  if (modal) renderMenu();
  localizer.refresh();
  const viewport=q('.route-viewport');
  if(viewport){const graph=expeditionGraph(run,E.STAGES),choice=E.routeChoices(run)[0],node=graph.byId.get(choice?.id||run.branchPath.at(-1))||graph.rows[run.stageIndex][0];routeCamera.mount(viewport,{id:run.id,stage:run.stageIndex,targetY:node.y,height:graph.height});}

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
  const [x, y] = L.mapPosition(run, world.route);
  actor.style.left = x * 100 + "%";
  actor.style.top = y * 100 + "%";
  actor.style.zIndex = Math.round(y * 1000);
  actor.style.setProperty("--map-facing", L.mapFacing(run, world));
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
function opponentView() {
  if (!run?.enemy || !["battle","victoryBeat"].includes(run.phase)) return "<h2>No opponent</h2>";
  const enemy = run.enemy, species = catalogue.pokemon[enemy.id], ability = guardianAbility(run);
  return `<h2>${esc(species.name)}</h2><div class="partner-profile">${mon(enemy.id)}<div><strong>Guardian · Level ${enemy.level}</strong><p>${enemy.hp} / ${enemy.maxHp} HP</p>${health(enemy)}<p>${species.types.map(t => NAME_TYPES[t] || t).join(" / ")}</p></div></div>${ability ? `<h3>${ability.name}${ability.hidden ? " · Hidden ability" : ""}</h3><p>${ability.text}</p><p class="guardian-state"><strong>${guardianState(run)}</strong></p><h3>Prepare your build</h3><p>${ability.tactic}</p>` : ""}<h3>Automatic moves</h3><div class="partner-moves">${enemy.moves.map(slot => { const move = catalogue.moves[slot.id] || E.STRUGGLE; return `<section class="partner-move"><div><strong>${esc(move.name)}</strong><small>${NAME_TYPES[move.type] || move.type} · ${move.damageClass} · Power ${move.power}</small></div><span>${slot.pp} / ${slot.maxPp} PP</span></section>`; }).join("")}</div><p>Battle is paused while you inspect this guardian.</p>`;
}
function guardiansView() {
  return `<h2>Know the guardians</h2><p>These native abilities are active only on guardians in new expeditions. Wild Pokémon and elites keep their usual battle rules.</p>${GUARDIANS.map(ability => `<section class="guardian-guide-entry"><div class="partner-profile">${mon(ability.species)}<div><h3>${catalogue.pokemon[ability.species].name}</h3><strong>${ability.name}${ability.hidden ? " · Hidden ability" : ""}</strong><p>${ability.text}</p></div></div><p>${ability.tactic}</p></section>`).join("")}<p>Inspect a guardian during battle by selecting its underlined ability. Scouting at a spring reveals which guardian awaits and strengthens your opening strike.</p>`;
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
function mobileSpeedControl(){return `<div class="mobile-speed-controls"><strong>Battle speed</strong><div>${[['Slow',2000],['Normal',1500],['Fast',750]].map(([label,value])=>button(label,'speed',value,speed===value?'selected':'')).join('')}</div></div>`;}
function languageControl() {
  return `<div class="language-picker paper-panel" role="group" aria-label="Language"><span>Language</span>${['en','fr'].map(language=>`<button data-action="language" data-value="${language}" aria-pressed="${meta.language===language}" class="${meta.language===language?'selected':''}" aria-label="${language==='fr'?'Français':'English'}">${language.toUpperCase()}</button>`).join('')}</div>`;
}
function legacyView(){
 const active=run&&!TERMINAL.has(run.phase);
 return `<h2>Legacy camp</h2><p><strong>${meta.gold} gold · ${meta.legacyMarks} legacy marks · Best depth ${meta.bestDepth}</strong></p><p>Defeat ends the expedition, but earned gold, captured partners and salvaged equipment return with you. Spend marks to learn skills. Equip one skill and one item before your next adventure.</p>${active?'<p>Return to camp before changing your legacy loadout.</p>':''}<div class="pause-actions">${button('Permanent upgrades','upgrades','','paper-panel')}${button('Trail challenge','threats','','paper-panel')}${button('Partner collection','partners','','paper-panel')}</div><h3>Learned skills</h3><div class="legacy-options">${SKILLS.map(skill=>{const owned=meta.learnedSkills.includes(skill.id),selected=meta.equippedSkill===skill.id;return choice(skill.asset,`${skill.name} · ${selected?'Equipped':owned?'Learned':`${skill.cost} marks`}`,skill.text,owned?'equip-skill':'unlock-skill',selected?'':skill.id,active||!owned&&meta.legacyMarks<skill.cost);}).join('')}</div><h3>Equipment</h3><p>Elites and guardians drop equipment. It is secured after defeat or returning to camp. Select an owned item to equip it; select it again to remove it.</p><div class="legacy-options">${EQUIPMENT.filter(item=>meta.equipment[item.id]).map(item=>choice(item.asset,`${item.name} · Tier ${meta.equipment[item.id]}${meta.equippedGear===item.id?' · Equipped':''}`,item.text,'equip-gear',meta.equippedGear===item.id?'':item.id,active)).join('')||'<p>No equipment yet. Defeat an elite or guardian to find your first item.</p>'}</div>`;
}
let partnerRarityFilter = 'all';
let partnerSearch = '';
const normalizePartnerName = name => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

function capturedPartnersView() {
  const active = run && !TERMINAL.has(run.phase);
  const owned = Object.keys(meta.captured).map(id => catalogue.pokemon[id]).filter(Boolean);
  if (!owned.length) return '<p>No captured partners yet. Find a Pokéball encounter and win the battle to try your first capture.</p>';
  const query = normalizePartnerName(partnerSearch);
  const visible = owned.filter(species => {
    if (partnerRarityFilter !== 'all' && rarityOf(species) !== partnerRarityFilter) return false;
    return !query || [species.name, frenchName(species.name)].some(name => normalizePartnerName(name).includes(query));
  });
  if (!visible.length) return query ? '<p>No captured Pokémon matches your search.</p>' : '<p>No captured Pokémon of this rarity.</p>';
  return visible.map(species => {
    const {id, name, types} = species;
    const selected = meta.startingPartner === id ? ' · Selected' : '';
    const label = `${mon(id, '', 'lazy')}<span><strong>${esc(name)}${selected}</strong>${rarityBadge(rarityOf(species))}<small>${types.map(type => NAME_TYPES[type]).join(' / ')} · Captured ${meta.captured[id]}</small></span>`;
    return button(label, 'partner-choice', id, 'captured-partner', active);
  }).join('');
}

function partnersView() {
  const active = run && !TERMINAL.has(run.phase);
  const options = Object.entries({all: 'All rarities', ...rarityLabels}).map(([value, label]) =>
    `<option value="${value}"${value === partnerRarityFilter ? ' selected' : ''}>${label}</option>`
  ).join('');
  return `<h2>Partner collection</h2><p>${active ? 'You can change your starting partner when you return to camp.' : 'Choose a captured Pokémon for your next expedition.'}</p>
    <div class="partner-collection-controls">${button(`Random partner${!meta.startingPartner ? ' · Selected' : ''}`, 'partner-choice', '', 'paper-panel', active)}
    <div class="partner-filters">
      <label><span>Pokémon name</span><input type="search" data-partner-search aria-controls="captured-partners" value="${esc(partnerSearch)}" autocomplete="off" spellcheck="false"></label>
      <label><span>Filter by rarity</span><select data-partner-rarity aria-controls="captured-partners">${options}</select></label>
    </div></div>
    <div id="captured-partners" class="captured-partners">${capturedPartnersView()}</div>`;
}
function plansView() {
  return `<h2>Expedition plan</h2><p>Choose a strategy for this expedition. An active plan selects routes, boons, supplies, spring actions and capture attempts, and may spend expedition gold at the merchant. Reforges and Eevee’s evolution remain your decisions.</p><div class="plan-options">${PLANS.map(plan=>choice(plan.asset, plan.name + ((run.plan || "manual") === plan.id ? " · Selected" : ""), plan.text, "set-plan", plan.id)).join("")}</div><p>Plans run while this game is visible. Pause or switch to Manual at any time.</p>${button(`Away progression: ${run.idleEnabled ? "On" : "Off"}`, "idle-toggle", "", "paper-panel", !run.plan || run.plan === "manual")}<p>When enabled, your plan can progress after this window is hidden or closed, for up to eight hours. Pause stops away progression. Eevee waits for your evolution choice. Each expedition ends at victory or defeat; another expedition requires your choice.</p>`;
}
function idleSummaryView() {
  const report = idleReport;
  return `<h2>While you were away</h2><p>Your ${PLANS.find(p=>p.id===run.plan).name} plan guided this expedition${run.threat ? ` at Threat ${run.threat}` : ""}.</p><div class="idle-results"><p><strong>Stages</strong> ${report.fromStage} to ${report.toStage}</p><p><strong>Victories</strong> ${report.wins}</p><p><strong>Gold change</strong> ${report.goldChange >= 0 ? "+" : ""}${report.goldChange}</p><p><strong>Levels gained</strong> ${report.levels}</p><p><strong>Battle actions</strong> ${report.actions}</p></div><p>${report.waitingForEvolution ? "Eevee is waiting for your evolution choice." : TERMINAL.has(run.phase) ? "This expedition has ended. Its rewards have been retained once." : "Your partner is ready to continue."}</p><p>Gold change includes merchant purchases and any ending reward.</p>${button("Continue", "close", "", "paper-panel main-button")}`;
}
function threatView() {
  const active = run && !TERMINAL.has(run.phase);
  return `<h2>Trail challenge</h2><p>Defeat a chapter’s legendary guardian to unlock the next starting threat when you return to camp, up to Threat ${E.MAX_THREAT}. Choose stronger enemies for richer rewards.</p>${active ? "<p>Finish or end your current expedition before changing its challenge.</p>" : ""}<div class="threat-options">${Array.from({length:E.MAX_THREAT+1},(_,tier)=>{
    const locked = tier > meta.unlockedThreat;
    const title = (tier ? `Threat ${tier}` : "Normal trail") + (meta.selectedThreat === tier ? " - Selected" : "");
    const description = locked ? `Locked. Clear ${tier === 1 ? "the normal trail" : `Threat ${tier-1}`} first.` : tier ? `Enemy HP +${tier*20}%. Enemy damage +${tier*12}%. Battle and ending gold +${tier*20}%.` : "The original trail. Standard enemy strength and gold rewards.";
    return choice(tier ? "guardian-crest" : "trail-sign", title, description, "choose-threat", tier, locked || active);
  }).join("")}</div><p>Your selected challenge is saved for new expeditions. An expedition keeps its starting threat, including away progression.</p>`;
}
function menuContent() {
  if (modal === 'reset-save') {
    return `<h2>Start over from scratch?</h2><p>Your current expedition, captured Pokémon, upgrades and settings will be permanently erased.</p><p class="reset-save-error" role="alert" hidden>The save could not be erased.</p><div class="pause-actions">${button('Cancel','close','','paper-panel main-button')}${button('Erase all progress','confirm-reset-save','','paper-panel reset-save-button')}</div>`;
  }
  if(modal==='legacy')return legacyView();
  if(modal==='partners')return partnersView();
  if (modal === "threats") return threatView();
  if (modal === "idle-summary" && idleReport) return idleSummaryView();
  if (modal === "plans" && run) return plansView();
  if (modal === "builds") return buildCombinationsView();
  if (modal === "guide") return fieldGuideView();
  if (modal === "partner" && run) return partnerView();
  if (modal === "opponent" && run?.enemy) return opponentView();
  if (modal === "guardians") return guardiansView();
  if (modal === "save-notice") return `<h2>Save notice</h2><p data-save-message>${esc(saveMessage() || "Saving is working.")}</p><p data-save-advice>${saveAdvice()}</p><div class="pause-actions">${button("Try saving","retry-save","","paper-panel")}<button class="paper-panel" data-action="dismiss-save-notice" ${saveAvailable && warning ? "" : "hidden"}>Dismiss notice</button></div>`;
  if (modal === "pause")
    return `<h2>Pause</h2><p>Battle and travel are paused.</p>${audioControl()}<div class="pause-actions">${button("Resume", "close", "", "paper-panel main-button")}${button("Expedition plan", "plans", "", "paper-panel")}${button("Partner & moves", "partner", "", "paper-panel")}${button("Expedition boons", "journal", "", "paper-panel")}${button("Know the guardians", "guardians", "", "paper-panel")}${button("Field guide", "guide", "", "paper-panel")}${button("How to play", "help", "", "paper-panel")}${button("Return to camp", "retire", "", "paper-panel", TERMINAL.has(run.phase))}</div>`;
  if (modal === "retire" || modal === "replace")
    return `<h2>Return to camp?</h2><p>This expedition will end. Your gold and victories will be retained.</p><div class="pause-actions">${button("Continue the journey", "close", "", "paper-panel main-button")}${button("End expedition", "confirm-retire")}</div>`;
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
  return `<h2>The wayfarer handbook</h2><div class="help-copy"><h3>An endless roguelite</h3><p>Begin with a random partner. Choose connected encounters on a procedural map. New chapters unfold as you advance; there is no final stage. Enemies grow stronger with depth, so defeat is part of your progression.</p><h3>Capture your next partner</h3><p>Pokéball encounters hide the Pokémon you will face. Win the battle to receive one capture attempt with a displayed success chance. Captured partners are secured when the expedition ends. At camp, choose an owned partner for the next adventure or keep random starts.</p><h3>Return stronger</h3><p>Run boons and levels reset after defeat. Earned gold buys permanent stat upgrades. Legacy marks unlock passive skills. Elites and guardians drop equipment that survives defeat. Equip one learned skill and one item before starting; the current expedition keeps its starting loadout.</p><h3>Automatic battles, deliberate builds</h3><p>Your partner automatically selects its strongest available move against the opponent, accounting for power, types and remaining PP. Prepare your build between battles and watch your choices play out.</p><p>Combine boon ranks to awaken relics. Springs offer recovery, training or a prepared opening strike. Shrines can exchange vitality for two boon ranks. PP are finite; Struggle prevents an unusable move set from blocking battle. Battles end after at most 80 actions.</p><h3>Optional expedition plans</h3><p>Plans can choose routes, boons, recovery, purchases and capture attempts. Away progression is optional and capped at eight hours. Eevee waits for your evolution choice. Defeat stops the expedition; only you can start another.</p><h3>Explore the map</h3><p>Drag to move the map. Use the mouse wheel or zoom buttons to zoom. Focus the map and use arrow keys to pan, plus or minus to zoom, and Home to recenter. Escape pauses the game. Your progress saves on this device.</p></div>`;
}
function updateMenuScroll() {
  const content = q("dialog .menu-content"), note = q(".menu-scroll-note");
  if (!content || !note) return;
  note.hidden = content.scrollHeight <= content.clientHeight + 2;
  note.textContent = content.scrollTop + content.clientHeight >= content.scrollHeight - 2
    ? "Scroll up to review" : "Scroll to read more";
}
window.addEventListener("resize", updateMenuScroll);
function renderMenu() {
  const host = q("#menu-host");
  if (!host) return;
  const resetButton = ['pause', 'legacy'].includes(modal)
    ? button('Start over from scratch', 'reset-save', '', 'paper-panel reset-save-button')
    : '';
  host.innerHTML = modal
    ? `<dialog aria-labelledby="menu-heading"><div class="menu-top"><span class="menu-scroll-note" hidden></span>${button("Close", "close", "", "menu-close paper-panel")}</div><div class="menu-content">${menuContent()}${modal === "help" ? audioControl() : ""}${modal==='pause'?button('Legacy camp','legacy','','paper-panel')+mobileSpeedControl():''}${['help','pause'].includes(modal)?languageControl():''}${resetButton}</div></dialog>`
    : "";
  if (modal) {
    const d = host.querySelector("dialog");
    d.querySelector("h2").id = "menu-heading";
    d.showModal();
    localizer.refresh();
    updateMenuScroll();
    d.querySelector(".menu-content").addEventListener("scroll", updateMenuScroll, { passive:true });
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
  wakeWork();
  pump();
}
let pendingStarter = null;
let idleReport = null;
function begin(id, mode, seed = Date.now()) {
  invalidateWork();
  effects.clear();
  audio.stop();
  audio.setPaused(false);
  run = E.createRun(id, meta, catalogue, seed);
  starterBoonCategory = 'all';
  E.enableBranching(run);
  E.enableEndless(run,meta);
  run.introPending = true;
  run.introMode = mode;
  run.starterId = id;
  titleMode = false;
  modal = null;
  paused = false;
  fatal = "";
  narration = "";
  persist();
  render();
  pump();
}
function live(token) {
  return token === epoch && run && !titleMode && !fatal;
}
function wakeWork() {
  const waiters = [...workWaiters];
  workWaiters.clear();
  for (const resolve of waiters) resolve();
}
function invalidateWork() {
  // Replacing an expedition also releases work suspended by pause or visibility.
  epoch++;
  wakeWork();
}
async function waitForActivity(token) {
  while (live(token) && (paused || document.hidden))
    await new Promise(resolve => workWaiters.add(resolve));
  return live(token);
}
async function wait(ms, token, owner) {
  // Interface changes can replace a scene while the same expedition continues.
  const current = () => live(token) && (owner === undefined || owner?.isConnected);
  let previous = performance.now(),
    elapsed = 0;
  while (elapsed < ms && current()) {
    if (paused || document.hidden) {
      if (!await waitForActivity(token)) break;
      if (!current()) break;
      previous = performance.now();
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(40, ms - elapsed)),
    );
    const now = performance.now();
    if (!paused && !document.hidden) elapsed += Math.min(100, now - previous);
    previous = now;
  }
  return current();
}
async function travel(token) {
  let previous = performance.now();
  while (live(token) && run.phase === "travel" && run.travelProgress < 1) {
    if (paused || document.hidden) {
      if (!await waitForActivity(token)) break;
      previous = performance.now();
    }
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
async function playLandmarkMotion(token) {
  const marker = run.landmark;
  let previous = performance.now();
  while (live(token) && run.landmark === marker && L.landmarkMoving(run) && marker.progress < 1) {
    if (paused || document.hidden) {
      if (!await waitForActivity(token)) break;
      previous = performance.now();
    }
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const now = performance.now();
    if (!paused && !document.hidden) {
      marker.progress = Math.min(1, marker.progress + Math.min(100, now-previous)/(marker.duration*speed/1500));
      updateTravel();
      if (now-saveAt > 500) { persist(); saveAt=now; }
    }
    previous=now;
  }
  if (!live(token)) return false;
  L.finishMotion(run);
  persist();
  render();
  return true;
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
    const reading = q(".battle-narration"), previousReading = narration || run.log.at(-1);
    if (reading) reading.replaceChildren(label);
    else node.closest("#battle-scene,#map-scene,#landmark-scene").append(label);
    q(".victory-banner")?.remove();
    const completed = await effects.evolve(node, catalogue.pokemon[growth.toId].artwork,
      name, (ms) => wait(ms, token, node), () => {node.dataset.species=String(growth.toId);applyMapArtwork(node.closest("#map-actor"), catalogue.artworkLayout[growth.toId]);});
    if (!completed || !live(token)) return false;
    label.textContent = `${name} joins your journey!`;
    if (!await wait(650, token, label)) return false;
    label.remove();
    if (reading?.isConnected) reading.textContent = previousReading;
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
    if (!await wait(duration, token, entry)) return false;
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
  const scene = q("#map-scene,#battle-scene,#landmark-scene");
  if (scene && recipe) {
    const toast = document.createElement("section");
    toast.className = "vfx awakening-toast";
    toast.innerHTML = `${art(recipe.asset)}<div class="awakening-reading"><small>BUILD AWAKENED</small><strong>${recipe.name}</strong></div>`;
    scene.append(toast);
    audio.play("evolve");
    effects.animate(toast, [
      { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, offset: 0.2 },
      { opacity: 1, offset: 0.8 }, { opacity: 0, scale: 1.05 },
    ], { duration: effects.reduced ? 1 : 1700, easing: "linear" });
    if (!await wait(effects.reduced ? 500 : 1700, token, toast)) return false;
    toast.remove();
  }
  if (!live(token)) return false;
  run.pendingAwakenings = run.pendingAwakenings.filter((pending) => pending !== id);
  persist();
  return true;
}
async function scrollStarterRoll(strip, windowNode, token, scene) {
  const card = strip.querySelector('.roll-item');
  const offset = index => windowNode.clientWidth / 2 - card.offsetWidth * (index + 0.5);
  const start = offset(effects.reduced ? rollWinnerIndex - 2 : 0);
  const end = offset(rollWinnerIndex);
  const duration = effects.reduced ? 1150 : 3400;
  const place = x => { strip.style.transform = `translate3d(${x}px,0,0)`; };
  place(start);

  // Decode the reel before it moves, with a deadline for slow or missing assets.
  let deadline;
  await Promise.race([
    Promise.allSettled([...strip.querySelectorAll('img')].map(image => image.decode())),
    new Promise(resolve => { deadline = setTimeout(resolve, 900); }),
  ]);
  clearTimeout(deadline);

  let elapsed = 0;
  let previous;
  while (live(token) && scene.isConnected && elapsed < duration) {
    if (paused || document.hidden) {
      if (!await waitForActivity(token) || !scene.isConnected) return false;
      previous = undefined;
    }
    const now = await new Promise(resolve => requestAnimationFrame(resolve));
    if (!live(token) || !scene.isConnected) return false;
    if (paused || document.hidden) continue;
    // A stalled frame must not advance the reel through portraits the player never saw.
    if (previous !== undefined) elapsed += Math.min(34, now - previous);
    previous = now;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - (1 - progress) ** 2.5;
    place(start + (end - start) * eased);
  }
  if (!live(token) || !scene.isConnected) return false;
  place(offset(rollWinnerIndex));
  return true;
}

function showStarterResult(scene) {
  const strip = scene.querySelector('.roll-strip');
  const reel = scene.querySelector('.roll-window');
  const winner = strip.querySelector(`[data-roll-index="${rollWinnerIndex}"]`);
  strip.style.transform = `translate3d(${reel.clientWidth / 2 - winner.offsetWidth * (rollWinnerIndex + .5)}px,0,0)`;
  const species = catalogue.pokemon[run.hero.id];
  const rarity = rarityOf(species);
  const special = rarity === 'legendary' || rarity === 'mythical';
  scene.dataset.revealRarity = rarity;
  scene.classList.toggle('roll-special', special);
  scene.querySelector('[data-roll-result]').textContent = species.name;
  scene.querySelector('[data-roll-rarity]').textContent = rarityLabels[rarity];
  winner.classList.add('roll-winner');
  scene.querySelector('[data-roll-choices]').hidden = false;
  return special;
}

async function playStarterRoll(token) {
  const scene = q('#partner-roll');
  if (!scene) return false;
  const strip = scene.querySelector('.roll-strip');
  if (strip) {
    if (!await scrollStarterRoll(strip, scene.querySelector('.roll-window'), token, scene)) return false;
    run.introChoicePending = true;
    audio.play(showStarterResult(scene) ? 'evolve' : 'reward');
  } else if (!await wait(800, token, scene)) return false;
  if (!live(token)) return false;
  run.introPending = false;
  persist();
  return true;
}

async function playCaptureReveal(token) {
  const scene = q('.capture-scene');
  const ball = scene?.querySelector('.capture-ball-position');
  const wild = scene?.querySelector('.capture-wild');
  const reading = scene?.querySelector('[data-capture-reading]');
  if (!ball || !wild || !reading) throw new Error('The capture scene is unavailable.');
  const reduced = effects.reduced;
  const distance = reduced ? 24 : scene.querySelector('.landmark-stage').clientWidth * .48;
  const rise = reduced ? 10 : Math.min(105, scene.querySelector('.landmark-stage').clientHeight * .37);
  const animate = (node, frames, normal, short, easing = 'ease-in-out') => {
    effects.animate(node, frames, {duration:normal,reducedDuration:short,easing,fill:'forwards'});
    return wait(reduced ? short : normal, token, scene);
  };

  audio.play('select');
  if (!await animate(ball, [
    {transform:`translate(${-distance}px,-10px) rotate(-28deg)`},
    {transform:`translate(${-distance * .46}px,${-rise}px) rotate(120deg)`,offset:.52},
    {transform:'translate(0,-24px) rotate(290deg)',offset:.84},
    {transform:'translate(0,0) rotate(360deg)'},
  ], 650, 300, 'linear')) return false;

  if (!await animate(wild, [
    {opacity:1,transform:'translateY(0) scale(1)'},
    {opacity:0,transform:'translateY(10%) scale(.12)'},
  ], 320, 180, 'ease-in')) return false;
  wild.hidden = true;
  reading.textContent = 'The Pokéball is shaking…';

  const angle = reduced ? 5 : 17;
  for (let shake = 0; shake < 3; shake++) {
    if (!await wait(reduced ? 70 : 140, token, scene)) return false;
    audio.play('select');
    if (!await animate(ball, [
      {transform:'rotate(0deg)'}, {transform:`rotate(${angle}deg)`},
      {transform:`rotate(${-angle}deg)`}, {transform:'rotate(0deg)'},
    ], 290, 150)) return false;
  }

  const result = captureReveal;
  if (!result.caught) {
    reading.textContent = 'The Pokémon broke free!';
    wild.hidden = false;
    const escape = animate(wild, [
      {opacity:0,transform:'translateY(10%) scale(.12)'},
      {opacity:1,transform:'translateY(0) scale(1)'},
    ], 390, 230, 'ease-out');
    effects.animate(ball, [
      {opacity:1,transform:'translateX(0) rotate(0deg)'},
      {opacity:0,transform:`translateX(${reduced ? 8 : 38}px) rotate(35deg)`},
    ], {duration:300,reducedDuration:180,fill:'forwards'});
    if (!await escape) return false;
  } else {
    audio.play(specialCaptureRarity(result) ? 'evolve' : 'reward');
  }
  captureReveal = null;
  return true;
}

async function pump() {
  if (running || titleMode || !run || fatal) return;
  running = true;
  const token = epoch;
  let transitions = 0;
  try {
    let batchStage=run.stageIndex,batchActions=run.actions;
    while (live(token) && hasAutomaticWork()) {
      if (++transitions > 500) {if(run.endless&&(run.stageIndex>batchStage||run.actions>batchActions)){transitions=0;batchStage=run.stageIndex;batchActions=run.actions;}else throw new Error("The automatic sequence was stopped to prevent an unexpected loop.");}
      if (paused || document.hidden) {
        await wait(30, token);
        continue;
      }
      if(run.introPending){if(!await playStarterRoll(token))break;if(!run.introChoicePending)render();continue;}
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
      if (captureAnimating()) {
        if (!await playCaptureReveal(token)) break;
        render();
        continue;
      }
      if (L.prepareDeparture(run)) { persist(); render(); }
      if (L.landmarkMoving(run)) {
        if (!await playLandmarkMotion(token)) break;
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
        const showingSpecialCapture = decision.action === 'capture' && decision.value === 'continue' && specialCaptureRarity(run.pendingCapture);
        if (!await wait(showingSpecialCapture ? 1900 : 1100, token)) break;
        if (planDecision(run)?.action !== decision.action || planDecision(run)?.value !== decision.value) continue;
        if (!applyPlanDecision(run, decision, catalogue)) throw new Error("The expedition plan could not apply its choice.");
        if (decision.action === 'capture' && decision.value === 'attempt') captureReveal = run.pendingCapture;
        persist();
        render();
        continue;
      }
      if (run.phase === "travel") {
        await travel(token);
        continue;
      }
      if (run.phase === "arrival") {
        if (L.beginApproach(run, world)) { persist(); render(); continue; }
        E.activateStage(run, catalogue);
        narration = "";
        persist();
        render();
        continue;
      }
      if (run.phase === "battle") {
        const scene = q("#battle-scene");
        if (!scene?.querySelector(".actor-ally .body-art") || !scene.querySelector(".actor-enemy .body-art"))
          throw new Error("The battle scene is unavailable.");
        if (run.battleActions === 0 && !narration && !await wait(1500, token, scene)) break;
        const side = run.nextSide,
          move = E.bestMove(run, catalogue),
          actor = side === "ally" ? run.hero : run.enemy;
        narration =
          catalogue.pokemon[actor.id].name + " uses " + move.name + "!";
        audio.play("windup", move.type);
        updateBattle();
        const duration = Math.max(450, speed * 0.65);
        const completed = await effects.windup(side, move, (ms) => wait(ms, token, scene), duration);
        if (!completed || !live(token) || run.phase !== "battle") break;
        const result = E.battleStep(run, catalogue);
        narration = run.log.at(-1);
        persist();
        updateBattle();
        if (result) {
          effects.impact(result);
          if (result.kind === "hit") audio.play("hit", result.move.type, result.crit);
          if (["victoryBeat", "complete", "capture"].includes(run.phase)) audio.play("victory");
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
        if(run.phase==='capture'){if(run.pendingGrowth&&!await playGrowth(token))break;render();}
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
      interruptJourney(error);
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
  if (!keepSaveSession()) return;
  if (action === 'accept-starter-draw' || action === 'choose-captured-starter') {
    if (!run?.introChoicePending || titleMode || modal || paused) return;
    if (action === 'choose-captured-starter') {
      const id = Number(value);
      if (meta.captured[id] && catalogue.pokemon[id]) begin(id, 'chosen', run.initialSeed);
      return;
    }
    run.introChoicePending = false;
    persist();
    render();
    pump();
    return;
  }
  if (action === 'reset-save' && ((titleMode && !modal) || ['pause', 'legacy'].includes(modal))) {
    openMenu('reset-save');
    return;
  }
  if (action === 'confirm-reset-save' && modal === 'reset-save') {
    if (!resetSave(saveStorage, document, location.port)) {
      q('.reset-save-error').hidden = false;
      return;
    }
    // Prevent pagehide from writing the old expedition back during reload.
    saveSessionIsCurrent = () => false;
    invalidateWork();
    location.reload();
    return;
  }
  if (action === 'random-start' || action === 'chosen-start') {
    const mode = action === 'chosen-start' ? 'chosen' : 'random';
    const id = mode === 'chosen' ? E.selectedStartingPartner(meta, catalogue) : E.randomStartingPartner(Date.now(), catalogue);
    if (!id) return;
    if (run && !TERMINAL.has(run.phase)) {
      pendingStarter = {id, mode};
      openMenu('replace');
    } else {
      begin(id, mode);
    }
    return;
  }
  if(['unlock-skill','equip-skill','equip-gear','partner-choice'].includes(action)&&meta&&(!run||TERMINAL.has(run.phase))){
    let changed=false;
    if(action==='unlock-skill')changed=unlockSkill(meta,value);
    if(action==='equip-skill')changed=equipSkill(meta,value);
    if(action==='equip-gear')changed=equipGear(meta,value);
    if(action==='partner-choice'&&(!value||meta.captured[value]&&catalogue.pokemon[value])){meta.startingPartner=value?Number(value):null;changed=true;}
    if(changed){persist();render();}return;
  }
  if(action==='language'&&meta&&['en','fr'].includes(value)){
    meta.language=value;setLocale(value);persist();
    for(const node of app.querySelectorAll('[data-action="language"]')){node.classList.toggle('selected',node.dataset.value===value);node.setAttribute('aria-pressed',String(node.dataset.value===value));}
    localizer.refresh();updateMenuScroll();localizer.refresh();return;
  }
  if (fatal && !["recover","reload"].includes(action)) return;
  if (action === 'route-zoom' && !modal && !paused) {routeCamera.zoomBy(value === 'out' ? 0.8 : 1.25);return;}
  if(action==='enter-route'&&run&&!paused&&!modal){if(E.selectRoute(run,value,catalogue)){persist();render();pump();}return;}
  if (action === 'route-center' && !modal && !paused) {routeCamera.center();routeCamera.apply();return;}
  if (action === 'select-route' && run && !paused && !modal) {
    if(phoneLayout()){const node=expeditionGraph(run,E.STAGES).byId.get(value);if(node)inspectRouteNode(node);return;}
    if (E.selectRoute(run,value,catalogue)) { persist(); render(); pump(); }
    return;
  }
  if (action === "recover") { recoverJourney(); return; }
  if (action === "save-notice") { openMenu("save-notice"); return; }
  if (action === "retry-save" && modal === "save-notice") { persist(); return; }
  if (action === "dismiss-save-notice" && modal === "save-notice" && saveAvailable) { warning = ""; closeMenu(); syncSaveNotice(); return; }
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
  if (["help", "upgrades", "journal", "retire", "guide", "partner", "opponent", "guardians", "builds", "threats", "legacy", "partners"].includes(action)) {
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
  if (action === "resume") {
    if (run?.idleEnabled) run.idleCredit = 0;
    titleMode = false;
    paused = false;
    wakeWork();
    render();
    pump();
    return;
  }
  if (action === "confirm-retire") {
    if (!run || TERMINAL.has(run.phase)) {
      closeMenu();
      return;
    }
    invalidateWork();
    audio.stop();
    run.phase = "retired";
    E.settle(run, meta);
    persist();
    const next = modal === "replace" ? pendingStarter : null;
    modal = null;
    paused = false;
    pendingStarter = null;
    if (next) begin(next.id, next.mode);
    else {
      render();
    }
    return;
  }
  if (action === "finish") {
    invalidateWork();
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
    const selected = E.selectedStartingPartner(meta, catalogue);
    begin(selected ?? E.randomStartingPartner(Date.now(), catalogue), selected ? 'chosen' : 'random');
    return;
  }
  if (modal || !run || titleMode || paused || fatal) return;
  if(action==='capture-attempt'){
    const result = E.attemptCapture(run, catalogue);
    if (result) {
      captureReveal = run.pendingCapture;
      persist();
      render();
      pump();
    }
    return;
  }
  if(action==='capture-skip'){if(E.skipCapture(run)){persist();render();pump();}return;}
  if(action==='capture-continue'){if(!captureAnimating()&&run.phase==='capture'&&run.pendingCapture?.attempted&&E.depart(run)){persist();render();pump();}return;}
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
function inspectRouteNode(node){
 const preview=q('#route-preview');if(!preview)return;
 preview.innerHTML=routePreview(node);localizer.refresh();
 for(const token of app.querySelectorAll('[data-route-node]'))token.classList.toggle('inspected',token.dataset.routeNode===node.id);
}
function previewRouteEvent(e) {
 const token=e.target.closest('[data-route-node]');
 if(token&&run?.routeMode==='branching'&&!token.closest('.route-viewport')?.classList.contains('dragging')){const node=expeditionGraph(run,E.STAGES).byId.get(token.dataset.routeNode);if(node)inspectRouteNode(node);}
}
app.addEventListener('pointerover',previewRouteEvent);
app.addEventListener('focusin',previewRouteEvent);
function refreshCapturedPartners() {
  q('#captured-partners').innerHTML = capturedPartnersView();
  localizer.refresh();
  updateMenuScroll();
}
app.addEventListener('input', event => {
  if (modal !== 'partners' || !event.target.matches('[data-partner-search]')) return;
  partnerSearch = event.target.value;
  refreshCapturedPartners();
});
app.addEventListener('change', event => {
  if (event.target.matches('[data-starter-boon-category]') && run?.phase === 'starter') {
    starterBoonCategory = event.target.value;
    const choices = q('.initial-bonus-dock .dock-choices');
    choices.innerHTML = starterBoonChoices();
    choices.scrollTop = 0;
    localizer.refresh();
    return;
  }
  if (modal !== 'partners' || !event.target.matches('[data-partner-rarity]')) return;
  partnerRarityFilter = event.target.value;
  refreshCapturedPartners();
});
app.addEventListener("click", (e) => {
  const node = e.target.closest("[data-action]");
  if (node && !node.disabled) {
    e.preventDefault();
    dispatch(node.dataset.action, node.dataset.value).catch(interruptJourney);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (fatal) { if (e.key === "Escape") e.preventDefault(); return; }
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
  const report = advanceIdle(run, meta, catalogue, elapsed, world);
  if (report) {
    idleReport = report;
    titleMode = false;
    paused = true;
    modal = "idle-summary";
  }
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !keepSaveSession()) return;
  if (fatal) return;
  if (document.hidden && run?.idleEnabled && !paused && !titleMode) {
    invalidateWork();
    effects.clear();
    persist();
  } else if (!document.hidden && run?.idleEnabled) {
    const hadAbsence = Number.isFinite(run.idleAt);
    catchUpAbsence();
    if (!idleReport) run.idleCredit = 0;
    persist();
    if (hadAbsence) render();
  }
  effects.setPaused(paused || document.hidden);
  audio.setPaused(paused || document.hidden);
  if (!document.hidden) { wakeWork(); pump(); }
});
window.addEventListener("pagehide", () => {
  if (meta && (!saveSessionIsCurrent || saveSessionIsCurrent())) persist();
});
window.addEventListener("focus", keepSaveSession);
async function boot() {
  try {
    const response = await Promise.all(
      ["data/pokemon.json", "data/moves.json", "data/world-map.json", "data/artwork-layout.json", "data/locales/fr.json"].map(
        async (path) => {
          const r = await fetch(path, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) throw new Error("Missing resource: " + path);
          return r.json();
        },
      ),
    );
    catalogue = { pokemon: response[0], moves: response[1], artworkLayout: response[3] };
    world = response[2];
    saveSessionIsCurrent = openSaveSession(saveStorage, document, location.port);
    const state = readState(saveStorage, catalogue);
    meta = state.meta;
    configureTranslations(response[4]);setLocale(meta.language);localizer.refresh();
    run = state.run;
    E.enableBranching(run);
    E.enableEndless(run,meta);
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
      "capture-ball",
      "offering-bowl",
      "wayside-shrine",
      "parchment-panel",
      "trail-banner",
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
      ...PROJECTILE_ASSETS,
      "impact-burst",
      "merchant-cart",
      "rest-spring",
      "supply-chest",
    ];
    const sources = [
      ...required.map((name) => "assets/generated/" + name + ".webp"),
      ...[...IMPACT_ASSETS, "evolution-aura"].map((name) =>
        "assets/effects/" + name + "-sheet.webp"),
      ...[run?.hero.id, run?.enemy?.id, E.selectedStartingPartner(meta, catalogue)]
        .filter((id) => catalogue.pokemon[id])
        .map((id) => catalogue.pokemon[id].artwork),
    ];
    let prepared = 0;
    function updateLoading() {
      const meter = q("[data-loading-progress]");
      if (!meter) return;
      meter.setAttribute("aria-valuemax",String(sources.length));
      meter.setAttribute("aria-valuenow",String(prepared));
      meter.querySelector(".health-fill").style.width = `${prepared/sources.length*100}%`;
      q(".loading-count").textContent = `${prepared} / ${sources.length} illustrations ready`;
    }
    updateLoading();
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
        ]).then(()=>{prepared++;updateLoading();}).finally(() => clearTimeout(timer));
      }),
    );
    catchUpAbsence();
    persist();
    render();
  } catch (error) {
    app.innerHTML = `<div class="loading-viewport loading-screen"><div class="title-shade"></div><div class="loading-brand"><h1>POKÉROGUE</h1><p>THE GUARDIAN TRAIL</p></div><section class="loading-paper paper-panel"><img class="loading-emblem" src="assets/generated/guardian-crest.webp" alt=""><div class="loading-copy"><h2>The trail could not open</h2><p>The game could not load its resources. Retry to prepare your journey again.</p>${button("Retry","reload","","paper-panel loading-retry")}<details class="recovery-details"><summary>Technical details</summary><p>${esc(error?.message || "A required resource could not be prepared.")}</p></details></div></section></div>`;
  }
}
boot();
