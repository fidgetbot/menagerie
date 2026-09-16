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
  class FakeNode {
    connect() { return this; }
  }
  class FakeAudioContext {
    constructor() {
      this.destination = {};
      this.state = "running";
      this.startedAt = performance.now();
    }
    get currentTime() { return (performance.now() - this.startedAt) / 1000; }
    createGain() {
      const node = new FakeNode();
      node.gain = { value: 0 };
      return node;
    }
    createBufferSource() {
      const node = new FakeNode();
      node.playbackRate = { value: 1 };
      node.start = () => { window.__menagerieAudioStarts += 1; };
      return node;
    }
    createStereoPanner() {
      const node = new FakeNode();
      node.pan = { value: 0 };
      return node;
    }
    async decodeAudioData() { return {}; }
    async resume() { this.state = "running"; }
  }
  Object.defineProperty(window, "AudioContext", { value: FakeAudioContext, configurable: true });
});

await page.goto(`${root}?diagnostics=1&species=capybara&rx=0&ry=0&rz=0`);
await page.waitForFunction(() => document.querySelector("#game").dataset.heldSpecies);
await page.waitForFunction(() => performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/audio/ceramic/")).length === 8);
const bubble = await page.locator("#rotation-bubble").evaluate((element) => ({
  x: Number(element.dataset.centerX),
  y: Number(element.dataset.centerY),
}));
await page.mouse.click(bubble.x, bubble.y);
await page.waitForFunction(() => window.__menagerieAudioStarts === 1);
await page.waitForTimeout(2500);

const starts = await page.evaluate(() => window.__menagerieAudioStarts);
const contact = await page.locator("#game").evaluate((canvas) => canvas.dataset.audioContact);
if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
if (audioResponses.length !== 8 || audioResponses.some((status) => status !== 200)) {
  throw new Error(`Runtime bank did not preload cleanly: ${audioResponses.join(",")}`);
}
if (contact ? starts !== 1 : starts < 1) {
  throw new Error(contact ? `Resting contact produced ${starts} sounds instead of one` : "Live contact produced no sound");
}
if (contact && (!contact.startsWith("settling:") || !contact.endsWith(":true"))) {
  throw new Error(`Unexpected contact classification: ${contact}`);
}

await browser.close();
console.log("Ceramic runtime bank: 8 assets loaded, contact played once, resting chatter suppressed");
