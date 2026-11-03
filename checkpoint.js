export class JourneyCheckpoint {
  #state = null;
  get available() { return this.#state !== null; }
  capture(meta, run) { this.#state = structuredClone({meta,run}); }
  restore() { return this.#state ? structuredClone(this.#state) : null; }
}
