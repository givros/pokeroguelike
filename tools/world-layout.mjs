import { STAGES, pointOnRoute, routeFraction } from "../engine.js";

const overlaps = (a, b, margin = 0.025) => a[0] < b[0] + b[2] + margin &&
  a[0] + a[2] > b[0] - margin && a[1] < b[1] + b[3] + margin &&
  a[1] + a[3] > b[1] - margin;

export function encounterProp(stage, index, point, fraction, route, scenery = [], preferred = []) {
  const asset = { shop: "merchant-cart", camp: "rest-spring", cache: "supply-chest", shrine: "wayside-shrine" }[stage.kind];
  if (!asset) return null;
  const a = pointOnRoute(route, Math.max(0, fraction - 0.005));
  const b = pointOnRoute(route, Math.min(1, fraction + 0.005));
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
  if (length === 0) throw new Error("Encounter needs a nonzero route tangent");
  const w = { shop: 0.17, camp: 0.16, cache: 0.075, shrine: 0.112 }[stage.kind];
  const h = { shop: 0.26, camp: 0.2, cache: 0.12, shrine: 0.20 }[stage.kind];
  const ground = stage.kind === "camp";
  const cw = w * (ground || stage.kind === "shrine" ? 0.85 : 0.7);
  const ch = ground ? h * 0.7 : stage.kind === "shrine" ? h * 0.3 : 0.045;
  const samples = Array.from({ length: 1501 }, (_, i) => pointOnRoute(route, i / 1500));
  const positions = [...preferred];
  for (const distance of (stage.kind === "shrine" ? [0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.21] : [0.12, 0.15, 0.18, 0.21]))
    for (const shift of (stage.kind === "shrine" ? [0, -0.06, 0.06, -0.10, 0.10, -0.16, 0.16] : [0, -0.06, 0.06, -0.10, 0.10]))
      for (const direction of [1, -1]) {
      const x = point[0] + (dy / length) * distance * direction + (dx / length) * shift;
      const y = point[1] - (dx / length) * distance * direction + (dy / length) * shift;
      positions.push([x, y]);
    }
  if (stage.kind === "shrine")
    for (const offsetY of [-0.03, -0.09, -0.15, 0.03, 0.09, 0.15, 0.21])
      for (const offsetX of [-0.10, -0.12, -0.18, -0.24, 0.10, 0.12, 0.18, 0.24, 0])
        positions.push([point[0] + offsetX, point[1] + offsetY]);
  for (const [x, y] of positions) {
      if (x < w / 2 || x > 1 - w / 2 || y < h || y > 0.9) continue;
      if (stage.kind === "shrine" && (y - h < 0.115 || y > 0.55 ||
        scenery.some((prop) => ["trail-sign", "merchant-cart", "rest-spring", "supply-chest", "wayside-shrine"].includes(prop.asset) && overlaps(
          [x - w / 2, y - h, w, h], [prop.x - prop.w / 2, prop.y - prop.h, prop.w, prop.h], 0.012)))) continue;
      const collider = [x - cw / 2, y - ch * (ground || stage.kind === "shrine" ? 1 : 0.5), cw, ch];
      const clearance = stage.kind === "shrine" ? 0.045 : 0.018;
      const routeClear = samples.every(([px, py]) =>
        !(px > collider[0] - clearance && px < collider[0] + cw + clearance &&
          py > collider[1] - clearance && py < collider[1] + ch + clearance));
      const sceneryClear = scenery.every((prop) => !overlaps(collider, prop.collider));
      if (routeClear && sceneryClear)
        return { id: "encounter-prop-" + index, asset, x, y, w, h, collider,
          layer: ground ? "ground" : "objects", collisionRole: ground ? "ground-footprint" : "base-footprint" };
    }
  throw new Error(`No clear placement for ${stage.kind} at stage ${index + 1}`);
}

export function buildEncounters(world, props, indices, routeMode) {
  const occupied = [...props];
  return indices.map((index) => {
    const stage = STAGES[index];
    const fraction = routeFraction({ stageIndex: index, travelProgress: 1, routeMode });
    const point = pointOnRoute(world.route, fraction);
    const preferred = routeMode === "regional" ? ({ 4: [[0.769, 0.305]], 7: [[0.40, 0.395]], 9: [[0.56, 0.319]], 13: [[0.67, 0.32]] }[index] || []) : [];
    const prop = encounterProp(stage, index, point, fraction, world.route, occupied, preferred);
    if (prop && routeMode === "regional") occupied.push(prop);
    return {
      id: "stage-" + (index + 1), index, kind: stage.kind,
      center: point, radius: world.zones.arrivalRadius,
      prop,
    };
  });
}
