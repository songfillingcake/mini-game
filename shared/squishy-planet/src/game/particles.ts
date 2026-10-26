import { TAU, clamp } from '@pocket-play/engine/core/math';
import { rgba } from '@pocket-play/engine/core/color';

type MoteKind = 'dust' | 'spark' | 'ring';

interface Mote {
  kind: MoteKind;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  grow: number;
  color: string;
  drag: number;
  spin: number;
  angle: number;
}

const MAX_MOTES = 180;

/** 轻量粒子系统：固定池 + 覆盖式复用，运行期不再分配对象。 */
export class Particles {
  private readonly motes: Mote[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < MAX_MOTES; i += 1) {
      this.motes.push({
        kind: 'dust',
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        grow: 0,
        color: '#ffffff',
        drag: 1,
        spin: 0,
        angle: 0,
      });
    }
  }

  private next(): Mote {
    const mote = this.motes[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_MOTES;
    return mote;
  }

  /** 按压时向上飘散的一小簇星尘。 */
  burst(x: number, y: number, count: number, color: string, power = 1): void {
    for (let i = 0; i < count; i += 1) {
      const mote = this.next();
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const speed = (70 + Math.random() * 120) * power;
      mote.kind = Math.random() < 0.32 ? 'spark' : 'dust';
      mote.active = true;
      mote.x = x + (Math.random() - 0.5) * 26;
      mote.y = y + (Math.random() - 0.5) * 26;
      mote.vx = Math.cos(angle) * speed;
      mote.vy = Math.sin(angle) * speed - 40;
      mote.maxLife = 0.7 + Math.random() * 0.8;
      mote.life = mote.maxLife;
      mote.size = mote.kind === 'spark' ? 9 + Math.random() * 9 : 2.4 + Math.random() * 3.4;
      mote.grow = 0;
      mote.color = color;
      mote.drag = 1.6;
      mote.spin = (Math.random() - 0.5) * 6;
      mote.angle = Math.random() * TAU;
    }
  }

  /** 扩散的光环。 */
  ring(x: number, y: number, color: string, radius: number, growth: number, duration = 0.7): void {
    const mote = this.next();
    mote.kind = 'ring';
    mote.active = true;
    mote.x = x;
    mote.y = y;
    mote.vx = 0;
    mote.vy = 0;
    mote.maxLife = duration;
    mote.life = duration;
    mote.size = radius;
    mote.grow = growth;
    mote.color = color;
    mote.drag = 0;
    mote.spin = 0;
    mote.angle = 0;
  }

  update(dt: number): void {
    const step = clamp(dt, 0, 0.05);
    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      if (!mote.active) continue;
      mote.life -= step;
      if (mote.life <= 0) {
        mote.active = false;
        continue;
      }
      if (mote.kind === 'ring') {
        mote.size += mote.grow * step;
        continue;
      }
      mote.x += mote.vx * step;
      mote.y += mote.vy * step;
      mote.vy -= 26 * step;
      const decay = Math.max(0, 1 - mote.drag * step);
      mote.vx *= decay;
      mote.vy *= decay;
      mote.angle += mote.spin * step;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      if (!mote.active) continue;
      const progress = 1 - mote.life / mote.maxLife;
      const fade = 1 - progress;
      if (mote.kind === 'ring') {
        ctx.globalAlpha = fade * 0.5;
        ctx.strokeStyle = rgba(mote.color, 0.9);
        ctx.lineWidth = 2.5 * fade + 0.6;
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.size, 0, TAU);
        ctx.stroke();
        continue;
      }
      const alpha = mote.kind === 'spark' ? fade : fade * 0.85;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = mote.color;
      if (mote.kind === 'spark') {
        const size = mote.size * (0.5 + fade * 0.5);
        ctx.save();
        ctx.translate(mote.x, mote.y);
        ctx.rotate(mote.angle);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.26, -size * 0.26);
        ctx.lineTo(size, 0);
        ctx.lineTo(size * 0.26, size * 0.26);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.26, size * 0.26);
        ctx.lineTo(-size, 0);
        ctx.lineTo(-size * 0.26, -size * 0.26);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.size * (0.6 + fade * 0.4), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  clear(): void {
    for (let i = 0; i < this.motes.length; i += 1) this.motes[i].active = false;
  }
}
