import { clamp, drawText, HEIGHT, roundedRect, WIDTH } from '../../core/Game';
import type { GameControls, MiniGame } from '../../core/Game';

interface FallingThing {
  x: number;
  y: number;
  kind: 'rock' | 'cone' | 'star';
  size: number;
  spin: number;
  hit: boolean;
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
  private scoreValue = 0;
  private ended = false;
  private endText = '再来一局，跑得更远！';

  get score(): number { return this.scoreValue; }
  get timeLeft(): number { return Math.max(0, 60 - this.elapsed); }
  get over(): boolean { return this.ended; }
  get outcome(): string { return this.endText; }
  get statusText(): string { return '❤ '.repeat(this.lifeCount).trim() + '　★ ' + this.stars; }

  start(): void {
    this.elapsed = 0;
    this.playerX = WIDTH / 2;
    this.things = [];
    this.spawnTimer = 0.6;
    this.hitFlash = 0;
    this.lifeCount = 3;
    this.stars = 0;
    this.scoreValue = 0;
    this.ended = false;
    this.endText = '再来一局，跑得更远！';
  }

  update(dt: number, controls: GameControls): void {
    if (this.ended) return;
    this.elapsed += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
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
      thing.y += pace * dt;
      thing.spin += dt * (thing.kind === 'star' ? 3 : 1.5);
      const dx = Math.abs(thing.x - this.playerX);
      const dy = Math.abs(thing.y - 430);
      const collisionDistance = thing.kind === 'star' ? 48 : thing.size + 28;
      if (!thing.hit && dx < collisionDistance && dy < collisionDistance) {
        thing.hit = true;
        if (thing.kind === 'star') {
          this.stars += 1;
          this.scoreValue += 25;
        } else {
          this.lifeCount -= 1;
          this.hitFlash = 0.35;
          if (this.lifeCount <= 0) {
            this.ended = true;
            this.endText = '撞到了三次，收集到 ' + this.stars + ' 顆星星';
          }
        }
      }
    }
    this.things = this.things.filter((thing) => thing.y < HEIGHT + 90 && !thing.hit);
    this.scoreValue = Math.max(this.scoreValue, Math.floor(this.elapsed * 8) + this.stars * 25);
    if (this.elapsed >= 60 && !this.ended) {
      this.elapsed = 60;
      this.ended = true;
      this.endText = '成功跑完！收集到 ' + this.stars + ' 顆星星';
    }
  }

  pointerDown(x: number): void {
    this.playerX = clamp(x, 70, WIDTH - 70);
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#f8d7a1');
    sky.addColorStop(0.54, '#f8ecce');
    sky.addColorStop(0.55, '#f2b5a5');
    sky.addColorStop(1, '#e9938d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 远处的小山和跑道
    ctx.fillStyle = '#d2d99e';
    ctx.beginPath();
    ctx.ellipse(145, 300, 260, 100, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(780, 300, 330, 115, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a9c83';
    roundedRect(ctx, 52, 0, 856, HEIGHT, 26);
    ctx.fill();
    ctx.fillStyle = '#92b29a';
    roundedRect(ctx, 74, 0, 812, HEIGHT, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,255,232,.54)';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 22]);
    ctx.beginPath();
    ctx.moveTo(480, -10 + (this.elapsed * 150) % 32);
    ctx.lineTo(480, HEIGHT + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const thing of this.things) this.drawThing(ctx, thing);
    this.drawRunner(ctx, this.playerX, 430, now);
    if (this.hitFlash > 0) {
      ctx.fillStyle = 'rgba(239,93,90,' + (this.hitFlash * 0.24) + ')';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    drawText(ctx, '左右移动躲开障碍，顺手捡星星', WIDTH / 2, 42, 18, '#314e46', 800);
  }

  private spawnThing(): void {
    const isStar = Math.random() < 0.24;
    this.things.push({
      x: 135 + Math.random() * 690,
      y: -50,
      kind: isStar ? 'star' : Math.random() < 0.5 ? 'rock' : 'cone',
      size: isStar ? 18 : 24 + Math.random() * 6,
      spin: Math.random() * 3,
      hit: false,
    });
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
