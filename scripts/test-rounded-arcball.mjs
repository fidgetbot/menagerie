import { webkit } from "playwright";
import { Quaternion, Vector3 } from "three";
import fs from "node:fs/promises";

await fs.mkdir("tmp", { recursive: true });
const browser = await webkit.launch();
const assert = (value, message) => { if (!value) throw Error(message); };
const quaternionDistance = (a, b) => Math.min(
  Math.hypot(...a.map((value, index) => value - b[index])),
  Math.hypot(...a.map((value, index) => value + b[index])),
);
const vectorDistance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const root = process.env.TEST_URL ?? "http://127.0.0.1:5175/menagerie/";

async function runVariant(mobile, bubble) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 714 } : { width: 1000, height: 800 },
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${root}?trace=1&diagnostics=1&species=skunk&rx=0&ry=0&rz=0&bubble=${bubble ? 1 : 0}`);
  await page.waitForSelector('canvas[data-held-species="skunk"]');
  await page.waitForTimeout(300);

  const trace = () => page.evaluate(() => {
    dispatchEvent(new Event("pagehide"));
    return JSON.parse(sessionStorage.getItem("menagerie-flight-recorder-v1"));
  });
  const held = async () => {
    await page.waitForTimeout(35);
    return page.locator("#game").evaluate((canvas) => ({
      p: canvas.dataset.heldPosition.split(",").map(Number),
      v: canvas.dataset.heldAnchorPosition.split(",").map(Number),
      q: canvas.dataset.heldQuaternion.split(",").map(Number),
    }));
  };
  const geometry = () => page.locator("#rotation-bubble").evaluate((element) => ({
    x: Number(element.dataset.centerX),
    y: Number(element.dataset.centerY),
    r: Number(element.dataset.radius),
    active: element.dataset.active === "true",
    hidden: element.hidden,
    opacity: Number(getComputedStyle(element).opacity),
  }));
  const move = (x, y) => page.mouse.move(x, y);
  const center = await geometry();
  assert(center.hidden === !bubble, "Bubble parameter did not control availability");
  assert(center.active === false, "Bubble started active");

  // Outside the rounded shoulder, a quarter-circle gesture is a pure 90°
  // twist around the camera view direction.
  const rollRadius = center.r * 1.10;
  await move(center.x + rollRadius, center.y);
  await page.mouse.down();
  const rollStart = await held();
  const frozenAnchor = rollStart.v;
  if (bubble) {
    await page.waitForTimeout(160);
    const activeBubble = await geometry();
    assert(activeBubble.active && activeBubble.opacity > 0.5, "Bubble did not fade in during rotation");
    await page.screenshot({ path: `tmp/rounded-arcball-active-${mobile ? "phone" : "desktop"}.png` });
  }
  for (let index = 1; index <= 12; index += 1) {
    const angle = index * Math.PI / 24;
    await move(center.x + rollRadius * Math.cos(angle), center.y + rollRadius * Math.sin(angle));
  }
  const rollEnd = await held();
  assert(vectorDistance(frozenAnchor, rollEnd.v) < 0.001, "Held anchor drifted during rotation");
  assert(vectorDistance(rollStart.p, rollEnd.p) < 0.001, "Body origin drifted during rotation");
  const delta = new Quaternion(...rollEnd.q).multiply(new Quaternion(...rollStart.q).invert());
  const axis = new Vector3(delta.x, delta.y, delta.z).normalize();
  const view = new Vector3(6.9, -12.35, 6).normalize();
  const angle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
  assert(Math.abs(axis.dot(view)) > 0.998, `Outer sweep tipped instead of twisting: axis=${axis.toArray()} dot=${axis.dot(view)}`);
  assert(Math.abs(angle - Math.PI / 2) < 0.025, `Outer sweep was not 1:1: ${angle}`);
  await page.mouse.up();
  await page.waitForTimeout(170);
  if (bubble) assert((await geometry()).opacity < 0.05, "Bubble did not fade out after release");

  // A central gesture tumbles, and returning to its origin exactly undoes it.
  const current = await geometry();
  await move(current.x, current.y);
  await page.mouse.down();
  const tumbleStart = await held();
  await move(current.x + current.r * 0.42, current.y - current.r * 0.25);
  assert(quaternionDistance(tumbleStart.q, (await held()).q) > 0.05, "Central drag did not tumble");
  await move(current.x, current.y);
  assert(quaternionDistance(tumbleStart.q, (await held()).q) < 0.001, "Returning did not undo the drag");
  await page.mouse.up();

  // Crossing the sphere shoulder changes response continuously rather than
  // selecting a hidden mode. Equal radial steps must not create a jump.
  await move(current.x, current.y);
  await page.mouse.down();
  let previous = (await held()).q;
  const boundarySteps = [];
  for (const radius of [0.62, 0.68, 0.74, 0.80, 0.86, 0.92, 0.98, 1.04, 1.10]) {
    await move(current.x + current.r * radius, current.y - current.r * radius * 0.16);
    const next = (await held()).q;
    boundarySteps.push(quaternionDistance(previous, next));
    previous = next;
  }
  // The first sample includes the intentional jump from the centre to the
  // start of the measured band; only adjacent shoulder steps are comparable.
  assert(Math.max(...boundarySteps.slice(1)) < 0.13, `Abrupt shoulder response: ${boundarySteps}`);
  await page.mouse.up();

  // A quick drag leaves only gentle momentum; touching catches it.
  await move(current.x, current.y);
  await page.mouse.down();
  await move(current.x + 44, current.y + 18);
  await page.mouse.up();
  const flick = await held();
  await page.waitForTimeout(120);
  const afterFlick = await held();
  assert(quaternionDistance(flick.q, afterFlick.q) > 0.0005, "No gentle flick");
  assert(vectorDistance(flick.v, afterFlick.v) < 0.001, "Held anchor moved during momentum");
  assert(vectorDistance(flick.p, afterFlick.p) < 0.001, "Body origin moved during momentum");
  if (mobile) await page.touchscreen.tap(current.x, current.y);
  else { await page.mouse.down(); await page.mouse.up(); }
  const caught = await held();
  await page.waitForTimeout(140);
  assert(quaternionDistance(caught.q, (await held()).q) < 0.001, "Touch did not catch momentum");

  // Interruptions cancel both the visual feedback and residual motion without
  // placing the held animal.
  await move(current.x, current.y);
  await page.mouse.down();
  await move(current.x + 24, current.y + 12);
  await page.evaluate(() => dispatchEvent(new Event("blur")));
  await page.mouse.up();
  const cancelled = await held();
  await page.waitForTimeout(140);
  assert(quaternionDistance(cancelled.q, (await held()).q) < 0.001, "Cancellation kept rotating");
  assert(!(await geometry()).active, "Cancellation left the bubble active");
  assert(!(await trace()).events.some((event) => event.type === "released"), "Pointer lift or cancellation dropped the animal");

  await page.screenshot({ path: `tmp/rounded-arcball-${mobile ? "phone" : "desktop"}-${bubble ? "bubble" : "plain"}.png` });
  const beforeDrop = await held();
  await page.locator("#drop").click();
  assert(!(await geometry()).active, "Bubble remained active after Drop");
  const finalTrace = await trace();
  const released = finalTrace.events.filter((event) => event.type === "released").at(-1);
  assert(quaternionDistance(beforeDrop.q, released.rotation) < 0.0002, "Drop changed orientation");
  assert(!errors.length, errors.join(", "));
  await page.close();
  return rollEnd.q;
}

for (const mobile of [true, false]) {
  const plain = await runVariant(mobile, false);
  const bubble = await runVariant(mobile, true);
  // Browser pointer coordinates are quantized to device pixels; allow a
  // sub-degree difference while still proving the overlay has no control path.
  assert(quaternionDistance(plain, bubble) < 0.004, `Bubble changed the rotation mapping: ${quaternionDistance(plain, bubble)} plain=${plain} bubble=${bubble}`);
  console.log(`${mobile ? "Phone" : "Desktop"}: rounded tumble/roll, smooth shoulder, stable pivot, undo, flick, catch, Drop, and bubble A/B passed`);
}

await browser.close();
