const note = (frequency, duration, gain = 0.12, delay = 0, end = frequency, type = "sine") =>
  ({ frequency, duration, gain, delay, end, type });
const noise = (frequency, duration, gain = 0.12, end = frequency) =>
  ({ frequency, duration, gain, delay: 0, end, type: "noise" });

export function cueVoices(cue, element = "normal", critical = false) {
  let voices;
  if (cue === "select") voices = [note(620, 0.065, 0.12, 0, 480, "triangle")];
  else if (cue === "reward") voices = [523.25, 659.25, 783.99].map((f, i) => note(f, 0.2, 0.10, i * 0.075));
  else if (cue === "victory") voices = [392, 523.25, 659.25, 783.99].map((f, i) => note(f, 0.35, 0.12, i * 0.12));
  else if (cue === "defeat") voices = [392, 311.13, 261.63].map((f, i) => note(f, 0.28, 0.10, i * 0.15, f * 0.94, "triangle"));
  else if (cue === "evolve") voices = [261.63, 329.63, 392, 523.25].map((f, i) => note(f, 0.7, 0.075, i * 0.13));
  else if (cue === "windup") voices = [
    note(["water", "ice"].includes(element) ? 400 : 180, 0.16, 0.06, 0,
      ["water", "ice"].includes(element) ? 680 : 300),
    noise(element === "fire" ? 900 : 2400, 0.12, 0.035),
  ];
  else if (cue === "hit") {
    if (element === "electric") voices = [noise(3200, 0.15, 0.17, 900), note(950, 0.12, 0.12, 0, 140)];
    else if (["psychic", "ghost", "dark"].includes(element)) voices = [note(190, 0.22, 0.12, 0, 380), note(380, 0.25, 0.08, 0, 190)];
    else if (element === "fire") voices = [noise(1000, 0.24, 0.22, 400), note(150, 0.15, 0.12, 0, 60)];
    else if (["water", "ice"].includes(element)) voices = [noise(2400, 0.2, 0.13, 1000), note(620, 0.16, 0.10, 0, 220)];
    else if (["grass", "bug"].includes(element)) voices = [noise(3500, 0.12, 0.12, 1800), note(360, 0.12, 0.10, 0, 200, "triangle")];
    else voices = [noise(800, 0.16, 0.20, 300), note(100, 0.18, 0.18, 0, 35)];
    if (critical) voices.push(note(1760, 0.2, 0.09, 0, 880));
  } else return [];
  return voices;
}

export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.noise = null;
    this.enabled = false;
    this.paused = false;
    this.voices = new Map();
  }
  async unlock(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      this.syncGain();
      return false;
    }
    try {
      if (!this.context) {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) return false;
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const channel = this.noise.getChannelData(0);
        for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
      }
      await this.context.resume();
      this.syncGain();
      return this.enabled;
    } catch {
      return false;
    }
  }
  syncGain() {
    if (!this.master) return;
    const time = this.context.currentTime;
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setTargetAtTime(this.enabled && !this.paused ? 0.2 : 0, time, 0.012);
  }
  setPaused(paused) {
    this.paused = paused;
    this.syncGain();
    if (!paused && this.enabled && this.context?.state === "suspended")
      this.context.resume().catch(() => {});
  }
  play(cue, element, critical) {
    if (!this.enabled || this.paused || this.context?.state !== "running") return false;
    const descriptors = cueVoices(cue, element, critical);
    for (const voice of descriptors) this.schedule(voice);
    return descriptors.length > 0;
  }
  schedule(voice) {
    while (this.voices.size >= 16) this.voices.values().next().value();
    const context = this.context, start = context.currentTime + voice.delay;
    const end = start + voice.duration;
    const source = voice.type === "noise" ? context.createBufferSource() : context.createOscillator();
    const filter = context.createBiquadFilter(), gain = context.createGain();
    if (voice.type === "noise") source.buffer = this.noise;
    else {
      source.type = voice.type;
      source.frequency.setValueAtTime(voice.frequency, start);
      source.frequency.exponentialRampToValueAtTime(voice.end, end);
    }
    filter.type = "bandpass";
    filter.Q.value = voice.type === "noise" ? 0.7 : 0.1;
    filter.frequency.setValueAtTime(voice.frequency, start);
    filter.frequency.exponentialRampToValueAtTime(voice.end, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(voice.gain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter).connect(gain).connect(this.master);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      source.onended = null;
      try { source.stop(); } catch { /* The source may already have ended. */ }
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.voices.delete(source);
    };
    this.voices.set(source, cleanup);
    source.onended = cleanup;
    source.start(start);
    source.stop(end);
  }
  stop() {
    for (const cleanup of [...this.voices.values()]) cleanup();
  }
}
