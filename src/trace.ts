export class FlightRecorder {
  private static readonly storageKey = "menagerie-flight-recorder-v1";
  readonly enabled: boolean;
  private readonly startedAt = performance.now();
  private readonly samples: unknown[] = [];
  private readonly events: unknown[] = [];
  private lastSampleAt = -Infinity;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) return;
    try {
      const recovered = JSON.parse(sessionStorage.getItem(FlightRecorder.storageKey) ?? "null");
      if (Array.isArray(recovered?.events)) this.events.push(...recovered.events.slice(-300));
      if (Array.isArray(recovered?.samples)) this.samples.push(...recovered.samples.slice(-1200));
      if (recovered) this.event("trace_recovered_after_reload");
    } catch {
      sessionStorage.removeItem(FlightRecorder.storageKey);
    }
    addEventListener("pagehide", () => this.persist());
  }

  event(type: string, data: Record<string, unknown> = {}) {
    if (!this.enabled) return;
    this.events.push({ t: this.time(), type, ...data });
    if (this.events.length > 300) this.events.shift();
    if (["upward_anomaly", "frame_exception", "game_over"].includes(type)) this.persist();
  }

  sample(data: Record<string, unknown>) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastSampleAt < 50) return;
    this.lastSampleAt = now;
    this.samples.push({ t: this.time(now), ...data });
    if (this.samples.length > 1200) this.samples.shift();
  }

  async share() {
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const filename = `menagerie-trace-${timestamp}.json`;
    const report = {
      format: "menagerie-flight-recorder-v1",
      capturedAt: new Date().toISOString(),
      page: location.href,
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
      resources: performance.getEntriesByType("resource").map((entry) => entry.name).filter((name) => /\/assets\//.test(name)),
      events: this.events,
      samples: this.samples,
    };
    const file = new File([JSON.stringify(report)], filename, { type: "application/json" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "Menagerie physics trace", files: [file] });
      sessionStorage.removeItem(FlightRecorder.storageKey);
      return "shared";
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    sessionStorage.removeItem(FlightRecorder.storageKey);
    return "downloaded";
  }

  snapshot() {
    return { events: this.events.length, samples: this.samples.length };
  }

  private time(now = performance.now()) {
    return Math.round(now - this.startedAt);
  }

  private persist() {
    if (!this.enabled) return;
    try {
      sessionStorage.setItem(FlightRecorder.storageKey, JSON.stringify({ events: this.events, samples: this.samples }));
    } catch {
      // The live recorder still remains shareable if browser storage is full.
    }
  }
}
