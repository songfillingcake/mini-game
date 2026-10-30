import { breakerStages, createBricks, type Brick, type BreakerUpgrade } from './Stages';

export type Orb = { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[] };
export type Drop = { x: number; y: number; kind: 'wide' | 'multi' | 'shield' };
export type Burst = { x: number; y: number; life: number; kind: 'hit' | 'blast' | 'catch' };
const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

/** Browser-free run state. Physics uses small substeps; the app owns the only clock. */
export class BreakerModel {
  stage = 0;
  phase: 'aim' | 'playing' | 'upgrade' | 'won' | 'lost' = 'aim';
  score = 0;
  lives = 3;
  paddle = 480;
  baseWidth = 120;
  power = 1;
  shields = 0;
  wideTime = 0;
  bricks = createBricks(0);
  balls: Orb[] = [];
  drops: Drop[] = [];
  bursts: Burst[] = [];
  message = '移动挡板 · 点击或空格发射';
  messageTime = 4;
  elapsed = 0;
  destroyed = 0;
  upgrades: BreakerUpgrade[] = [];
  private soundQueue: ('hit' | 'bounce' | 'star' | 'unlock' | 'miss')[] = [];
  get paddleWidth(): number { return Math.min(240, this.baseWidth + (this.wideTime > 0 ? 48 : 0)); }
  get speed(): number { return Math.min(520, 350 + this.stage * 22); }
  get over(): boolean { return this.phase === 'won' || this.phase === 'lost'; }
  private ball(x: number, y: number, vx: number, vy: number): Orb { return { x, y, vx, vy, trail: [] }; }
  takeSounds(): typeof this.soundQueue { const sounds = [...new Set(this.soundQueue)]; this.soundQueue = []; return sounds; }
  private notify(text: string): void { this.message = text; this.messageTime = 2.5; }
  launch(): void {
    if (this.phase !== 'aim') return;
    this.balls = [this.ball(this.paddle, 462, this.speed * .25, -this.speed * Math.sqrt(1 - .25 ** 2))];
    this.phase = 'playing';
  }
  choose(id: BreakerUpgrade): boolean {
    if (this.phase !== 'upgrade') return false;
    if ((id === 'paddle' && this.baseWidth >= 216) || (id === 'power' && this.power >= 3) || (id === 'life' && this.lives >= 5)) return false;
    if (id === 'paddle') this.baseWidth = Math.min(216, this.baseWidth + 24);
    else if (id === 'power') this.power = Math.min(3, this.power + 1);
    else this.lives = Math.min(5, this.lives + 1);
    this.upgrades.push(id); this.stage++; this.bricks = createBricks(this.stage);
    this.phase = 'aim'; this.balls = []; this.drops = []; this.wideTime = 0;
    this.notify(breakerStages[this.stage].name + ' · 准备发射');
    return true;
  }
  private burst(x: number, y: number, kind: Burst['kind']): void {
    this.bursts.push({ x, y, life: kind === 'blast' ? .5 : .3, kind });
    if (this.bursts.length > 70) this.bursts.shift();
  }
  private strike(brick: Brick, damage: number, explosion = false): void {
    if (brick.hp <= 0 || (!explosion && brick.cooldown > 0)) return;
    brick.hp = Math.max(0, brick.hp - damage); brick.cooldown = .045;
    this.score += 2; this.burst(brick.x + brick.width / 2, brick.y + 12, 'hit');
    this.soundQueue.push('hit');
    if (brick.hp > 0) return;
    this.destroyed++;
    this.score += brick.kind === 'core' ? 150 : brick.kind === 'crystal' ? 35 : brick.kind === 'armour' ? 20 : 10;
    const x = brick.x + brick.width / 2, y = brick.y + 12;
    if (brick.kind === 'blast') {
      this.burst(x, y, 'blast');
      // Marked dead before recursion, so explosive chains cannot revisit a brick.
      this.bricks.forEach(other => { if (other.hp > 0 && Math.hypot(other.x + other.width / 2 - x, other.y + 12 - y) < 110) this.strike(other, 1, true); });
    }
    if ((brick.kind === 'crystal' || brick.id % 11 === 0) && this.drops.length < 18) {
      this.drops.push({ x, y, kind: (['wide', 'multi', 'shield'] as const)[(brick.id + this.stage) % 3] });
    }
  }
  private catchDrop(drop: Drop): void {
    if (drop.kind === 'wide') { this.wideTime = 12; this.notify('挡板加宽 · 持续 12 秒'); }
    if (drop.kind === 'shield') { this.shields = Math.min(3, this.shields + 1); this.notify('底线护盾 +1'); }
    if (drop.kind === 'multi') {
      const source = this.balls[0];
      if (source) for (const angle of [-.36, .36]) {
        if (this.balls.length >= 5) break;
        const vx = source.vx * Math.cos(angle) - source.vy * Math.sin(angle);
        const vy = source.vx * Math.sin(angle) + source.vy * Math.cos(angle);
        const safeVy = Math.sign(vy || -1) * Math.max(120, Math.abs(vy));
        const norm = Math.hypot(vx, safeVy);
        this.balls.push(this.ball(source.x, source.y, vx / norm * this.speed, safeVy / norm * this.speed));
      }
      this.notify('弹珠分裂 · 最多五颗');
    }
    this.burst(drop.x, drop.y, 'catch'); this.soundQueue.push('star');
  }
  update(dt: number, direction: number, pointer: number | null): void {
    if (!Number.isFinite(dt) || dt <= 0 || this.over) return;
    dt = Math.min(.05, dt); this.elapsed += dt; this.messageTime = Math.max(0, this.messageTime - dt);
    this.bursts.forEach(b => b.life -= dt); this.bursts = this.bursts.filter(b => b.life > 0);
    if (this.phase === 'upgrade') return;
    const target = pointer === null ? this.paddle + direction * 570 * dt : pointer;
    this.paddle += clamp(target - this.paddle, -650 * dt, 650 * dt);
    this.paddle = clamp(this.paddle, 26 + this.paddleWidth / 2, 934 - this.paddleWidth / 2);
    this.wideTime = Math.max(0, this.wideTime - dt);
    if (this.phase === 'aim') return;
    this.balls.forEach(b => { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 8) b.trail.shift(); });
    const slices = Math.ceil(dt / (1 / 240)), step = dt / slices;
    for (let slice = 0; slice < slices; slice++) {
      this.bricks.forEach(b => b.cooldown = Math.max(0, b.cooldown - step));
      for (const ball of this.balls) {
        const previous = { x: ball.x, y: ball.y };
        ball.x += ball.vx * step; ball.y += ball.vy * step;
        if (ball.x < 26 || ball.x > 934) { ball.x = clamp(ball.x, 26, 934); ball.vx *= -1; this.soundQueue.push('bounce'); }
        if (ball.y < 80) { ball.y = 80; ball.vy = Math.abs(ball.vy); }
        if (ball.vy > 0 && previous.y <= 468 && ball.y >= 468 && Math.abs(ball.x - this.paddle) < this.paddleWidth / 2 + 8) {
          const offset = clamp((ball.x - this.paddle) / (this.paddleWidth / 2), -1, 1);
          ball.vx = Math.sin(offset * 1.05) * this.speed;
          ball.vy = -Math.cos(offset * 1.05) * this.speed; ball.y = 467;
          this.soundQueue.push('bounce');
        }
        for (const brick of this.bricks) {
          if (brick.hp <= 0 || ball.x + 8 < brick.x || ball.x - 8 > brick.x + brick.width || ball.y + 8 < brick.y || ball.y - 8 > brick.y + brick.height) continue;
          const dx = Math.min(ball.x + 8 - brick.x, brick.x + brick.width + 8 - ball.x);
          const dy = Math.min(ball.y + 8 - brick.y, brick.y + brick.height + 8 - ball.y);
          if (dx < dy) { ball.x = ball.x < brick.x + brick.width / 2 ? brick.x - 8.1 : brick.x + brick.width + 8.1; ball.vx *= -1; }
          else { ball.y = ball.y < brick.y + brick.height / 2 ? brick.y - 8.1 : brick.y + brick.height + 8.1; ball.vy *= -1; }
          this.strike(brick, this.power); break;
        }
        if (ball.y > 519 && ball.vy > 0 && this.shields > 0) { this.shields--; ball.y = 518; ball.vy = -Math.abs(ball.vy); this.burst(ball.x, 520, 'catch'); this.notify('底线护盾接住弹珠'); }
      }
    }
    this.balls = this.balls.filter(b => b.y < 558);
    this.drops.forEach(drop => drop.y += 135 * dt);
    this.drops = this.drops.filter(drop => {
      if (drop.y >= 461 && drop.y <= 495 && Math.abs(drop.x - this.paddle) < this.paddleWidth / 2 + 12) { this.catchDrop(drop); return false; }
      return drop.y < 550;
    });
    if (!this.bricks.some(b => b.hp > 0)) {
      this.score += 100 + this.stage * 25; this.balls = []; this.drops = [];
      this.phase = this.stage === breakerStages.length - 1 ? 'won' : 'upgrade';
      this.soundQueue.push('unlock'); return;
    }
    if (!this.balls.length) {
      this.lives--; this.drops = []; this.soundQueue.push('miss');
      this.phase = this.lives > 0 ? 'aim' : 'lost'; this.notify(this.lives > 0 ? '还有机会 · 再次发射' : '远征结束');
    }
  }
}
