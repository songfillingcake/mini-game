import { TAU, clamp } from '@pocket-play/engine/core/math';
import { mixColor, rgba } from '@pocket-play/engine/core/color';
import type { Dent } from './jelly';
import { Jelly } from './jelly';
import type { Palette } from './palette';

export interface FaceState {
  /** 0 ～ 1，越大笑得越开 */
  joy: number;
  /** 0 ～ 1，被捏时眯眼 */
  squint: number;
  /** -1 ～ 1，眼珠朝向 */
  lookX: number;
  lookY: number;
  /** 0 ～ 1，眨眼 */
  blink: number;
}

/** 椭圆路径：用缩放 + arc 实现，不依赖 quick game 可能缺失的 ctx.ellipse。 */
function ellipsePath(ctx: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number): void {
  const rx = Math.max(0.01, radiusX);
  const ry = Math.max(0.01, radiusY);
  ctx.beginPath();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.restore();
}

/** 星球本体：软体轮廓 + 光照 + 表情。 */
export class Planet {
  readonly jelly: Jelly;
  private cx = 0;
  private cy = 0;
  private bodyGradient: CanvasGradient | null = null;
  private glowGradient: CanvasGradient | null = null;
  private gradientKey = '';

  constructor(vertices = 132) {
    this.jelly = new Jelly(vertices, 200);
  }

  layout(cx: number, cy: number, radius: number): void {
    this.cx = cx;
    this.cy = cy;
    if (Math.abs(this.jelly.baseRadius - radius) > 0.5) this.jelly.reset(radius);
  }

  get radius(): number {
    return this.jelly.baseRadius;
  }

  update(dt: number, dents: readonly Dent[], palette: Palette): void {
    this.jelly.update(this.cx, this.cy, dt, dents, palette.stiffness, palette.damping);
  }

  render(
    ctx: CanvasRenderingContext2D,
    palette: Palette,
    face: FaceState,
    dents: readonly Dent[],
    glow: number,
  ): void {
    const cx = this.cx;
    const cy = this.cy;
    const radius = this.jelly.baseRadius;
    this.ensureGradients(ctx, palette, radius);

    if (this.glowGradient) {
      ctx.save();
      ctx.globalAlpha = clamp(0.55 + glow * 0.6, 0, 1);
      ctx.fillStyle = this.glowGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.62, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    this.traceBody(ctx);
    ctx.save();
    ctx.fillStyle = this.bodyGradient ?? palette.bodyMid;
    ctx.fill();

    // 底部内阴影 + 凹陷暗部：裁剪在星球轮廓内绘制。
    ctx.clip();
    const shade = ctx.createLinearGradient(0, cy + radius * 0.1, 0, cy + radius);
    shade.addColorStop(0, rgba(palette.bodyDeep, 0));
    shade.addColorStop(1, rgba(palette.bodyDeep, 0.4));
    ctx.fillStyle = shade;
    ctx.fillRect(cx - radius * 1.5, cy - radius * 1.5, radius * 3, radius * 3);

    for (let i = 0; i < dents.length; i += 1) {
      const dent = dents[i];
      if (dent.depth < 0.06) continue;
      const px = cx + Math.cos(dent.angle) * radius * 0.74;
      const py = cy + Math.sin(dent.angle) * radius * 0.74;
      const radiusShade = radius * 0.62;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radiusShade);
      gradient.addColorStop(0, rgba(palette.ink, 0.2 * dent.depth));
      gradient.addColorStop(1, rgba(palette.ink, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, radiusShade, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    this.traceBody(ctx);
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = rgba(palette.rim, 0.5);
    ctx.stroke();

    this.drawHighlight(ctx, palette, radius);
    this.drawFace(ctx, palette, face, radius);
  }

  private ensureGradients(ctx: CanvasRenderingContext2D, palette: Palette, radius: number): void {
    const key = `${palette.id}:${Math.round(radius)}:${Math.round(this.cx)}:${Math.round(this.cy)}`;
    if (this.bodyGradient && this.gradientKey === key) return;

    const body = ctx.createRadialGradient(
      this.cx - radius * 0.34,
      this.cy - radius * 0.38,
      radius * 0.1,
      this.cx,
      this.cy,
      radius * 1.3,
    );
    body.addColorStop(0, palette.bodyLight);
    body.addColorStop(0.44, palette.bodyMid);
    body.addColorStop(1, palette.bodyDeep);

    const glow = ctx.createRadialGradient(this.cx, this.cy, radius * 0.48, this.cx, this.cy, radius * 1.62);
    glow.addColorStop(0, rgba(palette.aura, 0.4));
    glow.addColorStop(0.58, rgba(palette.aura, 0.13));
    glow.addColorStop(1, rgba(palette.aura, 0));

    this.bodyGradient = body;
    this.glowGradient = glow;
    this.gradientKey = key;
  }

  /** 用中点 + 二次贝塞尔把 132 个节点连成平滑闭合轮廓。 */
  private traceBody(ctx: CanvasRenderingContext2D): void {
    const jelly = this.jelly;
    const n = jelly.count;
    ctx.beginPath();
    ctx.moveTo((jelly.x[n - 1] + jelly.x[0]) * 0.5, (jelly.y[n - 1] + jelly.y[0]) * 0.5);
    for (let i = 0; i < n; i += 1) {
      const next = i === n - 1 ? 0 : i + 1;
      ctx.quadraticCurveTo(
        jelly.x[i],
        jelly.y[i],
        (jelly.x[i] + jelly.x[next]) * 0.5,
        (jelly.y[i] + jelly.y[next]) * 0.5,
      );
    }
    ctx.closePath();
  }

  private drawHighlight(ctx: CanvasRenderingContext2D, palette: Palette, radius: number): void {
    ctx.save();
    ctx.translate(this.cx - radius * 0.36, this.cy - radius * 0.44);
    ctx.rotate(-0.62);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.34);
    gradient.addColorStop(0, rgba(palette.rim, 0.5));
    gradient.addColorStop(1, rgba(palette.rim, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.34, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawFace(ctx: CanvasRenderingContext2D, palette: Palette, face: FaceState, radius: number): void {
    const cx = this.cx;
    const cy = this.cy;
    const eyeDx = radius * 0.235;
    const eyeY = cy - radius * 0.02;
    const openness = clamp(1 - face.blink * 0.92 - face.squint * 0.62, 0.07, 1);
    const eyeW = radius * 0.074;
    const eyeH = radius * 0.1 * openness;
    const lookX = face.lookX * radius * 0.022;
    const lookY = face.lookY * radius * 0.018;

    ctx.save();
    for (let side = -1; side <= 1; side += 2) {
      const x = cx + side * eyeDx + lookX;
      const y = eyeY + lookY;
      ellipsePath(ctx, x, y, eyeW, eyeH);
      ctx.fillStyle = rgba(palette.ink, 0.9);
      ctx.fill();
      if (openness > 0.45) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x - eyeW * 0.34, y - eyeH * 0.36, radius * 0.018, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // 腮红
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = mixColor(palette.bodyDeep, '#ff6f91', 0.42);
    for (let side = -1; side <= 1; side += 2) {
      ellipsePath(ctx, cx + side * radius * 0.375, cy + radius * 0.14, radius * 0.084, radius * 0.048);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 嘴
    const mouthY = cy + radius * 0.205;
    const mouthW = radius * 0.15;
    const curve = radius * (0.026 + face.joy * 0.1);
    ctx.strokeStyle = rgba(palette.ink, 0.82);
    ctx.lineWidth = radius * 0.024;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + curve * 2.1, cx + mouthW, mouthY);
    ctx.stroke();
    ctx.restore();
  }
}
