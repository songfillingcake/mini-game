import { clamp, drawText, HEIGHT, roundedRect, WIDTH } from '../../core/Game';
import { audio } from '../../core/Audio';
import { LandingRhythm } from './LandingRhythm';
import { estimateLandings } from './LandingGuide';
import { composePlatform } from './RouteComposer';
import type { GameControls, GameSetupOption, MiniGame } from '../../core/Game';

type JumperRoute = 'star-chaser' | 'spring-rider' | 'steady-climb';

interface Platform {
  segment?: string;
  x: number;
  y: number;
  width: number;
  spring: boolean;
  moving: boolean;
  moveSpeed: number;
  moveDirection: -1 | 1;
  fragile: boolean;
  broken: boolean;
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
  private hasShownMovingPlatform = false;
  private starsCollected = 0;
  private starStreak = 0;
  private bestStarStreak = 0;
  private skyStage = 0;
  private skyStageFlash = 0;
  private route: JumperRoute = 'star-chaser';
  private rhythm = new LandingRhythm();
  private generatedPlatforms = 0;
  private routeSegment = '';
  private segmentFlash = 0;

  get score(): number { return this.scoreValue; }
  get resultSummary(): string { return `登高 ${this.getAltitude()} 米 · 收集 ${this.starsCollected} 星 · 精准连落最高 x${this.rhythm.best}`; }
  get over(): boolean { return this.ended; }
  get setupOptions(): readonly GameSetupOption[] {
    return [
      { id: 'star-chaser', group: '路线', icon: '⭐', label: '追星小径', detail: '星星平台更多，连着收集更容易；平台稍窄', unlocked: true },
      { id: 'spring-rider', group: '路线', icon: '↟', label: '弹簧巡游', detail: '弹簧平台更多，踩中后跳得更高；星星略少', unlocked: true },
      { id: 'steady-climb', group: '路线', icon: '🐾', label: '稳步登高', detail: '平台更宽，更容易踩稳；星星机会保持均衡', unlocked: true },
    ];
  }
  get selectedSetupOption(): string { return this.route; }
  selectSetupOption(id: string): void {
    if (id === 'star-chaser' || id === 'spring-rider' || id === 'steady-climb') this.route = id;
  }
  get outcome(): string {
    const streak = this.bestStarStreak > 0 ? '最高连星 x' + this.bestStarStreak : '还没踩中星星';
    return '走' + this.getRouteName() + '，爬到 ' + this.getAltitude() + ' 米高，收集 ' + this.starsCollected + ' 颗星，' + streak + '，精准连落最高 x' + this.rhythm.best + '，救援 ' + this.rhythm.rescues + ' 次，总得分 ' + this.scoreValue;
  }
  get statusText(): string { return '高度 ' + this.getAltitude() + 'm　★ ' + this.starsCollected + (this.starStreak > 1 ? ' · 连星 x' + this.starStreak : ''); }

  start(): void {
    this.playerX = WIDTH / 2;
    this.playerY = 420;
    this.previousY = 420;
    this.velocityY = 30;
    this.cameraY = 0;
    this.platforms = [
      { x: 385, y: 480, width: 190, spring: false, moving: false, moveSpeed: 0, moveDirection: 1, fragile: false, broken: false, hasStar: false, collected: false },
      { x: 185, y: 382, width: this.getRoutePlatformWidth(140), spring: false, moving: false, moveSpeed: 0, moveDirection: 1, fragile: false, broken: false, hasStar: Math.random() < this.getStarChance(), collected: false },
      { x: 615, y: 288, width: 142, spring: true, moving: false, moveSpeed: 0, moveDirection: 1, fragile: false, broken: false, hasStar: false, collected: false },
      { x: 365, y: 192, width: this.getRoutePlatformWidth(140), spring: false, moving: false, moveSpeed: 0, moveDirection: 1, fragile: false, broken: false, hasStar: Math.random() < this.getStarChance(), collected: false },
    ];
    this.topPlatformY = 192;
    this.peakY = 420;
    this.bonus = 0;
    this.scoreValue = 0;
    this.ended = false;
    this.springFlash = 0;
    this.hasShownMovingPlatform = false;
    this.starsCollected = 0;
    this.starStreak = 0;
    this.bestStarStreak = 0;
    this.skyStage = 0;
    this.skyStageFlash = 0;
    this.rhythm = new LandingRhythm();
    this.generatedPlatforms = 0; this.routeSegment = ''; this.segmentFlash = 0;
    this.createPlatformsAbove();
  }

  update(dt: number, controls: GameControls): void {
    if (this.ended) return;
    this.rhythm.flash = Math.max(0, this.rhythm.flash - dt);
    this.segmentFlash = Math.max(0, this.segmentFlash - dt);
    const direction = Number(controls.keys.has('right')) - Number(controls.keys.has('left'));
    this.playerX += direction * 360 * dt;
    if (controls.pointerX !== null) this.playerX += clamp(controls.pointerX - this.playerX, -470 * dt, 470 * dt);
    this.playerX = clamp(this.playerX, 35, WIDTH - 35);

    for (const platform of this.platforms) {
      if (!platform.moving || platform.broken) continue;
      platform.x += platform.moveDirection * platform.moveSpeed * dt;
      const rightEdge = WIDTH - platform.width - 24;
      if (platform.x <= 24) {
        platform.x = 24;
        platform.moveDirection = 1;
      } else if (platform.x >= rightEdge) {
        platform.x = rightEdge;
        platform.moveDirection = -1;
      }
    }

    this.previousY = this.playerY;
    this.velocityY += 1120 * dt;
    this.playerY += this.velocityY * dt;
    this.springFlash = Math.max(0, this.springFlash - dt);
    this.skyStageFlash = Math.max(0, this.skyStageFlash - dt);

    if (this.velocityY > 0) {
      for (const platform of this.platforms) {
        const crossed = this.previousY + 22 <= platform.y && this.playerY + 22 >= platform.y;
        const overlaps = this.playerX + 19 >= platform.x && this.playerX - 19 <= platform.x + platform.width;
        if (crossed && overlaps) {
          if (platform.segment && platform.segment !== this.routeSegment) { this.routeSegment = platform.segment; this.segmentFlash = 1.8; }
          this.bonus += this.rhythm.land(this.playerX, platform);
          this.playerY = platform.y - 22;
          this.velocityY = platform.spring ? this.route === 'spring-rider' ? -940 : -860 : -680;
          if (platform.spring) {
            this.springFlash = 0.4;
            audio.play('spring');
          } else {
            audio.play('bounce');
          }
          if (platform.hasStar && !platform.collected) {
            platform.collected = true;
            this.starsCollected += 1;
            this.starStreak += 1;
            this.bestStarStreak = Math.max(this.bestStarStreak, this.starStreak);
            this.bonus += 30 + Math.min(this.starStreak - 1, 5) * 12;
            audio.play('star');
          } else {
            this.starStreak = 0;
          }
          if (platform.fragile) platform.broken = true;
          break;
        }
      }
    }

    this.peakY = Math.min(this.peakY, this.playerY);
    this.cameraY = Math.min(this.cameraY, this.playerY - 245);
    this.createPlatformsAbove();
    this.platforms = this.platforms.filter((platform) => !platform.broken && platform.y < this.cameraY + HEIGHT + 100);
    this.scoreValue = this.getAltitude() + this.bonus;
    const reachedStage = this.getSkyStage();
    if (reachedStage > this.skyStage) {
      this.skyStage = reachedStage;
      this.skyStageFlash = 2.8;
      audio.play('unlock');
    }

    if (this.playerY - this.cameraY > HEIGHT + 20 && this.rhythm.ready) {
      this.rhythm.rescue();
      this.playerY = this.cameraY + HEIGHT - 80;
      this.previousY = this.playerY;
      this.velocityY = -820;
      this.starStreak = 0;
      audio.play('spring');
    }
    if (this.playerY - this.cameraY > HEIGHT + 60) this.ended = true;
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    const stage = this.getSkyStage();
    const skyPalettes = [
      { top: '#bde6e4', bottom: '#e9f3d1', cloud: 'rgba(255,255,255,.55)', ridge: 'rgba(104,163,145,.18)' },
      { top: '#a9c9eb', bottom: '#f4e1c6', cloud: 'rgba(255,255,255,.68)', ridge: 'rgba(100,136,184,.2)' },
      { top: '#263965', bottom: '#7083ad', cloud: 'rgba(230,239,255,.34)', ridge: 'rgba(134,152,205,.23)' },
    ];
    const palette = skyPalettes[stage];
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, palette.top);
    sky.addColorStop(1, palette.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (stage >= 2) {
      for (let i = 0; i < 25; i += 1) {
        const x = (i * 173 + 41) % WIDTH;
        const y = (i * 89 + 23) % 310;
        ctx.globalAlpha = 0.35 + (Math.sin(now * 2 + i) + 1) * 0.24;
        ctx.fillStyle = '#fff2bd';
        ctx.beginPath();
        ctx.arc(x, y, i % 5 === 0 ? 2 : 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < 7; i += 1) {
      const x = (i * 169 + 80) % WIDTH;
      const y = ((i * 127 - this.cameraY * 0.22) % 650 + 650) % 650 - 55;
      ctx.fillStyle = palette.cloud;
      ctx.beginPath();
      ctx.ellipse(x, y, 42, 15, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 30, y + 4, 29, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = palette.ridge;
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
    if (this.rhythm.flash > 0 && this.rhythm.message.includes('救援')) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.rhythm.flash);
      ctx.fillStyle = '#fff5d7'; ctx.beginPath(); ctx.ellipse(this.playerX, this.playerY - this.cameraY + 31, 54, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const titleColor = stage >= 2 ? '#fff0bd' : stage === 1 ? '#354f70' : '#355b5a';
    const hintColor = stage >= 2 ? 'rgba(255,246,218,.84)' : '#547a77';
    drawText(ctx, '踩住平台一直往上跳，别掉下去', WIDTH / 2, 42, 18, titleColor, 800);
    drawText(ctx, '本局路线 · ' + this.getRouteName(), WIDTH / 2, 69, 12, hintColor, 800);
    ctx.fillStyle = 'rgba(255,255,255,.83)'; roundedRect(ctx, 32, 105, 230, 48, 14); ctx.fill();
    drawText(ctx, this.rhythm.flash > 0 ? this.rhythm.message : this.rhythm.ready ? '救援云已就绪 · 掉落时接住你' : '精准落点 ' + this.rhythm.charge + '/3 · 积攒救援云', 147, 129, 12, '#45635e', 800);
    if (this.starStreak > 1) drawText(ctx, '连星 x' + this.starStreak + ' · 下一颗 +' + Math.min(this.starStreak, 5) * 12, 165, 76, 13, stage >= 2 ? '#fff0bd' : '#426b64', 900);
    drawText(ctx, '横移平台记得提前踩稳 · 裂纹平台只够踩一次 · 星星加分', WIDTH / 2, 514, 13, hintColor, 600);
    this.drawUpcomingPlatforms(ctx);
    if (this.segmentFlash > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.segmentFlash); ctx.fillStyle = 'rgba(255,255,255,.84)'; roundedRect(ctx, 340, 103, 280, 32, 14); ctx.fill();
      drawText(ctx, this.routeSegment, WIDTH / 2, 119, 16, '#45635e', 800); ctx.restore();
    }
    if (this.skyStageFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.skyStageFlash);
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      roundedRect(ctx, 355, 66, 250, 34, 17);
      ctx.fill();
      const stageName = stage === 2 ? '星光天际' : stage === 1 ? '云朵海' : '低空草甸';
      drawText(ctx, stageName + ' · ' + this.getAltitude() + 'm', WIDTH / 2, 83, 14, '#54756c', 900);
      ctx.restore();
    }
    if (this.springFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.springFlash * 0.42;
      ctx.fillStyle = '#fff0a5';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }
  }

  private drawUpcomingPlatforms(ctx: CanvasRenderingContext2D): void {
    const estimates = estimateLandings(this.platforms, this.playerX, this.playerY, this.velocityY);
    const recommended = estimates.find(estimate => estimate.reachable);
    const upcoming = estimates.slice(0, 3);
    // Keep at least one reachable option visible when the nearest three are risky.
    if (recommended && !upcoming.includes(recommended)) upcoming[upcoming.length - 1] = recommended;

    ctx.fillStyle = 'rgba(255,255,255,.76)';
    roundedRect(ctx, 770, 88, 166, 110, 14);
    ctx.fill();
    drawText(ctx, '↓ 落点预估', 853, 103, 12, '#45635e', 900);

    upcoming.forEach(({ platform, time, reachable, x }, index) => {
      const label = platform.hasStar
        ? platform.collected ? '✓ 星星已取' : '⭐ 星星'
        : platform.spring ? '↟ 弹簧'
          : platform.moving ? '↔ 横移'
            : platform.fragile ? '◇ 裂纹'
              : '· 普通';
      const color = platform.hasStar && !platform.collected
        ? 'rgba(255,232,170,.9)'
        : platform.fragile
          ? 'rgba(255,214,205,.9)'
          : platform.moving
            ? 'rgba(206,229,250,.9)'
            : 'rgba(215,240,225,.9)';
      const y = 120 + index * 25;
      ctx.fillStyle = color;
      roundedRect(ctx, 782, y - 9, 142, 20, 10);
      ctx.fill();
      drawText(ctx, (reachable ? '✓ ' : '! ') + label + ' ' + time.toFixed(1) + 's', 853, y + 1, 11, reachable ? '#3f5d58' : '#a26548', 800);
      const py = platform.y - this.cameraY;
      if (recommended?.platform === platform && py > 215 && py < HEIGHT - 65) {
        ctx.save(); ctx.strokeStyle = '#fff0ad'; ctx.lineWidth = 3;
        roundedRect(ctx, x - 3, py - 3, platform.width + 6, 25, 11); ctx.stroke();
        drawText(ctx, '建议落点', x + platform.width / 2, py + 37, 12, this.getSkyStage() >= 2 ? '#fff0ad' : '#426b64', 800);
        ctx.restore();
      }
      if (platform.moving && py > 160 && py < HEIGHT - 35) {
        ctx.save(); ctx.strokeStyle = reachable ? '#f6ecc0' : '#f1ad8d'; ctx.globalAlpha = .7; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        roundedRect(ctx, x, py, platform.width, 19, 9); ctx.stroke(); ctx.restore();
      }
    });
    if (upcoming.length === 0) drawText(ctx, '留意下方平台', 853, 147, 11, '#607b77', 700);
  }

  private createPlatformsAbove(): void {
    const previous = this.platforms.find((platform) => platform.y === this.topPlatformY);
    let previousCenter = previous ? previous.x + previous.width / 2 : WIDTH / 2;
    const stage = this.getSkyStage();
    while (this.topPlatformY > this.cameraY - 180) {
      const plan = composePlatform(this.generatedPlatforms++, this.route);
      const gap = 82 + stage * 4 + Math.random() * (24 + stage * 5);
      this.topPlatformY -= gap;
      const width = this.getRoutePlatformWidth(112 - stage * 6 + Math.random() * (44 - stage * 7));
      const platformWidth = width;
      const routeCenter = clamp(previousCenter + plan.delta, 48 + platformWidth / 2, WIDTH - 48 - platformWidth / 2);
      const x = routeCenter - platformWidth / 2;
      const spring = plan.spring ?? Math.random() < (this.route === 'spring-rider' ? .29 : .14);
      const moving = !spring && (plan.moving ?? (!this.hasShownMovingPlatform || Math.random() < .2 + stage * .06));
      if (moving) this.hasShownMovingPlatform = true;
      this.platforms.push({
        segment: plan.label,
        x,
        y: this.topPlatformY,
        width: platformWidth,
        spring,
        moving,
        moveSpeed: moving ? 70 + Math.random() * 45 : 0,
        moveDirection: Math.random() < 0.5 ? -1 : 1,
        fragile: !spring && !moving && (plan.fragile ?? Math.random() < .13 + stage * .05),
        broken: false,
        hasStar: plan.hasStar ?? Math.random() < this.getStarChance(),
        collected: false,
      });
      previousCenter = routeCenter;
    }
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, platform: Platform): void {
    const y = platform.y - this.cameraY;
    if (y < -50 || y > HEIGHT + 30) return;
    const stage = this.getSkyStage();
    const normal = stage === 2 ? '#7788c0' : stage === 1 ? '#6e9cb5' : '#6eaa83';
    const normalHighlight = stage === 2 ? '#c1c9f0' : stage === 1 ? '#b7dddd' : '#a9d99b';
    ctx.fillStyle = platform.spring ? '#ee8b72' : platform.moving ? '#7489b7' : platform.fragile ? '#bd8a76' : normal;
    roundedRect(ctx, platform.x, y, platform.width, 19, 10);
    ctx.fill();
    ctx.fillStyle = platform.spring ? '#ffc38e' : platform.moving ? '#c4c8ed' : platform.fragile ? '#e9b39a' : normalHighlight;
    roundedRect(ctx, platform.x + 4, y + 2, platform.width - 8, 7, 5);
    ctx.fill();
    const targetWidth = Math.min(36, platform.width * .3);
    ctx.fillStyle = 'rgba(255,248,204,.8)';
    ctx.fillRect(platform.x + (platform.width - targetWidth) / 2, y + 2, targetWidth, 5);
    if (platform.fragile) {
      ctx.strokeStyle = 'rgba(112,66,57,.72)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(platform.x + platform.width * 0.42, y + 3);
      ctx.lineTo(platform.x + platform.width * 0.5, y + 10);
      ctx.lineTo(platform.x + platform.width * 0.57, y + 6);
      ctx.stroke();
    }
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
    if (platform.moving) drawText(ctx, '↔', platform.x + platform.width / 2, y + 12, 12, '#f7f4ff', 900);
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

  private getAltitude(): number {
    return Math.max(0, Math.floor((420 - this.peakY) / 10));
  }

  private getSkyStage(): number {
    const altitude = this.getAltitude();
    return altitude >= 180 ? 2 : altitude >= 80 ? 1 : 0;
  }

  private getRouteName(): string {
    if (this.route === 'spring-rider') return '弹簧巡游';
    if (this.route === 'steady-climb') return '稳步登高';
    return '追星小径';
  }

  private getRoutePlatformWidth(baseWidth: number): number {
    const routeAdjustment = this.route === 'steady-climb' ? 16 : this.route === 'star-chaser' ? -8 : 0;
    return baseWidth + routeAdjustment;
  }

  private getStarChance(): number {
    if (this.route === 'star-chaser') return 0.48;
    if (this.route === 'spring-rider') return 0.26;
    return 0.32;
  }
}
