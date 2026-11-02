import { readFile, writeFile } from "node:fs/promises";
import { STAGES, pointOnRoute } from "../engine.js";
const world = JSON.parse(await readFile("data/world-map.json", "utf8"));
const samples = Array.from({ length: 1501 }, (_, i) =>
  pointOnRoute(world.route, i / 1500),
);
function propFor(stage, index, point) {
  const asset = {
    shop: "merchant-cart",
    camp: "rest-spring",
    cache: "supply-chest",
    shrine: "affinity-crystal",
  }[stage.kind];
  if (!asset) return null;
  const t = (index + 1) / STAGES.length,
    a = pointOnRoute(world.route, Math.max(0, t - 0.005)),
    b = pointOnRoute(world.route, Math.min(1, t + 0.005)),
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = Math.hypot(dx, dy);
  const w =
      stage.kind === "shop"
        ? 0.17
        : stage.kind === "camp"
          ? 0.16
          : stage.kind === "cache"
            ? 0.075
            : 0.055,
    h =
      stage.kind === "shop"
        ? 0.26
        : stage.kind === "camp"
          ? 0.2
          : stage.kind === "cache"
            ? 0.12
            : 0.1;
  const cw = w * 0.7,
    ch = stage.kind === "shrine" ? 0.025 : 0.045;
  for (const distance of [0.12, 0.15, 0.18])
    for (const direction of [1, -1]) {
      const x = point[0] + (dy / length) * distance * direction,
        y = point[1] - (dx / length) * distance * direction;
      if (x < w / 2 || x > 1 - w / 2 || y < h || y > 0.9) continue;
      const collider = [x - cw / 2, y - ch / 2, cw, ch];
      const clear = samples.every(
        ([px, py]) =>
          !(
            px > collider[0] - 0.018 &&
            px < collider[0] + cw + 0.018 &&
            py > collider[1] - 0.018 &&
            py < collider[1] + ch + 0.018
          ),
      );
      if (clear)
        return { id: "encounter-prop-" + index, asset, x, y, w, h, collider };
    }
  throw new Error("No clear placement for stage " + index);
}
world.encounters = STAGES.map((s, i) => {
  const point = pointOnRoute(world.route, (i + 1) / STAGES.length);
  return {
    id: "stage-" + (i + 1),
    index: i,
    kind: s.kind,
    center: point,
    radius: world.zones.arrivalRadius,
    prop: propFor(s, i, point),
  };
});
await writeFile("data/world-map.json", JSON.stringify(world, null, 2) + "\n");
console.log("Saved 15 route triggers with collision-checked encounter props.");
