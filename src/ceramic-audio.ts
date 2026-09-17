type ContactKind = "settling" | "body" | "ground";

type EncodedSound = { data: ArrayBuffer; filename: string };
type AudioTrace = (event: string, detail?: Record<string, unknown>) => void;
type RecoverableAudioContext = AudioContext & { readonly state: AudioContextState | "interrupted" };
type PendingContact = { kind: ContactKind; strength: number; pan: number; queuedAt: number };
const runtimeBankVersion = "muted-stoneware-v2";
const clockProbeDelayMs = 300;
const pendingContactMaxDelayMs = 1000;

const bank = [
  "stoneware_contact__seed-216001.wav",
  "stoneware_contact__seed-216002.wav",
  "stoneware_contact__seed-216003.wav",
  "stoneware_contact__seed-216004.wav",
];

const treatment: Record<ContactKind, {
  rate: number;
  rateSpread: number;
  minimumGain: number;
  maximumGain: number;
}> = {
  settling: { rate: 1.04, rateSpread: 0.05, minimumGain: 0.08, maximumGain: 0.18 },
  body: { rate: 0.98, rateSpread: 0.07, minimumGain: 0.13, maximumGain: 0.32 },
  ground: { rate: 0.86, rateSpread: 0.05, minimumGain: 0.20, maximumGain: 0.44 },
};

const AudioContextConstructor = window.AudioContext
  ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type: string };
};

export class CeramicAudio {
  private context: RecoverableAudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: AudioBuffer[] = [];
  private readonly sourceData: Promise<EncodedSound[]>;
  private sequence: Record<ContactKind, number> = { settling: 0, body: 0, ground: 0 };
  private lastPlayedAt = -Infinity;
  private unlocked = false;
  private backgrounded = false;
  private recreateOnNextGesture = false;
  private generation = 0;
  private clockProbeTimer: number | undefined;
  private pendingContact: PendingContact | null = null;
  private resumePendingContext: RecoverableAudioContext | null = null;
  private unlockPulseContext: RecoverableAudioContext | null = null;

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

  suspendForBackground() {
    if (!this.enabled) return;
    this.backgrounded = true;
    this.unlocked = false;
    this.pendingContact = null;
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
    const context = this.context;
    const master = this.master;
    const choices = this.buffers;
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

  private playReady(
    context: RecoverableAudioContext,
    master: GainNode,
    kind: ContactKind,
    strength: number,
    pan: number,
    queuedForMs = 0,
  ) {
    const choices = this.buffers;
    if (context.currentTime - this.lastPlayedAt < 0.045) return false;

    const index = this.sequence[kind]++ % choices.length;
    const source = context.createBufferSource();
    source.buffer = choices[index];
    const voice = treatment[kind];
    source.playbackRate.value = voice.rate + (Math.random() - 0.5) * voice.rateSpread;

    const gain = context.createGain();
    const shapedStrength = Math.sqrt(Math.min(1, Math.max(0, strength)));
    gain.gain.value = voice.minimumGain + shapedStrength * (voice.maximumGain - voice.minimumGain);

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
    });
    return true;
  }

  reset() {
    this.lastPlayedAt = -Infinity;
    this.pendingContact = null;
  }

  private createContext(reason: string) {
    const context = new (AudioContextConstructor as typeof AudioContext)() as RecoverableAudioContext;
    const generation = ++this.generation;
    this.context = context;
    this.unlocked = false;
    this.recreateOnNextGesture = false;
    this.buffers = [];
    this.master = context.createGain();
    this.master.gain.value = 0.72;
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
    this.buffers = [];
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
        this.flushPendingContact();
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
      this.flushPendingContact();
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
      this.flushPendingContact();
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
      buffers: this.buffers.length,
    });
  }

  private flushPendingContact() {
    const pending = this.pendingContact;
    const context = this.context;
    const master = this.master;
    if (!pending || !context || !master || context.state !== "running" || this.buffers.length === 0) return;
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
      const entries = await Promise.all((await this.sourceData).map(async ({ data }) => (
        context.decodeAudioData(data.slice(0))
      )));
      if (context !== this.context || generation !== this.generation) return;
      this.buffers = entries;
      this.trace("buffers_ready", { generation, count: entries.length });
      this.flushPendingContact();
    } catch (error) {
      if (context !== this.context || generation !== this.generation) return;
      console.warn("Ceramic audio could not be loaded", error);
      this.trace("decode_failed", { generation, error: String(error) });
      this.buffers = [];
    }
  }

  private async fetchSources() {
    return Promise.all(
      bank.map(async (filename) => {
        const response = await fetch(`${this.baseUrl}${filename}?v=${runtimeBankVersion}`);
        if (!response.ok) throw new Error(`Could not load ${filename}: ${response.status}`);
        return { data: await response.arrayBuffer(), filename };
      }),
    );
  }
}
