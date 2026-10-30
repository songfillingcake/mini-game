import { audio } from '../../core/Audio';
import type { GameControls, MiniGame } from '../../core/Game';
import { BreakerModel } from './BreakerModel';
import { renderBreaker, upgradeRects } from './BreakerRenderer';
import { breakerStages, breakerUpgrades } from './Stages';

export class BreakerGame implements MiniGame {
  readonly id = 'breaker' as const;
  readonly title = '弹珠远征';
  readonly modeLabel = '六关远征';
  model = new BreakerModel();
  private choice = 0;
  private keyCooldown = 0;
  get score(): number { return this.model.score; }
  get over(): boolean { return this.model.over; }
  get statusText(): string { return `第 ${this.model.stage + 1}/6 关 · ♥ ${this.model.lives} · ${this.model.phase === 'upgrade' ? '选择升级' : breakerStages[this.model.stage].name}`; }
  get resultTitle(): string { return this.model.phase === 'won' ? '弹珠远征通关！' : '远征暂时告一段落'; }
  get resultSummary(): string { return `到达第 ${this.model.stage + 1} 关 · 击碎 ${this.model.destroyed} 砖 · 升级 ${this.model.upgrades.length} 次`; }
  get outcome(): string { return `${this.model.phase === 'won' ? '黯星之核已击碎，完成六关远征！' : '在' + breakerStages[this.model.stage].name + '用完了发射机会。'} 共击碎 ${this.model.destroyed} 块砖，获得 ${this.model.upgrades.length} 次永久升级。`; }
  start(): void { this.model = new BreakerModel(); this.choice = 0; this.keyCooldown = 0; }
  update(dt: number, controls: GameControls): void {
    const direction = Number(controls.keys.has('right')) - Number(controls.keys.has('left'));
    this.keyCooldown = Math.max(0, this.keyCooldown - dt);
    if (this.model.phase === 'upgrade') {
      if (direction && this.keyCooldown <= 0) { this.choice = (this.choice + direction + 3) % 3; this.keyCooldown = .18; }
      if (!direction) this.keyCooldown = 0;
    }
    this.model.update(dt, direction, controls.pointerX);
    for (const cue of this.model.takeSounds()) audio.play(cue);
  }
  press(): void {
    if (this.model.phase === 'upgrade') { if (this.model.choose(breakerUpgrades[this.choice].id)) audio.play('unlock'); }
    else this.model.launch();
  }
  pointerDown(x: number, y: number): void {
    if (this.model.phase !== 'upgrade') { this.model.launch(); return; }
    const index = upgradeRects.findIndex(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
    if (index >= 0) { this.choice = index; this.press(); }
  }
  render(ctx: CanvasRenderingContext2D, now: number): void { renderBreaker(ctx, this.model, now, this.choice); }
}
