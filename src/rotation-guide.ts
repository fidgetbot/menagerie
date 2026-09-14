import * as THREE from 'three';

/** Single-pointer sphere rotation with a distinct, gesture-locked twist rim. */
export class RotationGuide {
  readonly element = document.createElement('div');
  center = new THREE.Vector2();
  radius = 140;
  mode: 'tumble' | 'twist' | 'catch' | null = null;
  private start = new THREE.Vector3();
  private initial = new THREE.Quaternion();
  private view = new THREE.Quaternion();
  private lastAngle = 0;
  private totalAngle = 0;
  private delta = new THREE.Quaternion();
  private point = new THREE.Vector3();
  private screen = new THREE.Vector3();

  constructor() {
    this.element.id = 'rotation-guide';
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = `<svg viewBox="-160 -160 320 320"><circle class="rim" r="140"/><path class="arrows" d="M-11 -146 L0 -140 L-11 -134 M11 134 L0 140 L11 146"/><circle class="contact" r="4"/></svg>`;
    document.querySelector('#app')!.append(this.element);
  }

  update(held: THREE.Object3D | null, camera: THREE.Camera) {
    this.element.hidden = !held;
    if (!held || this.mode !== null) return;
    this.radius = Math.min(170, innerWidth * 0.36, innerHeight * 0.22);
    this.screen.copy(held.position).project(camera);
    this.center.set(innerWidth * (this.screen.x + 1) / 2, innerHeight * (1 - this.screen.y) / 2);
    // Keep the full touch rim clear of the goal, screen edges, and Drop.
    this.center.x = THREE.MathUtils.clamp(this.center.x, this.radius + 24, innerWidth - this.radius - 24);
    this.center.y = THREE.MathUtils.clamp(this.center.y, this.radius + 118, innerHeight - this.radius - 94);
    this.element.style.left = `${this.center.x}px`;
    this.element.style.top = `${this.center.y}px`;
    this.element.style.width = `${this.radius * 320 / 140}px`;
    this.element.dataset.radius = String(this.radius);
  }

  private project(x: number, y: number, target: THREE.Vector3) {
    target.set((x - this.center.x) / (this.radius - 22), (this.center.y - y) / (this.radius - 22), 0);
    const length = target.lengthSq();
    if (length > 1) target.normalize();
    else target.z = Math.sqrt(1 - length);
    return target;
  }

  begin(x: number, y: number, orientation: THREE.Quaternion, camera: THREE.Camera) {
    const distance = Math.hypot(x - this.center.x, y - this.center.y);
    this.mode = Math.abs(distance - this.radius) <= 22 ? 'twist' : distance < this.radius - 22 ? 'tumble' : 'catch';
    this.initial.copy(orientation);
    this.view.copy(camera.quaternion);
    this.project(x, y, this.start);
    this.lastAngle = Math.atan2(this.center.y - y, x - this.center.x);
    this.totalAngle = 0;
    this.element.dataset.mode = this.mode;
    this.mark(x, y);
    return this.mode;
  }

  move(x: number, y: number, orientation: THREE.Quaternion) {
    if (!this.mode || this.mode === 'catch') return;
    if (this.mode === 'twist') {
      // Ignore the unstable angle near the center, but keep the gesture in twist mode.
      if (Math.hypot(x - this.center.x, y - this.center.y) < 24) return;
      const angle = Math.atan2(this.center.y - y, x - this.center.x);
      this.totalAngle += Math.atan2(Math.sin(angle - this.lastAngle), Math.cos(angle - this.lastAngle));
      this.lastAngle = angle;
      this.delta.setFromAxisAngle(this.point.set(0, 0, 1), this.totalAngle);
    } else {
      this.delta.setFromUnitVectors(this.start, this.project(x, y, this.point));
    }
    // Anchor to pointer-down orientation, so returning the pointer undoes the drag.
    this.delta.premultiply(this.view).multiply(this.view.clone().invert());
    orientation.copy(this.initial).premultiply(this.delta).normalize();
    this.mark(x, y);
  }

  private mark(x: number, y: number) {
    const point = this.element.querySelector('.contact')!;
    point.setAttribute('cx', String((x - this.center.x) * 140 / this.radius));
    point.setAttribute('cy', String((y - this.center.y) * 140 / this.radius));
  }

  end() { this.mode = null; delete this.element.dataset.mode; }
}
