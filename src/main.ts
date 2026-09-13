import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import RAPIER from "@dimforge/rapier3d-compat";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const scoreElement = document.querySelector<HTMLOutputElement>("#score")!;
const restartButton = document.querySelector<HTMLButtonElement>("#restart")!;

await RAPIER.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce8dd);
scene.fog = new THREE.Fog(0xdce8dd, 15, 28);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.OrthographicCamera(-4, 4, 5, -5, 0.1, 60);
camera.up.set(0, 0, 1);
const cameraTarget = new THREE.Vector3(0, 0, 1.9);
let cameraHeight = 1.9;

scene.add(new THREE.HemisphereLight(0xf8fbef, 0x547667, 2.1));
const key = new THREE.DirectionalLight(0xfff5de, 4.1);
key.position.set(-5, -6, 10);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 10;
key.shadow.camera.bottom = -3;
key.shadow.bias = -0.0001;
key.shadow.normalBias = 0.035;
scene.add(key);
const rim = new THREE.DirectionalLight(0x99cbd3, 1.8);
rim.position.set(5, 4, 7);
scene.add(rim);

const platformMaterial = new THREE.MeshStandardMaterial({ color: 0xf1f0e7, roughness: 0.72 });
const platform = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.12, 0.42, 64), platformMaterial);
platform.position.z = -0.21;
platform.rotation.x = Math.PI / 2;
platform.receiveShadow = true;
scene.add(platform);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(18, 64),
  new THREE.MeshStandardMaterial({ color: 0xc6dcce, roughness: 1 }),
);
ground.position.set(0, 4, -0.48);
ground.rotation.x = 0;
ground.receiveShadow = true;
scene.add(ground);

const preview = new THREE.Mesh(
  new THREE.RingGeometry(0.72, 0.84, 48),
  new THREE.MeshBasicMaterial({ color: 0x247f72, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false }),
);
preview.position.z = 0.012;
scene.add(preview);

const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/tortoise.glb`);
const modelTemplate = gltf.scene;
// glTF is Y-up; the game and Rapier world deliberately use Blender-style Z-up.
modelTemplate.rotation.x = Math.PI / 2;
modelTemplate.position.z = -0.65;
modelTemplate.updateMatrixWorld(true);
modelTemplate.traverse((object) => {
  if (object instanceof THREE.Mesh) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
});

const world = new RAPIER.World({ x: 0, y: 0, z: -9.81 });
world.timestep = 1 / 60;
const platformBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, -0.22));
world.createCollider(
  RAPIER.ColliderDesc.cylinder(0.22, 3)
    .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
    .setFriction(0.86),
  platformBody,
);

type Turtle = {
  body: RAPIER.RigidBody;
  group: THREE.Group;
  model: THREE.Object3D;
  eyes: THREE.Object3D[];
  head?: THREE.Object3D;
  feet: THREE.Object3D[];
  birth: number;
  quietFor: number;
  counted: boolean;
  fixed: boolean;
  landingPulse: number;
};

const turtles: Turtle[] = [];
let held: THREE.Group | null = null;
let heldModel: THREE.Object3D | null = null;
let heldRig: Pick<Turtle, "eyes" | "head" | "feet"> | null = null;
let heldPosition = new THREE.Vector2(0, -0.2);
let dragOrigin = new THREE.Vector2();
let positionOrigin = new THREE.Vector2();
let pointerId: number | null = null;
let score = 0;
let lost = false;
let squirmVelocity = new THREE.Vector3();
let squirmTarget = new THREE.Vector3();
let squirmChangeAt = 0;
let accumulator = 0;
let lastTime = performance.now() / 1000;

const halfExtents = new THREE.Vector3(1.06, 1.18, 0.66);
const rotationMatrix = new THREE.Matrix4();
const heldClearance = 1.15;

function makeRig(model: THREE.Object3D) {
  const feet: THREE.Object3D[] = [];
  const eyes: THREE.Object3D[] = [];
  let head: THREE.Object3D | undefined;
  model.traverse((object) => {
    if (object.name.startsWith("Paddling jade foot")) feet.push(object);
    if (object.name.startsWith("Tortoise eye") && !object.name.includes("sparkle")) eyes.push(object);
    if (object.name === "Curious head") head = object;
  });
  return { feet, eyes, head };
}

function addTurtleColliders(body: RAPIER.RigidBody) {
  const material = (desc: RAPIER.ColliderDesc, density: number) =>
    desc.setFriction(1.08).setRestitution(0.01).setDensity(density);

  // Broad, nearly flat support surfaces make the tortoise the forgiving first
  // animal. Most of its mass lives in the low belly, while the visible feet
  // remain animation-only so they cannot snag and flip a sensible placement.
  world.createCollider(
    material(RAPIER.ColliderDesc.roundCuboid(0.76, 0.86, 0.26, 0.10).setTranslation(0, 0, -0.05), 0.55),
    body,
  );
  world.createCollider(
    material(RAPIER.ColliderDesc.roundCuboid(0.72, 0.82, 0.06, 0.04).setTranslation(0, 0, -0.50), 3.2),
    body,
  );
  world.createCollider(
    material(RAPIER.ColliderDesc.roundCuboid(0.76, 0.86, 0.06, 0.02).setTranslation(0, 0, 0.54), 0.18),
    body,
  );
  world.createCollider(
    material(RAPIER.ColliderDesc.roundCuboid(0.31, 0.30, 0.18, 0.05).setTranslation(0, -1.10, -0.12), 0.20),
    body,
  );
}

function createTurtle(position: THREE.Vector3, rotation: THREE.Quaternion, fixed = false) {
  const bodyDesc = fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic().setLinearDamping(0.42).setAngularDamping(1.45);
  bodyDesc.setTranslation(position.x, position.y, position.z).setRotation(rotation);
  const body = world.createRigidBody(bodyDesc);
  addTurtleColliders(body);
  const group = new THREE.Group();
  const model = modelTemplate.clone(true);
  group.add(model);
  scene.add(group);
  const rig = makeRig(model);
  const turtle: Turtle = { body, group, model, ...rig, birth: performance.now() / 1000, quietFor: 0, counted: fixed, fixed, landingPulse: 0 };
  turtles.push(turtle);
  return turtle;
}

function verticalExtent(quaternion: THREE.Quaternion) {
  rotationMatrix.makeRotationFromQuaternion(quaternion);
  const e = rotationMatrix.elements;
  return Math.abs(e[2]) * halfExtents.x + Math.abs(e[6]) * halfExtents.y + Math.abs(e[10]) * halfExtents.z;
}

function landingTop(x: number, y: number) {
  let top = 0;
  for (const turtle of turtles) {
    const p = turtle.body.translation();
    const distance = Math.hypot(x - p.x, y - p.y);
    if (distance < 1.62) {
      const r = turtle.body.rotation();
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      top = Math.max(top, p.z + verticalExtent(q));
    }
  }
  return top;
}

function clampPosition(position: THREE.Vector2) {
  const radius = position.length();
  if (radius > 2.15) position.multiplyScalar(2.15 / radius);
}

function createHeld() {
  if (lost) return;
  held = new THREE.Group();
  heldModel = modelTemplate.clone(true);
  heldRig = makeRig(heldModel);
  held.add(heldModel);
  heldPosition.set(0, -0.25);
  held.position.set(heldPosition.x, heldPosition.y, landingTop(heldPosition.x, heldPosition.y) + halfExtents.z + heldClearance);
  squirmVelocity.set(0, 0, 0);
  squirmTarget.set(0, 0, 0);
  scene.add(held);
  preview.visible = true;
}

function releaseHeld() {
  if (!held || lost) return;
  const turtle = createTurtle(held.position.clone(), held.quaternion.clone());
  turtle.body.setLinvel({ x: 0, y: 0, z: -0.05 }, true);
  turtle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  scene.remove(held);
  held = null;
  heldModel = null;
  heldRig = null;
  preview.visible = false;
}

function animateRig(rig: Pick<Turtle, "eyes" | "head" | "feet">, time: number, intensity: number) {
  if (rig.head) rig.head.rotation.x = Math.sin(time * 2.1) * 0.045 * intensity;
  rig.feet.forEach((foot, index) => {
    foot.rotation.x = Math.sin(time * 4.2 + index * 1.7) * 0.10 * intensity;
  });
  const blink = Math.sin(time * 0.73 + 1.4) > 0.985 ? 0.16 : 1;
  rig.eyes.forEach((eye) => { eye.scale.z = blink; });
}

function updateSquirm(dt: number, time: number) {
  if (!held || pointerId === null) return;
  if (time >= squirmChangeAt) {
    const pause = Math.random() < 0.12;
    const energy = Math.random() < 0.28 ? 3.20 : 1.90;
    squirmTarget.set(
      pause ? 0 : THREE.MathUtils.randFloatSpread(energy),
      pause ? 0 : THREE.MathUtils.randFloatSpread(energy * 0.95),
      pause ? 0 : THREE.MathUtils.randFloatSpread(energy * 0.82),
    );
    squirmChangeAt = time + (pause ? THREE.MathUtils.randFloat(0.12, 0.26) : THREE.MathUtils.randFloat(0.68, 1.28));
  }
  squirmVelocity.lerp(squirmTarget, 1 - Math.exp(-dt * 7.0));
  const speed = squirmVelocity.length();
  if (speed > 0.0001) {
    const axis = squirmVelocity.clone().normalize();
    held.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, speed * dt)).normalize();
  }
}

function updateHeld(dt: number, time: number) {
  if (!held) return;
  updateSquirm(dt, time);
  const extent = verticalExtent(held.quaternion);
  const top = landingTop(heldPosition.x, heldPosition.y);
  held.position.x = THREE.MathUtils.damp(held.position.x, heldPosition.x, 18, dt);
  held.position.y = THREE.MathUtils.damp(held.position.y, heldPosition.y, 18, dt);
  held.position.z = THREE.MathUtils.damp(held.position.z, top + extent + heldClearance, 14, dt);
  preview.position.set(held.position.x, held.position.y, top + 0.025);
  const scale = THREE.MathUtils.clamp(1.15 - top * 0.035, 0.82, 1.15);
  preview.scale.setScalar(scale);
  if (heldRig) animateRig(heldRig, time, pointerId === null ? 0.22 : 1);
}

function updatePhysics(dt: number, time: number) {
  accumulator = Math.min(accumulator + dt, 0.12);
  while (accumulator >= world.timestep) {
    world.step();
    accumulator -= world.timestep;
  }

  for (const turtle of turtles) {
    const p = turtle.body.translation();
    const r = turtle.body.rotation();
    turtle.group.position.set(p.x, p.y, p.z);
    turtle.group.quaternion.set(r.x, r.y, r.z, r.w);
    animateRig(turtle, time + turtle.birth, turtle.fixed ? 0.18 : 0.28);

    if (!turtle.fixed && !turtle.counted) {
      const linear = turtle.body.linvel();
      const angular = turtle.body.angvel();
      const quiet = turtle.body.isSleeping()
        || (Math.hypot(linear.x, linear.y, linear.z) < 0.24 && Math.hypot(angular.x, angular.y, angular.z) < 0.30);
      turtle.quietFor = quiet ? turtle.quietFor + dt : 0;
      if (time - turtle.birth > 0.65 && turtle.quietFor > 0.58) {
        turtle.counted = true;
        turtle.landingPulse = 1;
        score += 1;
        scoreElement.value = String(score);
        scoreElement.textContent = String(score);
        scoreElement.classList.add("bump");
        setTimeout(() => scoreElement.classList.remove("bump"), 180);
      }
    }

    if (!turtle.fixed && (p.z < -3 || Math.hypot(p.x, p.y) > 5.2)) lost = true;
    if (turtle.landingPulse > 0) {
      turtle.landingPulse = Math.max(0, turtle.landingPulse - dt * 4.5);
      const squash = Math.sin(turtle.landingPulse * Math.PI) * 0.035;
      turtle.model.scale.set(1 + squash, 1 + squash, 1 - squash * 1.4);
    }
  }

  if (lost) {
    if (held) scene.remove(held);
    held = null;
    heldModel = null;
    heldRig = null;
    preview.visible = false;
    scoreElement.classList.add("lost");
  }
}

function updateCamera(dt: number) {
  let highest = 1.25;
  for (const turtle of turtles) {
    if (!turtle.counted) continue;
    const p = turtle.body.translation();
    const r = turtle.body.rotation();
    highest = Math.max(highest, p.z + verticalExtent(new THREE.Quaternion(r.x, r.y, r.z, r.w)));
  }
  const desired = Math.max(1.9, highest + 1.25);
  cameraHeight = THREE.MathUtils.damp(cameraHeight, desired, 2.7, dt);
  cameraTarget.set(0, 0.05, cameraHeight);
  camera.position.set(6.9, -12.3, cameraHeight + 6.0);
  camera.lookAt(cameraTarget);
}

function resize() {
  const width = innerWidth;
  const height = innerHeight;
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const halfHeight = 4.65;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

function reset() {
  for (const turtle of turtles.splice(0)) {
    world.removeRigidBody(turtle.body);
    scene.remove(turtle.group);
  }
  if (held) scene.remove(held);
  held = null;
  heldModel = null;
  heldRig = null;
  score = 0;
  lost = false;
  pointerId = null;
  scoreElement.value = "0";
  scoreElement.textContent = "0";
  scoreElement.classList.remove("lost", "bump");
  createTurtle(new THREE.Vector3(0, 0, 0.65), new THREE.Quaternion(), true);
}

canvas.addEventListener("pointerdown", (event) => {
  if (lost || pointerId !== null) return;
  if (!held) {
    if (turtles.some((turtle) => !turtle.counted)) return;
    createHeld();
  }
  if (!held) return;
  pointerId = event.pointerId;
  canvas.setPointerCapture(pointerId);
  dragOrigin.set(event.clientX, event.clientY);
  positionOrigin.copy(heldPosition);
  squirmChangeAt = 0;
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== pointerId || !held) return;
  const worldWidth = camera.right - camera.left;
  const worldHeight = camera.top - camera.bottom;
  heldPosition.set(
    positionOrigin.x + (event.clientX - dragOrigin.x) / innerWidth * worldWidth,
    positionOrigin.y - (event.clientY - dragOrigin.y) / innerHeight * worldHeight * 0.62,
  );
  clampPosition(heldPosition);
});

canvas.addEventListener("pointerup", (event) => {
  if (event.pointerId !== pointerId) return;
  pointerId = null;
  releaseHeld();
});

canvas.addEventListener("pointercancel", (event) => {
  if (event.pointerId !== pointerId) return;
  pointerId = null;
  releaseHeld();
});

restartButton.addEventListener("click", reset);
addEventListener("resize", resize);

resize();
reset();

function frame(nowMilliseconds: number) {
  const time = nowMilliseconds / 1000;
  const dt = Math.min(time - lastTime, 0.05);
  lastTime = time;
  updateHeld(dt, time);
  updatePhysics(dt, time);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
