import { clamp, drawText, HEIGHT, roundedRect, WIDTH } from '../../core/Game';
import { audio } from '../../core/Audio';
import type { GameControls, MiniGame } from '../../core/Game';

type FishingPhase = 'waiting' | 'bite' | 'fake';

export class FishingGame implements MiniGame {
  readonly id = 'fishing' as const;
  readonly title = '猫猫钓鱼';
  private elapsed = 0;
  private phase: FishingPhase = 'waiting';
  private phaseTimer = 1.8;
  private chain = 0;
  private catches = 0;
  private message = '鱼竿准备好了，等鱼上钩';
  private catchFlash = 0;
  private scoreValue = 0;
  private ended = false;

  get score(): number { return this.scoreValue; }
  get timeLeft(): number { return Math.max(0, 60 - this.elapsed); }
  get over(): boolean { return this.ended; }
  get outcome(): string { return '钓到了 ' + this.catches + ' 条鱼'; }
  get statusText(): string { return this.chain > 1 ? '连击 x' + this.chain : '收获 ' + this.catches + ' 条'; }

  start(): void {
    this.elapsed = 0;
    this.phase = 'waiting';
    this.phaseTimer = 1.5;
    this.chain = 0;
    this.catches = 0;
    this.scoreValue = 0;
    this.catchFlash = 0;
    this.ended = false;
    this.message = '鱼竿准备好了，等鱼上钩';
  }

  update(dt: number, _controls: GameControls): void {
    if (this.ended) return;
    this.elapsed += dt;
    this.catchFlash = Math.max(0, this.catchFlash - dt);
    if (this.elapsed >= 60) {
      this.elapsed = 60;
      this.ended = true;
      return;
    }

    this.phaseTimer -= dt;
    if (this.phase === 'waiting' && this.phaseTimer <= 0) {
      this.phase = Math.random() < 0.25 ? 'fake' : 'bite';
      this.phaseTimer = this.phase === 'fake' ? 0.62 : 0.92;
      audio.play(this.phase === 'fake' ? 'fake' : 'bite');
      this.message = this.phase === 'fake' ? '好像动了一下？' : '咬钩啦！快点收竿！';
    } else if (this.phase !== 'waiting' && this.phaseTimer <= 0) {
      if (this.phase === 'bite') {
        this.chain = 0;
        this.message = '鱼溜走了，再等等看';
        audio.play('miss');
      } else {
        this.message = '差点上当，继续等鱼';
      }
      this.nextWait();
    }
  }

  press(): void {
    if (this.ended) return;
    if (this.phase === 'bite') {
      const fish = [
        { name: '小蓝鱼', points: 10, color: '#56c7d7' },
        { name: '金鱼', points: 18, color: '#ffbd59' },
        { name: '胖鲈鱼', points: 25, color: '#ef8068' },
      ][Math.floor(Math.random() * 3)];
      this.catches += 1;
      this.chain += 1;
      this.scoreValue += fish.points + Math.min(this.chain - 1, 5) * 3;
      this.message = '钓到' + fish.name + '！+' + (fish.points + Math.min(this.chain - 1, 5) * 3);
      audio.play('catch');
      this.catchFlash = 0.55;
      this.nextWait();
    } else if (this.phase === 'fake') {
      this.chain = 0;
      this.message = '嘿嘿，是假动作！';
      audio.play('fake');
      this.nextWait();
    } else {
      this.chain = 0;
      this.message = '太心急啦，等等浮标动起来';
    }
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#c9edf0');
    sky.addColorStop(0.53, '#e4f3df');
    sky.addColorStop(0.54, '#7dc9c9');
    sky.addColorStop(1, '#47a8b4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#a9dcae';
    ctx.beginPath();
    ctx.ellipse(130, 180, 210, 75, -0.13, 0, Math.PI * 2);
    ctx.ellipse(840, 170, 250, 90, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#80c89e';
    ctx.beginPath();
    ctx.ellipse(0, 220, 280, 74, 0, 0, Math.PI * 2);
    ctx.ellipse(950, 215, 270, 85, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 7; i += 1) {
      const x = (i * 163 + now * (10 + i) % 110) % 1000;
      const y = 350 + (i % 3) * 57 + Math.sin(now * 1.4 + i) * 5;
      ctx.strokeStyle = 'rgba(231,255,246,.34)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, 34 + i * 2, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 木码头
    ctx.fillStyle = '#b9794d';
    roundedRect(ctx, 0, 390, 300, 42, 14);
    ctx.fill();
    ctx.fillStyle = '#d59662';
    roundedRect(ctx, 0, 380, 300, 20, 10);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = 'rgba(112,67,43,.22)';
      ctx.fillRect(14 + i * 60, 400, 2, 24);
    }

    this.drawCat(ctx, 175, 345, now);
    ctx.strokeStyle = '#574638';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(205, 316);
    ctx.quadraticCurveTo(340, 276, 505, 292);
    ctx.stroke();

    const bobX = 505;
    const bobY = this.phase === 'bite'
      ? 337 + Math.sin(now * 35) * 8
      : this.phase === 'fake'
        ? 337 + Math.sin(now * 29) * 5
        : 340 + Math.sin(now * 2.2) * 4;
    ctx.strokeStyle = 'rgba(255,255,255,.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(505, 292);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    ctx.fillStyle = '#ff7d72';
    ctx.beginPath();
    ctx.ellipse(bobX, bobY, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.ellipse(bobX, bobY + 8, 7, 6, 0, 0, Math.PI);
    ctx.fill();

    if (this.catchFlash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.catchFlash / 0.55, 0, 1);
      ctx.fillStyle = '#fff3b2';
      ctx.beginPath();
      ctx.ellipse(570, 318, 35, 12, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawText(ctx, this.message, 690, 208, 23, this.phase === 'bite' ? '#df6a4f' : '#315d61', 800);
    drawText(ctx, '點一下或按空格收竿', 690, 244, 14, '#52797b', 600);
    drawText(ctx, '每次咬钩的窗口都很短，假动作不要上当', 480, 500, 14, 'rgba(255,255,255,.82)', 600);
  }

  private nextWait(): void {
    this.phase = 'waiting';
    this.phaseTimer = 1.1 + Math.random() * 2.1;
  }

  private drawCat(ctx: CanvasRenderingContext2D, x: number, y: number, now: number): void {
    const bob = Math.sin(now * 2.1) * 2;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = '#f2a76d';
    ctx.beginPath();
    ctx.ellipse(0, 31, 39, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-32, -10);
    ctx.lineTo(-26, -53);
    ctx.lineTo(-1, -34);
    ctx.closePath();
    ctx.moveTo(3, -34);
    ctx.lineTo(28, -53);
    ctx.lineTo(34, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe1bb';
    ctx.beginPath();
    ctx.ellipse(0, -12, 34, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#35494b';
    ctx.beginPath();
    ctx.ellipse(-12, -16, 3, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(12, -16, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e7796e';
    ctx.beginPath();
    ctx.moveTo(-4, -7);
    ctx.lineTo(4, -7);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8b6d5b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-4, 4, -9, 1);
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(4, 4, 9, 1);
    ctx.stroke();
    ctx.strokeStyle = '#a98268';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-19, -6);
    ctx.lineTo(-37, -10);
    ctx.moveTo(-18, 0);
    ctx.lineTo(-37, 0);
    ctx.moveTo(19, -6);
    ctx.lineTo(37, -10);
    ctx.moveTo(18, 0);
    ctx.lineTo(37, 0);
    ctx.stroke();
    ctx.restore();
  }
}
