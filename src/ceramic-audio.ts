type ContactKind = "settling" | "body";

type AudioBank = Record<ContactKind, string[]>;
type EncodedSound = { kind: ContactKind; data: ArrayBuffer; filename: string };

const bank: AudioBank = {
  settling: [
    "settling_tick__seed-142001.wav",
    "settling_tick__seed-142002.wav",
    "settling_tick__seed-142004.wav",
    "settling_tick__seed-142005.wav",
  ],
  body: [
    "body_contact__seed-142103.wav",
    "body_contact__seed-142111.wav",
    "body_contact__seed-142114.wav",
    "body_contact__seed-142116.wav",
  ],
};

const AudioContextConstructor = window.AudioContext
  ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

export class CeramicAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: Record<ContactKind, AudioBuffer[]> = { settling: [], body: [] };
  private readonly sourceData: Promise<EncodedSound[]>;
  private sequence: Record<ContactKind, number> = { settling: 0, body: 0 };
  private lastPlayedAt = -Infinity;

  constructor(
    private readonly baseUrl: string,
    private readonly enabled = true,
  ) {
    this.sourceData = enabled
      ? this.fetchSources().catch((error) => {
        console.warn("Ceramic audio could not be fetched", error);
        return [];
      })
      : Promise.resolve([]);
  }

  unlock() {
    if (!this.enabled || !AudioContextConstructor) return;
    if (!this.context) {
      this.context = new AudioContextConstructor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);
      void this.load();
    }
    if (this.context.state === "suspended") void this.context.resume();
  }

  play(kind: ContactKind, strength: number, pan: number) {
    const context = this.context;
    const master = this.master;
    const choices = this.buffers[kind];
    if (!context || !master || context.state !== "running" || choices.length === 0) return false;
    if (context.currentTime - this.lastPlayedAt < 0.045) return false;

    const index = this.sequence[kind]++ % choices.length;
    const source = context.createBufferSource();
    source.buffer = choices[index];
    source.playbackRate.value = 0.96 + Math.random() * 0.08;

    const gain = context.createGain();
    const shapedStrength = Math.sqrt(Math.min(1, Math.max(0, strength)));
    gain.gain.value = (kind === "settling" ? 0.10 : 0.16) + shapedStrength * (kind === "settling" ? 0.12 : 0.24);

    source.connect(gain);
    if (typeof context.createStereoPanner === "function") {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.min(0.7, Math.max(-0.7, pan));
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }
    source.start();
    this.lastPlayedAt = context.currentTime;
    return true;
  }

  reset() {
    this.lastPlayedAt = -Infinity;
  }

  private async load() {
    const context = this.context;
    if (!context) return;
    try {
      const entries = await Promise.all((await this.sourceData).map(async ({ kind, data }) => ({
        kind,
        buffer: await context.decodeAudioData(data.slice(0)),
      })));
      for (const { kind, buffer } of entries) this.buffers[kind].push(buffer);
    } catch (error) {
      console.warn("Ceramic audio could not be loaded", error);
      this.buffers = { settling: [], body: [] };
    }
  }

  private async fetchSources() {
    return Promise.all(
      (Object.keys(bank) as ContactKind[]).flatMap((kind) => bank[kind].map(async (filename) => {
        const response = await fetch(`${this.baseUrl}${filename}`);
        if (!response.ok) throw new Error(`Could not load ${filename}: ${response.status}`);
        return { kind, data: await response.arrayBuffer(), filename };
      })),
    );
  }
}
