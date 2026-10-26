import { mulberry32, TAU } from '@pocket-play/engine/core/math';
import { rgba } from '@pocket-play/engine/core/color';
import type { Viewport } from '@pocket-play/engine/platform/types';
import type { Palette } from './palette';

interface Star {
  x: number;
  y: number;
  radius: number;
  phase: number;
  speed: number;
  alpha: number;
}

interface Aurora {
  x: number;
  y: number;
  radius: number;
  color: string;
  phase: number;
  drift: number;
  alpha: number;
}

/**
 * 背景：天空渐变 + 缓慢漂移的极光团 + 闪烁星点 + 暗角。
 * 所有坐标都用归一化比例保存，视口变化时自动适配；渐变按需缓存。
 */
export class Backdrop {
  private readonly stars: Star[] = [];
  private readonly auroras: Aurora[] = [];
  private skyGradient: CanvasGradient | null = null;
  private skyKey = '';
  private vignette: CanvasGradient | null = null;
  private vignetteKey = '';

  constructor(seed: number) {
    const random = mulberry32(seed);
    for (let i = 0; i < 54; i += 1) {
      this.stars.push({
        x: random(),
        y: random() * 0.92,
        radius: 0.9 + random() * 2.1,
        phase: random() * TAU,
        speed: 0.5 + random() * 1.6,
        alpha: 0.25 + random() * 0.65,
      });
    }
    this.auroras.push(
      { x: 0.24, y: 0.28, radius: 0.62, color: '#6f5cff', phase: 0.4, drift: 0.11, alpha: 0.3 },
      { x: 0.78, y: 0.42, radius: 0.54, color: '#3fd0c9', phase: 2.1, drift: 0.14, alpha: 0.22 },
      { x: 0.52, y: 0.86, radius: 0.72, color: '#ff7fb0', phase: 4.2, drift: 0.09, alpha: 0.18 },
    );
  }

  render(ctx: CanvasRenderingContext2D, vp: Viewport, palette: Palette, time: number): void {
    const key = `${palette.id}:${vp.width}x${vp.height}`;
    if (!this.skyGradient || this.skyKey !== key) {
      const gradient = ctx.createLinearGradient(0, 0, 0, vp.height);
      gradient.addColorStop(0, palette.skyTop);
      gradient.addColorStop(1, palette.skyBottom);
      this.skyGradient = gradient;
      this.skyKey = key;
    }
    ctx.fillStyle = this.skyGradient;
    ctx.fillRect(0, 0, vp.width, vp.height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.auroras.length; i += 1) {
      const aurora = this.auroras[i];
      const cx = (aurora.x + Math.sin(time * aurora.drift + aurora.phase) * 0.05) * vp.width;
      const cy = (aurora.y + Math.cos(time * aurora.drift * 0.8 + aurora.phase) * 0.04) * vp.height;
      const radius = aurora.radius * vp.width * 0.9;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      const tint = i === 0 ? palette.aura : aurora.color;
      gradient.addColorStop(0, rgba(tint, aurora.alpha));
      gradient.addColorStop(0.55, rgba(tint, aurora.alpha * 0.32));
      gradient.addColorStop(1, rgba(tint, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    for (let i = 0; i < this.stars.length; i += 1) {
      const star = this.stars[i];
      const twinkle = 0.55 + 0.45 * Math.sin(time * star.speed + star.phase);
      ctx.globalAlpha = star.alpha * twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x * vp.width, star.y * vp.height, star.radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    if (!this.vignette || this.vignetteKey !== key) {
      const radius = Math.max(vp.width, vp.height) * 0.78;
      const gradient = ctx.createRadialGradient(
        vp.width / 2,
        vp.height * 0.46,
        radius * 0.32,
        vp.width / 2,
        vp.height * 0.46,
        radius,
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      this.vignette = gradient;
      this.vignetteKey = key;
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, vp.width, vp.height);
  }
}
