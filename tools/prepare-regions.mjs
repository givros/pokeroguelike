import { readFile, writeFile } from "node:fs/promises";
import { REGIONS } from "../engine.js";
import { buildEncounters } from "./world-layout.mjs";
import { attachApproaches } from "./approach-paths.mjs";
const world = JSON.parse(await readFile("data/world-map.json", "utf8"));
world.regions = {
  woodland: { base: world.base, props: world.props, preview: "assets/generated/woodland-layered-preview.webp" },
  lake: {
    base: "assets/generated/lake-trail-base.webp",
    preview: "assets/generated/lake-layered-preview.webp",
    props: [
      ...world.props.filter((p) => p.asset !== "woodland-tree"),
      { id: "lake-willow-west", asset: "silver-willow", x: 0.095, y: 0.30, w: 0.23, h: 0.28, collider: [0.07, 0.255, 0.05, 0.055] },
      { id: "lake-willow-east", asset: "silver-willow", x: 0.915, y: 0.29, w: 0.22, h: 0.27, collider: [0.89, 0.245, 0.05, 0.045] },
      { id: "lake-willow-south", asset: "silver-willow", x: 0.25, y: 0.96, w: 0.26, h: 0.34, collider: [0.225, 0.915, 0.05, 0.045] },
      { id: "lake-reeds-west", asset: "lakeside-reeds", x: 0.24, y: 0.17, w: 0.085, h: 0.12, collider: [0.22, 0.15, 0.04, 0.02] },
      { id: "lake-reeds-center", asset: "lakeside-reeds", x: 0.49, y: 0.13, w: 0.07, h: 0.10, collider: [0.47, 0.11, 0.04, 0.02] },
      { id: "lake-reeds-east", asset: "lakeside-reeds", x: 0.72, y: 0.12, w: 0.065, h: 0.095, collider: [0.70, 0.10, 0.04, 0.02] },
    ],
  },
  sanctuary: {
    base: "assets/generated/sanctuary-trail-base.webp",
    preview: "assets/generated/sanctuary-layered-preview.webp",
    props: [
      ...world.props.filter((p) => ["mossy-rocks"].includes(p.asset) || p.id === "tree-southwest"),
      { id: "sanctuary-arch-east", asset: "sanctuary-arch", x: 0.875, y: 0.33, w: 0.26, h: 0.32, collider: [0.77, 0.29, 0.21, 0.04] },
      { id: "sanctuary-column-west", asset: "broken-sanctuary-column", x: 0.17, y: 0.32, w: 0.085, h: 0.17, collider: [0.14, 0.29, 0.06, 0.03] },
      { id: "sanctuary-column-north", asset: "broken-sanctuary-column", x: 0.52, y: 0.23, w: 0.07, h: 0.15, collider: [0.495, 0.205, 0.05, 0.025] },
    ],
  },
};
for (const region of REGIONS) {
  const area = world.regions[region.id];
  area.encounters = buildEncounters(world, area.props,
    Array.from({ length: region.to - region.from + 1 }, (_, i) => region.from + i), "regional");
}
attachApproaches(world);
await writeFile("data/world-map.json", JSON.stringify(world, null, 2) + "\n");
