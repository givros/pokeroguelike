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
  impact(result) {
    if (result.kind !== "hit") return;
    const target = result.side === "ally" ? "enemy" : "ally",
      point = this.point(target);
    if (!point) return;
    const width = Math.min(250, innerWidth * 0.18) * (result.crit ? 1.25 : 1),
      burst = this.image("impact-burst", point, width, "impact");
    if (burst) {
      const a = this.animate(
        burst,
        [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.25)" },
          { opacity: 1, offset: 0.15 },
          { opacity: 0, transform: "translate(-50%,-50%) scale(1.25)" },
        ],
        { duration: 470, easing: "ease-out" },
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
    const scene = document.querySelector("#battle-scene"),
      number = document.createElement("span");
    number.className = "damage-number" + (result.crit ? " critical" : "");
    number.textContent = (result.crit ? "CRITIQUE " : "") + "-" + result.damage;
    number.style.left = point.x + "px";
    number.style.top = point.y - 35 + "px";
    scene?.append(number);
    const a = this.animate(
      number,
      [
        { translate: "-50% 0", opacity: 1, scale: 0.8 },
        { opacity: 1, scale: 1.15, offset: 0.25 },
        { translate: "-50% -70px", opacity: 0, scale: 1 },
      ],
      { duration: 1000, easing: "ease-out" },
    );
    a?.finished.catch(() => {}).finally(() => number.remove());
    if (result.healing) {
      const h = document.createElement("span");
      h.className = "damage-number healing";
      h.textContent = "+" + result.healing;
      const p = this.point(result.side);
      h.style.left = p.x + "px";
      h.style.top = p.y + "px";
      scene?.append(h);
      const a = this.animate(
        h,
        [
          { translate: "-50% 0", opacity: 1 },
          { translate: "-50% -65px", opacity: 0 },
        ],
        { duration: 1000 },
      );
      a?.finished.catch(() => {}).finally(() => h.remove());
    }
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
