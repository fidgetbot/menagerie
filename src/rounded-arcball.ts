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
  private readonly start = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly screen = new THREE.Vector3();
  private readonly initial = new THREE.Quaternion();
  private readonly view = new THREE.Quaternion();
  private readonly inverseView = new THREE.Quaternion();
  private readonly delta = new THREE.Quaternion();

  constructor(bubbleEnabled: boolean) {
    this.bubbleEnabled = bubbleEnabled;
    this.bubble.id = "rotation-bubble";
    this.bubble.hidden = !bubbleEnabled;
    this.bubble.setAttribute("aria-hidden", "true");
    this.bubble.innerHTML = '<span class="bubble-highlight"></span>';
    document.querySelector("#app")!.append(this.bubble);
  }

  update(held: THREE.Object3D | null, camera: THREE.Camera) {
    if (!held) {
      this.active = false;
      this.bubble.classList.remove("active");
      return;
    }
    if (this.active) return;

    // Keep the control large enough for reliable roll on a phone, and centre
    // it on the actual rotation pivot. Do not clamp it away from that pivot.
    this.radius = Math.min(190, Math.max(132, Math.min(innerWidth, innerHeight) * 0.45));
    this.screen.copy(held.position).project(camera);
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
  }

  begin(x: number, y: number, orientation: THREE.Quaternion, camera: THREE.Camera) {
    this.active = true;
    this.bubble.dataset.active = "true";
    this.initial.copy(orientation);
    this.view.copy(camera.quaternion);
    this.inverseView.copy(camera.quaternion).invert();
    this.project(x, y, this.start);
    if (this.bubbleEnabled) this.bubble.classList.add("active");
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
    this.bubble.classList.remove("active");
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
