export type GameId = 'fishing' | 'dodger' | 'jumper';

export interface GameControls {
  keys: ReadonlySet<string>;
  pointerX: number | null;
}

export interface MiniGame {
  readonly id: GameId;
  readonly title: string;
  readonly score: number;
  readonly statusText: string;
  readonly timeLeft?: number;
  readonly over: boolean;
  readonly outcome: string;
  start(): void;
  update(dt: number, controls: GameControls): void;
  render(ctx: CanvasRenderingContext2D, now: number): void;
  press?(x?: number, y?: number): void;
  pointerDown?(x: number, y: number): void;
  dispose?(): void;
}

export const WIDTH = 960;
export const HEIGHT = 540;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color = '#253337',
  weight = 700,
  align: CanvasTextAlign = 'center',
): void {
  ctx.save();
  ctx.font = weight + ' ' + size + 'px "Trebuchet MS", "Microsoft YaHei", sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
