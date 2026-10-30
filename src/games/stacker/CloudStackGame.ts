import { audio } from '../../core/Audio';
import { cloudWind } from './WindCycle';
import { SkyBlueprint } from './SkyBlueprint';
import { cloudPlacement } from './Placement';
import { clamp, drawText, HEIGHT, roundedRect, WIDTH } from '../../core/Game';
import type { GameControls, GameSetupOption, MiniGame } from '../../core/Game';

type CloudRoute = 'soft-cloud' | 'wind-tower';
type Block = { x: number; y: number; width: number; layer: number };
type MovingBlock = Block & { travel: number; direction: number };
type Fragment = Block & { vx: number; vy: number; angle: number; spin: number; life: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number };

const BLOCK_HEIGHT = 30;
const BASE_Y = 432;
const MIN_WIDTH = 18;
const colors = ['#86cfc7', '#a6d7a1', '#d1d99a', '#edca93', '#e8abb9', '#bcaee5'];
const skyNames = ['草甸上空', '暮光云海', '星光天际'];

export class CloudStackGame implements MiniGame {
  readonly id = 'stacker' as const;
  readonly title = '云朵叠叠乐';
  private route: CloudRoute = 'soft-cloud';
  private runRoute: CloudRoute = 'soft-cloud';
  private blocks: Block[] = [];
  private active: MovingBlock | null = null;
  private fragments: Fragment[] = [];
  private sparks: Spark[] = [];
  private layers = 0;
  private scoreValue = 0;
  private perfects = 0;
  private streak = 0;
  private bestStreak = 0;
  private recoveries = 0;
  private elapsed = 0;
  private cameraOffset = 0;
  private placementCooldown = 0;
  private endingTimer = -1;
  private ended = false;
  private started = false;
  private feedback = '等云朵对齐，再轻轻放下';
  private feedbackTime = 2;
  private endReason = '';
  private settleFlash = 0;
  private gustPerfects = 0;
  private objective: 'endless' | 'blueprint' = 'endless';
  private runObjective: 'endless' | 'blueprint' = 'endless';
  private blueprint = new SkyBlueprint();

  constructor() {
    this.resetRun();
  }

  get score(): number { return this.scoreValue; }
  get resultTitle(): string | undefined {
    if (this.runObjective !== 'blueprint') return undefined;
    return this.blueprint.completed === 3 ? '天际蓝图完工！' : '蓝图挑战结束';
  }
  get resultSummary(): string { return `叠起 ${this.layers} 层 · 完美 ${this.perfects} 次 · 最高连击 x${this.bestStreak}` + (this.runObjective === 'blueprint' ? ` · 蓝图 ${this.blueprint.completed}/3` : ''); }
  get modeLabel(): string { return this.runObjective === 'blueprint' ? '天际蓝图' : '无尽'; }
  get over(): boolean { return this.ended; }
  get statusText(): string {
    return this.layers + ' 层' + (this.streak > 1 ? ' · 完美 x' + this.streak : ' · ' + this.getRouteName());
  }
  get outcome(): string {
    const recovery = this.recoveries > 0 ? '，让云朵重新变宽 ' + this.recoveries + ' 次' : '';
    return '沿' + this.getRouteName(this.runRoute) + '叠起 ' + this.layers + ' 层，抵达' + skyNames[this.getSkyStage()] +
      '，完美对齐 ' + this.perfects + ' 次，最高连击 x' + this.bestStreak + recovery + (this.gustPerfects ? '，阵风完美 ' + this.gustPerfects + ' 次' : '') + (this.runObjective === 'blueprint' ? '，完成蓝图 ' + this.blueprint.completed + '/3 段' : '') + '。' + this.endReason;
  }
  get setupOptions(): readonly GameSetupOption[] {
    return [
      { id: 'soft-cloud', group: '节奏', icon: '☁️', label: '软云慢游', detail: '云块宽、移动慢，适合练习对齐；三连完美恢复更多云宽', unlocked: true },
      { id: 'wind-tower', group: '节奏', icon: '🍃', label: '风之高塔', detail: '阵风来前会预警；顶风完美落点额外加分', unlocked: true },
      { id: 'endless', group: '目标', icon: '☁️', label: '无尽叠塔', detail: '保持原玩法，挑战更高层数', unlocked: true },
      { id: 'blueprint', group: '目标', icon: '🏗️', label: '天际蓝图', detail: '8 / 16 / 24 层保住指定云宽，完成三段建筑', unlocked: true },
    ];
  }
  get selectedSetupOption(): string { return this.route; }
  get selectedSetupOptions(): Readonly<Record<string, string>> { return { 节奏: this.route, 目标: this.objective }; }

  selectSetupOption(id: string): void {
    if (id === 'endless' || id === 'blueprint') {
      this.objective = id;
      if (!this.started) this.resetRun();
      return;
    }
    if (id !== 'soft-cloud' && id !== 'wind-tower') return;
    this.route = id;
    if (!this.started) this.resetRun();
  }

  start(): void {
    this.resetRun();
    this.started = true;
  }

  private resetRun(): void {
    this.runRoute = this.route;
    this.runObjective = this.objective;
    this.blueprint = new SkyBlueprint();
    const width = this.getStartingWidth();
    this.blocks = [{ x: (WIDTH - width) / 2, y: BASE_Y, width, layer: 0 }];
    this.fragments = [];
    this.sparks = [];
    this.layers = 0;
    this.scoreValue = 0;
    this.perfects = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.recoveries = 0;
    this.elapsed = 0;
    this.cameraOffset = 0;
    this.placementCooldown = 0;
    this.endingTimer = -1;
    this.ended = false;
    this.started = false;
    this.feedback = '等云朵对齐，再轻轻放下';
    this.feedbackTime = 2;
    this.endReason = '';
    this.settleFlash = 0;
    this.gustPerfects = 0;
    this.spawnBlock();
  }

  update(dt: number, _controls: GameControls): void {
    if (this.ended || !this.started || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    this.feedbackTime = Math.max(0, this.feedbackTime - dt);
    this.settleFlash = Math.max(0, this.settleFlash - dt);
    this.placementCooldown = Math.max(0, this.placementCooldown - dt);
    const cameraTarget = Math.max(0, this.layers * BLOCK_HEIGHT - 150);
    this.cameraOffset += (cameraTarget - this.cameraOffset) * (1 - Math.exp(-8 * dt));
    this.blocks = this.blocks.filter((block, index) => index === this.blocks.length - 1 || block.y + this.cameraOffset < HEIGHT + 90).slice(-32);
    for (const piece of this.fragments) {
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt + 420 * dt * dt;
      piece.vy += 840 * dt;
      piece.angle += piece.spin * dt;
      piece.life -= dt;
    }
    this.fragments = this.fragments.filter((piece) => piece.life > 0 && piece.y + this.cameraOffset < HEIGHT + 160).slice(-16);
    for (const spark of this.sparks) {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 110 * dt;
      spark.life -= dt;
    }
    this.sparks = this.sparks.filter((spark) => spark.life > 0).slice(-36);

    if (this.endingTimer >= 0) {
      this.endingTimer = Math.max(0, this.endingTimer - dt);
      if (this.endingTimer === 0) this.ended = true;
      return;
    }
    if (!this.active || this.placementCooldown > 0) return;
    const speed = this.route === 'soft-cloud'
      ? Math.min(340, 145 + this.layers * 8)
      : Math.min(440, 205 + this.layers * 11);
    const range = WIDTH - 160 - this.active.width;
    const wind = this.route === 'wind-tower' ? cloudWind(this.elapsed).speed : 1;
    this.active.travel += speed * wind * dt;
    const phase = this.active.travel % (range * 2);
    this.active.x = 80 + (phase <= range ? phase : range * 2 - phase);
    this.active.direction = phase < range ? 1 : -1;
  }

  pointerDown(_x: number, _y: number): void {
    this.press();
  }

  press(): void {
    if (!this.started || this.ended || this.endingTimer >= 0 || this.placementCooldown > 0 || !this.active) return;
    const target = this.blocks[this.blocks.length - 1];
    const moving = this.active;
    const placement = cloudPlacement(moving, target, this.getPerfectTolerance());
    const perfect = placement.perfect;
    let { left, width } = placement;
    if (width < MIN_WIDTH) {
      this.addFragment(moving.x, moving.width, moving, moving.direction);
      this.active = null;
      this.endingTimer = 0.85;
      this.endReason = width <= 0 ? '这一块擦肩而过，下次等它再靠近一点。' : '云朵变得太细啦，试试用完美连击补回宽度。';
      this.feedback = width <= 0 ? '差一点点，就接住啦' : '云朵太细啦，下次再试';
      this.feedbackTime = 1.2;
      audio.play('miss');
      return;
    }

    const layerPoints = this.route === 'soft-cloud' ? 10 : 15;
    let points = layerPoints;
    let restored = 0;
    if (perfect) {
      this.perfects += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      points += (this.route === 'soft-cloud' ? 4 : 6) * Math.min(8, this.streak);
      if (this.route === 'wind-tower' && cloudWind(this.elapsed).phase === 'gust') { points += 15; this.gustPerfects++; }
      if (this.streak % 3 === 0) {
        restored = Math.min(this.getStartingWidth() - width, this.route === 'soft-cloud' ? 24 : 16);
        left -= restored / 2;
        width += restored;
        left = clamp(left, 80, WIDTH - 80 - width);
        if (restored > 0) this.recoveries += 1;
      }
      this.feedback = '完美对齐 x' + this.streak + ' · +' + points +
        (restored > 0 ? ' · 云宽恢复！' : this.streak % 3 === 0 ? ' · 云宽已满' : '');
      this.makeSparks(left + width / 2, moving.y);
      audio.play('star');
    } else {
      this.streak = 0;
      const right = left + width;
      if (moving.x < left) this.addFragment(moving.x, left - moving.x, moving, -1);
      if (moving.x + moving.width > right) this.addFragment(right, moving.x + moving.width - right, moving, 1);
      this.feedback = '稳稳接住 · +' + points;
      audio.play('bounce');
    }
    this.layers += 1;
    this.scoreValue += points;
    this.blocks.push({ x: left, y: moving.y, width, layer: this.layers });
    this.settleFlash = 0.2;
    this.feedbackTime = 1.25;
    this.placementCooldown = 0.25;
    if (this.layers === 10 || this.layers === 20) {
      this.feedback = '抵达' + skyNames[this.getSkyStage()] + '！继续向上吧';
      this.feedbackTime = 2.2;
      audio.play('unlock');
    }
    if (this.runObjective === 'blueprint') {
      const report = this.blueprint.inspect(this.layers, width, this.getStartingWidth());
      if (report.result !== 'none') {
        this.scoreValue += report.reward;
        this.feedback = report.result === 'fail' ? report.name + ' · 云宽不足' : report.name + '完成！+' + report.reward;
        this.feedbackTime = 2;
        if (report.result === 'fail' || report.result === 'complete') {
          this.active = null; this.endingTimer = 1.2;
          this.endReason = report.result === 'complete' ? '天际蓝图全部完工！' : '这段蓝图需要更宽的云朵，试试利用三连完美修复。';
          audio.play(report.result === 'complete' ? 'unlock' : 'miss');
          return;
        }
        audio.play('unlock');
      }
    }
    this.spawnBlock();
  }

  private spawnBlock(): void {
    const target = this.blocks[this.blocks.length - 1];
    const range = WIDTH - 160 - target.width;
    const fromLeft = this.layers % 2 === 0;
    this.active = {
      x: fromLeft ? 80 : WIDTH - 80 - target.width,
      y: target.y - BLOCK_HEIGHT,
      width: target.width,
      layer: this.layers + 1,
      travel: fromLeft ? 0 : range,
      direction: fromLeft ? 1 : -1,
    };
  }

  private addFragment(x: number, width: number, source: Block, direction: number): void {
    if (width <= 0) return;
    this.fragments.push({ x, width, y: source.y, layer: source.layer, vx: direction * 60, vy: 35, angle: 0, spin: direction * 1.5, life: 1.8 });
  }

  private makeSparks(x: number, y: number): void {
    for (let index = 0; index < 12; index += 1) {
      const angle = Math.PI * 2 * index / 12;
      this.sparks.push({ x, y, vx: Math.cos(angle) * 85, vy: Math.sin(angle) * 65 - 40, life: 0.9 });
    }
    this.sparks = this.sparks.slice(-36);
  }

  private getStartingWidth(): number { return this.route === 'soft-cloud' ? 300 : 270; }
  private getRouteName(route = this.route): string { return route === 'soft-cloud' ? '软云慢游' : '风之高塔'; }
  private getSkyStage(): number { return this.layers >= 20 ? 2 : this.layers >= 10 ? 1 : 0; }
  private getPerfectTolerance(): number {
    return Math.max(3, Math.min(this.route === 'soft-cloud' ? 10 : 7, this.blocks[this.blocks.length - 1].width * 0.1));
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    const stage = this.getSkyStage();
    const palette = [
      { top: '#b9e4ef', bottom: '#f3f2d9', ink: '#315b66', soft: '#537681' },
      { top: '#b5bee7', bottom: '#ffe0bf', ink: '#514b73', soft: '#706384' },
      { top: '#172646', bottom: '#67749f', ink: '#fff1d4', soft: '#d4dbee' },
    ][stage];
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, palette.top);
    sky.addColorStop(1, palette.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (stage === 2) {
      ctx.fillStyle = '#ffefb7';
      for (let index = 0; index < 35; index += 1) {
        ctx.globalAlpha = 0.35 + (Math.sin(now * 1.4 + index) + 1) * 0.2;
        ctx.beginPath();
        ctx.arc((index * 137 + 31) % WIDTH, (index * 67 + 18) % 410, index % 5 === 0 ? 2 : 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (let index = 0; index < 8; index += 1) {
      const x = ((index * 159 + now * (3 + index % 3)) % (WIDTH + 180)) - 90;
      const y = ((index * 113 + this.cameraOffset * 0.16) % 600) - 25;
      this.drawCloud(ctx, x, y, 0.7 + (index % 3) * 0.18, stage === 2 ? 0.12 : 0.45);
    }
    const islandY = BASE_Y + BLOCK_HEIGHT + this.cameraOffset;
    if (islandY < HEIGHT + 80) {
      this.drawCloud(ctx, WIDTH / 2, islandY + 15, 3.3, 0.85);
      ctx.fillStyle = '#b4d2ae';
      ctx.beginPath();
      ctx.ellipse(WIDTH / 2, islandY, 176, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const target = this.blocks[this.blocks.length - 1];
    if (this.active) {
      const activeY = this.active.y + this.cameraOffset;
      const perfect = Math.abs(this.active.x - target.x) <= this.getPerfectTolerance();
      ctx.save();
      ctx.strokeStyle = stage === 2 ? 'rgba(241,244,255,.3)' : 'rgba(58,100,107,.28)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.5;
      for (const edge of [target.x, target.x + target.width]) {
        ctx.beginPath();
        ctx.moveTo(edge, activeY - 20);
        ctx.lineTo(edge, target.y + this.cameraOffset + BLOCK_HEIGHT);
        ctx.stroke();
      }
      ctx.restore();
      if (perfect && this.placementCooldown === 0) {
        ctx.save();
        ctx.shadowColor = '#f6e394';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#fff3b0';
        ctx.lineWidth = 4;
        roundedRect(ctx, this.active.x - 3, activeY - 3, this.active.width + 6, BLOCK_HEIGHT + 6, 12);
        ctx.stroke();
        ctx.restore();
        drawText(ctx, '现在落下 · 完美', this.active.x + this.active.width / 2, activeY - 18, 16, palette.ink, 800);
      }
    }
    for (const block of this.blocks) {
      const y = block.y + this.cameraOffset;
      if (y < -50 || y > HEIGHT + 40) continue;
      ctx.save();
      if (block === target && this.settleFlash > 0) {
        ctx.translate(block.x + block.width / 2, y + BLOCK_HEIGHT);
        ctx.scale(1 + this.settleFlash * 0.06, 1 - this.settleFlash * 0.3);
        ctx.translate(-(block.x + block.width / 2), -(y + BLOCK_HEIGHT));
      }
      this.drawBlock(ctx, block.x, y, block.width, block.layer, false);
      ctx.restore();
    }
    if (this.active) {
      const active = this.active, y = active.y + this.cameraOffset;
      this.drawBlock(ctx, active.x, y, active.width, active.layer, true);
      const preview = cloudPlacement(active, target, this.getPerfectTolerance());
      if (!preview.perfect && this.placementCooldown === 0) {
        ctx.save(); roundedRect(ctx, active.x, y, active.width, BLOCK_HEIGHT, Math.min(10, active.width / 3)); ctx.clip();
        ctx.fillStyle = 'rgba(204,99,104,.4)'; ctx.fillRect(active.x, y, active.width, BLOCK_HEIGHT);
        if (preview.width > 0) { ctx.fillStyle = 'rgba(225,249,192,.8)'; ctx.fillRect(preview.left, y, preview.width, BLOCK_HEIGHT); }
        ctx.restore();
        drawText(ctx, preview.width > 0 ? '将保留云宽 ' + Math.round(preview.width / this.getStartingWidth() * 100) + '%' : '尚未重叠 · 再等一下', active.x + active.width / 2, y - 18, 15, palette.ink, 800);
      }
    }
    for (const piece of this.fragments) {
      ctx.save();
      ctx.globalAlpha = clamp(piece.life / 0.5, 0, 1);
      ctx.translate(piece.x + piece.width / 2, piece.y + this.cameraOffset + BLOCK_HEIGHT / 2);
      ctx.rotate(piece.angle);
      this.drawBlock(ctx, -piece.width / 2, -BLOCK_HEIGHT / 2, piece.width, piece.layer, false);
      ctx.restore();
    }
    for (const spark of this.sparks) {
      ctx.save();
      ctx.globalAlpha = clamp(spark.life / 0.6, 0, 1);
      drawText(ctx, '✦', spark.x, spark.y + this.cameraOffset, 15, '#fff4b7', 900);
      ctx.restore();
    }

    ctx.fillStyle = stage === 2 ? 'rgba(21,35,62,.78)' : 'rgba(255,255,255,.77)';
    roundedRect(ctx, 24, 18, WIDTH - 48, 60, 18);
    ctx.fill();
    drawText(ctx, this.getRouteName(), 48, 38, 15, palette.soft, 700, 'left');
    drawText(ctx, skyNames[stage], 48, 60, 16, palette.ink, 800, 'left');
    drawText(ctx, this.layers + ' 层', WIDTH / 2, 49, 28, palette.ink, 900);
    drawText(ctx, '完美 ' + this.perfects + ' 次', WIDTH - 48, 38, 15, palette.soft, 700, 'right');
    drawText(ctx, this.streak > 0 ? '完美连击 x' + this.streak : '等待完美对齐', WIDTH - 48, 60, 16, palette.ink, 800, 'right');
    if (this.feedbackTime > 0) drawText(ctx, this.feedback, WIDTH / 2, 109, 19, palette.ink, 800);
    if (this.route === 'wind-tower') {
      const wind = cloudWind(this.elapsed);
      const text = wind.phase === 'warning' ? '阵风将至 · 留意加速' : wind.phase === 'gust' ? '阵风中 · 完美额外 +15' : '风平 · ' + Math.ceil(wind.remaining) + ' 秒后预警';
      ctx.fillStyle = stage === 2 ? 'rgba(21,35,62,.88)' : 'rgba(255,255,255,.86)';
      roundedRect(ctx, 342, 132, 276, 34, 14); ctx.fill();
      drawText(ctx, text, WIDTH / 2, 149, 15, palette.ink, 800);
      if (wind.phase === 'gust') {
        ctx.save(); ctx.strokeStyle = stage === 2 ? '#e7f5ff' : '#719caa'; ctx.globalAlpha = .35; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const x = (this.elapsed * 280 + i * 177) % (WIDTH + 140) - 140; const y = 190 + i * 37; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 70, y); ctx.stroke(); }
        ctx.restore();
      }
    }
    const remainingWidth = Math.round(target.width / this.getStartingWidth() * 100);
    const hint = this.streak > 0
      ? '再完美 ' + (3 - this.streak % 3) + ' 次，云朵就能长宽一点'
      : '连续 3 次完美对齐，可以修复云宽';
    ctx.fillStyle = stage === 2 ? 'rgba(21,35,62,.9)' : 'rgba(255,255,255,.93)';
    roundedRect(ctx, 24, 466, WIDTH - 48, 66, 18);
    ctx.fill();
    const next = this.runObjective === 'blueprint' ? this.blueprint.next : undefined;
    const objectiveHint = next ? `蓝图 ${this.blueprint.completed + 1}/3 · 第 ${next.layer} 层需云宽 ≥${Math.round(next.ratio * 100)}%` : this.runObjective === 'blueprint' ? '蓝图全部完工' : hint;
    drawText(ctx, '云宽 ' + remainingWidth + '% · ' + objectiveHint, WIDTH / 2, this.runObjective === 'blueprint' ? 484 : 488, 16, palette.ink, 800);
    if (this.runObjective === 'blueprint') {
      const barX = 300, barWidth = 360, ratio = target.width / this.getStartingWidth();
      ctx.fillStyle = stage === 2 ? '#34496b' : '#dce8db'; roundedRect(ctx, barX, 498, barWidth, 7, 3); ctx.fill();
      ctx.fillStyle = next && ratio < next.ratio ? '#dc9d79' : '#8fbb96'; roundedRect(ctx, barX, 498, barWidth * clamp(ratio, 0, 1), 7, 3); ctx.fill();
      if (next) { ctx.fillStyle = stage === 2 ? '#ffe5ae' : '#9c7439'; ctx.fillRect(barX + barWidth * next.ratio - 1.5, 494, 3, 15); }
      drawText(ctx, next && ratio < next.ratio ? '低于刻度 · 三连完美可修复云宽' : '刻度为下一段所需云宽', WIDTH / 2, 520, 13, palette.soft, 700);
    } else drawText(ctx, '点击画面 / 按空格落下 · 只保留与下层重叠的部分', WIDTH / 2, 516, 15, palette.soft, 700);
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, opacity: number): void {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#fffdf5';
    ctx.beginPath();
    ctx.ellipse(x, y, 48 * scale, 15 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 23 * scale, y - 7 * scale, 25 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 15 * scale, y - 11 * scale, 27 * scale, 22 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, layer: number, active: boolean): void {
    ctx.fillStyle = colors[layer % colors.length];
    roundedRect(ctx, x, y, width, BLOCK_HEIGHT, Math.min(10, width / 3));
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.38)';
    roundedRect(ctx, x + 2, y + 2, Math.max(0, width - 4), 6, 3);
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(255,255,255,.9)' : 'rgba(62,92,104,.14)';
    ctx.lineWidth = active ? 2 : 1;
    roundedRect(ctx, x + 1, y + 1, Math.max(0, width - 2), BLOCK_HEIGHT - 2, Math.min(9, width / 3));
    ctx.stroke();
    if (width >= 64) {
      const center = x + width / 2;
      ctx.fillStyle = '#526374';
      ctx.beginPath();
      ctx.arc(center - 9, y + 15, 1.6, 0, Math.PI * 2);
      ctx.arc(center + 9, y + 15, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#526374';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(center, y + 16, 3.2, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
  }
}
