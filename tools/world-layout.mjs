import { STAGES, pointOnRoute, routeFraction } from "../engine.js";

const overlaps = (a, b, margin = 0.025) => a[0] < b[0] + b[2] + margin &&
  a[0] + a[2] > b[0] - margin && a[1] < b[1] + b[3] + margin &&
  a[1] + a[3] > b[1] - margin;

export function encounterProp(stage, index, point, fraction, route, scenery = []) {
  const asset = { shop: "merchant-cart", camp: "rest-spring", cache: "supply-chest", shrine: "affinity-crystal" }[stage.kind];
  if (!asset) return null;
  const a = pointOnRoute(route, Math.max(0, fraction - 0.005));
  const b = pointOnRoute(route, Math.min(1, fraction + 0.005));
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
  if (length === 0) throw new Error("Encounter needs a nonzero route tangent");
  const w = { shop: 0.17, camp: 0.16, cache: 0.075, shrine: 0.055 }[stage.kind];
  const h = { shop: 0.26, camp: 0.2, cache: 0.12, shrine: 0.1 }[stage.kind];
  const ground = stage.kind === "camp";
  const cw = w * (ground ? 0.85 : 0.7);
  const ch = ground ? h * 0.7 : stage.kind === "shrine" ? 0.025 : 0.045;
  const samples = Array.from({ length: 1501 }, (_, i) => pointOnRoute(route, i / 1500));
  for (const distance of [0.12, 0.15, 0.18, 0.21])
    for (const shift of [0, -0.06, 0.06, -0.10, 0.10])
      for (const direction of [1, -1]) {
      const x = point[0] + (dy / length) * distance * direction + (dx / length) * shift;
      const y = point[1] - (dx / length) * distance * direction + (dy / length) * shift;
      if (x < w / 2 || x > 1 - w / 2 || y < h || y > 0.9) continue;
      const collider = [x - cw / 2, y - ch * (ground ? 1 : 0.5), cw, ch];
      const routeClear = samples.every(([px, py]) =>
        !(px > collider[0] - 0.018 && px < collider[0] + cw + 0.018 &&
          py > collider[1] - 0.018 && py < collider[1] + ch + 0.018));
      const sceneryClear = scenery.every((prop) => !overlaps(collider, prop.collider));
      if (routeClear && sceneryClear)
        return { id: "encounter-prop-" + index, asset, x, y, w, h, collider,
          layer: ground ? "ground" : "objects", collisionRole: ground ? "ground-footprint" : "base-footprint" };
    }
  throw new Error(`No clear placement for ${stage.kind} at stage ${index + 1}`);
}

export function buildEncounters(world, props, indices, routeMode) {
  return indices.map((index) => {
    const stage = STAGES[index];
    const fraction = routeFraction({ stageIndex: index, travelProgress: 1, routeMode });
    const point = pointOnRoute(world.route, fraction);
    return {
      id: "stage-" + (index + 1), index, kind: stage.kind,
      center: point, radius: world.zones.arrivalRadius,
      prop: encounterProp(stage, index, point, fraction, world.route, props),
    };
  });
}
