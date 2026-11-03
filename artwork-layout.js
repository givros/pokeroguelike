// The map actor is 8.5% of a 16:9 scene wide and 15% high.
const MAP_ACTOR_ASPECT = (0.085 * 16 / 9) / 0.15;
export function mapArtworkGrounding(entry, actorAspect = MAP_ACTOR_ASPECT) {
  if (!entry) return { offset:0, pivot:100 };
  const [width,height] = entry.size;
  const imageHeight = Math.min(1, actorAspect / (width / height));
  const offset = (height - entry.bounds[3]) / height * imageHeight * 100;
  return { offset, pivot:100-offset };
}
export function mapArtworkStyle(entry) {
  const {offset,pivot} = mapArtworkGrounding(entry);
  return `--map-art-offset:${offset}%;--map-art-pivot:${pivot}%;`;
}
export function applyMapArtwork(actor, entry) {
  if (!actor) return;
  const {offset,pivot} = mapArtworkGrounding(entry);
  actor.style.setProperty("--map-art-offset",`${offset}%`);
  actor.style.setProperty("--map-art-pivot",`${pivot}%`);
}
