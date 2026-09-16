export type CameraExplorationPhase = "idle" | "dragging" | "momentum" | "dwell" | "return" | "quick-return";

type HeightBounds = { min: number; max: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Temporary camera offsets for inspecting the tower.
 *
 * The ordinary gameplay camera remains authoritative. Exploration only adds
 * bounded yaw/height offsets, then decays those offsets back to zero.
 */
export class CameraExploration {
  yaw = 0;
  height = 0;
  yawVelocity = 0;
  heightVelocity = 0;
  phase: CameraExplorationPhase = "idle";

  private dwellElapsed = 0;

  readonly yawLimit = 75 * Math.PI / 180;
  readonly safetyMargin = 22;

  get active() {
    return this.phase !== "idle" || Math.abs(this.yaw) > 0.002 || Math.abs(this.height) > 0.008;
  }

  begin() {
    this.phase = "dragging";
    this.dwellElapsed = 0;
    this.yawVelocity = 0;
    this.heightVelocity = 0;
  }

  drag(dx: number, dy: number, dt: number, bounds: HeightBounds) {
    if (this.phase !== "dragging") return;
    const yawDelta = -dx * 0.005;
    const heightDelta = -dy * 0.012;
    const safeDt = clamp(dt, 0.008, 0.08);
    const measuredYawVelocity = clamp(yawDelta / safeDt, -0.9, 0.9);
    const measuredHeightVelocity = clamp(heightDelta / safeDt, -1.5, 1.5);
    this.yawVelocity += (measuredYawVelocity - this.yawVelocity) * 0.48;
    this.heightVelocity += (measuredHeightVelocity - this.heightVelocity) * 0.48;
    this.yaw = clamp(this.yaw + yawDelta, -this.yawLimit, this.yawLimit);
    this.height = clamp(this.height + heightDelta, bounds.min, bounds.max);
    if (Math.abs(this.yaw) >= this.yawLimit - 1e-5 && Math.sign(this.yawVelocity) === Math.sign(this.yaw)) {
      this.yawVelocity = 0;
    }
    if ((this.height <= bounds.min + 1e-5 && this.heightVelocity < 0)
      || (this.height >= bounds.max - 1e-5 && this.heightVelocity > 0)) {
      this.heightVelocity = 0;
    }
  }

  end(keepMomentum: boolean) {
    if (this.phase !== "dragging") return;
    if (!keepMomentum) {
      this.yawVelocity = 0;
      this.heightVelocity = 0;
    }
    if (!this.displaced()) {
      this.reset();
    } else if (Math.abs(this.yawVelocity) >= 0.08 || Math.abs(this.heightVelocity) >= 0.12) {
      this.phase = "momentum";
    } else {
      this.beginDwell();
    }
  }

  quickReturn() {
    if (!this.active) return;
    this.phase = "quick-return";
    this.dwellElapsed = 0;
    this.yawVelocity = 0;
    this.heightVelocity = 0;
  }

  update(dt: number, bounds: HeightBounds) {
    if (this.phase === "momentum") {
      const previousYaw = this.yaw;
      const previousHeight = this.height;
      this.yaw = clamp(this.yaw + this.yawVelocity * dt, -this.yawLimit, this.yawLimit);
      this.height = clamp(this.height + this.heightVelocity * dt, bounds.min, bounds.max);
      if (this.yaw === previousYaw) this.yawVelocity = 0;
      if (this.height === previousHeight) this.heightVelocity = 0;
      const decay = Math.exp(-7 * dt);
      this.yawVelocity *= decay;
      this.heightVelocity *= decay;
      if (Math.abs(this.yawVelocity) < 0.025 && Math.abs(this.heightVelocity) < 0.04) this.beginDwell();
    } else if (this.phase === "dwell") {
      this.dwellElapsed += dt;
      if (this.dwellElapsed >= 1.4) this.phase = "return";
    } else if (this.phase === "return" || this.phase === "quick-return") {
      const rate = this.phase === "quick-return" ? 18 : 6;
      const decay = Math.exp(-rate * dt);
      this.yaw *= decay;
      this.height *= decay;
      if (!this.displaced()) this.reset();
    }
    this.height = clamp(this.height, bounds.min, bounds.max);
  }

  reset() {
    this.yaw = 0;
    this.height = 0;
    this.yawVelocity = 0;
    this.heightVelocity = 0;
    this.phase = "idle";
    this.dwellElapsed = 0;
  }

  private beginDwell() {
    this.yawVelocity = 0;
    this.heightVelocity = 0;
    this.dwellElapsed = 0;
    this.phase = "dwell";
  }

  private displaced() {
    return Math.abs(this.yaw) > 0.002 || Math.abs(this.height) > 0.008;
  }
}
