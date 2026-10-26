import { TAU, angleDelta, clamp } from '@pocket-play/engine/core/math';

export interface Dent {
  /** 按压方向（弧度） */
  readonly angle: number;
  /** 0 = 不按，1 = 按到底 */
  readonly depth: number;
}

const DENT_SIGMA = 0.44;
const DENT_RATIO = 0.62;
const SMOOTHING = 0.24;

/**
 * 软体星球：一圈节点各自带弹簧，用户按压时把附近节点的「静止半径」压下去，
 * 松手后自然回弹并带一点晃动。节点数是固定开销，全程无对象分配。
 */
export class Jelly {
  readonly count: number;
  baseRadius: number;
  /** 节点世界坐标（设计坐标），渲染时直接使用 */
  readonly x: Float32Array;
  readonly y: Float32Array;

  private readonly radius: Float32Array;
  private readonly velocity: Float32Array;
  private readonly target: Float32Array;
  private readonly scratch: Float32Array;

  constructor(count: number, baseRadius: number) {
    this.count = count;
    this.baseRadius = baseRadius;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.radius = new Float32Array(count);
    this.velocity = new Float32Array(count);
    this.target = new Float32Array(count);
    this.scratch = new Float32Array(count);
    this.radius.fill(baseRadius);
  }

  reset(baseRadius: number): void {
    this.baseRadius = baseRadius;
    this.radius.fill(baseRadius);
    this.velocity.fill(0);
  }

  /** 松手时在某个方向上给一个向外的冲量，形成回弹晃动。 */
  impulse(angle: number, strength: number): void {
    const n = this.count;
    for (let i = 0; i < n; i += 1) {
      const delta = angleDelta((i / n) * TAU, angle);
      const weight = Math.exp(-(delta * delta) / (2 * 0.55 * 0.55));
      this.velocity[i] += strength * weight;
    }
  }

  update(cx: number, cy: number, dt: number, dents: readonly Dent[], stiffness: number, damping: number): void {
    const n = this.count;
    const base = this.baseRadius;
    const step = clamp(dt, 0, 0.033);
    if (step <= 0) {
      this.syncPositions(cx, cy);
      return;
    }

    for (let i = 0; i < n; i += 1) {
      const angle = (i / n) * TAU;
      let target = base;
      for (let d = 0; d < dents.length; d += 1) {
        const dent = dents[d];
        const delta = angleDelta(angle, dent.angle);
        const weight = Math.exp(-(delta * delta) / (2 * DENT_SIGMA * DENT_SIGMA));
        target -= base * dent.depth * weight * DENT_RATIO;
      }
      this.target[i] = target;
    }

    for (let i = 0; i < n; i += 1) {
      const accel = -stiffness * (this.radius[i] - this.target[i]) - damping * this.velocity[i];
      this.velocity[i] += accel * step;
      this.radius[i] += this.velocity[i] * step;
    }

    // 邻接平滑：让凹陷两侧自然过渡，避免出现尖角。
    for (let i = 0; i < n; i += 1) {
      const prev = this.radius[i === 0 ? n - 1 : i - 1];
      const next = this.radius[i === n - 1 ? 0 : i + 1];
      const average = (prev + next) * 0.5;
      this.scratch[i] = this.radius[i] + (average - this.radius[i]) * SMOOTHING;
    }

    const minRadius = base * 0.3;
    const maxRadius = base * 1.5;
    for (let i = 0; i < n; i += 1) {
      this.radius[i] = clamp(this.scratch[i], minRadius, maxRadius);
    }

    this.syncPositions(cx, cy);
  }

  /** 形变量 0 ～ 1，用于驱动光晕、表情与音色。 */
  deformation(): number {
    const n = this.count;
    let total = 0;
    for (let i = 0; i < n; i += 1) total += Math.abs(this.radius[i] - this.baseRadius);
    return clamp(total / n / this.baseRadius, 0, 1);
  }

  radiusAtAngle(angle: number): number {
    const n = this.count;
    const normalized = ((angle % TAU) + TAU) % TAU;
    const index = Math.round((normalized / TAU) * n) % n;
    return this.radius[index];
  }

  private syncPositions(cx: number, cy: number): void {
    const n = this.count;
    for (let i = 0; i < n; i += 1) {
      const angle = (i / n) * TAU;
      const r = this.radius[i];
      this.x[i] = cx + Math.cos(angle) * r;
      this.y[i] = cy + Math.sin(angle) * r;
    }
  }
}
