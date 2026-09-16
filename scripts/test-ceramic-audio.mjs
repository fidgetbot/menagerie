import { webkit } from "playwright";

const root = process.env.TEST_URL ?? "http://127.0.0.1:5175/menagerie/";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 714 }, reducedMotion: "reduce" });
const errors = [];
const audioResponses = [];

page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.url().includes("/audio/ceramic/")) audioResponses.push(response.status());
});
await page.addInitScript(() => {
  window.__menagerieAudioStarts = 0;
  window.__menagerieWarmupStarts = 0;
  window.__menagerieAudioResumes = 0;
  window.__menagerieAudioSuspends = 0;
  window.__menagerieAudioCloses = 0;
  window.__menagerieAudioDecodes = 0;
  window.__menagerieAudioContexts = [];
  window.__menagerieVisibility = "visible";
  window.__menagerieHoldWarmupEnd = true;
  window.__menagerieHoldDecodes = true;
  window.__menageriePendingWarmups = [];
  window.__menageriePendingDecodes = [];
  window.__menagerieReleaseWarmups = () => {
    window.__menagerieHoldWarmupEnd = false;
    for (const finish of window.__menageriePendingWarmups.splice(0)) setTimeout(finish, 0);
  };
  window.__menagerieReleaseDecodes = () => {
    window.__menagerieHoldDecodes = false;
    for (const finish of window.__menageriePendingDecodes.splice(0)) finish();
  };
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => window.__menagerieVisibility,
  });
  Object.defineProperty(navigator, "audioSession", {
    value: { type: "ambient" },
    configurable: true,
  });

  class FakeNode {
    connect() { return this; }
    disconnect() {}
  }

  class FakeAudioContext {
    constructor() {
      this.destination = {};
      this.sampleRate = 44100;
      this.state = "interrupted";
      this.startedAt = performance.now();
      this.forceStall = false;
      this.stalledAt = 0;
      this.listeners = [];
      window.__menagerieAudioContexts.push(this);
    }
    get currentTime() {
      return this.forceStall ? this.stalledAt : (performance.now() - this.startedAt) / 1000;
    }
    addEventListener(type, listener) {
      if (type === "statechange") this.listeners.push(listener);
    }
    emitStateChange() {
      for (const listener of this.listeners) listener();
    }
    createBuffer() {
      return { warmup: true };
    }
    createGain() {
      const node = new FakeNode();
      node.gain = { value: 0 };
      return node;
    }
    createBufferSource() {
      const context = this;
      const node = new FakeNode();
      node.playbackRate = { value: 1 };
      node.addEventListener = (type, listener) => {
        if (type === "ended") node.ended = listener;
      };
      node.start = () => {
        if (node.buffer?.warmup) {
          window.__menagerieWarmupStarts += 1;
          const finish = () => {
            if (context.state === "running" && !context.forceStall) node.ended?.();
          };
          if (window.__menagerieHoldWarmupEnd) window.__menageriePendingWarmups.push(finish);
          else setTimeout(finish, 0);
        } else {
          window.__menagerieAudioStarts += 1;
        }
      };
      return node;
    }
    createStereoPanner() {
      const node = new FakeNode();
      node.pan = { value: 0 };
      return node;
    }
    async decodeAudioData() {
      window.__menagerieAudioDecodes += 1;
      if (window.__menagerieHoldDecodes) {
        await new Promise((resolve) => window.__menageriePendingDecodes.push(resolve));
      }
      return { decoded: true };
    }
    async resume() {
      window.__menagerieAudioResumes += 1;
      this.state = "running";
      this.emitStateChange();
    }
    async suspend() {
      window.__menagerieAudioSuspends += 1;
      this.state = "suspended";
      this.emitStateChange();
    }
    async close() {
      window.__menagerieAudioCloses += 1;
      this.state = "closed";
      this.emitStateChange();
    }
    stall() {
      this.stalledAt = this.currentTime;
      this.forceStall = true;
    }
  }
  Object.defineProperty(window, "AudioContext", { value: FakeAudioContext, configurable: true });
});

await page.goto(`${root}?diagnostics=1&species=capybara&rx=0&ry=0&rz=0`);
await page.waitForFunction(() => document.querySelector("#game").dataset.heldSpecies);
await page.waitForFunction(() => performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/audio/ceramic/")).length === 8);

// Unlock without placing the animal. iOS requires a source to start inside the
// gesture, not merely a later resume() call.
await page.mouse.click(5, 5);
await page.waitForFunction(() => window.__menagerieWarmupStarts === 1);
await page.waitForFunction(() => window.__menagerieAudioDecodes === 8);
const initialResumeCount = await page.evaluate(() => window.__menagerieAudioResumes);
if (initialResumeCount < 1) throw new Error("Interrupted AudioContext was not resumed by the first gesture");

const sessionType = await page.evaluate(() => navigator.audioSession.type);
if (sessionType !== "playback") throw new Error(`Unexpected audio session type: ${sessionType}`);

const bubble = await page.locator("#rotation-bubble").evaluate((element) => ({
  x: Number(element.dataset.centerX),
  y: Number(element.dataset.centerY),
}));
await page.mouse.click(bubble.x, bubble.y);
await page.waitForFunction(() => document.querySelector("#game").dataset.audioContact);
const queuedFirstContact = await page.locator("#game").evaluate((canvas) => ({
  contact: canvas.dataset.audioContact,
  starts: window.__menagerieAudioStarts,
}));
if (!queuedFirstContact.contact?.endsWith(":true") || queuedFirstContact.starts !== 0) {
  throw new Error(`First contact was not accepted while decode and unlock confirmation were pending: ${JSON.stringify(queuedFirstContact)}`);
}
await page.evaluate(() => window.__menagerieReleaseDecodes());
await page.waitForFunction(() => window.__menagerieAudioStarts === 1, undefined, { timeout: 5000 });
await page.evaluate(() => window.__menagerieReleaseWarmups());
await page.waitForTimeout(2500);

// Home Screen apps pass through hidden/visible frequently. The context must be
// explicitly suspended, resumed, and unlocked again by the next real gesture.
await page.evaluate(() => {
  window.__menagerieVisibility = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
});
await page.waitForFunction(() => window.__menagerieAudioSuspends === 1);
await page.evaluate(() => {
  window.__menagerieVisibility = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
});
await page.waitForFunction((before) => window.__menagerieAudioResumes > before, initialResumeCount);
await page.mouse.click(5, 5);
await page.waitForFunction(() => window.__menagerieWarmupStarts === 3);

// WebKit can claim a context is running while its clock is frozen. Foreground
// recovery probes that clock; the following gesture must replace the context
// and decode the cached bytes without fetching the bank again.
await page.evaluate(() => {
  window.__menagerieAudioContexts[0].stall();
  dispatchEvent(new Event("pageshow"));
});
await page.waitForTimeout(450);
await page.mouse.click(5, 5);
await page.waitForFunction(() => window.__menagerieAudioContexts.length === 2);
await page.waitForFunction(() => window.__menagerieWarmupStarts === 4);
await page.waitForFunction(() => window.__menagerieAudioDecodes === 16);

const lifecycle = await page.evaluate(() => ({
  contexts: window.__menagerieAudioContexts.length,
  closes: window.__menagerieAudioCloses,
  starts: window.__menagerieAudioStarts,
}));
const contact = await page.locator("#game").evaluate((canvas) => canvas.dataset.audioContact);
if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
if (audioResponses.length !== 8 || audioResponses.some((status) => status !== 200)) {
  throw new Error(`Runtime bank did not preload cleanly: ${audioResponses.join(",")}`);
}
if (lifecycle.contexts !== 2 || lifecycle.closes !== 1) {
  throw new Error(`Stalled context was not replaced exactly once: ${JSON.stringify(lifecycle)}`);
}
if (contact ? lifecycle.starts !== 1 : lifecycle.starts < 1) {
  throw new Error(contact ? `Resting contact produced ${lifecycle.starts} sounds instead of one` : "Live contact produced no sound");
}
if (contact && (!contact.startsWith("settling:") || !contact.endsWith(":true"))) {
  throw new Error(`Unexpected contact classification: ${contact}`);
}

await browser.close();
console.log("Ceramic audio lifecycle: first contact survives pending unlock/decode, background recovery and stale-context replacement verified");
