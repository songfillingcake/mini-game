import { clamp, drawText, HEIGHT, roundedRect, WIDTH } from '../../core/Game';
import type { GameControls, MiniGame } from '../../core/Game';

interface Platform {
  x: number;
  y: number;
  width: number;
  spring: boolean;
  hasStar: boolean;
  collected: boolean;
}

export class JumperGame implements MiniGame {
  readonly id = 'jumper' as const;
  readonly title = '彈跳闖關';
  private playerX = WIDTH / 2;
  private playerY = 420;
  private previousY = 420;
  private velocityY = 30;
  private cameraY = 0;
  private platforms: Platform[] = [];
  private topPlatformY = 170;
  private peakY = 420;
  private bonus = 0;
  private scoreValue = 0;
  private ended = false;
  private springFlash = 0;

  get score(): number { return this.scoreValue; }
  get over(): boolean { return this.ended; }
  get outcome(): string { return '爬到 ' + this.scoreValue + ' 米高'; }
  get statusText(): string { return '高度 ' + this.scoreValue + ' m'; }

  start(): void {
    this.playerX = WIDTH / 2;
    this.playerY = 420;
    this.previousY = 420;
    this.velocityY = 30;
    this.cameraY = 0;
    this.platforms = [
      { x: 385, y: 480, width: 190, spring: false, hasStar: false, collected: false },
      { x: 185, y: 382, width: 140, spring: false, hasStar: true, collected: false },
      { x: 615, y: 288, width: 142, spring: true, hasStar: false, collected: false },
      { x: 365, y: 192, width: 140, spring: false, hasStar: false, collected: false },
    ];
    this.topPlatformY = 192;
    this.peakY = 420;
    this.bonus = 0;
    this.scoreValue = 0;
    this.ended = false;
    this.springFlash = 0;
    this.createPlatformsAbove();
  }

  update(dt: number, controls: GameControls): void {
    if (this.ended) return;
    const direction = Number(controls.keys.has('right')) - Number(controls.keys.has('left'));
    this.playerX += direction * 360 * dt;
    if (controls.pointerX !== null) this.playerX += clamp(controls.pointerX - this.playerX, -470 * dt, 470 * dt);
    this.playerX = clamp(this.playerX, 35, WIDTH - 35);

    this.previousY = this.playerY;
    this.velocityY += 1120 * dt;
    this.playerY += this.velocityY * dt;
    this.springFlash = Math.max(0, this.springFlash - dt);

    if (this.velocityY > 0) {
      for (const platform of this.platforms) {
        const crossed = this.previousY + 22 <= platform.y && this.playerY + 22 >= platform.y;
        const overlaps = this.playerX + 19 >= platform.x && this.playerX - 19 <= platform.x + platform.width;
        if (crossed && overlaps) {
          this.playerY = platform.y - 22;
          this.velocityY = platform.spring ? -860 : -680;
          if (platform.spring) this.springFlash = 0.4;
          if (platform.hasStar && !platform.collected) {
            platform.collected = true;
            this.bonus += 30;
          }
          break;
        }
      }
    }

    this.peakY = Math.min(this.peakY, this.playerY);
    this.cameraY = Math.min(this.cameraY, this.playerY - 245);
    this.createPlatformsAbove();
    this.platforms = this.platforms.filter((platform) => platform.y < this.cameraY + HEIGHT + 100);
    this.scoreValue = Math.max(0, Math.floor((420 - this.peakY) / 10)) + this.bonus;

    if (this.playerY - this.cameraY > HEIGHT + 60) this.ended = true;
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#bde6e4');
    sky.addColorStop(1, '#e9f3d1');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 7; i += 1) {
      const x = (i * 169 + 80) % WIDTH;
      const y = ((i * 127 - this.cameraY * 0.22) % 650 + 650) % 650 - 55;
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.ellipse(x, y, 42, 15, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 30, y + 4, 29, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(104,163,145,.18)';
    ctx.beginPath();
    ctx.moveTo(0, 460);
    ctx.quadraticCurveTo(160, 380, 330, 470);
    ctx.quadraticCurveTo(530, 360, 700, 458);
    ctx.quadraticCurveTo(830, 390, 960, 450);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.fill();

    for (const platform of this.platforms) this.drawPlatform(ctx, platform);
    this.drawPlayer(ctx, this.playerX, this.playerY - this.cameraY, now);
    drawText(ctx, '踩住平台一直往上跳，别掉下去', WIDTH / 2, 42, 18, '#355b5a', 800);
    drawText(ctx, '落在星星平台可加分 · 弹簧平台跳得更高', WIDTH / 2, 500, 14, '#547a77', 600);
    if (this.springFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.springFlash * 0.42;
      ctx.fillStyle = '#fff0a5';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }
  }

  private createPlatformsAbove(): void {
    const previous = this.platforms.find((platform) => platform.y === this.topPlatformY);
    let previousCenter = previous ? previous.x + previous.width / 2 : WIDTH / 2;
    while (this.topPlatformY > this.cameraY - 180) {
      const gap = 82 + Math.random() * 24;
      this.topPlatformY -= gap;
      const width = 112 + Math.random() * 44;
      const center = clamp(previousCenter + (Math.random() - 0.5) * 420, 48 + width / 2, WIDTH - 48 - width / 2);
      const x = center - width / 2;
      this.platforms.push({
        x,
        y: this.topPlatformY,
        width,
        spring: Math.random() < 0.14,
        hasStar: Math.random() < 0.32,
        collected: false,
      });
      previousCenter = center;
    }
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, platform: Platform): void {
    const y = platform.y - this.cameraY;
    if (y < -50 || y > HEIGHT + 30) return;
    ctx.fillStyle = platform.spring ? '#ee8b72' : '#6eaa83';
    roundedRect(ctx, platform.x, y, platform.width, 19, 10);
    ctx.fill();
    ctx.fillStyle = platform.spring ? '#ffc38e' : '#a9d99b';
    roundedRect(ctx, platform.x + 4, y + 2, platform.width - 8, 7, 5);
    ctx.fill();
    if (platform.spring) {
      ctx.strokeStyle = '#fff1c5';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(platform.x + platform.width * 0.38, y + 12);
      ctx.lineTo(platform.x + platform.width * 0.48, y + 5);
      ctx.lineTo(platform.x + platform.width * 0.58, y + 12);
      ctx.lineTo(platform.x + platform.width * 0.68, y + 5);
      ctx.stroke();
    }
    if (platform.hasStar && !platform.collected) {
      ctx.fillStyle = '#ffcf5c';
      ctx.beginPath();
      ctx.arc(platform.x + platform.width / 2, y - 18, 10, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, '★', platform.x + platform.width / 2, y - 18, 13, '#fff8d1', 800);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, now: number): void {
    const tilt = clamp(this.velocityY / 900, -0.2, 0.2);
    ctx.save();
    ctx.translate(x, y + Math.sin(now * 10) * 2);
    ctx.rotate(tilt);
    ctx.fillStyle = '#ef9c65';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe2ba';
    ctx.beginPath();
    ctx.ellipse(0, 5, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#385358';
    ctx.beginPath();
    ctx.arc(-8, -3, 2.5, 0, Math.PI * 2);
    ctx.arc(8, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d97868';
    ctx.beginPath();
    ctx.arc(0, 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
