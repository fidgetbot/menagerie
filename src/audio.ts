export type CeramicMaterial = "tortoise" | "capybara" | "toucan" | "platform";

export type CeramicContact = {
  key: string;
  materials: [CeramicMaterial, CeramicMaterial];
  impulse: number;
  pan: number;
  active: boolean;
};

export type CeramicTrigger = {
  key: string;
  materials: [CeramicMaterial, CeramicMaterial];
  impulse: number;
  intensity: number;
};

type PairState = { baseline: number; lastSeen: number; lastPlayed: number };
type Profile = { base: number; decay: number; brightness: number; weight: number };

const profiles: Record<CeramicMaterial, Profile> = {
  tortoise: { base: 610, decay: 0.34, brightness: 0.78, weight: 0.95 },
  capybara: { base: 500, decay: 0.29, brightness: 0.68, weight: 1.08 },
  toucan: { base: 790, decay: 0.38, brightness: 1.0, weight: 0.76 },
  platform: { base: 245, decay: 0.24, brightness: 0.48, weight: 1.28 },
};

const modeRatios = [1, 1.57, 2.36, 3.81, 5.24, 7.13];

export class CeramicAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly banks = new Map<string, AudioBuffer[]>();
  private readonly pairStates = new Map<string, PairState>();
  private activeVoices = 0;
  private warming = false;

  constructor(private readonly outputEnabled = true) {}

  unlock() {
    if (!this.outputEnabled) return;
    try {
      if (!this.context) this.initialize();
      if (this.context?.state === "suspended") void this.context.resume();
    } catch (error) {
      console.warn("Ceramic audio unavailable", error);
    }
  }

  process(contacts: CeramicContact[], now: number) {
    const triggers: CeramicTrigger[] = [];
    const seen = new Set<string>();
    for (const contact of contacts) {
      seen.add(contact.key);
      const previous = this.pairStates.get(contact.key);
      const onset = !previous || now - previous.lastSeen > 0.075;
      const baseline = previous?.baseline ?? 0;
      const excess = onset ? contact.impulse : Math.max(0, contact.impulse - baseline * 1.18);
      const includesPlatform = contact.materials.includes("platform");
      const threshold = includesPlatform ? 0.18 : 0.09;
      const cooldown = includesPlatform ? 0.065 : 0.048;
      const lastPlayed = previous?.lastPlayed ?? -Infinity;

      let playedAt = lastPlayed;
      if (contact.active && excess > threshold && now - lastPlayed > cooldown) {
        const intensity = Math.min(1, Math.log1p(excess / threshold) / Math.log(18));
        this.play(contact.materials, intensity, contact.pan);
        triggers.push({ key: contact.key, materials: contact.materials, impulse: contact.impulse, intensity });
        playedAt = now;
      }

      // Follow resting load slowly, but let brief impact peaks stand above it.
      const follow = contact.impulse > baseline ? 0.10 : 0.035;
      const nextBaseline = onset ? contact.impulse * 0.24 : baseline + (contact.impulse - baseline) * follow;
      this.pairStates.set(contact.key, { baseline: nextBaseline, lastSeen: now, lastPlayed: playedAt });
    }

    for (const [key, state] of this.pairStates) {
      if (!seen.has(key) && now - state.lastSeen > 2) this.pairStates.delete(key);
    }
    return triggers;
  }

  reset() {
    this.pairStates.clear();
  }

  private initialize() {
    this.context = new AudioContext({ latencyHint: "interactive" });
    const master = this.context.createGain();
    master.gain.value = 0.62;
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.11;
    master.connect(compressor).connect(this.context.destination);
    this.master = master;
    // Never synthesize buffers inside the user gesture. In WebKit that can
    // hold the pointer event open long enough to feel like dropped input.
    setTimeout(() => this.warmBanks(), 0);
  }

  private warmBanks() {
    if (this.warming) return;
    this.warming = true;
    const pairs: [CeramicMaterial, CeramicMaterial][] = [
      ["tortoise", "tortoise"], ["tortoise", "capybara"], ["tortoise", "toucan"],
      ["tortoise", "platform"], ["capybara", "platform"], ["toucan", "platform"],
      ["capybara", "capybara"], ["capybara", "toucan"], ["toucan", "toucan"],
      ["platform", "platform"],
    ];
    const buildNext = () => {
      const pair = pairs.shift();
      if (!pair) {
        this.warming = false;
        return;
      }
      this.banks.set(this.bankKey(pair), Array.from({ length: 2 }, (_, variant) => this.makeBuffer(pair, variant)));
      setTimeout(buildNext, 0);
    };
    buildNext();
  }

  private makeBuffer(materials: [CeramicMaterial, CeramicMaterial], variant: number) {
    const context = this.context!;
    const first = profiles[materials[0]];
    const second = profiles[materials[1]];
    const platformContact = materials.includes("platform");
    const base = Math.sqrt(first.base * second.base) * (0.965 + variant * 0.019);
    const duration = Math.max(first.decay, second.decay) * (1.24 + variant * 0.035);
    const brightness = (first.brightness + second.brightness) * 0.5;
    const length = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let seed = 0x9e3779b9 ^ (variant * 0x85ebca6b) ^ Math.round(base * 97);
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) / 0xffffffff) * 2 - 1;
    };
    const detunes = modeRatios.map(() => 1 + random() * 0.012);
    let peak = 0;

    for (let index = 0; index < length; index += 1) {
      const time = index / context.sampleRate;
      const attack = Math.min(1, time / 0.00065);
      let value = random() * Math.exp(-time / (platformContact ? 0.0045 : 0.0022)) * (platformContact ? 0.32 : 0.21);
      for (let mode = 0; mode < modeRatios.length; mode += 1) {
        const frequency = base * modeRatios[mode] * detunes[mode];
        const modeDecay = duration * (0.58 / (1 + mode * 0.29)) * (0.88 + brightness * 0.20);
        const amplitude = Math.pow(brightness, mode * 0.62) / Math.pow(mode + 1, 0.67);
        value += Math.sin(Math.PI * 2 * frequency * time) * Math.exp(-time / modeDecay) * amplitude * attack;
      }
      if (platformContact) value += Math.sin(Math.PI * 2 * base * 0.42 * time) * Math.exp(-time / 0.075) * 0.46 * attack;
      channel[index] = value;
      peak = Math.max(peak, Math.abs(value));
    }

    const normalization = peak > 0 ? 0.82 / peak : 1;
    for (let index = 0; index < length; index += 1) {
      const fade = Math.min(1, (length - index) / (context.sampleRate * 0.012));
      channel[index] *= normalization * fade;
    }
    return buffer;
  }

  private play(materials: [CeramicMaterial, CeramicMaterial], intensity: number, pan: number) {
    if (!this.context || !this.master || this.context.state !== "running" || this.activeVoices >= 10) return;
    const bank = this.banks.get(this.bankKey(materials));
    if (!bank) return;
    const source = this.context.createBufferSource();
    source.buffer = bank[Math.floor(Math.random() * bank.length)];
    source.playbackRate.value = 0.96 + Math.random() * 0.08 + intensity * 0.025;

    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200 + intensity * 9800;
    filter.Q.value = 0.35;
    const gain = this.context.createGain();
    const weight = (profiles[materials[0]].weight + profiles[materials[1]].weight) * 0.5;
    gain.gain.value = (0.022 + Math.pow(intensity, 0.72) * 0.25) * weight;
    const panner = this.context.createStereoPanner();
    panner.pan.value = Math.max(-0.42, Math.min(0.42, pan * 0.42));
    source.connect(filter).connect(gain).connect(panner).connect(this.master);
    this.activeVoices += 1;
    source.addEventListener("ended", () => { this.activeVoices -= 1; }, { once: true });
    source.start();
  }

  private bankKey(materials: [CeramicMaterial, CeramicMaterial]) {
    return [...materials].sort().join(":");
  }
}
