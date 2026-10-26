import { TAU, clamp, rgba, roundRectPath } from '@pocket-play/engine';
import type { Viewport } from '@pocket-play/engine';
import type { BoardState } from './rules';
import type { Theme } from './themes';

export interface BoardLayout {
  readonly cell: number;
  readonly ox: number;
  readonly oy: number;
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
}

export function layoutBoard(vp: Viewport, cols: number, rows: number, top: number, bottom: number): BoardLayout {
  const maxWidth = vp.width - 64;
  const maxHeight = Math.max(160, bottom - top);
  const cell = Math.min(maxWidth / cols, maxHeight / rows);
  const width = cell * cols;
  const height = cell * rows;
  return {
    cell,
    ox: (vp.width - width) / 2,
    oy: top + (maxHeight - height) / 2,
    cols,
    rows,
    width,
    height,
  };
}

export function cellCenter(layout: BoardLayout, cell: number): { x: number; y: number } {
  const x = cell % layout.cols;
  const y = (cell - x) / layout.cols;
  return {
    x: layout.ox + (x + 0.5) * layout.cell,
    y: layout.oy + (y + 0.5) * layout.cell,
  };
}

export function cellAt(layout: BoardLayout, x: number, y: number): number {
  const cx = clamp(Math.floor((x - layout.ox) / layout.cell), 0, layout.cols - 1);
  const cy = clamp(Math.floor((y - layout.oy) / layout.cell), 0, layout.rows - 1);
  return cy * layout.cols + cx;
}

function lineColor(theme: Theme, color: number): string {
  return theme.lines[color % theme.lines.length];
}

function tracePoints(ctx: CanvasRenderingContext2D, layout: BoardLayout, path: number[]): void {
  ctx.beginPath();
  for (let i = 0; i < path.length; i += 1) {
    const point = cellCenter(layout, path[i]);
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
}

function strokeGlow(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
  path: number[],
  color: string,
  width: number,
): void {
  const passes: readonly [number, number][] = [
    [2.35, 0.1],
    [1.6, 0.2],
    [1, 0.92],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  for (let i = 0; i < passes.length; i += 1) {
    ctx.globalAlpha = passes[i][1];
    ctx.lineWidth = width * passes[i][0];
    tracePoints(ctx, layout, path);
    ctx.stroke();
  }
  ctx.restore();
}

export interface BoardFrame {
  readonly hintColor: number;
  readonly hintAlpha: number;
  readonly time: number;
}

export function renderBoard(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
  state: BoardState,
  theme: Theme,
  frame: BoardFrame,
): void {
  const cell = layout.cell;
  const radius = cell * 0.24;

  // 1. 格子底
  for (let y = 0; y < layout.rows; y += 1) {
    for (let x = 0; x < layout.cols; x += 1) {
      const cellIndex = y * layout.cols + x;
      const px = layout.ox + x * cell;
      const py = layout.oy + y * cell;
      const pad = cell * 0.045;
      if (state.wall[cellIndex]) {
        roundRectPath(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, radius);
        ctx.fillStyle = theme.wall;
        ctx.fill();
        ctx.strokeStyle = rgba(theme.wallEdge, 0.9);
        ctx.lineWidth = 2;
        ctx.stroke();
        // 石纹：两道斜线
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = theme.wallEdge;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(px + cell * 0.3, py + cell * 0.34);
        ctx.lineTo(px + cell * 0.68, py + cell * 0.68);
        ctx.moveTo(px + cell * 0.36, py + cell * 0.7);
        ctx.lineTo(px + cell * 0.7, py + cell * 0.36);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      roundRectPath(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, radius);
      ctx.fillStyle = theme.cell;
      ctx.fill();
      ctx.strokeStyle = rgba(theme.cellEdge, 0.75);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // 2. 提示高亮
  if (frame.hintColor >= 0 && frame.hintAlpha > 0.01) {
    const cells = state.solutionCells(frame.hintColor);
    const color = lineColor(theme, frame.hintColor);
    ctx.save();
    ctx.globalAlpha = frame.hintAlpha;
    for (let i = 0; i < cells.length; i += 1) {
      const point = cellCenter(layout, cells[i]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, cell * 0.34, 0, TAU);
      ctx.fillStyle = rgba(color, 0.16);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. 单向格箭头
  for (let i = 0; i < state.arrow.length; i += 1) {
    const dir = state.arrow[i];
    if (dir < 0) continue;
    const point = cellCenter(layout, i);
    const size = cell * 0.2;
    const angle = (dir * Math.PI) / 2;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);
    ctx.strokeStyle = rgba(theme.accent, 0.55);
    ctx.lineWidth = Math.max(2, cell * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-size, size * 0.5);
    ctx.lineTo(0, -size * 0.35);
    ctx.lineTo(size, size * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // 4. 已画的线
  const width = cell * 0.3;
  for (let color = 0; color < state.paths.length; color += 1) {
    const path = state.paths[color];
    if (path.length === 0) continue;
    const tint = lineColor(theme, color);
    if (path.length === 1) {
      const point = cellCenter(layout, path[0]);
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(point.x, point.y, width * 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }
    strokeGlow(ctx, layout, path, tint, width);
  }

  // 5. 端点
  for (let color = 0; color < state.paths.length; color += 1) {
    for (let i = 0; i < state.level.pairs.length; i += 1) {
      const pair = state.level.pairs[i];
      if (pair.color !== color) continue;
      const tint = lineColor(theme, color);
      const connected = state.isConnected(color);
      const pulse = 0.75 + 0.25 * Math.sin(frame.time * 3 + color);
      drawEndpoint(ctx, cellCenter(layout, pair.a), cell, tint, connected, pulse);
      drawEndpoint(ctx, cellCenter(layout, pair.b), cell, tint, connected, pulse);
    }
  }

  // 6. 拖拽头
  const active = state.activeColor;
  if (active >= 0) {
    const head = state.headOf(active);
    if (head >= 0) {
      const point = cellCenter(layout, head);
      const tint = lineColor(theme, active);
      const pulse = 1 + 0.12 * Math.sin(frame.time * 12);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(point.x, point.y, cell * 0.3 * pulse, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawEndpoint(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  cell: number,
  color: string,
  connected: boolean,
  pulse: number,
): void {
  const halo = ctx.createRadialGradient(point.x, point.y, cell * 0.04, point.x, point.y, cell * 0.42);
  halo.addColorStop(0, rgba(color, 0.55 * pulse));
  halo.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(point.x, point.y, cell * 0.42, 0, TAU);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, cell * (connected ? 0.2 : 0.17), 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(point.x - cell * 0.045, point.y - cell * 0.05, cell * 0.05, 0, TAU);
  ctx.fill();

  if (connected) {
    ctx.strokeStyle = rgba('#ffffff', 0.55);
    ctx.lineWidth = Math.max(2, cell * 0.035);
    ctx.beginPath();
    ctx.arc(point.x, point.y, cell * 0.26, 0, TAU);
    ctx.stroke();
  }
}
