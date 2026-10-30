import { audio } from '../../core/Audio';
import type { GameControls, MiniGame } from '../../core/Game';
import { SokobanModel } from './SokobanModel';
import { boxIslands } from './Islands';
import { boxButtons, boxOrigin, boxTile, renderSokoban } from './SokobanRenderer';

export class SokobanGame implements MiniGame {
  readonly id = 'sokoban' as const;
  readonly title = '推箱小岛';
  readonly modeLabel = '十岛解谜';
  model = new SokobanModel();
  private cooldown = 0;
  get score(): number { return this.model.score; }
  get over(): boolean { return this.model.over; }
  get statusText(): string { return `第 ${this.model.stage + 1}/${boxIslands.length} 岛 · 目标 ${this.model.covered}/${this.model.goals.size}`; }
  get resultTitle(): string { return '十座小岛全部点亮！'; }
  get resultSummary(): string { return `完成 ${boxIslands.length} 岛 · 总移动 ${this.model.totalMoves} 步`; }
  get outcome(): string { return `完成五组地图及其镜像挑战，共 ${boxIslands.length} 岛，累计移动 ${this.model.totalMoves} 步。可重新挑战，用更少步数推箱到位。`; }
  start(): void { this.model = new SokobanModel(); this.cooldown = 0; }
  private move(dx: number, dy: number): void { const result = this.model.move(dx, dy); if (result !== 'blocked') audio.play(result === 'clear' ? 'unlock' : result === 'push' ? 'bounce' : 'reel'); }
  update(dt: number, controls: GameControls): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const x = Number(controls.keys.has('right')) - Number(controls.keys.has('left'));
    const y = Number(controls.keys.has('down')) - Number(controls.keys.has('up'));
    if (!x && !y) { this.cooldown = 0; return; }
    if (this.cooldown <= 0) { this.move(y ? 0 : x, y); this.cooldown = .17; }
  }
  press(): void { if (this.model.phase === 'cleared') this.model.next(); else this.model.undo(); }
  pointerDown(x: number, y: number): void {
    const button = boxButtons.findIndex(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
    if (button === 0) { this.model.undo(); return; }
    if (button === 1) { this.model.restart(); return; }
    if (button === 2) { this.model.next(); return; }
    const origin = boxOrigin(this.model), col = Math.floor((x - origin.x) / boxTile), row = Math.floor((y - origin.y) / boxTile);
    const dx = col - this.model.player.x, dy = row - this.model.player.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) this.move(dx, dy);
  }
  render(ctx: CanvasRenderingContext2D, now: number): void { renderSokoban(ctx, this.model, now); }
}
