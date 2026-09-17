import { webkit } from "playwright";
import fs from "node:fs/promises";

await fs.mkdir("tmp", { recursive: true });
const root = process.env.TEST_URL ?? "http://127.0.0.1:5175/menagerie/";
const browser = await webkit.launch();
const assert = (value, message) => { if (!value) throw Error(message); };

for (const mobile of [true, false]) {
  const viewport = mobile ? { width: 390, height: 714 } : { width: 1000, height: 800 };
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    class FakeNode {
      connect() { return this; }
      disconnect() {}
      addEventListener(type, listener) { if (type === "ended") this.ended = listener; }
      start() { setTimeout(() => this.ended?.(), 0); }
    }
    class FakeAudioContext {
      constructor() {
        this.state = "running";
        this.destination = {};
        this.sampleRate = 44100;
      }
      get currentTime() { return performance.now() / 1000; }
      addEventListener() {}
      createBuffer() { return {}; }
      createBufferSource() {
        const node = new FakeNode();
        node.playbackRate = { value: 1 };
        return node;
      }
      createGain() {
        const node = new FakeNode();
        node.gain = { value: 0 };
        return node;
      }
      createStereoPanner() {
        const node = new FakeNode();
        node.pan = { value: 0 };
        return node;
      }
      async decodeAudioData() { return {}; }
      async resume() { this.state = "running"; }
      async suspend() { this.state = "suspended"; }
      async close() { this.state = "closed"; }
    }
    Object.defineProperty(window, "AudioContext", { value: FakeAudioContext, configurable: true });
    try {
      if (!sessionStorage.getItem("menagerie-hud-test-initialized")) {
        localStorage.removeItem("menagerie-sound-v1");
        localStorage.removeItem("menagerie-bubble-loops-v1");
        sessionStorage.setItem("menagerie-hud-test-initialized", "1");
      }
    } catch { /* The target origin will run this again after about:blank. */ }
  });

  const url = `${root}?diagnostics=1&species=skunk&rx=0&ry=0&rz=0`;
  await page.goto(url);
  await page.waitForSelector('canvas[data-held-species="skunk"]');
  await page.waitForTimeout(180);

  const sound = page.locator("#sound-toggle");
  const score = page.locator("#score");
  const loops = page.locator("#loops-toggle");
  const [soundBox, scoreBox, loopsBox] = await Promise.all([
    sound.boundingBox(), score.boundingBox(), loops.boundingBox(),
  ]);
  assert(soundBox && scoreBox && loopsBox, "HUD controls were not rendered");
  for (const [name, box] of [["sound", soundBox], ["loops", loopsBox]]) {
    assert(Math.abs(box.width - 54) < 0.5 && Math.abs(box.height - 54) < 0.5, `${name} control was not 54 px circular`);
  }
  assert(Math.abs(scoreBox.width - 54) < 0.5 && Math.abs(scoreBox.height - 54) < 0.5, "Score did not retain its centered HUD area");
  assert(Math.abs(scoreBox.x + scoreBox.width / 2 - viewport.width / 2) < 0.5, "Score was not horizontally centered");
  assert(soundBox.x < scoreBox.x && loopsBox.x > scoreBox.x, "Toggles did not flank the score");
  assert(soundBox.x <= 17 && loopsBox.x + loopsBox.width >= viewport.width - 17, "Toggles did not reach the safe-area edges");
  assert(Math.abs(soundBox.y - scoreBox.y) < 0.5 && Math.abs(loopsBox.y - scoreBox.y) < 0.5, "HUD controls were not top-aligned");
  const scoreStyle = await score.evaluate((element) => ({
    border: parseFloat(getComputedStyle(element).borderTopWidth),
    background: getComputedStyle(element).backgroundColor,
  }));
  assert(scoreStyle.border === 0 && scoreStyle.background === "rgba(0, 0, 0, 0)", "Score still had a visible circle");
  assert(await sound.getAttribute("aria-pressed") === "true", "Sound did not default on");
  assert(await loops.getAttribute("aria-pressed") === "false", "Bubble loops did not default off");
  const loopGlyph = await loops.locator("svg").innerHTML();
  const replayStyle = await page.locator("#drop").evaluate((element) => {
    const button = getComputedStyle(element);
    const icon = getComputedStyle(element.querySelector("path"));
    return {
      borderColor: button.borderTopColor,
      background: button.backgroundColor,
      color: button.color,
      radius: button.borderRadius,
      fill: icon.fill,
      stroke: icon.stroke,
    };
  });
  const soundStyle = await sound.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderColor: style.borderTopColor,
      background: style.backgroundColor,
      color: style.color,
      radius: style.borderRadius,
    };
  });
  assert(replayStyle.fill === "none" && replayStyle.stroke !== "none", "Replay icon was not a thin-stroke loop arrow");
  assert(replayStyle.borderColor === soundStyle.borderColor
    && replayStyle.background === soundStyle.background
    && replayStyle.color === soundStyle.color
    && replayStyle.radius === soundStyle.radius, "Replay button did not match the new controls");
  const tapControl = (box) => mobile
    ? page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    : page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const beforeToggle = await page.locator("#game").getAttribute("data-held-quaternion");
  await tapControl(loopsBox);
  assert(await loops.getAttribute("aria-pressed") === "true", "Bubble-loop button did not turn on");
  assert(await loops.locator("svg").innerHTML() === loopGlyph, "Bubble-loop glyph changed between off and on states");
  assert(await page.locator("#rotation-bubble").getAttribute("data-loops-enabled") === "true", "Loop renderer did not receive the live setting");
  assert(await page.evaluate(() => localStorage.getItem("menagerie-bubble-loops-v1")) === "1", "Loop preference was not saved");
  assert(await page.locator("#game").getAttribute("data-held-quaternion") === beforeToggle, "Loop button changed the held piece");

  const geometry = await page.locator("#rotation-bubble").evaluate((element) => ({
    x: Number(element.dataset.centerX),
    y: Number(element.dataset.centerY),
    r: Number(element.dataset.radius),
  }));
  await page.mouse.move(geometry.x, geometry.y);
  await page.mouse.down();
  await page.mouse.move(geometry.x + geometry.r * 0.38, geometry.y - geometry.r * 0.22);
  await page.waitForTimeout(60);
  const loopOpacity = Number(await page.locator(".bubble-loops").evaluate((element) => getComputedStyle(element).opacity));
  assert(loopOpacity > 0.5, "Newly enabled bubble loops did not appear during rotation");
  await page.mouse.up();

  await tapControl(soundBox);
  assert(await sound.getAttribute("aria-pressed") === "false", "Sound button did not turn off");
  assert(await page.evaluate(() => localStorage.getItem("menagerie-sound-v1")) === "0", "Sound preference was not saved");
  assert(await page.locator("#game").getAttribute("data-sound-enabled") === "false", "Sound state was not exposed to diagnostics");
  const latestGeometry = await page.locator("#rotation-bubble").evaluate((element) => ({
    x: Number(element.dataset.centerX),
    y: Number(element.dataset.centerY),
  }));
  await page.mouse.click(latestGeometry.x, latestGeometry.y);
  await page.waitForFunction(() => document.querySelector("#game").dataset.audioBubblePop === "false");

  await page.screenshot({ path: `tmp/hud-controls-${mobile ? "phone" : "desktop"}.png` });
  await page.reload();
  await page.waitForSelector('canvas[data-held-species="skunk"]');
  assert(await sound.getAttribute("aria-pressed") === "false", "Sound preference did not survive reload");
  assert(await loops.getAttribute("aria-pressed") === "true", "Loop preference did not survive reload");
  await tapControl(soundBox);
  assert(await sound.getAttribute("aria-pressed") === "true", "Sound could not be turned back on");
  assert(await page.evaluate(() => localStorage.getItem("menagerie-sound-v1")) === "1", "Re-enabled sound preference was not saved");

  await page.goto(`${root}?diagnostics=1&sequence=ram&rx=180`);
  await page.waitForSelector('canvas[data-held-species="ram"]');
  const lossGeometry = await page.locator("#rotation-bubble").evaluate((element) => ({
    x: Number(element.dataset.centerX),
    y: Number(element.dataset.centerY),
  }));
  await page.mouse.click(lossGeometry.x, lossGeometry.y);
  await page.waitForFunction(() => !document.querySelector("#drop").hidden, undefined, { timeout: 12000 });
  const replayBox = await page.locator("#drop").boundingBox();
  assert(replayBox && Math.abs(replayBox.width - 54) < 0.5 && Math.abs(replayBox.height - 54) < 0.5, "Visible replay button did not match the HUD controls");
  await page.screenshot({ path: `tmp/hud-replay-${mobile ? "phone" : "desktop"}.png` });
  await tapControl(replayBox);
  await page.waitForFunction(() => document.querySelector("#game").dataset.heldSpecies);
  assert(await page.locator("#drop").isHidden(), "Replay button remained visible after reset");
  assert(await page.locator("#score").textContent() === "0", "Replay did not reset the score");
  assert(!errors.length, errors.join(", "));
  await page.close();
  console.log(`${mobile ? "Phone" : "Desktop"}: HUD layout, stable loop glyph, matching replay, mute, and persisted preferences passed`);
}

await browser.close();
