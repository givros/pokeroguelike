export function impactSequence(type) {
  if (type === "electric") return "electric-burst";
  if (["psychic", "ghost", "dark"].includes(type)) return "spectral-pulse";
  if (["ground", "rock", "steel"].includes(type)) return "stone-impact";
  return null;
}
export class BattleEffects {
  constructor() {
    this.animations = new Set();
    this.paused = false;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  animate(node, frames, options) {
    if (!node) return null;
    const a = node.animate(frames, {
      ...options,
      duration: this.reduced ? 1 : options.duration,
    });
    this.animations.add(a);
    if (this.paused) a.pause();
    a.finished.catch(() => {}).finally(() => this.animations.delete(a));
    return a;
  }
  setPaused(paused) {
    this.paused = paused;
    for (const a of this.animations)
      if (a.playState !== "finished") paused ? a.pause() : a.play();
  }
  clear() {
    for (const a of this.animations) a.cancel();
    this.animations.clear();
    document.querySelectorAll(".vfx,.damage-number").forEach((n) => n.remove());
  }
  point(side) {
    const node = document.querySelector(".actor-" + side + " .body-art"),
      scene = document.querySelector("#battle-scene");
    if (!node || !scene) return null;
    const a = node.getBoundingClientRect(),
      b = scene.getBoundingClientRect();
    return {
      x: a.left + a.width * 0.5 - b.left,
      y: a.top + a.height * 0.48 - b.top,
    };
  }
  image(asset, point, width, cls = "") {
    const scene = document.querySelector("#battle-scene");
    if (!scene) return null;
    const n = document.createElement("img");
    n.className = "vfx " + cls;
    n.src = "assets/generated/" + asset + ".webp";
    n.alt = "";
    n.style.cssText = `left:${point.x}px;top:${point.y}px;width:${width}px`;
    scene.append(n);
    return n;
  }
  sprite(asset, point, width, options = {}) {
    const scene = options.scene || document.querySelector("#battle-scene");
    if (!scene) return null;
    const node = document.createElement("span");
    node.className = "vfx impact effect-sprite";
    node.dataset.effect = asset;
    node.style.cssText = `left:${point.x}px;top:${point.y}px;width:${width}px;height:${width}px;background-image:url(assets/effects/${asset}-sheet.webp)`;
    scene.append(node);
    const animation = this.animate(node, [
      { backgroundPosition: "0% 0%", offset: 0, easing: "steps(1, end)" },
      { backgroundPosition: "100% 0%", offset: 0.25, easing: "steps(1, end)" },
      { backgroundPosition: "0% 100%", offset: 0.5, easing: "steps(1, end)" },
      { backgroundPosition: "100% 100%", offset: 0.75, easing: "steps(1, end)" },
      { backgroundPosition: "100% 100%", offset: 1 },
    ], { duration: options.duration || 640, iterations: options.iterations || 1, easing: "linear" });
    animation?.finished.catch(() => {}).finally(() => node.remove());
    return node;
  }
  async evolve(node, artwork, name, wait) {
    const scene = node.closest("#battle-scene,#map-scene");
    if (!scene) return true;
    const body = node.getBoundingClientRect(), bounds = scene.getBoundingClientRect();
    const point = { x: body.left + body.width / 2 - bounds.left,
      y: body.top + body.height / 2 - bounds.top };
    const aura = this.sprite("evolution-aura", point, Math.max(240, body.height * 1.4),
      { scene, duration: 800, iterations: 2 });
    if (aura) aura.style.zIndex = "1800";
    node.classList.add("evolving");
    this.animate(node, [
      { filter: "brightness(1)", scale: 1 },
      { filter: "brightness(8)", scale: 1.2 },
    ], { duration: 650, fill: "forwards", easing: "ease-in" });
    if (!await wait(650)) return false;
    node.src = artwork;
    node.alt = name;
    this.animate(node, [
      { filter: "brightness(8)", scale: 1.2 },
      { filter: "brightness(1)", scale: 1 },
    ], { duration: 900, fill: "forwards", easing: "ease-out" });
    if (!await wait(900)) return false;
    node.classList.remove("evolving");
    return true;
  }
  async windup(side, move, wait, duration) {
    const actor = document.querySelector(".actor-" + side + " .body-art");
    const direction = side === "ally" ? 1 : -1;
    this.animate(
      actor,
      [
        { translate: "0 0", rotate: "0deg", scale: 1 },
        {
          translate: `${-direction * 13}px 4px`,
          rotate: `${-direction * 3}deg`,
          scale: 0.97,
        },
        {
          translate: `${direction * 35}px -8px`,
          rotate: `${direction * 3}deg`,
          scale: 1.035,
        },
        { translate: "0 0", rotate: "0deg", scale: 1 },
      ],
      { duration: duration * 0.7, easing: "ease-in-out" },
    );
    await wait(duration * 0.25);
    const from = this.point(side),
      to = this.point(side === "ally" ? "enemy" : "ally");
    if (!from || !to) return;
    const asset =
      move.type === "fire"
        ? "fire-wisp"
        : move.type === "water" || move.type === "ice"
          ? "water-wisp"
          : move.type === "grass" || move.type === "bug"
            ? "leaf-wisp"
            : null;
    if (asset) {
      const projectile = this.image(
        asset,
        from,
        Math.min(245, innerWidth * 0.18),
        "projectile",
      );
      if (projectile) {
        if (direction < 0) projectile.style.scale = "-1 1";
        const a = this.animate(
          projectile,
          [
            {
              left: from.x + "px",
              top: from.y + "px",
              opacity: 0,
              transform: "translate(-50%,-50%) scale(.4)",
            },
            { opacity: 1, offset: 0.15 },
            {
              left: to.x + "px",
              top: to.y + "px",
              opacity: 1,
              transform: "translate(-50%,-50%) scale(1)",
            },
          ],
          { duration: duration * 0.48, easing: "ease-in" },
        );
        a?.finished.catch(() => {}).finally(() => projectile.remove());
      }
    }
    await wait(duration * 0.45);
  }
  floatingText(label, point, cls = "", delay = 0) {
    const scene = document.querySelector("#battle-scene");
    if (!scene || !point) return;
    const node = document.createElement("span");
    node.className = "damage-number " + cls;
    node.textContent = label;
    scene.append(node);
    const width = node.getBoundingClientRect().width * 1.1 + 8;
    node.style.left = Math.max(width / 2 + 12, Math.min(scene.clientWidth - width / 2 - 12, point.x)) + "px";
    node.style.top = Math.max(100, Math.min(scene.clientHeight - 60, point.y)) + "px";
    const animation = this.animate(node, [
      { translate: "-50% 0", opacity: 1, scale: .9 },
      { opacity: 1, scale: 1.08, offset: .25 },
      { translate: "-50% -65px", opacity: 0, scale: 1 },
    ], { duration: 1000, delay, fill: "backwards", easing: "ease-out" });
    animation?.finished.catch(() => {}).finally(() => node.remove());
  }
  impact(result) {
    if (result.kind !== "hit") return;
    for (const node of document.querySelectorAll(".damage-number")) {
      for (const animation of node.getAnimations()) animation.cancel();
      node.remove();
    }
    const target = result.side === "ally" ? "enemy" : "ally",
      point = this.point(target);
    if (!point) return;
    const width = Math.min(250, innerWidth * 0.18) * (result.crit ? 1.25 : 1),
      sequence = impactSequence(result.move.type),
      burst = sequence ? this.sprite(sequence, point, width * 1.5) :
        this.image("impact-burst", point, width, "impact");
    if (burst) {
      const a = this.animate(
        burst,
        sequence ? [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.7)", offset: 0 },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: 0.12 },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1.05)", offset: 0.65 },
          { opacity: 0, transform: "translate(-50%,-50%) scale(1.15)", offset: 1 },
        ] : [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.25)" },
          { opacity: 1, offset: 0.15 },
          { opacity: 0, transform: "translate(-50%,-50%) scale(1.25)" },
        ],
        { duration: sequence ? 640 : 470, easing: sequence ? "linear" : "ease-out" },
      );
      a?.finished.catch(() => {}).finally(() => burst.remove());
    }
    const body = document.querySelector(".actor-" + target + " .body-art");
    this.animate(
      body,
      [
        { filter: "brightness(1)", translate: "0 0" },
        {
          filter: "brightness(1.65)",
          translate: (target === "ally" ? "-12" : "12") + "px 0",
        },
        { filter: "brightness(1)", translate: "0 0" },
      ],
      { duration: 360 },
    );
    for (let i = 0; i < (this.reduced ? 0 : result.crit ? 12 : 7); i++) {
      const angle = i * 2.399 + result.damage * 0.1,
        particle = this.image(
          "impact-burst",
          point,
          14 + (i % 3) * 8,
          "particle",
        );
      if (!particle) continue;
      const distance = 40 + (i % 5) * 14;
      const a = this.animate(
        particle,
        [
          { translate: "0 0", opacity: 0.9, rotate: "0deg" },
          {
            translate: `${Math.cos(angle) * distance}px ${Math.sin(angle) * distance - 20}px`,
            opacity: 0,
            rotate: (i % 2 ? 90 : -90) + "deg",
          },
        ],
        { duration: 500 + (i % 4) * 75, easing: "ease-out" },
      );
      a?.finished.catch(() => {}).finally(() => particle.remove());
    }
    const primary = result.damage - (result.echoDamage || 0);
    this.floatingText(primary ? (result.crit ? "CRITICAL " : "") + "-" + primary : "BLOCKED",
      { x: point.x, y: point.y - 35 }, result.crit ? "critical" : "");
    if (result.echoDamage) this.floatingText("ECHO -" + result.echoDamage,
      { x: point.x, y: point.y + 30 }, "secondary", 120);
    const source = this.point(result.side);
    if (result.reflectDamage) this.floatingText("RIPOSTE -" + result.reflectDamage,
      { x: source.x, y: source.y - 35 }, "secondary", 120);
    if (result.healing) this.floatingText("+" + result.healing + " HP", source, "healing secondary");
    if (result.shielding) this.floatingText("+" + result.shielding + " BARRIER",
      { x: source.x, y: source.y + 40 }, "barrier-number secondary", 120);
    if (result.absorbed && primary) this.floatingText("BARRIER " + result.absorbed,
      { x: point.x, y: point.y + 30 }, "barrier-number secondary", 120);
    if (result.crit && !this.reduced)
      this.animate(
        document.querySelector("#battle-camera"),
        [
          { translate: "0 0" },
          { translate: "4px -2px" },
          { translate: "-3px 2px" },
          { translate: "0 0" },
        ],
        { duration: 180 },
      );
  }
}
