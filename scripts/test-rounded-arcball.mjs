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
  await page.goto(`${root}?audio=0&trace=1&diagnostics=1&species=skunk&rx=0&ry=0&rz=0&bubble=${bubble ? 1 : 0}`);
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
    held: element.classList.contains("held"),
    popping: element.classList.contains("popping"),
  }));
  const move = (x, y) => page.mouse.move(x, y);
  const center = await geometry();
  assert(center.hidden === !bubble, "Bubble parameter did not control availability");
  assert(center.active === false, "Bubble started active");
  if (bubble) {
    assert(center.held && center.opacity > 0.5, "Bubble was not visible around the waiting animal");
  }

  // A gesture that begins outside the bubble must remain inert even if it
  // later crosses into the control surface.
  const beforeOutsideTouch = await held();
  await move(center.x + center.r + 6, center.y);
  await page.mouse.down();
  await move(center.x + center.r * 0.45, center.y - center.r * 0.2);
  await page.waitForTimeout(35);
  assert(!(await geometry()).active, "A press outside the bubble activated rotation");
  assert(quaternionDistance(beforeOutsideTouch.q, (await held()).q) < 0.001, "A press outside the bubble steered the animal");
  await page.mouse.up();

  // A quarter-circle gesture beginning at the visible edge is predominantly
  // twist around the camera view direction while remaining admissible.
  const rollRadius = center.r;
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
  assert(Math.abs(axis.dot(view)) > 0.98, `Outer sweep tipped instead of twisting: axis=${axis.toArray()} dot=${axis.dot(view)}`);
  assert(Math.abs(angle - Math.PI / 2) < 0.04, `Edge sweep was not approximately 1:1: ${angle}`);
  await page.mouse.up();
  await page.waitForTimeout(170);
  if (bubble) assert((await geometry()).opacity > 0.5, "Bubble disappeared before it was popped");

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
  await move(current.x, current.y);
  await page.mouse.down();
  await page.waitForTimeout(320);
  await page.mouse.up();
  const caught = await held();
  await page.waitForTimeout(140);
  assert(quaternionDistance(caught.q, (await held()).q) < 0.001, "Hold did not catch momentum");
  assert(!(await trace()).events.some((event) => event.type === "released"), "A deliberate hold popped the bubble");

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
  assert(await page.locator("#drop").isHidden(), "Play-again button was visible during play");
  if (mobile) await page.touchscreen.tap(current.x, current.y);
  else {
    await move(current.x, current.y);
    await page.mouse.down();
    await page.mouse.up();
  }
  if (bubble) assert((await geometry()).popping || !(await geometry()).held, "Quick tap did not start the pop transition");
  await page.waitForFunction(() => !document.querySelector("#game").dataset.heldSpecies);
  assert(!(await geometry()).active, "Bubble remained active after popping");
  const finalTrace = await trace();
  const released = finalTrace.events.filter((event) => event.type === "released").at(-1);
  assert(finalTrace.events.some((event) => event.type === "bubble_popped"), "Pop event was not recorded");
  assert(quaternionDistance(beforeDrop.q, released.rotation) < 0.0002, "Popping changed orientation");
  assert(!errors.length, errors.join(", "));
  await page.close();
  return rollEnd.q;
}

for (const mobile of [true, false]) {
  const plain = await runVariant(mobile, false);
  const bubble = await runVariant(mobile, true);
  // Browser pointer coordinates are quantized to device pixels; allow a small
  // near-edge difference while still proving the overlay has no control path.
  assert(quaternionDistance(plain, bubble) < 0.012, `Bubble changed the rotation mapping: ${quaternionDistance(plain, bubble)} plain=${plain} bubble=${bubble}`);
  console.log(`${mobile ? "Phone" : "Desktop"}: rounded tumble/roll, smooth shoulder, stable pivot, undo, flick, hold-to-catch, tap-to-pop, and bubble A/B passed`);
}

async function verifySurfaceLoops(mobile) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 714 } : { width: 1000, height: 800 },
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${root}?audio=0&diagnostics=1&species=skunk&rx=0&ry=0&rz=0&loops=1`);
  await page.waitForSelector('canvas[data-held-species="skunk"]');
  await page.waitForTimeout(200);

  const bubble = page.locator("#rotation-bubble");
  const loops = bubble.locator(".bubble-loops");
  const geometry = await bubble.evaluate((element) => ({
    x: Number(element.dataset.centerX),
    y: Number(element.dataset.centerY),
    r: Number(element.dataset.radius),
    enabled: element.dataset.loopsEnabled === "true",
  }));
  assert(geometry.enabled, "Loop study URL did not enable the surface overlay");
  assert(Number(await loops.evaluate((element) => getComputedStyle(element).opacity)) === 0, "Surface loops were visible before touch");

  const pathsBefore = await bubble.locator(".bubble-loop").evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
  assert(pathsBefore.length === 6 && pathsBefore.every(Boolean), "Surface loops were not projected into near/far arcs");
  const radii = pathsBefore.flatMap((path) => [...path.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)]
    .map((match) => Math.hypot(Number(match[1]) - 100, Number(match[2]) - 100)));
  assert(Math.max(...radii) <= 98.4, "A loop escaped the bubble surface");
  assert(Math.max(...radii) >= 98.1, "Projected great circles did not meet the bubble silhouette");

  await page.mouse.move(geometry.x, geometry.y);
  await page.mouse.down();
  await page.waitForTimeout(320);
  assert(Number(await loops.evaluate((element) => getComputedStyle(element).opacity)) === 0, "Stationary hold revealed rotation loops");
  await page.mouse.move(geometry.x + 8, geometry.y);
  await page.waitForTimeout(30);
  assert(Number(await loops.evaluate((element) => getComputedStyle(element).opacity)) === 0, "Sub-threshold tap movement revealed rotation loops");
  await page.mouse.move(geometry.x + geometry.r * 0.38, geometry.y - geometry.r * 0.22);
  await page.waitForTimeout(50);
  assert(Number(await loops.evaluate((element) => getComputedStyle(element).opacity)) > 0.5, "Surface loops did not appear after rotation intent");
  const pathsAfter = await bubble.locator(".bubble-loop").evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
  assert(pathsAfter.some((path, index) => path !== pathsBefore[index]), "Surface loops did not follow the animal orientation");
  await page.screenshot({ path: `tmp/rounded-arcball-loops-${mobile ? "phone" : "desktop"}.png` });
  await page.mouse.up();
  await page.waitForTimeout(30);
  assert(Number(await loops.evaluate((element) => getComputedStyle(element).opacity)) === 0, "Surface loops did not disappear after touch");

  await page.mouse.move(geometry.x, geometry.y);
  await page.mouse.down();
  await page.waitForTimeout(60);
  assert(Number(await loops.evaluate((element) => getComputedStyle(element).opacity)) === 0, "Quick tap flashed rotation loops before pop");
  await page.mouse.up();
  assert(!errors.length, errors.join(", "));
  await page.close();
  console.log(`${mobile ? "Phone" : "Desktop"}: URL-gated great-circle surface loops passed`);
}

for (const mobile of [true, false]) await verifySurfaceLoops(mobile);

async function verifyTowerExploration(mobile) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 714 } : { width: 1000, height: 800 },
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${root}?audio=0&diagnostics=1&species=skunk&rx=0&ry=0&rz=0`);
  await page.waitForSelector('canvas[data-held-species="skunk"]');
  await page.waitForTimeout(200);

  const bubble = page.locator("#rotation-bubble");
  const geometry = () => bubble.evaluate((element) => ({
    x: Number(element.dataset.centerX),
    y: Number(element.dataset.centerY),
    r: Number(element.dataset.radius),
    opacity: Number(getComputedStyle(element).opacity),
  }));
  const state = () => page.locator("#game").evaluate((canvas) => ({
    phase: canvas.dataset.cameraExplorePhase,
    yaw: Number(canvas.dataset.cameraExploreYaw),
    height: Number(canvas.dataset.cameraExploreHeight),
    cameraHeight: Number(canvas.dataset.cameraHeight),
    pointerMode: canvas.dataset.pointerMode,
    q: canvas.dataset.heldQuaternion.split(",").map(Number),
    species: canvas.dataset.heldSpecies,
  }));

  // The moat below the bubble is deliberately inert.
  let current = await geometry();
  const beforeMoat = await state();
  await page.mouse.move(current.x, current.y + current.r + 10);
  await page.mouse.down();
  await page.mouse.move(current.x + 60, current.y + current.r + 35);
  await page.mouse.up();
  await page.waitForTimeout(60);
  const afterMoat = await state();
  assert(afterMoat.phase === "idle", "The bubble safety margin started camera exploration");
  assert(quaternionDistance(beforeMoat.q, afterMoat.q) < 0.001, "The bubble safety margin rotated the animal");

  // Below the moat, a diagonal drag orbits and raises the view without
  // touching the animal. Releasing it leaves a short, damped glide.
  current = await geometry();
  await page.mouse.move(current.x, current.y + current.r + 32);
  await page.mouse.down();
  const beforeExplore = await state();
  await page.mouse.move(current.x + 80, current.y + current.r + 102, { steps: 3 });
  await page.waitForTimeout(30);
  const duringExplore = await state();
  assert(duringExplore.phase === "dragging" && duringExplore.pointerMode === "explore", "Below-bubble drag did not own camera exploration");
  assert(Math.abs(duringExplore.yaw) > 0.2, `Horizontal exploration did not orbit: ${duringExplore.yaw}`);
  assert(duringExplore.height > 0.35, `Dragging downward did not raise the camera: ${duringExplore.height}`);
  assert(quaternionDistance(beforeExplore.q, duringExplore.q) < 0.001, "Camera exploration rotated the held animal");
  assert((await geometry()).opacity < 0.05, "Bubble did not fade out while camera exploration owned input");
  await page.screenshot({ path: `tmp/tower-exploration-${mobile ? "phone" : "desktop"}.png` });
  await page.mouse.up();
  await page.waitForTimeout(35);
  const released = await state();
  assert(released.phase === "momentum", `Exploration did not keep gentle momentum: ${released.phase}`);
  await page.waitForTimeout(140);
  const afterMomentum = await state();
  assert(Math.abs(afterMomentum.yaw - released.yaw) > 0.005 || Math.abs(afterMomentum.height - released.height) > 0.01, "Exploration stopped dead on release");
  await page.waitForTimeout(520);
  assert((await state()).phase === "dwell", "Exploration did not settle into its inspection pause");

  // The sphere is softly locked while the view is displaced. Touching it
  // fast-recentres, then promotes the same held pointer into rotation without
  // allowing that transitional touch to pop the bubble.
  current = await geometry();
  const beforeRecenter = await state();
  await page.mouse.move(current.x, current.y);
  await page.mouse.down();
  await page.mouse.move(current.x + 20, current.y + 8);
  await page.waitForTimeout(90);
  const recentering = await state();
  assert(recentering.pointerMode === "recenter", "Sphere touch did not start the fast recenter");
  assert(quaternionDistance(beforeRecenter.q, recentering.q) < 0.001, "Sphere moved while the camera was recentering");
  await page.waitForTimeout(360);
  const ready = await state();
  assert(ready.phase === "idle" && ready.pointerMode === "rotate", `Held touch was not promoted after recenter: ${JSON.stringify(ready)}`);
  assert(Math.abs(ready.yaw - beforeRecenter.yaw) < 0.003, "Fast height recenter discarded the chosen orbit");
  await page.mouse.move(current.x + 58, current.y + 18);
  await page.waitForTimeout(35);
  assert(quaternionDistance(ready.q, (await state()).q) > 0.02, "Promoted sphere touch did not gain rotation control");
  await page.mouse.up();
  await page.waitForTimeout(220);
  assert((await state()).species === "skunk", "The recentering touch accidentally popped the bubble");

  // With no interruption, momentum settles, pauses briefly, and returns only
  // the temporary height while preserving the chosen working orbit.
  current = await geometry();
  await page.mouse.move(current.x, current.y + current.r + 32);
  await page.mouse.down();
  await page.mouse.move(current.x + 70, current.y + current.r + 78, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const returning = await state();
  assert(returning.phase === "return" || returning.phase === "idle", `Short inspection pause did not start height return: ${JSON.stringify(returning)}`);
  await page.waitForTimeout(900);
  const returned = await state();
  assert(returned.phase === "idle", `Camera did not return automatically: ${returned.phase}`);
  assert(Math.abs(returned.height) < 0.01, `Camera retained its temporary height: ${JSON.stringify(returned)}`);
  assert(Math.abs(returned.yaw) > 0.1, `Camera discarded the chosen orbit: ${JSON.stringify(returned)}`);
  await page.waitForTimeout(300);
  assert(Math.abs((await state()).yaw - returned.yaw) < 0.003, "Chosen orbit drifted after height reset");
  assert((await geometry()).opacity > 0.9, "Bubble did not restore after camera return");

  // Committing the piece clears transient camera motion but keeps the selected
  // working orbit for the placement and the next turn.
  current = await geometry();
  await page.mouse.move(current.x, current.y);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
  await page.waitForTimeout(240);
  assert(Math.abs((await state()).yaw - returned.yaw) < 0.003, "Placement reset the selected working orbit");
  assert(!errors.length, errors.join(", "));
  await page.close();
  console.log(`${mobile ? "Phone" : "Desktop"}: safety moat, tower orbit/pan, momentum, short height return, persistent orbit, and soft sphere lock passed`);
}

for (const mobile of [true, false]) await verifyTowerExploration(mobile);

const defaultPage = await browser.newPage({ viewport: { width: 390, height: 714 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
await defaultPage.goto(`${root}?audio=0&diagnostics=1&species=armadillo&rx=0&ry=0&rz=0`);
await defaultPage.waitForSelector('canvas[data-held-species="armadillo"]');
await defaultPage.waitForTimeout(200);
const defaultBubble = defaultPage.locator("#rotation-bubble");
assert(!(await defaultBubble.evaluate((element) => element.hidden)), "Bare URL did not enable the default bubble");
const defaultGeometry = await defaultBubble.evaluate((element) => ({
  x: Number(element.dataset.centerX),
  y: Number(element.dataset.centerY),
}));
assert(Number(await defaultBubble.evaluate((element) => getComputedStyle(element).opacity)) > 0.5, "Default bubble was not visible before touch");
assert(await defaultBubble.evaluate((element) => element.dataset.loopsEnabled === "false"), "Bare URL unexpectedly enabled experimental loops");
await defaultPage.close();
console.log("Bare URL: bubble defaults on and remains visible until popped");

await browser.close();
