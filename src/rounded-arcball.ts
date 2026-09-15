import * as THREE from "three";

/**
 * A one-pointer virtual sphere with a rounded transition to pure screen roll.
 *
 * The pointer is projected onto a hemisphere near the centre. Toward the
 * outside, a cubic Hermite shoulder eases that hemisphere into its equator,
 * so circular drags become view-axis twists without a separate mode or ring.
 */
export class RoundedArcball {
  readonly bubble = document.createElement("div");
  readonly center = new THREE.Vector2();
  radius = 160;
  active = false;

  private readonly bubbleEnabled: boolean;
  private readonly loopsEnabled: boolean;
  private readonly loopPaths: SVGPathElement[] = [];
  private loopsReady = false;
  private readonly start = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly screen = new THREE.Vector3();
  private readonly initial = new THREE.Quaternion();
  private readonly view = new THREE.Quaternion();
  private readonly inverseView = new THREE.Quaternion();
  private readonly delta = new THREE.Quaternion();
  private readonly loopOrientation = new THREE.Quaternion();
  private readonly loopView = new THREE.Quaternion();
  private readonly loopPoint = new THREE.Vector3();

  constructor(bubbleEnabled: boolean, loopsEnabled = false) {
    this.bubbleEnabled = bubbleEnabled;
    this.loopsEnabled = bubbleEnabled && loopsEnabled;
    this.bubble.id = "rotation-bubble";
    this.bubble.hidden = !bubbleEnabled;
    this.bubble.setAttribute("aria-hidden", "true");
    this.bubble.innerHTML = `
      <svg class="bubble-loops" viewBox="0 0 200 200" aria-hidden="true">
        <path class="bubble-loop loop-a loop-back"></path>
        <path class="bubble-loop loop-b loop-back"></path>
        <path class="bubble-loop loop-c loop-back"></path>
        <path class="bubble-loop loop-a loop-front"></path>
        <path class="bubble-loop loop-b loop-front"></path>
        <path class="bubble-loop loop-c loop-front"></path>
      </svg>
      <span class="bubble-highlight"></span>
      <span class="bubble-pop-sweep"></span>
      <span class="bubble-pop-fragments">
        <i class="bubble-fragment fragment-a"></i>
        <i class="bubble-fragment fragment-b"></i>
        <i class="bubble-fragment fragment-c"></i>
        <i class="bubble-fragment fragment-d"></i>
        <i class="bubble-droplet droplet-a"></i>
        <i class="bubble-droplet droplet-b"></i>
        <i class="bubble-droplet droplet-c"></i>
      </span>
    `;
    this.bubble.dataset.loopsEnabled = String(this.loopsEnabled);
    this.loopPaths.push(...this.bubble.querySelectorAll<SVGPathElement>(".bubble-loop"));
    this.bubble.addEventListener("animationend", (event) => {
      if (event.animationName === "bubble-pop" || event.animationName === "bubble-pop-reduced") this.finishPop();
    });
    document.querySelector("#app")!.append(this.bubble);
  }

  update(held: THREE.Object3D | null, camera: THREE.Camera, worldCenter?: THREE.Vector3, worldRadius?: number) {
    if (!held) {
      this.active = false;
      this.loopsReady = false;
      this.bubble.classList.remove("active", "looping");
      // The physics handoff happens at the rupture frame, before the last
      // film fragments have faded. Let the pop finish independently.
      if (!this.bubble.classList.contains("popping")) this.bubble.classList.remove("held");
      delete this.bubble.dataset.active;
      return;
    }
    if (this.loopsEnabled && (!this.loopsReady || this.active)) this.updateLoops(held, camera);
    if (this.active) return;

    // Keep the control large enough for reliable roll on a phone, and centre
    // it on the actual rotation pivot. Do not clamp it away from that pivot.
    const projectedRadius = worldRadius && camera instanceof THREE.OrthographicCamera
      ? worldRadius * innerHeight / (camera.top - camera.bottom)
      : 0;
    const availableRadius = Math.min(190, innerWidth * 0.45, innerHeight * 0.28);
    this.radius = Math.min(availableRadius, Math.max(132, projectedRadius * 1.03, Math.min(innerWidth, innerHeight) * 0.42));
    this.screen.copy(worldCenter ?? held.position).project(camera);
    this.center.set(
      innerWidth * (this.screen.x + 1) / 2,
      innerHeight * (1 - this.screen.y) / 2,
    );
    this.bubble.style.left = `${this.center.x}px`;
    this.bubble.style.top = `${this.center.y}px`;
    this.bubble.style.width = `${this.radius * 2}px`;
    this.bubble.dataset.centerX = String(this.center.x);
    this.bubble.dataset.centerY = String(this.center.y);
    this.bubble.dataset.radius = String(this.radius);
    if (this.bubbleEnabled) this.bubble.classList.add("held");
  }

  begin(x: number, y: number, orientation: THREE.Quaternion, camera: THREE.Camera) {
    this.active = true;
    this.bubble.classList.remove("looping");
    this.bubble.dataset.active = "true";
    this.initial.copy(orientation);
    this.view.copy(camera.quaternion);
    this.inverseView.copy(camera.quaternion).invert();
    this.project(x, y, this.start);
    if (this.bubbleEnabled) this.bubble.classList.add("active");
  }

  engageLoops() {
    if (this.active && this.loopsEnabled) this.bubble.classList.add("looping");
  }

  move(x: number, y: number, orientation: THREE.Quaternion) {
    if (!this.active) return;
    this.delta.setFromUnitVectors(this.start, this.project(x, y, this.point));
    this.delta.premultiply(this.view).multiply(this.inverseView);
    // Anchor every move to pointer-down so returning to the start exactly
    // undoes the gesture and sampling rate cannot change the result.
    orientation.copy(this.initial).premultiply(this.delta).normalize();
  }

  end() {
    this.active = false;
    delete this.bubble.dataset.active;
    this.bubble.classList.remove("active", "looping");
  }

  pop() {
    this.active = false;
    delete this.bubble.dataset.active;
    this.bubble.classList.remove("active", "looping");
    if (this.bubbleEnabled) this.bubble.classList.add("popping");
  }

  cancelPop() {
    this.finishPop();
  }

  private finishPop() {
    this.bubble.classList.remove("held", "popping");
  }

  private updateLoops(held: THREE.Object3D, camera: THREE.Camera) {
    if (!this.loopsEnabled) return;

    held.getWorldQuaternion(this.loopOrientation);
    this.loopView.copy(camera.quaternion).invert();
    const circles = [
      (angle: number) => this.loopPoint.set(Math.cos(angle), Math.sin(angle), 0),
      (angle: number) => this.loopPoint.set(Math.cos(angle), 0, Math.sin(angle)),
      (angle: number) => this.loopPoint.set(0, Math.cos(angle), Math.sin(angle)),
    ];

    circles.forEach((circle, circleIndex) => {
      let front = "";
      let back = "";
      let previousFront: boolean | undefined;
      for (let index = 0; index <= 72; index += 1) {
        const angle = index / 72 * Math.PI * 2;
        const point = circle(angle).applyQuaternion(this.loopOrientation).applyQuaternion(this.loopView);
        const x = 100 + point.x * 98.3;
        const y = 100 - point.y * 98.3;
        const isFront = point.z >= 0;
        const command = `${x.toFixed(2)} ${y.toFixed(2)}`;

        if (previousFront === undefined) {
          if (isFront) front = `M${command}`;
          else back = `M${command}`;
        } else if (isFront === previousFront) {
          if (isFront) front += `L${command}`;
          else back += `L${command}`;
        } else {
          // Share the transition sample between the two paths so the near and
          // far arcs meet cleanly on the bubble silhouette.
          if (previousFront) front += `L${command}`;
          else back += `L${command}`;
          if (isFront) front += `M${command}`;
          else back += `M${command}`;
        }
        previousFront = isFront;
      }

      this.loopPaths[circleIndex].setAttribute("d", back);
      this.loopPaths[circleIndex + 3].setAttribute("d", front);
    });
    this.loopsReady = true;
  }

  private project(x: number, y: number, target: THREE.Vector3) {
    const dx = (x - this.center.x) / this.radius;
    const dy = (this.center.y - y) / this.radius;
    const radial = Math.hypot(dx, dy);
    if (radial < 1e-7) return target.set(0, 0, 1);

    const inner = 0.72;
    const outer = 1.08;
    let z: number;
    if (radial <= inner) {
      z = Math.sqrt(1 - radial * radial);
    } else if (radial >= outer) {
      z = 0;
    } else {
      // Cubic Hermite shoulder: match the sphere's value and slope at the
      // inner edge, then arrive flat at the equator. This removes the abrupt
      // response change of a hard sphere boundary.
      const width = outer - inner;
      const t = (radial - inner) / width;
      const t2 = t * t;
      const t3 = t2 * t;
      const height = Math.sqrt(1 - inner * inner);
      const slope = -inner / height;
      z = (2 * t3 - 3 * t2 + 1) * height + (t3 - 2 * t2 + t) * width * slope;
      z = Math.max(0, z);
    }

    const planar = Math.sqrt(Math.max(0, 1 - z * z));
    return target.set(dx / radial * planar, dy / radial * planar, z);
  }
}
