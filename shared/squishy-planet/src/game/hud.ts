import { clamp, formatCount } from '@pocket-play/engine/core/math';
import { rgba } from '@pocket-play/engine/core/color';
import { roundRectPath, setFont, starPath } from '@pocket-play/engine/core/draw';
import type { Viewport } from '@pocket-play/engine/platform/types';
import type { DailyGoal } from './save';
import { PALETTES, type Palette } from './palette';

export interface HudModel {
  readonly dust: number;
  readonly goal: DailyGoal;
  readonly goalProgress: number;
  readonly goalDone: boolean;
  readonly soundOn: boolean;
  readonly tutorialAlpha: number;
  /** 累计时间，用于提示语的呼吸闪烁 */
  readonly time: number;
}

interface DockSlot {
  x: number;
  y: number;
  radius: number;
}

const DOCK_GAP = 92;
const DOCK_RADIUS = 30;
const PILL_HEIGHT = 64;

/** 顶部状态栏 + 底部材质栏 + 轻提示。 */
export class Hud {
  private readonly dock: DockSlot[] = [];
  private dockY = 0;
  private soundX = 0;
  private soundY = 0;
  private soundRadius = 26;
  private toastText = '';
  private toastLife = 0;
  private toastMax = 1;
  private toastY = 0;

  showToast(text: string, duration = 2.4): void {
    this.toastText = text;
    this.toastLife = duration;
    this.toastMax = duration;
  }

  get hasToast(): boolean {
    return this.toastLife > 0;
  }

  update(dt: number): void {
    if (this.toastLife > 0) this.toastLife = Math.max(0, this.toastLife - dt);
  }

  layout(vp: Viewport): void {
    const bottom = vp.height - vp.insetBottom - 62;
    this.dockY = bottom;
    this.dock.length = 0;
    const startX = vp.width / 2 - (DOCK_GAP * (PALETTES.length - 1)) / 2;
    for (let i = 0; i < PALETTES.length; i += 1) {
      this.dock.push({ x: startX + i * DOCK_GAP, y: bottom, radius: DOCK_RADIUS });
    }
    this.soundRadius = 26;
    this.soundX = 58;
    this.soundY = bottom;
    this.toastY = bottom - 118;
  }

  hitDock(x: number, y: number): number {
    for (let i = 0; i < this.dock.length; i += 1) {
      const slot = this.dock[i];
      const dx = x - slot.x;
      const dy = y - slot.y;
      if (dx * dx + dy * dy <= (slot.radius + 12) * (slot.radius + 12)) return i;
    }
    return -1;
  }

  hitSound(x: number, y: number): boolean {
    const dx = x - this.soundX;
    const dy = y - this.soundY;
    return dx * dx + dy * dy <= (this.soundRadius + 14) * (this.soundRadius + 14);
  }

  render(ctx: CanvasRenderingContext2D, vp: Viewport, palette: Palette, model: HudModel, unlocked: readonly string[]): void {
    this.drawTopBar(ctx, vp, palette, model);
    this.drawDock(ctx, palette, model, unlocked);
    this.drawTutorial(ctx, vp, model);
    this.drawToast(ctx, vp);
  }

  private drawTopBar(ctx: CanvasRenderingContext2D, vp: Viewport, palette: Palette, model: HudModel): void {
    const top = vp.insetTop + 18;
    const pillWidth = 196;

    roundRectPath(ctx, 32, top, pillWidth, PILL_HEIGHT, PILL_HEIGHT / 2);
    ctx.fillStyle = 'rgba(8, 8, 18, 0.42)';
    ctx.fill();

    starPath(ctx, 32 + 34, top + PILL_HEIGHT / 2, 15, 6, 4, 0);
    ctx.fillStyle = palette.mote;
    ctx.fill();

    setFont(ctx, 30, 700);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fillText(formatCount(model.dust), 32 + 62, top + PILL_HEIGHT / 2 + 1);

    const rightX = vp.width - 32;
    setFont(ctx, 24, 600);
    ctx.textAlign = 'right';
    ctx.fillStyle = model.goalDone ? palette.mote : 'rgba(255, 255, 255, 0.72)';
    const label = model.goalDone ? `今日完成 · ${model.goal.label}` : model.goal.label;
    ctx.fillText(label, rightX, top + 30);

    const barWidth = 190;
    const barX = rightX - barWidth;
    const barY = top + 50;
    roundRectPath(ctx, barX, barY, barWidth, 7, 3.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
    const ratio = clamp(model.goalProgress / model.goal.target, 0, 1);
    if (ratio > 0) {
      roundRectPath(ctx, barX, barY, Math.max(7, barWidth * ratio), 7, 3.5);
      ctx.fillStyle = model.goalDone ? palette.mote : rgba(palette.mote, 0.85);
      ctx.fill();
    }

    setFont(ctx, 20, 500);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(`${Math.min(model.goalProgress, model.goal.target)}/${model.goal.target}`, rightX, top + 72);
  }

  private drawDock(
    ctx: CanvasRenderingContext2D,
    palette: Palette,
    model: HudModel,
    unlocked: readonly string[],
  ): void {
    // 音效开关
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.soundX, this.soundY, this.soundRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 8, 18, 0.38)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    setFont(ctx, 24, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = model.soundOn ? 'rgba(255, 255, 255, 0.86)' : 'rgba(255, 255, 255, 0.34)';
    ctx.fillText('♪', this.soundX, this.soundY + 1);
    if (!model.soundOn) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(this.soundX - 11, this.soundY + 11);
      ctx.lineTo(this.soundX + 11, this.soundY - 11);
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < this.dock.length; i += 1) {
      const slot = this.dock[i];
      const item = PALETTES[i];
      const owned = unlocked.indexOf(item.id) >= 0;
      const selected = item.id === palette.id;

      if (owned) {
        const gradient = ctx.createRadialGradient(
          slot.x - slot.radius * 0.35,
          slot.y - slot.radius * 0.4,
          slot.radius * 0.1,
          slot.x,
          slot.y,
          slot.radius,
        );
        gradient.addColorStop(0, item.bodyLight);
        gradient.addColorStop(1, item.bodyDeep);
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, slot.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, slot.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(slot.x, slot.y, slot.radius + (selected ? 7 : 2), 0, Math.PI * 2);
      ctx.strokeStyle = selected ? rgba(palette.rim, 0.9) : 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = selected ? 3 : 2;
      ctx.stroke();

      if (!owned) {
        setFont(ctx, 18, 600);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
        ctx.fillText(String(item.unlock), slot.x, slot.y);
      }

      if (selected) {
        setFont(ctx, 20, 600);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = rgba(palette.rim, 0.85);
        ctx.fillText(item.name, slot.x, slot.y + slot.radius + 16);
      }
    }
  }

  private drawTutorial(ctx: CanvasRenderingContext2D, vp: Viewport, model: HudModel): void {
    if (model.tutorialAlpha <= 0.01) return;
    const alpha = clamp(model.tutorialAlpha, 0, 1);
    setFont(ctx, 26, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha * (0.62 + 0.28 * Math.sin(model.time * 3));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('按住星球 · 轻轻捏一捏', vp.width / 2, this.dockY - 150);
    ctx.globalAlpha = 1;
  }

  private drawToast(ctx: CanvasRenderingContext2D, vp: Viewport): void {
    if (this.toastLife <= 0) return;
    const elapsed = this.toastMax - this.toastLife;
    const fadeIn = clamp(elapsed / 0.18, 0, 1);
    const fadeOut = clamp(this.toastLife / 0.4, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);

    setFont(ctx, 24, 600);
    const width = Math.min(vp.width - 80, ctx.measureText(this.toastText).width + 56);
    const height = 58;
    const x = vp.width / 2 - width / 2;
    const y = this.toastY - height / 2;

    ctx.globalAlpha = alpha;
    roundRectPath(ctx, x, y, width, height, height / 2);
    ctx.fillStyle = 'rgba(10, 10, 22, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fillText(this.toastText, vp.width / 2, y + height / 2 + 1);
    ctx.globalAlpha = 1;
  }
}
