import { clamp, drawText, HEIGHT, roundedRect, WIDTH } from '../../core/Game';
import { audio } from '../../core/Audio';
import type { GameControls, GameSetupOption, MiniGame } from '../../core/Game';

type DodgerRoute = 'stargazer' | 'steady' | 'close-call';

interface FallingThing {
  x: number;
  y: number;
  kind: 'rock' | 'cone' | 'star';
  size: number;
  spin: number;
  hit: boolean;
  missed: boolean;
  nearMissed: boolean;
  nearMissTimer: number;
  nearMissBonus: number;
  nearMissStreak: number;
}

export class DodgerGame implements MiniGame {
  readonly id = 'dodger' as const;
  readonly title = '躲障碍';
  private elapsed = 0;
  private playerX = WIDTH / 2;
  private things: FallingThing[] = [];
  private spawnTimer = 0.5;
  private hitFlash = 0;
  private lifeCount = 3;
  private stars = 0;
  private starStreak = 0;
  private bestStarStreak = 0;
  private nearMisses = 0;
  private nearMissStreak = 0;
  private bestNearMissStreak = 0;
  private bonusValue = 0;
  private scoreValue = 0;
  private ended = false;
  private endText = '再来一局，跑得更远！';
  private courseStage = 0;
  private courseFlash = 0;
  private route: DodgerRoute = 'stargazer';

  get score(): number { return this.scoreValue; }
  get timeLeft(): number { return Math.max(0, 60 - this.elapsed); }
  get over(): boolean { return this.ended; }
  get outcome(): string { return this.endText; }
  get statusText(): string { return '❤ '.repeat(Math.max(0, this.lifeCount)).trim() + '　★ ' + this.stars + ' · ' + this.getCourseName(this.courseStage); }
  get setupOptions(): readonly GameSetupOption[] {
    return [
      { id: 'stargazer', group: '路线徽章', icon: '⭐', label: '星星小径', detail: '星星更常出现，适合冲高分', unlocked: true },
      { id: 'steady', group: '路线徽章', icon: '🐾', label: '稳稳路线', detail: '碰撞范围更宽容，星星稍少', unlocked: true },
      { id: 'close-call', group: '路线徽章', icon: '⚡', label: '贴边路线', detail: '险闪奖励更高，障碍判定更紧', unlocked: true },
    ];
  }
  get selectedSetupOption(): string { return this.route; }

  selectSetupOption(id: string): void {
    if (id === 'stargazer' || id === 'steady' || id === 'close-call') this.route = id;
  }

  start(): void {
    this.elapsed = 0;
    this.playerX = WIDTH / 2;
    this.things = [];
    this.spawnTimer = 0.6;
    this.hitFlash = 0;
    this.lifeCount = 3;
    this.stars = 0;
    this.starStreak = 0;
    this.bestStarStreak = 0;
    this.nearMisses = 0;
    this.nearMissStreak = 0;
    this.bestNearMissStreak = 0;
    this.bonusValue = 0;
    this.scoreValue = 0;
    this.ended = false;
    this.endText = '再来一局，跑得更远！';
    this.courseStage = 0;
    this.courseFlash = 0;
  }

  update(dt: number, controls: GameControls): void {
    if (this.ended) return;
    this.elapsed += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.courseFlash = Math.max(0, this.courseFlash - dt);
    const reachedStage = this.getCourseStage();
    if (reachedStage > this.courseStage) {
      this.courseStage = reachedStage;
      this.courseFlash = 2.8;
      audio.play('unlock');
    }
    const direction = Number(controls.keys.has('right')) - Number(controls.keys.has('left'));
    this.playerX += direction * 440 * dt;
    if (controls.pointerX !== null) this.playerX += clamp(controls.pointerX - this.playerX, -520 * dt, 520 * dt);
    this.playerX = clamp(this.playerX, 70, WIDTH - 70);

    const pace = 285 + this.elapsed * 4.2;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnThing();
      this.spawnTimer = Math.max(0.34, 0.82 - this.elapsed * 0.004) + Math.random() * 0.2;
    }

    for (const thing of this.things) {
      if (this.ended) break;
      thing.y += pace * dt;
      thing.spin += dt * (thing.kind === 'star' ? 3 : 1.5);
      thing.nearMissTimer = Math.max(0, thing.nearMissTimer - dt);
      const collisionDistance = thing.kind === 'star' ? 48 : thing.size + this.getCollisionPadding();
      if (!thing.hit && !thing.missed && thing.y > 430 + collisionDistance) {
        thing.missed = true;
        if (thing.kind === 'star') this.starStreak = 0;
        else if (!thing.nearMissed) this.nearMissStreak = 0;
      }
      const dx = Math.abs(thing.x - this.playerX);
      const dy = Math.abs(thing.y - 430);
      if (!thing.hit && !thing.missed && dx < collisionDistance && dy < collisionDistance) {
        thing.hit = true;
        if (thing.kind === 'star') {
          this.stars += 1;
          this.starStreak += 1;
          this.bestStarStreak = Math.max(this.bestStarStreak, this.starStreak);
          this.bonusValue += Math.min(this.starStreak - 1, 5) * 5;
          audio.play('star');
        } else {
          this.lifeCount -= 1;
          this.starStreak = 0;
          this.nearMissStreak = 0;
          this.hitFlash = 0.35;
          audio.play('hit');
          if (this.lifeCount <= 0) {
            this.lifeCount = 0;
            this.ended = true;
            this.endText = this.getRunSummary('撞到了三次。');
            break;
          }
        }
      } else if (!thing.hit && !thing.missed && thing.kind !== 'star' && !thing.nearMissed && dy < 32 && dx >= collisionDistance && dx < collisionDistance + this.getNearMissWidth()) {
        thing.nearMissed = true;
        thing.nearMissTimer = 0.65;
        this.nearMisses += 1;
        this.nearMissStreak += 1;
        this.bestNearMissStreak = Math.max(this.bestNearMissStreak, this.nearMissStreak);
        thing.nearMissBonus = 15 + Math.min(this.nearMissStreak - 1, 4) * 5 + (this.route === 'close-call' ? 10 : 0);
        thing.nearMissStreak = this.nearMissStreak;
        this.bonusValue += thing.nearMissBonus;
        audio.play('star');
      }
    }
    this.things = this.things.filter((thing) => thing.y < HEIGHT + 90 && !thing.hit);
    this.scoreValue = Math.floor(this.elapsed * 8) + this.stars * 25 + this.bonusValue;
    if (this.elapsed >= 60 && !this.ended) {
      this.elapsed = 60;
      this.ended = true;
      this.endText = this.getRunSummary('成功跑完！');
    }
  }

  pointerDown(x: number): void {
    this.playerX = clamp(x, 70, WIDTH - 70);
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    const palettes = [
      { skyTop: '#f8d7a1', skyMid: '#f8ecce', skyBottom: '#e9938d', hills: '#d2d99e', roadEdge: '#7a9c83', road: '#92b29a', lane: 'rgba(245,255,232,.54)' },
      { skyTop: '#ffd09c', skyMid: '#ffe1bf', skyBottom: '#da9098', hills: '#e4bf8e', roadEdge: '#976c76', road: '#c18483', lane: 'rgba(255,244,223,.62)' },
      { skyTop: '#263960', skyMid: '#415781', skyBottom: '#776e9b', hills: '#667b9b', roadEdge: '#2c405f', road: '#415a7d', lane: 'rgba(213,244,246,.64)' },
    ];
    const palette = palettes[this.courseStage];
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(0.54, palette.skyMid);
    sky.addColorStop(0.55, palette.skyBottom);
    sky.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 远处的小山和跑道
    ctx.fillStyle = palette.hills;
    ctx.beginPath();
    ctx.ellipse(145, 300, 260, 100, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(780, 300, 330, 115, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.roadEdge;
    roundedRect(ctx, 52, 0, 856, HEIGHT, 26);
    ctx.fill();
    ctx.fillStyle = palette.road;
    roundedRect(ctx, 74, 0, 812, HEIGHT, 20);
    ctx.fill();
    ctx.strokeStyle = palette.lane;
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 22]);
    ctx.beginPath();
    ctx.moveTo(480, -10 + (this.elapsed * 150) % 32);
    ctx.lineTo(480, HEIGHT + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.courseStage >= 2) {
      ctx.save();
      for (let i = 0; i < 18; i += 1) {
        const x = (i * 197 + 33) % WIDTH;
        const y = 35 + (i * 71) % 230;
        ctx.globalAlpha = 0.38 + (Math.sin(now * 2 + i) + 1) * 0.23;
        ctx.fillStyle = '#e4f4ce';
        ctx.beginPath();
        ctx.arc(x, y, i % 6 === 0 ? 2.2 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const thing of this.things) this.drawThing(ctx, thing);
    this.drawRunner(ctx, this.playerX, 430, now);
    if (this.hitFlash > 0) {
      ctx.fillStyle = 'rgba(239,93,90,' + (this.hitFlash * 0.24) + ')';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    const titleColor = this.courseStage >= 2 ? '#fff0c7' : this.courseStage === 1 ? '#684350' : '#314e46';
    drawText(ctx, '左右移动躲开障碍，顺手捡星星', WIDTH / 2, 42, 18, titleColor, 800);
    ctx.fillStyle = this.route === 'close-call' ? 'rgba(255,231,177,.88)' : this.route === 'steady' ? 'rgba(206,236,217,.9)' : 'rgba(255,255,255,.76)';
    roundedRect(ctx, 750, 26, 176, 29, 15);
    ctx.fill();
    drawText(ctx, this.getRouteBadge(), 838, 40.5, 12, '#3d5852', 800);
    if (this.starStreak > 1) drawText(ctx, '连星 x' + this.starStreak, WIDTH / 2, 70, 14, '#fff5c7', 900);
    if (this.nearMissStreak > 1) drawText(ctx, '连躲 x' + this.nearMissStreak, WIDTH / 2, 96, 13, '#ffe4b4', 900);
    if (this.courseFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.courseFlash);
      ctx.fillStyle = 'rgba(255,250,231,.86)';
      roundedRect(ctx, 360, 124, 240, 32, 16);
      ctx.fill();
      drawText(ctx, this.getCourseName(this.courseStage) + ' · ' + Math.floor(this.elapsed) + 's', WIDTH / 2, 140, 14, this.courseStage >= 2 ? '#394b70' : '#7e5460', 900);
      ctx.restore();
    }
  }

  private spawnThing(): void {
    const starChance = this.route === 'stargazer' ? 0.36 : this.route === 'steady' ? 0.16 : 0.24;
    const isStar = Math.random() < starChance;
    this.things.push({
      x: 135 + Math.random() * 690,
      y: -50,
      kind: isStar ? 'star' : Math.random() < 0.5 ? 'rock' : 'cone',
      size: isStar ? 18 : 24 + Math.random() * 6,
      spin: Math.random() * 3,
      hit: false,
      missed: false,
      nearMissed: false,
      nearMissTimer: 0,
      nearMissBonus: 0,
      nearMissStreak: 0,
    });
  }

  private getRunSummary(prefix: string): string {
    const streak = this.bestStarStreak > 0 ? '最长连星 x' + this.bestStarStreak : '还没连起星星';
    const dodgeStreak = this.bestNearMissStreak > 0 ? '最长连躲 x' + this.bestNearMissStreak : '还没连起贴边闪避';
    return prefix + '选择' + this.getRouteName() + '，到达' + this.getCourseName(this.courseStage) + '，收集 ' + this.stars + ' 颗星，贴边闪过 ' + this.nearMisses + ' 次，' + streak + '，' + dodgeStreak;
  }

  private getCollisionPadding(): number {
    if (this.route === 'steady') return 19;
    if (this.route === 'close-call') return 33;
    return 28;
  }

  private getNearMissWidth(): number {
    return this.route === 'close-call' ? 48 : this.route === 'steady' ? 28 : 34;
  }

  private getRouteName(): string {
    if (this.route === 'steady') return '稳稳路线';
    if (this.route === 'close-call') return '贴边路线';
    return '星星小径';
  }

  private getRouteBadge(): string {
    if (this.route === 'steady') return '🐾 稳稳路线';
    if (this.route === 'close-call') return '⚡ 贴边路线';
    return '⭐ 星星小径';
  }

  private getCourseStage(): number {
    return this.elapsed >= 40 ? 2 : this.elapsed >= 20 ? 1 : 0;
  }

  private getCourseName(stage: number): string {
    return ['晨雾草甸', '霞光栈道', '星夜高架'][stage] || '晨雾草甸';
  }

  private drawThing(ctx: CanvasRenderingContext2D, thing: FallingThing): void {
    ctx.save();
    ctx.translate(thing.x, thing.y);
    ctx.rotate(thing.spin * (thing.kind === 'star' ? 0.7 : 0.2));
    if (thing.kind === 'star') {
      ctx.fillStyle = '#ffdf6e';
      ctx.strokeStyle = '#d88d43';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? 20 : 9;
        const angle = -Math.PI / 2 + (Math.PI * i) / 5;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (thing.kind === 'rock') {
      ctx.fillStyle = '#d58d69';
      ctx.strokeStyle = '#9d654f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-thing.size, 10);
      ctx.lineTo(-thing.size * 0.72, -15);
      ctx.lineTo(-4, -thing.size);
      ctx.lineTo(thing.size * 0.7, -thing.size * 0.72);
      ctx.lineTo(thing.size, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#f58c62';
      ctx.strokeStyle = '#b85646';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -thing.size);
      ctx.lineTo(thing.size * 0.83, thing.size);
      ctx.lineTo(-thing.size * 0.83, thing.size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff0d5';
      ctx.fillRect(-thing.size * 0.55, 1, thing.size * 1.1, 6);
      ctx.fillStyle = '#b85646';
      ctx.beginPath();
      ctx.ellipse(0, thing.size + 2, thing.size * 0.92, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (thing.nearMissTimer > 0) {
      const text = thing.nearMissStreak > 1 ? '连躲 x' + thing.nearMissStreak + ' +' + thing.nearMissBonus : '贴边 +' + thing.nearMissBonus;
      drawText(ctx, text, thing.x, thing.y - 34 - (0.65 - thing.nearMissTimer) * 22, 13, '#fff4c7', 900);
    }
  }

  private drawRunner(ctx: CanvasRenderingContext2D, x: number, y: number, now: number): void {
    const bounce = Math.abs(Math.sin(now * 12)) * 5;
    ctx.fillStyle = 'rgba(39,62,57,.23)';
    ctx.beginPath();
    ctx.ellipse(x, y + 31, 32, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5e6c6';
    ctx.beginPath();
    ctx.ellipse(x, y - bounce, 27, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4e7e78';
    ctx.beginPath();
    ctx.arc(x - 11, y - 24 - bounce, 12, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#314a47';
    ctx.beginPath();
    ctx.arc(x - 9, y - 4 - bounce, 2.6, 0, Math.PI * 2);
    ctx.arc(x + 9, y - 4 - bounce, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e78570';
    ctx.beginPath();
    ctx.ellipse(x, y + 5 - bounce, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
