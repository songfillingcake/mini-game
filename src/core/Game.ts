export type GameId = 'fishing' | 'dodger' | 'jumper' | 'shells' | 'stacker' | 'autochess' | 'extraction';

export interface GameControls {
  keys: ReadonlySet<string>;
  pointerX: number | null;
}

export interface GameSetupOption {
  id: string;
  group?: string;
  icon: string;
  label: string;
  detail: string;
  unlocked: boolean;
  unlockHint?: string;
}

export interface MiniGame {
  readonly id: GameId;
  readonly title: string;
  readonly score: number;
  readonly statusText: string;
  readonly timeLeft?: number;
  readonly over: boolean;
  readonly outcome: string;
  readonly setupOptions?: readonly GameSetupOption[];
  readonly selectedSetupOption?: string;
  readonly selectedSetupOptions?: Readonly<Record<string, string>>;
  start(): void;
  update(dt: number, controls: GameControls): void;
  render(ctx: CanvasRenderingContext2D, now: number): void;
  press?(x?: number, y?: number): void;
  selectSetupOption?(id: string): void;
  pointerDown?(x: number, y: number): void;
  mount?(host: HTMLElement): void;
  setActive?(active: boolean): void;
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
  const canvas = ctx.canvas;
  const transform = ctx.getTransform();
  const cssScale = canvas.clientWidth > 0
    ? Math.min(Math.abs(transform.a), Math.abs(transform.d)) / (canvas.width / canvas.clientWidth)
    : 1;
  const minimumRenderedSize = size <= 12 ? 11 : size <= 16 ? 12 : size <= 18 ? 13 : 0;
  const readableSize = minimumRenderedSize > 0 && cssScale > 0 && cssScale < 1
    ? Math.min(size * 1.5, Math.max(size, minimumRenderedSize / cssScale))
    : size;
  ctx.font = weight + ' ' + readableSize + 'px "Trebuchet MS", "Microsoft YaHei", sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
