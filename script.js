import * as E from "./engine.js";
import { readState, writeState } from "./storage.js";
import { BattleEffects } from "./presentation.js";
const app = document.getElementById("app");
const effects = new BattleEffects();
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
  grass: "Plante",
  poison: "Poison",
  fire: "Feu",
  flying: "Vol",
  water: "Eau",
  normal: "Normal",
  electric: "Électrik",
  bug: "Insecte",
  ground: "Sol",
  rock: "Roche",
  psychic: "Psy",
  ghost: "Spectre",
  ice: "Glace",
  fighting: "Combat",
  dragon: "Dragon",
  steel: "Acier",
  dark: "Ténèbres",
  fairy: "Fée",
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
const button = (label, action, value = "", cls = "", disabled = false) =>
  `<button class="${cls}" data-action="${action}" data-value="${value}" ${disabled ? "disabled" : ""}>${label}</button>`;
function persist() {
  if (!writeState(saveStorage, meta, run))
    warning = "Sauvegarde indisponible : gardez cette fenêtre ouverte.";
}
function health(m) {
  return `<div class="health-frame"><div class="health-fill ${m.hp / m.maxHp < 0.25 ? "danger" : m.hp / m.maxHp < 0.5 ? "low" : ""}" style="width:${(m.hp / m.maxHp) * 100}%"></div></div>`;
}
function hud() {
  const stage = E.stage(run);
  return `<header class="game-hud"><div class="hud-left paper-panel">${art("gold-coins")}<strong id="hud-coins">${run.coins}</strong><span class="hud-score">${run.wins} victoire${run.wins > 1 ? "s" : ""}</span></div><div class="stage-heading"><small>LE SENTIER DES GARDIENS · ${String(run.stageIndex + 1).padStart(2, "0")} / ${E.STAGES.length}</small><strong>${stage.name}</strong></div><div class="hud-controls"><div class="speed-select paper-panel">${[
    ["Lent", 2000],
    ["Normal", 1500],
    ["Rapide", 750],
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
  const h = run.hero;
  return `<div class="map-hero-card paper-panel">${mon(h.id)}<div><strong>${catalogue.pokemon[h.id].name}</strong><small>Niveau ${h.level} · ${h.hp} / ${h.maxHp} PV</small>${health(h)}</div></div>`;
}
function titleView() {
  const saved = run && !TERMINAL.has(run.phase);
  return `<div class="title-scene"><div class="title-shade"></div><div class="title-brand"><small>ROGUELIKE · COMBATS AUTOMATIQUES</small><h1>POKÉ<span>ROGUE</span></h1><p>LE SENTIER DES GARDIENS</p></div><div class="title-stats"><span>Record <b>${meta.bestScore}</b></span><span>Victoires <b>${meta.totalVictories}</b></span><span class="title-gold">${art("gold-coins")}<b>${meta.gold}</b></span></div>
 ${saved ? `<div class="resume-adventure">${button(`Reprendre l'expédition · étape ${run.stageIndex + 1}`, "resume", "", "paper-panel main-button")}</div>` : ""}
 <h2 class="starter-heading">${saved ? "Ou choisir un nouveau partenaire" : "Choisissez votre partenaire"}</h2><div class="starter-line">${STARTERS.map(
   (id) => {
     const s = catalogue.pokemon[id],
       locked = !meta.unlockedStarters[id],
       threshold = { 25: 10, 133: 25, 152: 50 }[id];
     return button(
       `${mon(id)}<strong>${s.name}</strong><small>${s.types.map((t) => NAME_TYPES[t] || t).join(" / ")}</small>${locked ? `<span class="starter-lock">${art("brass-lock")}<span>${threshold} victoires</span></span>` : ""}`,
       "starter",
       id,
       `starter-pokemon ${locked ? "locked" : ""}`,
       locked,
     );
   },
 ).join("")}</div>
 <div class="title-actions">${button(`${art("affinity-crystal")}Améliorations permanentes`, "upgrades", "", "paper-panel")}${button("Comment jouer", "help", "", "paper-panel")}</div></div>`;
}
function battleCard(m, side) {
  const s = catalogue.pokemon[m.id];
  return `<section class="battle-card ${side}-card paper-panel"><div class="fighter-name"><strong>${s.name}</strong><span>Nv. ${m.level}</span></div><small>${s.types.map((t) => NAME_TYPES[t] || t).join(" / ")}</small><div class="fighter-hp">${health(m)}<span>${m.hp} / ${m.maxHp}</span></div></section>`;
}
function battleView() {
  const h = run.hero,
    e = run.enemy;
  return `<div id="battle-scene"><div id="battle-camera"><div class="arena-shade"></div><div class="actor actor-ally ${h.hp <= 0 ? "fainted" : ""}">${mon(h.id, "body-art")}</div><div class="actor actor-enemy ${e.hp <= 0 ? "fainted" : ""}">${mon(e.id, "body-art")}</div></div><div id="battle-cards">${battleCard(h, "ally")}${battleCard(e, "enemy")}</div><div class="battle-kind">${E.stage(run).kind === "boss" ? "GARDIEN" : E.stage(run).kind === "elite" ? "RENCONTRE ÉLITE" : "COMBAT AUTOMATIQUE"}<small id="turn-label">Action ${run.battleActions + 1}</small></div>${buffRail()}<div class="battle-narration paper-panel" aria-live="polite">${esc(narration || run.log.at(-1))}</div>${run.phase === "victoryBeat" ? '<div class="victory-banner">VICTOIRE</div>' : ""}</div>`;
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
  return `<div id="map-scene"><div class="map-canvas"><img class="map-foundation" src="${world.base}" alt="Sentier de forêt peint à la main">${world.props.map(worldProp).join("")}${destinationProp()}<div id="map-actor" class="map-actor ${run.phase === "travel" ? "walking" : ""}" style="left:${x * 100}%;top:${y * 100}%;z-index:${Math.round(y * 1000)}" data-x="${x}" data-y="${y}">${mon(run.hero.id, "body-art")}</div></div>${heroCard()}${run.phase === "travel" ? `<div class="travel-caption"><strong>${catalogue.pokemon[run.hero.id].name} rejoint la prochaine étape</strong><span>En route vers ${esc(E.stage(run).name)}</span></div>` : ""}${encounterDock()}</div>`;
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
  let title = "",
    content = "";
  if (run.phase === "evolution") {
    title = "Votre Évoli est prêt à évoluer";
    content = [134, 135, 136]
      .map((id) =>
        button(
          `${mon(id, "evolution-art")}<span><strong>${catalogue.pokemon[id].name}</strong><small>${catalogue.pokemon[id].types.map((t) => NAME_TYPES[t] || t).join(" / ")} · Votre choix est définitif pour cette expédition.</small></span>`,
          "evolve",
          id,
          "dock-choice",
        ),
      )
      .join("");
  }
  if (run.phase === "reward") {
    title = "Une victoire, un nouvel atout";
    content = bonusChoices();
  }
  if (run.phase === "camp") {
    title = "Le murmure de la source";
    content =
      choice(
        "rest-spring",
        "Se reposer",
        "Restaure tous les PV et PP.",
        "encounter",
        "rest",
      ) +
      choice(
        "attack-fang",
        "S’entraîner",
        "Gagne un niveau et 5 PV maximum.",
        "encounter",
        "train",
      );
  }
  if (run.phase === "cache") {
    title = "Une découverte sur le chemin";
    content =
      choice(
        "gold-coins",
        "Prendre les pièces",
        "Trouve 50 à 80 pièces.",
        "encounter",
        "gold",
      ) +
      choice(
        "healing-potion",
        "Garder les provisions",
        "Rend 50 % des PV maximum.",
        "encounter",
        "heal",
      );
  }
  if (run.phase === "shrine") {
    title = "Un don des anciens";
    content =
      bonusChoices() +
      choice(
        "trail-sign",
        "Poursuivre",
        "Laisse le sanctuaire intact.",
        "encounter",
        "leave",
      );
  }
  if (run.phase === "shop") {
    title = "L’échoppe des voyageurs";
    content =
      Object.entries(E.SHOP_ITEMS)
        .map(([key, s]) =>
          choice(
            s.asset,
            s.name + " · " + s.cost + " pièces",
            s.text,
            "buy",
            key,
            run.coins < s.cost ||
              (s.bonus &&
                E.count(run, s.bonus) >=
                  E.BONUSES.find((b) => b.id === s.bonus).max) ||
              (key === "potion" && run.hero.hp === run.hero.maxHp),
          ),
        )
        .join("") + button("Reprendre le chemin", "leave", "", "dock-leave");
  }
  return title
    ? `<section class="encounter-dock paper-panel"><h2>${title}</h2><div class="dock-choices">${content}</div><p class="dock-note">${esc(run.log.at(-1))}</p></section>`
    : "";
}
function starterBonusView() {
  return `<div class="starter-bonus-scene">${mon(run.hero.id, "bonus-partner")}<section class="initial-bonus-dock paper-panel"><small>PRÉPARER L’EXPÉDITION</small><h2>Choisissez votre premier atout</h2><div class="dock-choices">${bonusChoices()}</div><p>Votre Pokémon combattra automatiquement. Vos choix feront la différence.</p></section></div>`;
}
function endingView() {
  const won = run.phase === "complete";
  return `<div class="ending-scene"><div class="ending-shade"></div>${mon(run.hero.id, "ending-partner")}<section class="ending-content"><small>${won ? "LES GARDIENS S’INCLINENT" : "CHAQUE VOYAGE LAISSE UNE TRACE"}</small><h1>${won ? "Expédition accomplie" : "Le voyage s’achève"}</h1><p>${won ? "Votre Pokémon a traversé le sentier et vaincu le dernier gardien." : run.phase === "retired" ? "Votre Pokémon rentre au camp avec ses découvertes." : "Votre Pokémon a tout donné. De nouveaux chemins vous attendent."}</p><div class="ending-stats"><span><b>${run.wins}</b>victoires</span><span><b>${run.stageIndex + 1} / ${E.STAGES.length}</b>étapes</span><span><b>${run.coins}</b>pièces conservées</span></div><div class="ending-actions">${button("Retour au camp", "finish", "", "paper-panel main-button")}${button("Nouvelle expédition", "retry", "", "paper-panel")}</div></section></div>`;
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
  app.innerHTML = `<div class="game-screen mode-${mode} ${paused ? "paused" : ""}" data-phase="${run?.phase || "title"}">${mode === "title" ? titleView() : mode === "ending" ? endingView() : `${hud()}${mode === "starter" ? starterBonusView() : mode === "battle" ? battleView() : mapView()}`}${warning ? `<div class="save-warning">${esc(warning)}</div>` : ""}${fatal ? `<div class="fatal-panel paper-panel"><h2>Le voyage est interrompu</h2><p>${esc(fatal)}</p>${button("Reprendre depuis la sauvegarde", "reload", "", "main-button")}</div>` : ""}<div id="menu-host"></div></div>`;
  if (modal) renderMenu();
}
function updateBattle() {
  for (const [side, m] of [
    ["ally", run.hero],
    ["enemy", run.enemy],
  ]) {
    const card = q("." + side + "-card");
    if (card) {
      card.querySelector(".fighter-name>strong").textContent =
        catalogue.pokemon[m.id].name;
      card.querySelector(".fighter-name>span").textContent = "Nv. " + m.level;
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
    ["ally", run.hero],
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
function menuContent() {
  if (modal === "pause")
    return `<h2>Pause</h2><p>Le combat et le déplacement sont suspendus.</p><div class="pause-actions">${button("Reprendre", "close", "", "paper-panel main-button")}${button("Les atouts du voyage", "journal", "", "paper-panel")}${button("Comment jouer", "help", "", "paper-panel")}${button("Rentrer au camp", "retire", "", "paper-panel", TERMINAL.has(run.phase))}</div>`;
  if (modal === "retire" || modal === "replace")
    return `<h2>Rentrer au camp ?</h2><p>Cette expédition prendra fin. Votre or et vos victoires seront conservés.</p><div class="pause-actions">${button("Continuer le voyage", "close", "", "paper-panel main-button")}${button("Terminer l’expédition", "confirm-retire", pendingStarter || "", "", "")}</div>`;
  if (modal === "upgrades")
    return `<h2>Améliorations permanentes</h2><p class="menu-money">${art("gold-coins")}${meta.gold} pièces</p><div class="upgrade-list">${Object.entries(
      E.UPGRADE_DEFS,
    )
      .map(([key, d]) => {
        const n = meta.permanentUpgrades[key],
          cost = Math.round(d.cost * (1 + n * 0.5));
        return choice(
          d.asset,
          d.name + " · niveau " + n + "/10",
          d.text + (n < 10 ? " · " + cost + " pièces" : ""),
          "upgrade",
          key,
          n >= 10 || meta.gold < cost || (!!run && !TERMINAL.has(run.phase)),
        );
      })
      .join(
        "",
      )}</div>${run && !TERMINAL.has(run.phase) ? '<p class="muted">Terminez votre expédition pour acheter des améliorations.</p>' : ""}`;
  if (modal === "journal")
    return `<h2>Les atouts du voyage</h2><div class="journal-bonuses">${
      [...new Set(run.bonuses)]
        .map((id) => {
          const b = E.BONUSES.find((b) => b.id === id);
          return `<div>${art(b.asset)}<span><strong>${b.name}${E.count(run, id) > 1 ? " ×" + E.count(run, id) : ""}</strong><small>${b.text}</small></span></div>`;
        })
        .join("") || "<p>Aucun atout pour le moment.</p>"
    }</div><h3>Journal de combat</h3><div class="log-list">${run.log.map((s) => `<p>${esc(s)}</p>`).join("")}</div>`;
  return `<h2>Le carnet du voyageur</h2><div class="help-copy"><h3>Un autobattler roguelike</h3><p>Votre Pokémon choisit automatiquement sa meilleure attaque en fonction des types, de sa puissance et des PP restants. Il n’y a pas de commande d’attaque manuelle.</p><h3>Un chemin de quinze étapes</h3><p>Après chaque victoire, votre Pokémon rejoint automatiquement la prochaine étape sur la carte. Choisissez alors un nouvel atout. Des coffres, des sources, un marchand, un sanctuaire, des élites et deux gardiens jalonnent le trajet.</p><h3>Construire votre stratégie</h3><p>Les atouts se combinent : dégâts, résistance, critiques, régénération et vol de vie. Les PP sont limités. Une attaque de dernier recours empêche les blocages. Un combat ne peut pas dépasser 80 actions.</p><h3>Grandir et recommencer</h3><p>Votre partenaire gagne des niveaux, apprend des capacités et les trois starters évoluent aux niveaux 8 et 11. Pikachu et Germignon évoluent également. Évoli choisit sa forme au niveau 7. L’or conservé permet d’acheter des améliorations permanentes. Pikachu, Évoli et Germignon se débloquent à 10, 25 et 50 victoires.</p><p class="muted">Échap : pause. Le jeu sauvegarde votre progression sur cet appareil. Vous pouvez reprendre un combat ou un trajet après rechargement.</p></div>`;
}
function renderMenu() {
  const host = q("#menu-host");
  if (!host) return;
  host.innerHTML = modal
    ? `<dialog aria-labelledby="menu-heading"><div class="menu-top">${button("Fermer", "close", "", "menu-close")}</div><div id="menu-heading">${menuContent()}</div></dialog>`
    : "";
  if (modal) {
    const d = host.querySelector("dialog");
    d.showModal();
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeMenu();
    });
  }
}
function openMenu(name) {
  modal = name;
  paused = true;
  if (meta) persist();
  effects.setPaused(true);
  q(".game-screen")?.classList.add("paused");
  renderMenu();
}
function closeMenu() {
  modal = null;
  paused = false;
  effects.setPaused(false);
  q(".game-screen")?.classList.remove("paused");
  renderMenu();
  pump();
}
let pendingStarter = null;
function begin(id) {
  epoch++;
  effects.clear();
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
        "La destination du trajet ne correspond pas à sa rencontre.",
      );
    E.arrive(run, catalogue);
    persist();
    render();
  }
}
async function pump() {
  if (running || titleMode || !run || fatal) return;
  running = true;
  const token = epoch;
  let transitions = 0;
  try {
    while (live(token) && AUTO.has(run.phase)) {
      if (++transitions > 500)
        throw new Error(
          "La séquence automatique a été arrêtée pour éviter une répétition inattendue.",
        );
      if (paused || document.hidden) {
        await wait(30, token);
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
          catalogue.pokemon[actor.id].name + " utilise " + move.name + " !";
        updateBattle();
        const duration = Math.max(450, speed * 0.65);
        await effects.windup(side, move, (ms) => wait(ms, token), duration);
        if (!live(token) || run.phase !== "battle") break;
        const result = E.battleStep(run, catalogue);
        narration = run.log.at(-1);
        persist();
        updateBattle();
        if (result) effects.impact(result);
        await wait(Math.max(430, speed - duration * 0.7), token);
        if (!live(token)) break;
        if (TERMINAL.has(run.phase)) {
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
        E.depart(run);
        persist();
        render();
      }
    }
  } catch (error) {
    if (token === epoch) {
      fatal = error.message || "Une erreur a interrompu le voyage.";
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
      AUTO.has(run.phase) &&
      !paused &&
      !document.hidden
    )
      queueMicrotask(pump);
  }
}
async function dispatch(action, value) {
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
  if (["help", "upgrades", "journal", "retire"].includes(action)) {
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
      persist();
      render();
      pump();
    }
    return;
  }
  if (action === "encounter") {
    if (E.resolveEncounter(run, value)) {
      persist();
      render();
      pump();
    }
    return;
  }
  if (action === "buy") {
    if (E.buy(run, value)) {
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
          if (!r.ok) throw new Error("Ressource manquante : " + path);
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
      "woodland-trail-base",
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
              () => reject(new Error("Illustration indisponible : " + src)),
              8000,
            );
          }),
        ]).finally(() => clearTimeout(timer));
      }),
    );
    persist();
    render();
  } catch (error) {
    app.innerHTML = `<div class="loading-screen"><h1>POKÉROGUE</h1><p>Le jeu n’a pas pu charger ses ressources.</p><p>${esc(error.message)}</p><button data-action="reload">Réessayer</button></div>`;
  }
}
boot();
