import { contactGain, type ContactKind } from "./audio-dynamics";

type SoundFamily = "contact" | "bubble";
type EncodedSound = { family: SoundFamily; data: ArrayBuffer; filename: string };
type AudioTrace = (event: string, detail?: Record<string, unknown>) => void;
type RecoverableAudioContext = AudioContext & { readonly state: AudioContextState | "interrupted" };
type PendingContact = { kind: ContactKind; strength: number; pan: number; queuedAt: number };
const runtimeBankVersion = "muted-stoneware-v3-dynamics-bubble-v5";
const clockProbeDelayMs = 300;
const pendingContactMaxDelayMs = 1000;
const pendingBubbleMaxDelayMs = 800;
const masterGain = 0.72;

const contactBank = [
  "ceramic/stoneware_contact__seed-216001.wav",
  "ceramic/stoneware_contact__seed-216002.wav",
  "ceramic/stoneware_contact__seed-216003.wav",
  "ceramic/stoneware_contact__seed-216004.wav",
];
const bubbleSound = "ui/bubble_pop__seed-277201-v5.wav";

const treatment: Record<ContactKind, {
  rate: number;
  rateSpread: number;
}> = {
  settling: { rate: 1.04, rateSpread: 0.05 },
  body: { rate: 0.98, rateSpread: 0.07 },
  ground: { rate: 0.86, rateSpread: 0.05 },
};

const AudioContextConstructor = window.AudioContext
  ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type: string };
};

export class CeramicAudio {
  private context: RecoverableAudioContext | null = null;
  private master: GainNode | null = null;
  private contactBuffers: AudioBuffer[] = [];
  private bubbleBuffer: AudioBuffer | null = null;
  private readonly sourceData: Promise<EncodedSound[]>;
  private sequence: Record<ContactKind, number> = { settling: 0, body: 0, ground: 0 };
  private lastPlayedAt = -Infinity;
  private unlocked = false;
  private backgrounded = false;
  private recreateOnNextGesture = false;
  private generation = 0;
  private clockProbeTimer: number | undefined;
  private pendingContact: PendingContact | null = null;
  private pendingBubbleAt: number | null = null;
  private resumePendingContext: RecoverableAudioContext | null = null;
  private unlockPulseContext: RecoverableAudioContext | null = null;
  private muted = false;

  constructor(
    private readonly baseUrl: string,
    private readonly enabled = true,
    private readonly trace: AudioTrace = () => {},
  ) {
    if (enabled) this.configureAudioSession();
    this.sourceData = enabled
      ? this.fetchSources().catch((error) => {
        console.warn("Ceramic audio could not be fetched", error);
        this.trace("fetch_failed", { error: String(error) });
        return [];
      })
      : Promise.resolve([]);
  }

  unlock() {
    if (!this.enabled || !AudioContextConstructor) return;
    this.backgrounded = false;
    this.configureAudioSession();
    if (this.recreateOnNextGesture) this.replaceContext("stalled_or_failed");
    let context = this.context ?? this.createContext("first_gesture");
    if (this.resumePendingContext === context && context.state !== "running") {
      this.trace("resume_still_pending", { generation: this.generation, state: context.state });
      context = this.replaceContext("resume_pending");
    }
    this.trace("unlock_attempt", { generation: this.generation, state: context.state, unlocked: this.unlocked });
    this.startUnlockPulse(context);
    this.resumeContext(context, "gesture");
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.pendingContact = null;
      this.pendingBubbleAt = null;
    }
    if (this.master) this.master.gain.value = muted ? 0 : masterGain;
    this.trace("mute_changed", { muted });
  }

  suspendForBackground() {
    if (!this.enabled) return;
    this.backgrounded = true;
    this.unlocked = false;
    this.pendingContact = null;
    this.pendingBubbleAt = null;
    this.clearClockProbe();
    const context = this.context;
    if (!context || context.state === "closed" || context.state === "suspended") return;
    const generation = this.generation;
    this.trace("background_suspend_attempt", { generation, state: context.state });
    void context.suspend().then(() => {
      if (context !== this.context) return;
      this.trace("background_suspended", { generation, state: context.state });
    }).catch((error) => {
      if (context !== this.context) return;
      this.recreateOnNextGesture = true;
      console.warn("Ceramic audio could not suspend", error);
      this.trace("background_suspend_failed", { generation, error: String(error) });
    });
  }

  recoverAfterForeground() {
    if (!this.enabled || document.visibilityState !== "visible") return;
    this.backgrounded = false;
    this.configureAudioSession();
    const context = this.context;
    if (!context) return;
    this.trace("foreground_recovery", { generation: this.generation, state: context.state });
    this.resumeContext(context, "foreground");
  }

  play(kind: ContactKind, strength: number, pan: number) {
    if (this.muted) {
      this.trace("play_blocked", { kind, reason: "muted" });
      return false;
    }
    const context = this.context;
    const master = this.master;
    const choices = this.contactBuffers;
    if (!context || !master) {
      this.trace("play_blocked", {
        kind,
        context: Boolean(context),
        unlocked: this.unlocked,
        state: context?.state ?? "missing",
        buffers: choices.length,
      });
      return false;
    }
    if (context.state !== "running" || choices.length === 0) {
      this.queueContact(kind, strength, pan, context.state !== "running" ? context.state : "buffers");
      return true;
    }
    return this.playReady(context, master, kind, strength, pan);
  }

  playBubble() {
    if (this.muted) {
      this.trace("bubble_play_blocked", { reason: "muted" });
      return false;
    }
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      this.trace("bubble_play_blocked", {
        context: Boolean(context),
        unlocked: this.unlocked,
        state: context?.state ?? "missing",
        buffer: Boolean(this.bubbleBuffer),
      });
      return false;
    }
    if (context.state !== "running" || !this.bubbleBuffer) {
      this.pendingBubbleAt = performance.now();
      this.trace("bubble_play_queued", {
        generation: this.generation,
        state: context.state,
        buffer: Boolean(this.bubbleBuffer),
      });
      return true;
    }
    return this.playBubbleReady(context, master);
  }

  private playReady(
    context: RecoverableAudioContext,
    master: GainNode,
    kind: ContactKind,
    strength: number,
    pan: number,
    queuedForMs = 0,
  ) {
    const choices = this.contactBuffers;
    if (context.currentTime - this.lastPlayedAt < 0.045) return false;

    const index = this.sequence[kind]++ % choices.length;
    const source = context.createBufferSource();
    source.buffer = choices[index];
    const voice = treatment[kind];
    source.playbackRate.value = voice.rate + (Math.random() - 0.5) * voice.rateSpread;

    const gain = context.createGain();
    const voiceGain = contactGain(kind, strength);
    gain.gain.value = voiceGain;

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
    this.trace("played", {
      generation: this.generation,
      kind,
      index,
      state: context.state,
      unlockConfirmed: this.unlocked,
      queuedForMs: Math.round(queuedForMs),
      strength: Math.round(strength * 1000) / 1000,
      gain: Math.round(voiceGain * 1000) / 1000,
    });
    return true;
  }

  private playBubbleReady(context: RecoverableAudioContext, master: GainNode, queuedForMs = 0) {
    const buffer = this.bubbleBuffer;
    if (!buffer) return false;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1;
    const gain = context.createGain();
    gain.gain.value = 0.78;
    source.connect(gain);
    gain.connect(master);
    source.start();
    this.trace("bubble_played", {
      generation: this.generation,
      state: context.state,
      unlockConfirmed: this.unlocked,
      queuedForMs: Math.round(queuedForMs),
    });
    return true;
  }

  reset() {
    this.lastPlayedAt = -Infinity;
    this.pendingContact = null;
    this.pendingBubbleAt = null;
  }

  private createContext(reason: string) {
    const context = new (AudioContextConstructor as typeof AudioContext)() as RecoverableAudioContext;
    const generation = ++this.generation;
    this.context = context;
    this.unlocked = false;
    this.recreateOnNextGesture = false;
    this.contactBuffers = [];
    this.bubbleBuffer = null;
    this.master = context.createGain();
    this.master.gain.value = this.muted ? 0 : masterGain;
    this.master.connect(context.destination);
    context.addEventListener("statechange", () => {
      if (context === this.context) this.trace("state_changed", { generation, state: context.state });
    });
    this.trace("context_created", { generation, reason, state: context.state, sampleRate: context.sampleRate });
    void this.load(context, generation);
    return context;
  }

  private replaceContext(reason: string) {
    this.clearClockProbe();
    const previous = this.context;
    const previousGeneration = this.generation;
    this.context = null;
    this.master = null;
    this.unlocked = false;
    this.resumePendingContext = null;
    this.unlockPulseContext = null;
    this.contactBuffers = [];
    this.bubbleBuffer = null;
    if (previous && previous.state !== "closed") {
      void previous.close().catch((error) => {
        console.warn("Ceramic audio could not close its stale context", error);
      });
    }
    this.trace("context_replaced", { previousGeneration, reason });
    return this.createContext(reason);
  }

  private startUnlockPulse(context: RecoverableAudioContext) {
    if (this.unlocked || context !== this.context || this.unlockPulseContext === context) return;
    const generation = this.generation;
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      source.connect(context.destination);
      this.unlockPulseContext = context;
      source.addEventListener("ended", () => {
        source.disconnect();
        if (this.unlockPulseContext === context) this.unlockPulseContext = null;
        if (context !== this.context || this.backgrounded) return;
        this.unlocked = true;
        this.trace("unlock_confirmed", { generation, state: context.state });
        this.probeClock(context, "unlock");
        this.flushPendingSounds();
      }, { once: true });
      source.start(0);
      this.trace("unlock_pulse_started", { generation, state: context.state });
    } catch (error) {
      if (this.unlockPulseContext === context) this.unlockPulseContext = null;
      this.recreateOnNextGesture = true;
      console.warn("Ceramic audio could not start its unlock pulse", error);
      this.trace("unlock_pulse_failed", { generation, error: String(error) });
    }
  }

  private configureAudioSession() {
    const audioSession = (navigator as NavigatorWithAudioSession).audioSession;
    if (!audioSession) return;
    try {
      audioSession.type = "playback";
    } catch (error) {
      console.warn("Ceramic audio session could not use playback mode", error);
      this.trace("session_configuration_failed", { error: String(error) });
    }
  }

  private resumeContext(context: RecoverableAudioContext, reason: string) {
    if (context !== this.context || context.state === "closed") return;
    const generation = this.generation;
    if (context.state === "running") {
      if (this.resumePendingContext === context) this.resumePendingContext = null;
      this.probeClock(context, reason);
      this.flushPendingSounds();
      return;
    }
    if (this.resumePendingContext === context) {
      this.trace("resume_already_pending", { generation, reason, state: context.state });
      return;
    }
    this.resumePendingContext = context;
    this.trace("resume_requested", { generation, reason, state: context.state });
    void context.resume().then(() => {
      if (context !== this.context) return;
      if (this.resumePendingContext === context) this.resumePendingContext = null;
      this.trace("context_resumed", { generation, reason, state: context.state });
      this.probeClock(context, reason);
      this.flushPendingSounds();
    }).catch((error) => {
      if (context !== this.context) return;
      if (this.resumePendingContext === context) this.resumePendingContext = null;
      this.recreateOnNextGesture = true;
      console.warn("Ceramic audio could not resume", error);
      this.trace("resume_failed", { generation, reason, error: String(error) });
    });
  }

  private probeClock(context: RecoverableAudioContext, reason: string) {
    if (context !== this.context || this.backgrounded || document.visibilityState !== "visible" || context.state !== "running") return;
    this.clearClockProbe();
    const generation = this.generation;
    const startedAt = context.currentTime;
    this.clockProbeTimer = window.setTimeout(() => {
      this.clockProbeTimer = undefined;
      if (context !== this.context || this.backgrounded || document.visibilityState !== "visible" || context.state !== "running") return;
      const advancedBy = context.currentTime - startedAt;
      if (advancedBy > 0.001) return;
      this.unlocked = false;
      this.recreateOnNextGesture = true;
      console.warn("Ceramic audio clock stalled; the context will be recreated on the next gesture");
      this.trace("clock_stalled", { generation, reason, currentTime: context.currentTime });
    }, clockProbeDelayMs);
  }

  private clearClockProbe() {
    if (this.clockProbeTimer === undefined) return;
    clearTimeout(this.clockProbeTimer);
    this.clockProbeTimer = undefined;
  }

  private queueContact(kind: ContactKind, strength: number, pan: number, reason: string) {
    const candidate: PendingContact = { kind, strength, pan, queuedAt: performance.now() };
    if (!this.pendingContact || strength > this.pendingContact.strength) this.pendingContact = candidate;
    this.trace("play_queued", {
      generation: this.generation,
      kind,
      reason,
      unlocked: this.unlocked,
      buffers: this.contactBuffers.length,
    });
  }

  private flushPendingSounds() {
    this.flushPendingBubble();
    this.flushPendingContact();
  }

  private flushPendingBubble() {
    const queuedAt = this.pendingBubbleAt;
    const context = this.context;
    const master = this.master;
    if (queuedAt === null || !context || !master || context.state !== "running" || !this.bubbleBuffer) return;
    const queuedForMs = performance.now() - queuedAt;
    this.pendingBubbleAt = null;
    if (queuedForMs > pendingBubbleMaxDelayMs) {
      this.trace("bubble_play_expired", { generation: this.generation, queuedForMs: Math.round(queuedForMs) });
      return;
    }
    this.playBubbleReady(context, master, queuedForMs);
  }

  private flushPendingContact() {
    const pending = this.pendingContact;
    const context = this.context;
    const master = this.master;
    if (!pending || !context || !master || context.state !== "running" || this.contactBuffers.length === 0) return;
    const queuedForMs = performance.now() - pending.queuedAt;
    this.pendingContact = null;
    if (queuedForMs > pendingContactMaxDelayMs) {
      this.trace("queued_play_expired", { generation: this.generation, kind: pending.kind, queuedForMs: Math.round(queuedForMs) });
      return;
    }
    this.playReady(context, master, pending.kind, pending.strength, pending.pan, queuedForMs);
  }

  private async load(context: RecoverableAudioContext, generation: number) {
    try {
      const entries = await Promise.all((await this.sourceData).map(async ({ family, data }) => ({
        family,
        buffer: await context.decodeAudioData(data.slice(0)),
      })));
      if (context !== this.context || generation !== this.generation) return;
      this.contactBuffers = entries.filter((entry) => entry.family === "contact").map((entry) => entry.buffer);
      this.bubbleBuffer = entries.find((entry) => entry.family === "bubble")?.buffer ?? null;
      this.trace("buffers_ready", {
        generation,
        count: entries.length,
        contacts: this.contactBuffers.length,
        bubble: Boolean(this.bubbleBuffer),
      });
      this.flushPendingSounds();
    } catch (error) {
      if (context !== this.context || generation !== this.generation) return;
      console.warn("Ceramic audio could not be loaded", error);
      this.trace("decode_failed", { generation, error: String(error) });
      this.contactBuffers = [];
      this.bubbleBuffer = null;
    }
  }

  private async fetchSources() {
    return Promise.all(
      [
        ...contactBank.map((filename) => ({ family: "contact" as const, filename })),
        { family: "bubble" as const, filename: bubbleSound },
      ].map(async ({ family, filename }) => {
        const response = await fetch(`${this.baseUrl}${filename}?v=${runtimeBankVersion}`);
        if (!response.ok) throw new Error(`Could not load ${filename}: ${response.status}`);
        return { family, data: await response.arrayBuffer(), filename };
      }),
    );
  }
}
