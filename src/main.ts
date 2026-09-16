import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { CeramicAudio } from "./ceramic-audio";
import { observeContactAudio, type ContactAudioState } from "./contact-audio-detector";
import { FlightRecorder } from "./trace";
import { RoundedArcball } from "./rounded-arcball";
import expansionColliders from "./expansion-colliders.json";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const scoreElement = document.querySelector<HTMLOutputElement>("#score")!;
const dropButton = document.querySelector<HTMLButtonElement>("#drop")!;
const shareTraceButton = document.querySelector<HTMLButtonElement>("#share-trace")!;
const runtimeParams = new URLSearchParams(location.search);
// Explicit diagnostics are safe data attributes used by browser regressions,
// including checks against the deployed production build. Deterministic setup
// overrides accompany that explicit mode; fault injection stays dev-only.
const diagnosticsEnabled = runtimeParams.has("diagnostics");
const devParams = import.meta.env.DEV ? runtimeParams : null;
const diagnosticParams = devParams ?? (diagnosticsEnabled ? runtimeParams : null);
const forgivingPlacementEnabled = diagnosticParams?.get("forgiving") !== "0";
const bubbleEnabled = runtimeParams.get("bubble") !== "0";
const bubbleLoopsEnabled = runtimeParams.get("loops") === "1";
const audioEnabled = runtimeParams.get("audio") !== "0";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const recorder = new FlightRecorder(runtimeParams.has("trace"));
const ceramicAudio = new CeramicAudio(
  `${import.meta.env.BASE_URL}audio/ceramic/`,
  audioEnabled,
  (event, detail = {}) => recorder.event(`audio_${event}`, detail),
);
shareTraceButton.hidden = !recorder.enabled;

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
let fallTarget: Animal | null = null;
let endingElapsed = 0;
let newestReleased: Animal | null = null;
let fallingFor = 0;
let cameraFallSpeed = 0;
let finalViewRecorded = false;

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

type SpeciesId = "tortoise" | "capybara" | "toucan" | keyof typeof expansionColliders;
type ModelTemplate = {
  model: THREE.Object3D;
  halfExtents: THREE.Vector3;
  rotationRadius: number;
};

const speciesIds: SpeciesId[] = ["tortoise", "capybara", "toucan", "armadillo", "ram", "skunk"];
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
  // Expansion meshes are authored in the same body-local coordinates as their
  // colliders. Recentering a raised tail/horn would misalign that geometry.
  const expansion = species in expansionColliders;
  if (!expansion) model.position.sub(center);
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  const halfExtents = expansion
    ? new THREE.Vector3(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)), Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)))
    : size.multiplyScalar(0.5);
  const visualBounds = new THREE.Box3().setFromObject(model);
  let rotationRadius = 0;
  for (const x of [visualBounds.min.x, visualBounds.max.x]) {
    for (const y of [visualBounds.min.y, visualBounds.max.y]) {
      for (const z of [visualBounds.min.z, visualBounds.max.z]) {
        rotationRadius = Math.max(rotationRadius, Math.hypot(x, y, z));
      }
    }
  }
  modelTemplates.set(species, { model, halfExtents, rotationRadius });
}

const world = new RAPIER.World({ x: 0, y: 0, z: -9.81 });
world.timestep = 1 / 60;
const physicsEvents = new RAPIER.EventQueue(true);
const platformBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, -0.22));
const platformCollider = world.createCollider(
  RAPIER.ColliderDesc.cylinder(0.22, 3)
    .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
    .setFriction(0.86),
  platformBody,
);

type Animal = {
  id: number;
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
  hadSupport: boolean;
  supportedFor: number;
  lowering: boolean;
  lastSafeZ: number;
  settlingGripRaised: boolean;
  stackFrictionRestored: boolean;
  resolutionTimer?: number;
};

const animals: Animal[] = [];
const colliderOwners = new Map<number, Animal>();
const contactStates = new Map<string, ContactAudioState>();
let physicsStep = 0;
let held: THREE.Group | null = null;
let heldModel: THREE.Object3D | null = null;
let heldRig: Pick<Animal, "eyes" | "head" | "feet"> | null = null;
let heldSpecies: SpeciesId | null = null;
const defaultHeldPosition = new THREE.Vector2(0, -0.25);
let heldPosition = defaultHeldPosition.clone();
const heldAnchorPosition = new THREE.Vector3();
let heldRotationRadius = 0;
let dragOrigin = new THREE.Vector2();
const pointerStart = new THREE.Vector2();
const pointerPosition = new THREE.Vector2();
let rotationInput = new THREE.Vector2();
const spinVelocity = new THREE.Vector3();
let lastDragTime = 0;
let pointerStartedAt = 0;
let pointerTravel = 0;
let tapCandidate = false;
let pointerId: number | null = null;
let bubblePopping = false;
let bubblePopTimer: number | undefined;
let score = 0;
let lost = false;
let accumulator = 0;
let lastTime = performance.now() / 1000;
let lastFrameWallTime = performance.now();
let engineFault = false;
let devFaultInjected = false;
let nextAnimalId = 1;
const activeUpwardAnomalies = new Set<number>();

let speciesBag: SpeciesId[] = [];
const devSpeciesSequence = (diagnosticParams?.get("sequence") ?? "")
  .split(",")
  .filter((species): species is SpeciesId => speciesIds.includes(species as SpeciesId));
let devSpeciesIndex = 0;
const devRotations = (diagnosticParams?.get("rotations") ?? "")
  .split(";")
  .map((value) => value.split(",").map(Number))
  .filter((value) => value.length === 4 && value.every(Number.isFinite));
let devRotationIndex = 0;
const rotationMatrix = new THREE.Matrix4();
const controlAxis = new THREE.Vector3();
const controlRotation = new THREE.Quaternion();
const rotationControl = new RoundedArcball(bubbleEnabled, bubbleLoopsEnabled);
const priorDragRotation = new THREE.Quaternion();
const dragDelta = new THREE.Quaternion();
const heldClearance = 1.15;
const landingFriction = 0.25;
const settlingFriction = 0.58;
const stackedFriction = 1.08;
const settlingGripDelay = 0.22;
const crownFollowLimit = 0.65;
const loweringSpeed = 4.2;
const tapMaxDuration = 280;
const tapMaxTravel = 10;

function number(value: number) {
  return Math.round(value * 10000) / 10000;
}

function vector(value: { x: number; y: number; z: number }) {
  return [number(value.x), number(value.y), number(value.z)];
}

function quaternion(value: { x: number; y: number; z: number; w: number }) {
  return [number(value.x), number(value.y), number(value.z), number(value.w)];
}

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
    if (["Paddling jade foot", "Tucked foot", "Broad resting foot", "Living foot"].some((name) => object.name.startsWith(name))) feet.push(object);
    if (["Tortoise eye", "Sleepy eye", "Toucan eye", "Living eye"].some((name) => object.name.startsWith(name))
      && !object.name.toLowerCase().includes("sparkle") && !object.name.toLowerCase().includes("glimmer")) eyes.push(object);
    if ((species === "tortoise" && object.name.startsWith("Curious head"))
      || (species === "capybara" && object.name.startsWith("Squared head"))
      || (species === "toucan" && object.name === "Head")) head = object;
  });
  return { feet, eyes, head };
}

function addAnimalColliders(body: RAPIER.RigidBody, species: SpeciesId, fixed: boolean) {
  const friction = fixed ? stackedFriction : landingFriction;
  const material = (desc: RAPIER.ColliderDesc, density: number) =>
    desc
      .setFriction(friction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(0)
      .setDensity(density);

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
  } else if (species === "toucan") {
    // The beak changes the silhouette and contacts, but stays deliberately light.
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.56, 0.55, 0.54, 0.16).setTranslation(0, 0.53, -0.18), 1.0), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.51, 0.47, 0.39, 0.14).setTranslation(0, 0.38, 0.57), 0.55), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.34, 0.76, 0.19, 0.06).setTranslation(0, -0.68, 0.52), 0.10), body);
    world.createCollider(material(RAPIER.ColliderDesc.roundCuboid(0.45, 0.34, 0.07, 0.03).setTranslation(0, 0.31, -0.91), 2.6), body);
  } else {
    for (const { vertices, d } of expansionColliders[species]) {
      const shape = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
      if (!shape) throw new Error(`Invalid collision hull for ${species}`);
      world.createCollider(material(shape, d), body);
    }
  }
}

function createAnimal(species: SpeciesId, position: THREE.Vector3, rotation: THREE.Quaternion, fixed = false) {
  const bodyDesc = fixed
    ? RAPIER.RigidBodyDesc.fixed()
    : RAPIER.RigidBodyDesc.dynamic().setLinearDamping(0.42).setAngularDamping(1.45).setCcdEnabled(true);
  bodyDesc.setTranslation(position.x, position.y, position.z).setRotation(rotation);
  const body = world.createRigidBody(bodyDesc);
  addAnimalColliders(body, species, fixed);
  const template = modelTemplates.get(species)!;
  const group = new THREE.Group();
  const model = template.model.clone(true);
  group.add(model);
  scene.add(group);
  const rig = makeRig(model, species);
  const animal: Animal = { id: nextAnimalId++, species, halfExtents: template.halfExtents, body, group, model, ...rig, birth: performance.now() / 1000, quietFor: 0, counted: fixed, fixed, landingPulse: 0, hadSupport: fixed, supportedFor: 0, lowering: false, lastSafeZ: position.z, settlingGripRaised: fixed, stackFrictionRestored: fixed };
  animals.push(animal);
  for (let index = 0; index < body.numColliders(); index += 1) {
    colliderOwners.set(body.collider(index).handle, animal);
  }
  recorder.event("animal_created", { id: animal.id, species, fixed, position: vector(position), rotation: quaternion(rotation) });
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
  if (devSpeciesSequence.length > 0) return devSpeciesSequence[devSpeciesIndex++ % devSpeciesSequence.length];
  const requested = diagnosticParams?.get("species") as SpeciesId | null;
  if (requested && speciesIds.includes(requested)) return requested;
  if (speciesBag.length === 0) {
    speciesBag = [...speciesIds];
    for (let index = speciesBag.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [speciesBag[index], speciesBag[swap]] = [speciesBag[swap], speciesBag[index]];
    }
  }
  return speciesBag.pop()!;
}

function crownLandingAnchor() {
  let crown: Animal | null = null;
  let crownTop = -Infinity;
  for (const animal of animals) {
    if (!animal.counted || animal.fixed) continue;
    const p = animal.body.translation();
    const r = animal.body.rotation();
    const top = p.z + verticalExtent(new THREE.Quaternion(r.x, r.y, r.z, r.w), animal.halfExtents);
    if (top > crownTop) {
      crown = animal;
      crownTop = top;
    }
  }

  const position = defaultHeldPosition.clone();
  if (crown && forgivingPlacementEnabled) {
    const p = crown.body.translation();
    const offset = new THREE.Vector2(p.x, p.y).sub(defaultHeldPosition);
    if (offset.length() > crownFollowLimit) offset.setLength(crownFollowLimit);
    position.add(offset);
  }
  return { position, crown };
}

function positionHeldAtAnchor() {
  if (!held) return;
  held.position.copy(heldAnchorPosition);
}

function createHeld() {
  if (lost) return;
  heldSpecies = takeNextSpecies();
  const template = modelTemplates.get(heldSpecies)!;
  held = new THREE.Group();
  heldModel = template.model.clone(true);
  heldRotationRadius = template.rotationRadius;
  heldRig = makeRig(heldModel, heldSpecies);
  held.add(heldModel);
  const devRotation = devRotations[devRotationIndex++ % devRotations.length];
  const eulerDegrees = ["rx", "ry", "rz"].map((key) => Number(diagnosticParams?.get(key)));
  if (devRotation) {
    held.quaternion.set(devRotation[0], devRotation[1], devRotation[2], devRotation[3]).normalize();
  } else if (eulerDegrees.every(Number.isFinite)) {
    held.quaternion.setFromEuler(new THREE.Euler(...eulerDegrees.map(THREE.MathUtils.degToRad) as [number, number, number]));
  } else {
    held.quaternion.copy(randomQuaternion());
  }
  const landingAnchor = crownLandingAnchor();
  heldPosition.copy(landingAnchor.position);
  heldAnchorPosition.set(
    heldPosition.x,
    heldPosition.y,
    landingTop(heldPosition.x, heldPosition.y) + verticalExtent(held.quaternion, template.halfExtents) + heldClearance,
  );
  positionHeldAtAnchor();
  rotationInput.set(0, 0);
  spinVelocity.set(0, 0, 0);
  dropButton.hidden = true;
  dropButton.disabled = true;
  scene.add(held);
  canvas.dataset.heldSpecies = heldSpecies;
  if (diagnosticsEnabled) {
    canvas.dataset.heldPosition = held.position.toArray().join(",");
    if (landingAnchor.crown) canvas.dataset.crownPosition = vector(landingAnchor.crown.body.translation()).join(",");
    else delete canvas.dataset.crownPosition;
  }
  recorder.event("held_ready", {
    species: heldSpecies,
    position: vector(held.position),
    rotation: quaternion(held.quaternion),
    crownId: landingAnchor.crown?.id ?? null,
    crownPosition: landingAnchor.crown ? vector(landingAnchor.crown.body.translation()) : null,
  });
}

function releaseHeld() {
  bubblePopping = false;
  bubblePopTimer = undefined;
  dropButton.disabled = true;
  spinVelocity.set(0, 0, 0);
  if (!held || lost) return;
  rotationControl.end();
  rotationControl.update(null, camera);
  const animal = createAnimal(heldSpecies!, held.position.clone(), held.quaternion.clone());
  newestReleased = animal;
  fallingFor = 0;
  recorder.event("released", { id: animal.id, species: animal.species, position: vector(held.position), rotation: quaternion(held.quaternion) });
  // Preserve the generous rotation clearance without turning it into impact
  // energy. Descend as a non-colliding sensor to the actual collider surface.
  animal.lowering = true;
  animal.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  for (let index = 0; index < animal.body.numColliders(); index += 1) {
    const collider = animal.body.collider(index);
    collider.setSensor(true);
    collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
  }
  scene.remove(held);
  held = null;
  heldModel = null;
  heldRig = null;
  heldSpecies = null;
  delete canvas.dataset.heldSpecies;
  animal.resolutionTimer = window.setTimeout(() => resolveOverdueAnimal(animal), 8500);
}

function popHeldBubble() {
  if (!held || lost || engineFault || bubblePopping) return;
  bubblePopping = true;
  spinVelocity.set(0, 0, 0);
  rotationControl.pop();
  recorder.event("bubble_popped", { species: heldSpecies, rotation: quaternion(held.quaternion) });
  bubblePopTimer = window.setTimeout(() => {
    bubblePopTimer = undefined;
    if (held && !lost && !engineFault) releaseHeld();
    else bubblePopping = false;
  }, reducedMotion ? 24 : 145);
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

function touchesStack(animal: Animal) {
  for (const support of animals) {
    if (support === animal || !support.counted) continue;
    for (let ownIndex = 0; ownIndex < animal.body.numColliders(); ownIndex += 1) {
      for (let supportIndex = 0; supportIndex < support.body.numColliders(); supportIndex += 1) {
        let touching = false;
        world.contactPair(animal.body.collider(ownIndex), support.body.collider(supportIndex), (manifold) => {
          if (manifold.numSolverContacts() > 0) touching = true;
        });
        if (touching) return true;
      }
    }
  }
  return false;
}

function intersectsLandingSurface(animal: Animal) {
  for (let ownIndex = 0; ownIndex < animal.body.numColliders(); ownIndex += 1) {
    const ownCollider = animal.body.collider(ownIndex);
    if (world.intersectionPair(ownCollider, platformCollider)) return true;
    for (const support of animals) {
      if (support === animal || !support.counted) continue;
      for (let supportIndex = 0; supportIndex < support.body.numColliders(); supportIndex += 1) {
        if (world.intersectionPair(ownCollider, support.body.collider(supportIndex))) return true;
      }
    }
  }
  return false;
}

function finishLowering(animal: Animal, time: number) {
  const position = animal.body.translation();
  recorder.event("lowering_contact", { id: animal.id, species: animal.species, intersectingZ: number(position.z), safeZ: number(animal.lastSafeZ) });
  animal.body.setTranslation({ x: position.x, y: position.y, z: animal.lastSafeZ }, true);
  for (let index = 0; index < animal.body.numColliders(); index += 1) {
    animal.body.collider(index).setSensor(false);
  }
  animal.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  animal.body.setLinvel({ x: 0, y: 0, z: -0.05 }, true);
  animal.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  animal.birth = time;
  animal.lowering = false;
}

function emitContactAudio() {
  physicsStep += 1;
  const peaks = new Map<string, { first: Animal; second: Animal; force: number }>();
  physicsEvents.drainContactForceEvents((event) => {
    const first = colliderOwners.get(event.collider1());
    const second = colliderOwners.get(event.collider2());
    if (!first || !second || first === second || first.lowering || second.lowering || (first.fixed && second.fixed)) return;
    const key = first.id < second.id ? `${first.id}:${second.id}` : `${second.id}:${first.id}`;
    const force = event.maxForceMagnitude();
    const peak = peaks.get(key);
    if (!peak || force > peak.force) peaks.set(key, { first, second, force });
  });

  let strongest: {
    key: string;
    first: Animal;
    second: Animal;
    force: number;
    ratio: number;
    baselineRatio: number;
    spikeRatio: number;
    trigger: "initial" | "renewed-impact";
  } | null = null;
  for (const [key, peak] of peaks) {
    const previous = contactStates.get(key);
    const movingMass = peak.first.fixed ? peak.second.body.mass()
      : peak.second.fixed ? peak.first.body.mass()
        : Math.min(peak.first.body.mass(), peak.second.body.mass());
    const ratio = peak.force / Math.max(0.01, movingMass * 9.81);
    const observation = observeContactAudio(previous, physicsStep, ratio);
    contactStates.set(key, observation.state);
    if (observation.rearmed) {
      recorder.event("ceramic_contact_rearmed", {
        pair: key,
        baselineRatio: number(observation.state.baselineRatio),
        quietSteps: observation.state.quietSteps,
      });
    }
    if (!observation.trigger || (strongest && ratio <= strongest.ratio)) continue;
    strongest = {
      key,
      ...peak,
      ratio,
      baselineRatio: previous?.baselineRatio ?? ratio,
      spikeRatio: observation.spikeRatio,
      trigger: observation.trigger,
    };
  }

  if (strongest) {
    const midpoint = new THREE.Vector3()
      .copy(strongest.first.group.position)
      .add(strongest.second.group.position)
      .multiplyScalar(0.5)
      .project(camera);
    const kind = strongest.ratio >= 0.9 ? "body" : "settling";
    const strength = THREE.MathUtils.clamp((strongest.ratio - 0.12) / 2.4, 0, 1);
    const played = ceramicAudio.play(kind, strength, midpoint.x);
    recorder.event("ceramic_contact", {
      pair: strongest.key,
      kind,
      force: number(strongest.force),
      weightRatio: number(strongest.ratio),
      baselineRatio: number(strongest.baselineRatio),
      spikeRatio: number(strongest.spikeRatio),
      trigger: strongest.trigger,
      played,
    });
    if (diagnosticsEnabled) {
      canvas.dataset.audioContact = `${kind}:${strongest.ratio.toFixed(3)}:${played}`;
    }
  }

  for (const [key, state] of contactStates) {
    if (state.lastSeenStep < physicsStep - 180) contactStates.delete(key);
  }
}

function updateRotationControl(dt: number) {
  if (!held || pointerId !== null) return;
  const speed = spinVelocity.length();
  if (speed < 0.025) { spinVelocity.set(0, 0, 0); return; }
  // Exact exponential decay keeps the flick consistent across frame rates.
  const decay = Math.exp(-5.0 * dt);
  controlRotation.setFromAxisAngle(controlAxis.copy(spinVelocity).normalize(), speed * (1 - decay) / 5.0);
  held.quaternion.premultiply(controlRotation).normalize();
  spinVelocity.multiplyScalar(decay);
}

function updateHeld(dt: number, time: number) {
  if (!held) return;
  updateRotationControl(dt);
  // The initial pose establishes one physical/control pivot for the entire
  // held phase, including inertial spin. Actual contact is resolved only after
  // Drop by the sensor-lowering path, so rotation needs no height correction.
  positionHeldAtAnchor();
  if (heldRig) animateRig(heldRig, time, pointerId === null ? 0.22 : 1);
  if (diagnosticsEnabled) {
    canvas.dataset.heldPosition = held.position.toArray().join(",");
    canvas.dataset.heldAnchorPosition = heldAnchorPosition.toArray().join(",");
    canvas.dataset.heldQuaternion = held.quaternion.toArray().join(",");
  }
}

function endGame(reason = "unknown", animal?: Animal) {
  if (lost) return;
  if (bubblePopTimer !== undefined) clearTimeout(bubblePopTimer);
  bubblePopTimer = undefined;
  bubblePopping = false;
  rotationControl.end();
  rotationControl.update(null, camera);
  recorder.event("game_over", { reason, score, engineFault });
  lost = true;
  // Never retarget the camera to an older piece during a collapse.
  fallTarget ??= animal === newestReleased ? animal ?? null : null;
  endingElapsed = 0;
  dropButton.disabled = true;
  spinVelocity.set(0, 0, 0);
  for (const animal of animals) {
    if (animal.resolutionTimer !== undefined) clearTimeout(animal.resolutionTimer);
  }
  if (held) scene.remove(held);
  held = null;
  heldModel = null;
  heldRig = null;
  heldSpecies = null;
  delete canvas.dataset.heldSpecies;
  rotationInput.set(0, 0);
  pointerId = null;
  scoreElement.classList.add("lost");
  dropButton.hidden = false;
  dropButton.disabled = false;
}

function countAnimal(animal: Animal) {
  if (animal.counted || lost) return;
  if (animal.resolutionTimer !== undefined) clearTimeout(animal.resolutionTimer);
  animal.counted = true;
  animal.landingPulse = 1;
  // Scoring is bookkeeping, not a physics transition. Forcing a marginally
  // supported body asleep here can preserve penetration in Rapier's contact
  // cache; a later solver pass then ejects the whole stack. Leave velocity,
  // constraints, and sleep state untouched so the solver finishes naturally.
  score += 1;
  recorder.event("scored", { id: animal.id, species: animal.species, score, position: vector(animal.body.translation()), rotation: quaternion(animal.body.rotation()) });
  scoreElement.value = String(score);
  scoreElement.textContent = String(score);
  scoreElement.classList.add("bump");
  setTimeout(() => scoreElement.classList.remove("bump"), 180);
  createHeld();
}

function resolveOverdueAnimal(animal: Animal) {
  if (animal.counted || lost || animal.fixed) return;
  try {
    // This timer runs outside requestAnimationFrame. If rendering or physics
    // stopped after a browser/engine exception, it can still end the turn.
    const frameStopped = performance.now() - lastFrameWallTime > 1500;
    if (frameStopped) {
      engineFault = true;
      endGame("frame_watchdog");
    } else if (animal.lowering) {
      endGame("lowering_timeout");
    } else if (touchesStack(animal)) {
      countAnimal(animal);
    } else {
      endGame("unsupported_watchdog");
    }
  } catch (error) {
    console.error("Failed to resolve overdue animal", error);
    engineFault = true;
    endGame("watchdog_exception");
  }
}

function updatePhysics(dt: number, time: number) {
  accumulator = Math.min(accumulator + dt, 0.12);
  while (accumulator >= world.timestep) {
    for (const animal of animals) {
      if (!animal.lowering) continue;
      const position = animal.body.translation();
      animal.lastSafeZ = position.z;
      animal.body.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z - loweringSpeed * world.timestep });
    }
    world.step(physicsEvents);
    emitContactAudio();
    for (const animal of animals) {
      if (animal.lowering && intersectsLandingSurface(animal)) finishLowering(animal, time);
    }
    accumulator -= world.timestep;
  }

  let maxStackUpwardSpeed = 0;
  for (const animal of animals) {
    const p = animal.body.translation();
    const r = animal.body.rotation();
    animal.group.position.set(p.x, p.y, p.z);
    animal.group.quaternion.set(r.x, r.y, r.z, r.w);
    animateRig(animal, time + animal.birth, animal.fixed ? 0.18 : 0.28);

    if (animal.counted && !animal.fixed && !animal.stackFrictionRestored && animal.body.isSleeping()) {
      // Restore grippy stacking friction only after Rapier itself has accepted
      // the contact configuration and put the body to sleep.
      for (let index = 0; index < animal.body.numColliders(); index += 1) {
        animal.body.collider(index).setFriction(stackedFriction);
      }
      animal.stackFrictionRestored = true;
      recorder.event("natural_sleep", { id: animal.id, species: animal.species, position: vector(p) });
    }

    if (animal.counted && !animal.fixed) maxStackUpwardSpeed = Math.max(maxStackUpwardSpeed, animal.body.linvel().z);
    if (!animal.fixed && !animal.lowering && touchesPlatform(animal)) endGame("platform_contact", animal);

    if (!lost && !animal.fixed && !animal.counted && !animal.lowering) {
      const linear = animal.body.linvel();
      const angular = animal.body.angvel();
      const linearSpeed = Math.hypot(linear.x, linear.y, linear.z);
      const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
      const supported = touchesStack(animal);
      animal.supportedFor = supported ? animal.supportedFor + dt : Math.max(0, animal.supportedFor - dt * 2);
      if (supported && !animal.hadSupport) {
        // Low landing friction prevents a corner from pole-vaulting the body.
        // Absorb the first impact like a soft toy, then restore strong static
        // stacking friction once the placement has been counted.
        animal.hadSupport = true;
        recorder.event("first_support", {
          id: animal.id,
          species: animal.species,
          position: vector(p),
          linearVelocity: vector(linear),
          angularVelocity: vector(angular),
        });
        animal.body.setLinvel({ x: linear.x * 0.45, y: linear.y * 0.45, z: Math.min(linear.z, 0) }, true);
        animal.body.setAngvel({ x: angular.x * 0.55, y: angular.y * 0.55, z: angular.z * 0.55 }, true);
      }
      if (forgivingPlacementEnabled && animal.hadSupport && !animal.settlingGripRaised && animal.supportedFor >= settlingGripDelay) {
        for (let index = 0; index < animal.body.numColliders(); index += 1) {
          animal.body.collider(index).setFriction(settlingFriction);
        }
        animal.settlingGripRaised = true;
        recorder.event("settling_grip", {
          id: animal.id,
          species: animal.species,
          supportedFor: number(animal.supportedFor),
          friction: settlingFriction,
        });
      }
      const calm = animal.body.isSleeping() || (linearSpeed < 0.30 && angularSpeed < 0.42);
      // Solver corrections at compound-collider corners can produce tiny speed
      // spikes forever. Accumulate evidence of supported calm instead of
      // erasing the entire timer on every single-frame spike.
      if (supported && calm) animal.quietFor += dt;
      else animal.quietFor = Math.max(0, animal.quietFor - dt * 0.45);

      const age = time - animal.birth;
      if (!devFaultInjected && devParams?.get("fault") === "frame" && age > 0.4) {
        devFaultInjected = true;
        throw new Error("Injected frame failure for recovery testing");
      }
      const gentlySupported = supported && linearSpeed < 0.85 && angularSpeed < 1.10;
      if (diagnosticsEnabled) {
        canvas.dataset.phase = "settling";
        canvas.dataset.releaseAge = age.toFixed(3);
        canvas.dataset.bodyZ = p.z.toFixed(4);
        canvas.dataset.verticalSpeed = linear.z.toFixed(4);
        canvas.dataset.linearSpeed = linearSpeed.toFixed(4);
        canvas.dataset.angularSpeed = angularSpeed.toFixed(4);
        canvas.dataset.supported = String(supported);
        canvas.dataset.hadSupport = String(animal.hadSupport);
        canvas.dataset.supportedFor = animal.supportedFor.toFixed(3);
        canvas.dataset.frictionStage = animal.stackFrictionRestored ? "stacked" : animal.settlingGripRaised ? "settling" : "landing";
        canvas.dataset.quietFor = animal.quietFor.toFixed(3);
      }
      if (age > 0.65 && (animal.quietFor > 0.58 || (age > 3.5 && gentlySupported) || (age > 6 && supported))) {
        countAnimal(animal);
      } else if (age > 8 && !supported) {
        // Defensive deadline: a release must always resolve, even if a future
        // collider configuration avoids both the platform and the stack.
        endGame("unsupported_deadline", animal);
      }
    }

    if (!animal.fixed && (p.z < -1.5 || Math.hypot(p.x, p.y) > 4.2)) endGame("out_of_bounds", animal);
    if (animal.landingPulse > 0) {
      animal.landingPulse = Math.max(0, animal.landingPulse - dt * 4.5);
      const squash = Math.sin(animal.landingPulse * Math.PI) * 0.035;
      animal.model.scale.set(1 + squash, 1 + squash, 1 - squash * 1.4);
    }
  }
  if (diagnosticsEnabled) canvas.dataset.maxStackUpwardSpeed = maxStackUpwardSpeed.toFixed(4);
}

function updateCamera(dt: number) {
  let highest = 1.25;
  for (const animal of animals) {
    if (!animal.counted) continue;
    const p = animal.body.translation();
    const r = animal.body.rotation();
    highest = Math.max(highest, p.z + verticalExtent(new THREE.Quaternion(r.x, r.y, r.z, r.w), animal.halfExtents));
  }
  const candidate = newestReleased;
  const clearlyFalling = candidate && !candidate.lowering
    && candidate.body.linvel().z < -1
    && candidate.body.translation().z < highest - 0.6
    && !touchesStack(candidate);
  fallingFor = clearlyFalling ? fallingFor + dt : 0;
  if (!lost && !fallTarget && candidate && fallingFor >= 0.35) {
    fallTarget = candidate;
    recorder.event("fall_camera", { id: candidate.id, confirmedFor: fallingFor });
  }
  // Lock the confirmed follow instead of oscillating between follow and tower modes.
  let desired = Math.max(cameraHeight, 1.9, highest + 1.25);
  if (fallTarget && !lost) desired = Math.max(1.9, Math.min(cameraHeight, fallTarget.body.translation().z + 1.0));
  if (lost) {
    endingElapsed += dt;
    // Platform contact can happen before the airborne confirmation window ends.
    // Hold briefly only if not already following; never stop an ongoing descent.
    desired = !fallTarget && endingElapsed < 0.35 ? cameraHeight : 1.9;
  }
  if (fallTarget || lost) {
    const remaining = Math.max(0, cameraHeight - desired);
    // Cap both speed and acceleration: a distant falling target must not cause a catch-up lurch.
    const targetSpeed = Math.min(2.0, remaining * 2.2);
    const acceleration = 2.5 * dt;
    cameraFallSpeed += THREE.MathUtils.clamp(targetSpeed - cameraFallSpeed, -acceleration, acceleration);
    cameraHeight -= Math.min(remaining, cameraFallSpeed * dt);
  } else {
    cameraFallSpeed = 0;
    cameraHeight = THREE.MathUtils.damp(cameraHeight, desired, 2.7, dt);
  }
  if (lost && !finalViewRecorded && endingElapsed >= 0.35 && Math.abs(cameraHeight - 1.9) < 0.06) {
    finalViewRecorded = true;
    recorder.event("final_view", { cameraHeight });
  }
  if (diagnosticsEnabled) canvas.dataset.cameraHeight = cameraHeight.toFixed(4);
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

function recordTrace(dt: number) {
  if (!recorder.enabled) return;
  const bodies = animals.map((animal) => {
    const position = animal.body.translation();
    const rotation = animal.body.rotation();
    const linearVelocity = animal.body.linvel();
    const angularVelocity = animal.body.angvel();
    const upwardAnomaly = (animal.counted || animal.hadSupport) && linearVelocity.z > 0.75;
    if (upwardAnomaly && !activeUpwardAnomalies.has(animal.id)) {
      activeUpwardAnomalies.add(animal.id);
      recorder.event("upward_anomaly", {
        id: animal.id,
        species: animal.species,
        counted: animal.counted,
        position: vector(position),
        linearVelocity: vector(linearVelocity),
        angularVelocity: vector(angularVelocity),
      });
    } else if (!upwardAnomaly && linearVelocity.z < 0.25) {
      activeUpwardAnomalies.delete(animal.id);
    }
    return {
      id: animal.id,
      species: animal.species,
      counted: animal.counted,
      fixed: animal.fixed,
      lowering: animal.lowering,
      supported: animal.hadSupport,
      sleeping: animal.body.isSleeping(),
      p: vector(position),
      q: quaternion(rotation),
      v: vector(linearVelocity),
      w: vector(angularVelocity),
    };
  });
  recorder.sample({
    dt: number(dt),
    accumulator: number(accumulator),
    score,
    lost,
    engineFault,
    pointer: pointerId,
    rotationInput: [number(rotationInput.x), number(rotationInput.y)],
    held: held && heldSpecies ? { species: heldSpecies, p: vector(held.position), q: quaternion(held.quaternion) } : null,
    bodies,
  });
  const snapshot = recorder.snapshot();
  shareTraceButton.title = `Share trace (${snapshot.samples} samples)`;
}

function reset() {
  if (bubblePopTimer !== undefined) clearTimeout(bubblePopTimer);
  bubblePopTimer = undefined;
  bubblePopping = false;
  rotationControl.end();
  recorder.event("reset", { score, engineFault });
  fallTarget = null;
  newestReleased = null;
  fallingFor = 0;
  cameraFallSpeed = 0;
  finalViewRecorded = false;
  endingElapsed = 0;
  cameraHeight = 1.9;
  for (const animal of animals.splice(0)) {
    if (animal.resolutionTimer !== undefined) clearTimeout(animal.resolutionTimer);
    world.removeRigidBody(animal.body);
    scene.remove(animal.group);
  }
  colliderOwners.clear();
  contactStates.clear();
  physicsStep = 0;
  physicsEvents.clear();
  ceramicAudio.reset();
  if (held) scene.remove(held);
  held = null;
  heldModel = null;
  heldRig = null;
  heldSpecies = null;
  delete canvas.dataset.heldSpecies;
  speciesBag = [];
  engineFault = false;
  devFaultInjected = false;
  score = 0;
  lost = false;
  pointerId = null;
  scoreElement.value = "0";
  scoreElement.textContent = "0";
  scoreElement.classList.remove("lost", "bump");
  dropButton.hidden = true;
  dropButton.disabled = true;
  const baseHeight = modelTemplates.get("tortoise")!.halfExtents.z;
  createAnimal("tortoise", new THREE.Vector3(0, 0, baseHeight), new THREE.Quaternion(), true);
  createHeld();
}

canvas.addEventListener("pointerdown", (event) => {
  ceramicAudio.unlock();
  if (lost || pointerId !== null || bubblePopping) return;
  if (!held) return;
  rotationControl.update(held, camera, heldAnchorPosition, heldRotationRadius);
  pointerId = event.pointerId;
  canvas.setPointerCapture(pointerId);
  spinVelocity.set(0, 0, 0);
  pointerStartedAt = performance.now();
  lastDragTime = pointerStartedAt;
  pointerStart.set(event.clientX, event.clientY);
  pointerTravel = 0;
  tapCandidate = pointerStart.distanceTo(rotationControl.center) <= rotationControl.radius * 1.08;
  dragOrigin.set(event.clientX, event.clientY);
  rotationControl.begin(event.clientX, event.clientY, held.quaternion, camera);
  rotationInput.set(0, 0);
  recorder.event("pointer_down", { pointer: event.pointerId, x: number(event.clientX), y: number(event.clientY), species: heldSpecies });
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== pointerId || !held) return;
  const now = performance.now();
  rotationInput.set(event.clientX - dragOrigin.x, event.clientY - dragOrigin.y);
  pointerPosition.set(event.clientX, event.clientY);
  pointerTravel = Math.max(pointerTravel, pointerStart.distanceTo(pointerPosition));
  if (pointerTravel > tapMaxTravel) {
    tapCandidate = false;
    rotationControl.engageLoops();
  }
  dragOrigin.set(event.clientX, event.clientY);
  const distance = rotationInput.length();
  if (distance === 0) return;
  priorDragRotation.copy(held.quaternion);
  rotationControl.move(event.clientX, event.clientY, held.quaternion);
  dragDelta.copy(held.quaternion).multiply(priorDragRotation.invert()).normalize();
  if (dragDelta.w < 0) dragDelta.set(-dragDelta.x, -dragDelta.y, -dragDelta.z, -dragDelta.w);
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(dragDelta.w, -1, 1));
  controlAxis.set(dragDelta.x, dragDelta.y, dragDelta.z).normalize();
  const speed = Math.min(1.5, angle / Math.max(0.008, (now - lastDragTime) / 1000));
  spinVelocity.copy(controlAxis).multiplyScalar(speed * 0.45);
  lastDragTime = now;
});

function finishPointer(pointer: number, reason: string) {
  if (pointer !== pointerId) return;
  const shouldPop = reason.endsWith("pointerup")
    && tapCandidate
    && pointerTravel <= tapMaxTravel
    && performance.now() - pointerStartedAt <= tapMaxDuration;
  recorder.event("pointer_finished", { pointer, reason, rotationInput: [number(rotationInput.x), number(rotationInput.y)] });
  pointerId = null;
  rotationControl.end();
  rotationInput.set(0, 0);
  tapCandidate = false;
  if (shouldPop) {
    popHeldBubble();
  } else if (!reason.endsWith("pointerup") || performance.now() - lastDragTime > 90) {
    spinVelocity.set(0, 0, 0);
  }
}

canvas.addEventListener("pointerup", (event) => finishPointer(event.pointerId, "canvas_pointerup"));
canvas.addEventListener("pointercancel", (event) => {
  finishPointer(event.pointerId, "canvas_pointercancel");
});
// Mobile browsers can revoke pointer capture when their own chrome or a system
// gesture takes over. Without this path, the old pointer ID remains latched and
// all later presses are ignored, leaving the animal suspended indefinitely.
canvas.addEventListener("lostpointercapture", (event) => finishPointer(event.pointerId, "lost_pointer_capture"));
addEventListener("pointerup", (event) => finishPointer(event.pointerId, "window_pointerup"), { capture: true });
addEventListener("pointercancel", (event) => finishPointer(event.pointerId, "window_pointercancel"), { capture: true });
addEventListener("touchcancel", finishInterruptedPointer, { capture: true });

function finishInterruptedPointer() {
  spinVelocity.set(0, 0, 0);
  if (pointerId !== null) finishPointer(pointerId, "touch_or_page_interruption");
}

addEventListener("blur", () => {
  recorder.event("window_blur", { pointer: pointerId });
  finishInterruptedPointer();
});
document.addEventListener("visibilitychange", () => {
  recorder.event("visibility_changed", { state: document.visibilityState, pointer: pointerId });
  if (document.visibilityState === "hidden") {
    finishInterruptedPointer();
    ceramicAudio.suspendForBackground();
  }
  else ceramicAudio.recoverAfterForeground();
});
addEventListener("pageshow", () => ceramicAudio.recoverAfterForeground());

function restartGame() {
  recorder.event("restart_requested", { score, engineFault });
  // Rebuild the Rapier/WebGL state after an engine fault; ordinary gameplay
  // losses still use the faster in-memory reset.
  if (engineFault) location.reload();
  else reset();
}

dropButton.addEventListener("click", () => {
  ceramicAudio.unlock();
  if (lost) { restartGame(); return; }
});
shareTraceButton.addEventListener("click", async () => {
  shareTraceButton.disabled = true;
  const label = shareTraceButton.textContent;
  try {
    recorder.event("trace_shared", recorder.snapshot());
    shareTraceButton.textContent = "Preparing…";
    await recorder.share();
    shareTraceButton.textContent = "Shared";
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) console.error("Could not share trace", error);
    shareTraceButton.textContent = label;
  } finally {
    shareTraceButton.disabled = false;
    setTimeout(() => { shareTraceButton.textContent = label; }, 1200);
  }
});
addEventListener("resize", resize);

resize();
reset();

// A one-time invitation to rotate, using exactly the same catchable inertia as a flick.
if (!reducedMotion) {
  spinVelocity.set(0.3, 1, 0).normalize().applyQuaternion(camera.quaternion).multiplyScalar(4.4);
}

function frame(nowMilliseconds: number) {
  // Schedule first so a one-off exception cannot permanently stop the loop.
  requestAnimationFrame(frame);
  lastFrameWallTime = performance.now();
  const time = nowMilliseconds / 1000;
  const dt = Math.min(time - lastTime, 0.05);
  lastTime = time;
  try {
    if (!engineFault) {
      updateHeld(dt, time);
      updatePhysics(dt, time);
      updateCamera(dt);
    }
    rotationControl.update(held, camera, held ? heldAnchorPosition : undefined, held ? heldRotationRadius : undefined);
    renderer.render(scene, camera);
    recordTrace(dt);
  } catch (error) {
    console.error("Menagerie frame failed", error);
    recorder.event("frame_exception", { message: error instanceof Error ? error.message : String(error) });
    engineFault = true;
    endGame("frame_exception");
  }
}

requestAnimationFrame(frame);
