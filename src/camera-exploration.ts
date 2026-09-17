export type CameraExplorationPhase = "idle" | "dragging" | "momentum" | "dwell" | "return" | "quick-return";

type HeightBounds = { min: number; max: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Camera controls for inspecting the tower.
 *
 * The ordinary gameplay camera remains authoritative. Exploration adds a
 * bounded persistent yaw plus a temporary height offset that returns to zero.
 */
export class CameraExploration {
  yaw = 0;
  height = 0;
  yawVelocity = 0;
  heightVelocity = 0;
  phase: CameraExplorationPhase = "idle";

  private dwellElapsed = 0;
  private dragged = false;
  private returnElapsed = 0;
  private returnStartHeight = 0;
  private readonly heightEpsilon = 0.02;
  private readonly returnDuration = 0.62;
  private readonly quickReturnDuration = 0.24;
  private readonly bubbleRestoreLead = 0.11;

  readonly yawLimit = 75 * Math.PI / 180;
  readonly safetyMargin = 11;

  get active() {
    return this.phase !== "idle" || this.heightDisplaced();
  }

  get bubbleHidden() {
    if (this.phase === "idle") return false;
    if (this.phase === "return" || this.phase === "quick-return") {
      const duration = this.phase === "quick-return" ? this.quickReturnDuration : this.returnDuration;
      return this.returnElapsed < duration - this.bubbleRestoreLead;
    }
    return true;
  }

  begin() {
    this.phase = "dragging";
    this.dwellElapsed = 0;
    this.returnElapsed = 0;
    this.dragged = false;
    this.yawVelocity = 0;
    this.heightVelocity = 0;
  }

  drag(dx: number, dy: number, dt: number, bounds: HeightBounds) {
    if (this.phase !== "dragging") return;
    const yawDelta = -dx * 0.005;
    // Direct manipulation: dragging the tower downward raises the view, while
    // dragging it upward moves the view back toward the platform.
    const heightDelta = dy * 0.012;
    const safeDt = clamp(dt, 0.008, 0.08);
    const measuredYawVelocity = clamp(yawDelta / safeDt, -0.9, 0.9);
    const measuredHeightVelocity = clamp(heightDelta / safeDt, -1.5, 1.5);
    this.yawVelocity += (measuredYawVelocity - this.yawVelocity) * 0.48;
    this.heightVelocity += (measuredHeightVelocity - this.heightVelocity) * 0.48;
    this.dragged ||= Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
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
    if (!this.dragged) {
      this.settleAtCurrentYaw();
    } else if (Math.abs(this.yawVelocity) >= 0.08 || Math.abs(this.heightVelocity) >= 0.12) {
      this.phase = "momentum";
    } else {
      this.settleAtCurrentYaw();
    }
  }

  quickReturn() {
    if (!this.active) return;
    this.dwellElapsed = 0;
    this.yawVelocity = 0;
    this.heightVelocity = 0;
    if (this.heightDisplaced()) this.beginReturn("quick-return");
    else this.phase = "idle";
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
      if (Math.abs(this.yawVelocity) < 0.025 && Math.abs(this.heightVelocity) < 0.04) this.settleAtCurrentYaw();
    } else if (this.phase === "dwell") {
      this.dwellElapsed += dt;
      if (this.dwellElapsed >= 0.5) this.beginReturn("return");
    } else if (this.phase === "return" || this.phase === "quick-return") {
      const duration = this.phase === "quick-return" ? this.quickReturnDuration : this.returnDuration;
      this.returnElapsed += dt;
      const progress = clamp(this.returnElapsed / duration, 0, 1);
      this.height = this.returnStartHeight * ((1 - progress) ** 3);
      if (progress >= 1) this.resetHeight();
    }
    this.height = clamp(this.height, bounds.min, bounds.max);
  }

  reset() {
    this.yaw = 0;
    this.resetHeight();
  }

  resetHeight() {
    this.height = 0;
    this.yawVelocity = 0;
    this.heightVelocity = 0;
    this.phase = "idle";
    this.dwellElapsed = 0;
    this.returnElapsed = 0;
    this.returnStartHeight = 0;
    this.dragged = false;
  }

  private beginDwell() {
    this.yawVelocity = 0;
    this.heightVelocity = 0;
    this.dwellElapsed = 0;
    this.phase = "dwell";
  }

  private beginReturn(phase: "return" | "quick-return") {
    this.returnElapsed = 0;
    this.returnStartHeight = this.height;
    this.phase = phase;
  }

  private settleAtCurrentYaw() {
    if (this.heightDisplaced()) this.beginDwell();
    else this.resetHeight();
  }

  private heightDisplaced() {
    return Math.abs(this.height) > this.heightEpsilon;
  }
}
