import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import RAPIER from "@dimforge/rapier3d-compat";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const scoreElement = document.querySelector<HTMLOutputElement>("#score")!;
const tutorial = document.querySelector<HTMLElement>("#tutorial")!;
const restartButton = document.querySelector<HTMLButtonElement>("#restart")!;
const gameOver = document.querySelector<HTMLElement>("#game-over")!;
const playAgainButton = document.querySelector<HTMLButtonElement>("#play-again")!;

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

type SpeciesId = "tortoise" | "capybara" | "toucan";
type ModelTemplate = { model: THREE.Object3D; halfExtents: THREE.Vector3 };

const speciesIds: SpeciesId[] = ["tortoise", "capybara", "toucan"];
const loader = new GLTFLoader();
const loadedModels = await Promise.all(
  speciesIds.map(async (species) => [species, (await loader.loadAsync(`${import.meta.env.BASE_URL}models/${species}.glb`)).scene] as const),
);
const modelTemplates = new Map<SpeciesId, ModelTemplate>();

for (const [species, model] of loadedModels) {
  // glTF is Y-up; the game and Rapier world deliberately use Blender-style Z-up.
  model.rotation.x = Math.PI / 2;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  model.position.sub(center);
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  modelTemplates.set(species, { model, halfExtents: size.multiplyScalar(0.5) });
}

const world = new RAPIER.World({ x: 0, y: 0, z: -9.81 });
world.timestep = 1 / 60;
const platformBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, -0.22));
const platformCollider = world.createCollider(
  RAPIER.ColliderDesc.cylinder(0.22, 3)
    .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
    .setFriction(0.86),
  platformBody,
);

type Animal = {
  species: SpeciesId;
  halfExtents: THREE.Vector3;
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

const animals: Animal[] = [];
let held: THREE.Group | null = null;
let heldModel: THREE.Object3D | null = null;
let heldRig: Pick<Animal, "eyes" | "head" | "feet"> | null = null;
let heldSpecies: SpeciesId | null = null;
let heldHalfExtents = new THREE.Vector3();
let heldPosition = new THREE.Vector2(0, -0.2);
let dragOrigin = new THREE.Vector2();
let rotationInput = new THREE.Vector2();
let pointerId: number | null = null;
let score = 0;
let lost = false;
let accumulator = 0;
let lastTime = performance.now() / 1000;

let speciesBag: SpeciesId[] = [];
const rotationMatrix = new THREE.Matrix4();
const controlAxis = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const cameraUp = new THREE.Vector3();
const controlRotation = new THREE.Quaternion();
const heldClearance = 1.15;

function randomQuaternion() {
  // Uniform random rotation rather than independent Euler angles, which bias
  // heavily toward some orientations.
  const u1 = Math.random();
  const u2 = Math.random() * Math.PI * 2;
  const u3 = Math.random() * Math.PI * 2;
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  return new THREE.Quaternion(
    a * Math.sin(u2),
    a * Math.cos(u2),
    b * Math.sin(u3),
    b * Math.cos(u3),
  );
}

function makeRig(model: THREE.Object3D, species: SpeciesId) {
  const feet: THREE.Object3D[] = [];
  const eyes: THREE.Object3D[] = [];
  let head: THREE.Object3D | undefined;
  model.traverse((object) => {
    if (["Paddling jade foot", "Tucked foot", "Broad resting foot"].some((name) => object.name.startsWith(name))) feet.push(object);
    if (["Tortoise eye", "Sleepy eye", "Toucan eye"].some((name) => object.name.startsWith(name))
      && !object.name.toLowerCase().includes("sparkle") && !object.name.toLowerCase().includes("glimmer")) eyes.push(object);
    if ((species === "tortoise" && object.name.startsWith("Curious head"))
      || (species === "capybara" && object.name.startsWith("Squared head"))
      || (species === "toucan" && object.name === "Head")) head = object;
  });
  return { feet, eyes, head };
}

function addAnimalColliders(body: RAPIER.RigidBody, species: SpeciesId) {
  const material = (desc: RAPIER.ColliderDesc, density: number) =>
    desc.setFriction(1.08).setRestitution(0.01).setDensity(density);

  if (species === "tortoise") {
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.76, 0.86, 0.26, 0.10).setTranslation(0, 0, -0.05), 0.55), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.72, 0.82, 0.06, 0.04).setTranslation(0, 0, -0.50), 3.2), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.76, 0.86, 0.06, 0.02).setTranslation(0, 0, 0.54), 0.18), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.31, 0.30, 0.18, 0.05).setTranslation(0, -1.10, -0.12), 0.20), body);
  } else if (species === "capybara") {
    // A long, useful bridge with its center of mass biased into the lower body.
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.67, 0.88, 0.48, 0.15).setTranslation(0, 0.34, -0.13), 0.95), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.62, 0.57, 0.46, 0.14).setTranslation(0, -0.65, 0.12), 0.42), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.50, 0.22, 0.23, 0.10).setTranslation(0, -1.12, -0.09), 0.20), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.58, 0.74, 0.07, 0.035).setTranslation(0, 0.22, -0.84), 2.4), body);
  } else {
    // The beak changes the silhouette and contacts, but stays deliberately light.
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.56, 0.55, 0.54, 0.16).setTranslation(0, 0.53, -0.18), 1.0), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.51, 0.47, 0.39, 0.14).setTranslation(0, 0.38, 0.57), 0.55), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.34, 0.76, 0.19, 0.06).setTranslation(0, -0.68, 0.52), 0.10), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.45, 0.34, 0.07, 0.03).setTranslation(0, 0.31, -0.91), 2.6), body);
  }
}

function createAnimal(species: SpeciesId, position: THREE.Vector3, rotation: THREE.Quaternion, fixed = false) {
  const bodyDesc = fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic().setLinearDamping(0.42).setAngularDamping(1.45);
  bodyDesc.setTranslation(position.x, position.y, position.z).setRotation(rotation);
  const body = world.createRigidBody(bodyDesc);
  addAnimalColliders(body, species);
  const template = modelTemplates.get(species)!;
  const group = new THREE.Group();
  const model = template.model.clone(true);
  group.add(model);
  scene.add(group);
  const rig = makeRig(model, species);
  const animal: Animal = { species, halfExtents: template.halfExtents, body, group, model, ...rig, birth: performance.now() / 1000, quietFor: 0, counted: fixed, fixed, landingPulse: 0 };
  animals.push(animal);
  return animal;
}

function verticalExtent(quaternion: THREE.Quaternion, halfExtents: THREE.Vector3) {
  rotationMatrix.makeRotationFromQuaternion(quaternion);
  const e = rotationMatrix.elements;
  return Math.abs(e[2]) * halfExtents.x + Math.abs(e[6]) * halfExtents.y + Math.abs(e[10]) * halfExtents.z;
}

function landingTop(x: number, y: number) {
  let top = 0;
  for (const animal of animals) {
    const p = animal.body.translation();
    const distance = Math.hypot(x - p.x, y - p.y);
    if (distance < 1.62) {
      const r = animal.body.rotation();
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      top = Math.max(top, p.z + verticalExtent(q, animal.halfExtents));
    }
  }
  return top;
}

function takeNextSpecies() {
  if (speciesBag.length === 0) {
    speciesBag = [...speciesIds];
    for (let index = speciesBag.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [speciesBag[index], speciesBag[swap]] = [speciesBag[swap], speciesBag[index]];
    }
  }
  return speciesBag.pop()!;
}

function createHeld() {
  if (lost) return;
  heldSpecies = takeNextSpecies();
  const template = modelTemplates.get(heldSpecies)!;
  held = new THREE.Group();
  heldModel = template.model.clone(true);
  heldHalfExtents.copy(template.halfExtents);
  heldRig = makeRig(heldModel, heldSpecies);
  held.add(heldModel);
  held.quaternion.copy(randomQuaternion());
  heldPosition.set(0, -0.25);
  held.position.set(
    heldPosition.x,
    heldPosition.y,
    landingTop(heldPosition.x, heldPosition.y) + verticalExtent(held.quaternion, heldHalfExtents) + heldClearance,
  );
  rotationInput.set(0, 0);
  scene.add(held);
  preview.visible = true;
  canvas.dataset.heldSpecies = heldSpecies;
}

function releaseHeld() {
  if (!held || lost) return;
  const animal = createAnimal(heldSpecies!, held.position.clone(), held.quaternion.clone());
  animal.body.setLinvel({ x: 0, y: 0, z: -0.05 }, true);
  animal.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  scene.remove(held);
  held = null;
  heldModel = null;
  heldRig = null;
  heldSpecies = null;
  delete canvas.dataset.heldSpecies;
  preview.visible = false;
}

function animateRig(rig: Pick<Animal, "eyes" | "head" | "feet">, time: number, intensity: number) {
  if (rig.head) rig.head.rotation.x = Math.sin(time * 2.1) * 0.045 * intensity;
  rig.feet.forEach((foot, index) => {
    foot.rotation.x = Math.sin(time * 4.2 + index * 1.7) * 0.10 * intensity;
  });
  const blink = Math.sin(time * 0.73 + 1.4) > 0.985 ? 0.16 : 1;
  rig.eyes.forEach((eye) => { eye.scale.z = blink; });
}

function touchesPlatform(animal: Animal) {
  for (let index = 0; index < animal.body.numColliders(); index += 1) {
    let touching = false;
    world.contactPair(animal.body.collider(index), platformCollider, (manifold) => {
      if (manifold.numSolverContacts() > 0) touching = true;
    });
    if (touching) return true;
  }
  return false;
}

function updateRotationControl(dt: number) {
  if (!held || pointerId === null) return;
  const distance = rotationInput.length();
  const deadZone = Math.max(16, Math.min(innerWidth, innerHeight) * 0.045);
  if (distance <= deadZone) return;

  const fullSpeedDistance = Math.min(innerWidth, innerHeight) * 0.34;
  const amount = THREE.MathUtils.clamp((distance - deadZone) / (fullSpeedDistance - deadZone), 0, 1);
  const speed = 3.2 * Math.pow(amount, 1.45);

  cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  controlAxis
    .copy(cameraUp).multiplyScalar(rotationInput.x / distance)
    .addScaledVector(cameraRight, rotationInput.y / distance)
    .normalize();
  controlRotation.setFromAxisAngle(controlAxis, speed * dt);
  held.quaternion.premultiply(controlRotation).normalize();
}

function updateHeld(dt: number, time: number) {
  if (!held) return;
  updateRotationControl(dt);
  const extent = verticalExtent(held.quaternion, heldHalfExtents);
  const top = landingTop(heldPosition.x, heldPosition.y);
  held.position.x = THREE.MathUtils.damp(held.position.x, heldPosition.x, 18, dt);
  held.position.y = THREE.MathUtils.damp(held.position.y, heldPosition.y, 18, dt);
  held.position.z = THREE.MathUtils.damp(held.position.z, top + extent + heldClearance, 14, dt);
  preview.position.set(held.position.x, held.position.y, top + 0.025);
  const scale = THREE.MathUtils.clamp(1.15 - top * 0.035, 0.82, 1.15);
  preview.scale.setScalar(scale);
  if (heldRig) animateRig(heldRig, time, pointerId === null ? 0.22 : 1);
}

function endGame() {
  if (lost) return;
  lost = true;
  if (held) scene.remove(held);
  held = null;
  heldModel = null;
  heldRig = null;
  heldSpecies = null;
  delete canvas.dataset.heldSpecies;
  preview.visible = false;
  rotationInput.set(0, 0);
  pointerId = null;
  scoreElement.classList.add("lost");
  tutorial.classList.add("hidden");
  gameOver.classList.remove("hidden");
  playAgainButton.focus({ preventScroll: true });
}

function updatePhysics(dt: number, time: number) {
  accumulator = Math.min(accumulator + dt, 0.12);
  while (accumulator >= world.timestep) {
    world.step();
    accumulator -= world.timestep;
  }

  for (const animal of animals) {
    const p = animal.body.translation();
    const r = animal.body.rotation();
    animal.group.position.set(p.x, p.y, p.z);
    animal.group.quaternion.set(r.x, r.y, r.z, r.w);
    animateRig(animal, time + animal.birth, animal.fixed ? 0.18 : 0.28);

    if (!animal.fixed && touchesPlatform(animal)) endGame();

    if (!lost && !animal.fixed && !animal.counted) {
      const linear = animal.body.linvel();
      const angular = animal.body.angvel();
      const quiet = animal.body.isSleeping()
        || (Math.hypot(linear.x, linear.y, linear.z) < 0.24 && Math.hypot(angular.x, angular.y, angular.z) < 0.30);
      animal.quietFor = quiet ? animal.quietFor + dt : 0;
      if (time - animal.birth > 0.65 && animal.quietFor > 0.58) {
        animal.counted = true;
        animal.landingPulse = 1;
        score += 1;
        scoreElement.value = String(score);
        scoreElement.textContent = String(score);
        scoreElement.classList.add("bump");
        tutorial.classList.add("hidden");
        setTimeout(() => scoreElement.classList.remove("bump"), 180);
        createHeld();
      }
    }

    if (!animal.fixed && (p.z < -1.5 || Math.hypot(p.x, p.y) > 4.2)) endGame();
    if (animal.landingPulse > 0) {
      animal.landingPulse = Math.max(0, animal.landingPulse - dt * 4.5);
      const squash = Math.sin(animal.landingPulse * Math.PI) * 0.035;
      animal.model.scale.set(1 + squash, 1 + squash, 1 - squash * 1.4);
    }
  }
}

function updateCamera(dt: number) {
  let highest = 1.25;
  for (const animal of animals) {
    if (!animal.counted) continue;
    const p = animal.body.translation();
    const r = animal.body.rotation();
    highest = Math.max(highest, p.z + verticalExtent(new THREE.Quaternion(r.x, r.y, r.z, r.w), animal.halfExtents));
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
  for (const animal of animals.splice(0)) {
    world.removeRigidBody(animal.body);
    scene.remove(animal.group);
  }
  if (held) scene.remove(held);
  held = null;
  heldModel = null;
  heldRig = null;
  heldSpecies = null;
  delete canvas.dataset.heldSpecies;
  speciesBag = [];
  score = 0;
  lost = false;
  pointerId = null;
  scoreElement.value = "0";
  scoreElement.textContent = "0";
  scoreElement.classList.remove("lost", "bump");
  tutorial.classList.remove("hidden");
  gameOver.classList.add("hidden");
  const baseHeight = modelTemplates.get("tortoise")!.halfExtents.z;
  createAnimal("tortoise", new THREE.Vector3(0, 0, baseHeight), new THREE.Quaternion(), true);
  createHeld();
}

canvas.addEventListener("pointerdown", (event) => {
  if (lost || pointerId !== null) return;
  if (!held) return;
  pointerId = event.pointerId;
  canvas.setPointerCapture(pointerId);
  dragOrigin.set(event.clientX, event.clientY);
  rotationInput.set(0, 0);
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== pointerId || !held) return;
  rotationInput.set(event.clientX - dragOrigin.x, event.clientY - dragOrigin.y);
});

function finishPointer(pointer: number) {
  if (pointer !== pointerId) return;
  pointerId = null;
  rotationInput.set(0, 0);
  releaseHeld();
}

canvas.addEventListener("pointerup", (event) => finishPointer(event.pointerId));
canvas.addEventListener("pointercancel", (event) => {
  finishPointer(event.pointerId);
});
// Mobile browsers can revoke pointer capture when their own chrome or a system
// gesture takes over. Without this path, the old pointer ID remains latched and
// all later presses are ignored, leaving the animal suspended indefinitely.
canvas.addEventListener("lostpointercapture", (event) => finishPointer(event.pointerId));

function finishInterruptedPointer() {
  if (pointerId !== null) finishPointer(pointerId);
}

addEventListener("blur", finishInterruptedPointer);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") finishInterruptedPointer();
});

restartButton.addEventListener("click", reset);
playAgainButton.addEventListener("click", reset);
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
