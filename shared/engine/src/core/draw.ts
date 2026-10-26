import { TAU } from './math';

export const FONT_STACK = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';

export function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 600): void {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT_STACK}`;
}

/** 手写圆角矩形路径，避免依赖 quick game 未实现的 ctx.roundRect。 */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  const right = x + width;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(right - r, y);
  ctx.arc(right - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(right, bottom - r);
  ctx.arc(right - r, bottom - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, bottom);
  ctx.arc(x + r, bottom - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

/** 四角星 / 星尘图标。 */
export function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points = 4,
  rotation = 0,
): void {
  const step = TAU / (points * 2);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation - Math.PI / 2 + step * i;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 以 (cx, cy) 为中心的椭圆路径（不依赖 ctx.ellipse）。 */
export function ellipsePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, Math.max(0.01, radiusY / Math.max(0.01, radiusX)));
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0.01, radiusX), 0, TAU);
  ctx.restore();
}

/** 带描边阴影的胶囊标签。 */
export function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
): void {
  roundRectPath(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = fill;
  ctx.fill();
}
