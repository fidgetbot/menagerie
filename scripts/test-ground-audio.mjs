import { webkit } from "playwright";

const root = process.env.TEST_URL ?? "http://127.0.0.1:5175/menagerie/";
const browser = await webkit.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 714 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
const errors = [];

page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  window.__menagerieAudioStarts = 0;

  class FakeNode {
    connect() { return this; }
    disconnect() {}
  }

  class FakeAudioContext {
    constructor() {
      this.destination = {};
      this.sampleRate = 44100;
      this.state = "running";
      this.startedAt = performance.now();
    }
    get currentTime() { return (performance.now() - this.startedAt) / 1000; }
    addEventListener() {}
    createBuffer() { return { warmup: true }; }
    createGain() {
      const node = new FakeNode();
      node.gain = { value: 0 };
      return node;
    }
    createBufferSource() {
      const node = new FakeNode();
      node.playbackRate = { value: 1 };
      node.addEventListener = (type, listener) => {
        if (type === "ended") node.ended = listener;
      };
      node.start = () => {
        if (node.buffer?.warmup) setTimeout(() => node.ended?.(), 0);
        else window.__menagerieAudioStarts += 1;
      };
      return node;
    }
    createStereoPanner() {
      const node = new FakeNode();
      node.pan = { value: 0 };
      return node;
    }
    async decodeAudioData() { return { decoded: true }; }
    async resume() {}
    async suspend() { this.state = "suspended"; }
    async close() { this.state = "closed"; }
  }

  Object.defineProperty(window, "AudioContext", { value: FakeAudioContext, configurable: true });
});

await page.goto(`${root}?trace=1&diagnostics=1&sequence=ram&rx=180`);
await page.waitForFunction(() => document.querySelector("#game").dataset.heldSpecies === "ram");
await page.waitForFunction(() => performance.getEntriesByType("resource")
  .filter((entry) => entry.name.includes("/audio/ceramic/")).length === 4);

const bubble = await page.locator("#rotation-bubble").evaluate((element) => ({
  x: Number(element.dataset.centerX),
  y: Number(element.dataset.centerY),
}));
await page.mouse.click(bubble.x, bubble.y);
await page.waitForFunction(() => document.querySelector("#score").classList.contains("lost"), undefined, { timeout: 12000 });
await page.waitForFunction(() => document.querySelector("#game").dataset.audioContact?.startsWith("ground:"));

const result = await page.evaluate(() => {
  const trace = JSON.parse(sessionStorage.getItem("menagerie-flight-recorder-v1"));
  return {
    contact: document.querySelector("#game").dataset.audioContact,
    groundEvents: trace.events.filter((event) => event.type === "ceramic_contact" && event.kind === "ground"),
    starts: window.__menagerieAudioStarts,
  };
});

if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
if (!result.contact.endsWith(":true")) throw new Error(`Ground contact was not played: ${result.contact}`);
if (result.groundEvents.length !== 1 || !result.groundEvents[0].played) {
  throw new Error(`Expected one played ground event: ${JSON.stringify(result.groundEvents)}`);
}
if (result.starts < 1) throw new Error("Ground contact started no audio source");

await browser.close();
console.log("Ground audio: tilted ram produces one played platform-contact event");
