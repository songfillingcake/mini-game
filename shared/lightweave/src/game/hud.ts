import { TAU, clamp, rgba, roundRectPath, setFont, starPath } from '@pocket-play/engine';
import type { Viewport } from '@pocket-play/engine';
import type { Level } from './types';
import type { Theme } from './themes';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function inside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  count: number,
  color: string,
  gap = 1.1,
): void {
  const total = size * gap * 3;
  const start = x - total / 2 + (size * gap) / 2;
  for (let i = 0; i < 3; i += 1) {
    starPath(ctx, start + i * size * gap, y, size, size * 0.42, 5, 0);
    ctx.fillStyle = i < count ? color : rgba(color, 0.18);
    ctx.fill();
  }
}

/** 关卡页顶栏：返回星图 + 关卡名 + 已得星。 */
export function drawPlayHeader(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  theme: Theme,
  title: string,
  subtitle: string,
  stars: number,
): Rect {
  const top = vp.insetTop + 20;
  const back: Rect = { x: 26, y: top, w: 92, h: 64 };
  roundRectPath(ctx, back.x, back.y, back.w, back.h, 32);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  setFont(ctx, 30, 600);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(theme.ink, 0.9);
  ctx.fillText('‹', back.x + back.w / 2, back.y + back.h / 2 + 1);

  ctx.textAlign = 'left';
  setFont(ctx, 34, 700);
  ctx.fillStyle = rgba(theme.ink, 0.95);
  ctx.fillText(title, back.x + back.w + 22, top + 24);
  setFont(ctx, 22, 500);
  ctx.fillStyle = rgba(theme.ink, 0.5);
  ctx.fillText(subtitle, back.x + back.w + 22, top + 54);

  drawStars(ctx, vp.width - 96, top + 32, 15, stars, theme.accent);
  return back;
}

/** 关卡页底栏：星屑数量 + 提示按钮。返回提示按钮区域。 */
export function drawPlayFooter(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  theme: Theme,
  dust: number,
  hintEnabled: boolean,
): Rect {
  const y = vp.height - vp.insetBottom - 104;
  const pill: Rect = { x: 32, y, w: 190, h: 68 };
  roundRectPath(ctx, pill.x, pill.y, pill.w, pill.h, 34);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.fill();
  starPath(ctx, pill.x + 38, pill.y + pill.h / 2, 14, 5.8, 4, 0);
  ctx.fillStyle = theme.accent;
  ctx.fill();
  setFont(ctx, 30, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(theme.ink, 0.9);
  ctx.fillText(String(dust), pill.x + 64, pill.y + pill.h / 2 + 1);

  const hint: Rect = { x: vp.width - 244, y, w: 212, h: 68 };
  roundRectPath(ctx, hint.x, hint.y, hint.w, hint.h, 34);
  ctx.fillStyle = hintEnabled ? rgba(theme.accent, 0.16) : 'rgba(255, 255, 255, 0.05)';
  ctx.fill();
  ctx.strokeStyle = hintEnabled ? rgba(theme.accent, 0.5) : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  setFont(ctx, 26, 600);
  ctx.textAlign = 'center';
  ctx.fillStyle = hintEnabled ? rgba(theme.ink, 0.92) : rgba(theme.ink, 0.35);
  ctx.fillText('提示 · 40', hint.x + hint.w / 2, hint.y + hint.h / 2 + 1);
  return hint;
}

export interface MapLayout {
  readonly back: Rect;
  readonly prev: Rect;
  readonly next: Rect;
  readonly buttons: Rect[];
}

/** 星图（选关）页布局。 */
export function mapLayout(vp: Viewport, count: number): MapLayout {
  const top = vp.insetTop + 26;
  const prev: Rect = { x: 32, y: top + 52, w: 76, h: 76 };
  const next: Rect = { x: vp.width - 108, y: top + 52, w: 76, h: 76 };

  const columns = 6;
  const rows = Math.ceil(count / columns);
  const gap = 16;
  const gridWidth = vp.width - 88;
  const size = Math.min(112, (gridWidth - gap * (columns - 1)) / columns);
  const gridHeight = rows * size + (rows - 1) * gap;
  const startX = (vp.width - (columns * size + (columns - 1) * gap)) / 2;
  const startY = top + 226 + Math.max(0, (vp.height - 226 - 220 - gridHeight) * 0.28);

  const buttons: Rect[] = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    buttons.push({
      x: startX + col * (size + gap),
      y: startY + row * (size + gap),
      w: size,
      h: size,
    });
  }
  return { back: { x: 0, y: 0, w: 0, h: 0 }, prev, next, buttons };
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  theme: Theme,
  layout: MapLayout,
  chapterName: string,
  chapterSubtitle: string,
  levels: readonly Level[],
  stars: Record<string, number>,
  unlocked: readonly boolean[],
  totalStarCount: number,
): void {
  const top = vp.insetTop + 26;
  setFont(ctx, 46, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(theme.ink, 0.95);
  ctx.fillText(chapterName, vp.width / 2, top + 34);
  setFont(ctx, 22, 500);
  ctx.fillStyle = rgba(theme.ink, 0.5);
  ctx.fillText(chapterSubtitle, vp.width / 2, top + 78);

  // 章节切换
  const arrows: readonly [Rect, string][] = [
    [layout.prev, '‹'],
    [layout.next, '›'],
  ];
  for (let i = 0; i < arrows.length; i += 1) {
    const rect = arrows[i][0];
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 38);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fill();
    setFont(ctx, 40, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(theme.ink, 0.75);
    ctx.fillText(arrows[i][1], rect.x + rect.w / 2, rect.y + rect.h / 2 - 2);
  }

  drawStars(ctx, vp.width / 2, top + 128, 16, 0, theme.accent);
  setFont(ctx, 24, 600);
  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(theme.ink, 0.65);
  ctx.fillText(`共 ${totalStarCount} 颗星`, vp.width / 2, top + 164);

  for (let i = 0; i < layout.buttons.length && i < levels.length; i += 1) {
    const rect = layout.buttons[i];
    const level = levels[i];
    const got = stars[level.id] || 0;
    const open = unlocked[i];
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 22);
    ctx.fillStyle = open ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
    if (got > 0) {
      ctx.strokeStyle = rgba(theme.accent, 0.55);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    setFont(ctx, rect.w * 0.36, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = open ? rgba(theme.ink, got > 0 ? 0.95 : 0.75) : rgba(theme.ink, 0.2);
    ctx.fillText(String(level.index + 1), rect.x + rect.w / 2, rect.y + rect.h * 0.42);

    if (got > 0) {
      drawStars(ctx, rect.x + rect.w / 2, rect.y + rect.h * 0.76, rect.w * 0.1, got, theme.accent);
    } else if (!open) {
      ctx.fillStyle = rgba(theme.ink, 0.18);
      ctx.beginPath();
      ctx.arc(rect.x + rect.w / 2, rect.y + rect.h * 0.76, rect.w * 0.035, 0, TAU);
      ctx.fill();
    }
  }
}

export interface CompleteModel {
  readonly stars: number;
  readonly perfect: boolean;
  readonly reward: number;
  readonly hasNext: boolean;
}

export interface CompleteLayout {
  readonly next: Rect;
  readonly replay: Rect;
  readonly map: Rect;
}

export function completeLayout(vp: Viewport): CompleteLayout {
  const cardWidth = 560;
  const cardHeight = 470;
  const x = (vp.width - cardWidth) / 2;
  const y = (vp.height - cardHeight) / 2;
  const buttonY = y + cardHeight - 132;
  return {
    next: { x: x + 40, y: buttonY, w: cardWidth - 80, h: 86 },
    replay: { x: x + 40, y: buttonY + 96, w: (cardWidth - 96) / 2, h: 62 },
    map: { x: x + 40 + (cardWidth - 96) / 2 + 16, y: buttonY + 96, w: (cardWidth - 96) / 2, h: 62 },
  };
}

export function drawComplete(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  theme: Theme,
  layout: CompleteLayout,
  model: CompleteModel,
): void {
  ctx.fillStyle = 'rgba(2, 4, 10, 0.72)';
  ctx.fillRect(0, 0, vp.width, vp.height);

  const cardWidth = 560;
  const cardHeight = 470;
  const x = (vp.width - cardWidth) / 2;
  const y = (vp.height - cardHeight) / 2;
  roundRectPath(ctx, x, y, cardWidth, cardHeight, 36);
  ctx.fillStyle = rgba('#101a2e', 0.98);
  ctx.fill();
  ctx.strokeStyle = rgba(theme.accent, 0.35);
  ctx.lineWidth = 2;
  ctx.stroke();

  setFont(ctx, 40, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(theme.ink, 0.96);
  ctx.fillText(model.perfect ? '完美点亮' : '连上了', vp.width / 2, y + 78);

  drawStars(ctx, vp.width / 2, y + 158, 34, model.stars, theme.accent, 1.35);

  setFont(ctx, 26, 500);
  ctx.fillStyle = rgba(theme.ink, 0.6);
  ctx.fillText(`+${model.reward} 星屑`, vp.width / 2, y + 230);

  roundRectPath(ctx, layout.next.x, layout.next.y, layout.next.w, layout.next.h, 43);
  ctx.fillStyle = rgba(theme.accent, 0.9);
  ctx.fill();
  setFont(ctx, 30, 700);
  ctx.fillStyle = '#05070f';
  ctx.fillText(model.hasNext ? '下一关' : '回到星图', vp.width / 2, layout.next.y + layout.next.h / 2 + 1);

  const secondary: readonly [Rect, string][] = [
    [layout.replay, '重玩'],
    [layout.map, '星图'],
  ];
  for (let i = 0; i < secondary.length; i += 1) {
    const rect = secondary[i][0];
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 31);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    setFont(ctx, 25, 600);
    ctx.fillStyle = rgba(theme.ink, 0.8);
    ctx.fillText(secondary[i][1], rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  }
}

export function drawToast(ctx: CanvasRenderingContext2D, vp: Viewport, theme: Theme, text: string, alpha: number): void {
  if (alpha <= 0.01) return;
  setFont(ctx, 25, 600);
  const width = Math.min(vp.width - 80, ctx.measureText(text).width + 56);
  const height = 58;
  const x = (vp.width - width) / 2;
  const y = vp.height - vp.insetBottom - 210;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  roundRectPath(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = 'rgba(10, 14, 26, 0.85)';
  ctx.fill();
  ctx.strokeStyle = rgba(theme.accent, 0.3);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(theme.ink, 0.95);
  ctx.fillText(text, vp.width / 2, y + height / 2 + 1);
  ctx.restore();
}

export function hitRect(rect: Rect, x: number, y: number): boolean {
  return inside(rect, x, y);
}
