import { readFile, writeFile } from "node:fs/promises";
import { STAGES } from "../engine.js";
import { buildEncounters } from "./world-layout.mjs";
const world = JSON.parse(await readFile("data/world-map.json", "utf8"));
world.encounters = buildEncounters(world, world.props,
  STAGES.map((_, index) => index), "legacy");
await writeFile("data/world-map.json", JSON.stringify(world, null, 2) + "\n");
console.log("Saved legacy route triggers with complete ground-footprint clearance.");
