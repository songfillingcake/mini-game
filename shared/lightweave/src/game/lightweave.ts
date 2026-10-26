import { TAU, clamp, mulberry32 } from '@pocket-play/engine';
import type { Host, InputSink, PointerSample, Viewport } from '@pocket-play/engine';
import { cellAt, cellCenter, layoutBoard, renderBoard, type BoardLayout } from './board';
import {
  completeLayout,
  drawComplete,
  drawMap,
  drawPlayFooter,
  drawPlayHeader,
  drawToast,
  hitRect,
  mapLayout,
  type CompleteModel,
  type MapLayout,
  type Rect,
} from './hud';
import { levelsOfChapter } from './catalog';
import { BoardState } from './rules';
import { loadProgress, saveProgress, totalStars, type Progress } from './save';
import { themeById } from './themes';
import { CHAPTERS, type Level } from './types';

const HINT_COST = 40;
const BOARD_TOP_GAP = 158;
const BOARD_BOTTOM_GAP = 198;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

type CompleteState = CompleteModel;

/**
 * 《织光》主控。
 *
 * 两个界面：星图（选关）与棋盘。棋盘上的路径全部由 BoardState 管理，
 * 这里只负责输入分发、结算与渲染编排。
 */
export class Lightweave implements InputSink {
  private readonly host: Host;
  private readonly stars: { x: number; y: number; r: number; phase: number }[] = [];
  private readonly sparks: Spark[] = [];

  private progress: Progress;
  private vp: Viewport = { width: 750, height: 1334, dpr: 2, insetTop: 0, insetBottom: 0 };
  private mode: 'map' | 'play' = 'map';
  private chapterIndex = 0;
  private levelIndex = 0;
  private level: Level | null = null;
  private board: BoardState | null = null;
  private boardLayout: BoardLayout | null = null;
  private map: MapLayout | null = null;
  private complete: CompleteState | null = null;

  private time = 0;
  private hintColor = -1;
  private hintTimer = 0;
  private hintUsed = false;
  private toast = '';
  private toastTimer = 0;
  private dirty = false;
  private saveHold = 0;
  private dragging = false;

  constructor(host: Host) {
    this.host = host;
    this.progress = loadProgress(host.storage);

    const random = mulberry32(20_261_023);
    for (let i = 0; i < 64; i += 1) {
      this.stars.push({
        x: random() * 750,
        y: random() * 1600,
        r: 0.8 + random() * 1.8,
        phase: random() * TAU,
      });
    }

    host.bindInput(this);
    host.loop(this.step);
  }

  private readonly step = (dt: number): void => {
    const vp = this.host.beginFrame();
    this.vp = vp;
    this.update(dt);
    this.render();
  };

  private get theme() {
    return themeById(this.progress.theme);
  }

  private get chapter() {
    return CHAPTERS[this.chapterIndex];
  }

  private get chapterLevels(): readonly Level[] {
    return levelsOfChapter(this.chapter.id);
  }

  // ------------------------------------------------------------- 输入

  pointerDown(sample: PointerSample): void {
    if (this.complete) {
      this.handleCompleteTap(sample.x, sample.y);
      return;
    }
    if (this.mode === 'map') {
      this.handleMapTap(sample.x, sample.y);
      return;
    }
    this.handlePlayTap(sample.x, sample.y);
  }

  pointerMove(sample: PointerSample): void {
    if (!this.dragging || !this.board || !this.boardLayout || this.complete) return;
    const cell = cellAt(this.boardLayout, sample.x, sample.y);
    if (cell < 0) return;
    const before = this.board.connectedCount();
    this.board.dragTo(cell);
    const after = this.board.connectedCount();
    if (after > before) this.celebrateConnect();
  }

  pointerUp(): void {
    if (!this.dragging || !this.board) {
      this.dragging = false;
      return;
    }
    this.dragging = false;
    this.board.release();
    if (this.board.isSolved()) this.finishLevel();
  }

  pointerCancel(): void {
    this.dragging = false;
    this.board?.release();
  }

  private handleMapTap(x: number, y: number): void {
    const layout = this.map;
    if (!layout) return;
    if (hitRect(layout.prev, x, y)) {
      this.chapterIndex = (this.chapterIndex + CHAPTERS.length - 1) % CHAPTERS.length;
      this.host.audio.play('press', 0.5);
      return;
    }
    if (hitRect(layout.next, x, y)) {
      this.chapterIndex = (this.chapterIndex + 1) % CHAPTERS.length;
      this.host.audio.play('press', 0.5);
      return;
    }
    const levels = this.chapterLevels;
    const unlocked = this.unlockedFlags(levels);
    for (let i = 0; i < layout.buttons.length && i < levels.length; i += 1) {
      if (!hitRect(layout.buttons[i], x, y)) continue;
      if (!unlocked[i]) {
        this.showToast('先点亮前一关');
        this.host.audio.play('press', 0.35);
        return;
      }
      this.startLevel(i);
      return;
    }
  }

  private handlePlayTap(x: number, y: number): void {
    if (!this.board || !this.boardLayout) return;
    const headerBack = this.headerRect();
    if (hitRect(headerBack, x, y)) {
      this.mode = 'map';
      this.saveNow();
      return;
    }
    const hint = this.hintRect();
    if (hitRect(hint, x, y)) {
      this.useHint();
      return;
    }
    const cell = cellAt(this.boardLayout, x, y);
    if (this.board.startAt(cell)) {
      this.dragging = true;
      this.host.audio.play('press', 0.5);
    }
  }

  private handleCompleteTap(x: number, y: number): void {
    if (!this.complete) return;
    const layout = completeLayout(this.vp);
    if (hitRect(layout.next, x, y)) {
      if (this.complete.hasNext) this.startLevel(this.levelIndex + 1);
      else {
        this.complete = null;
        this.mode = 'map';
      }
      return;
    }
    if (hitRect(layout.replay, x, y)) {
      this.startLevel(this.levelIndex);
      return;
    }
    if (hitRect(layout.map, x, y)) {
      this.complete = null;
      this.mode = 'map';
    }
  }

  // ------------------------------------------------------------- 流程

  private startLevel(index: number): void {
    const levels = this.chapterLevels;
    if (index < 0 || index >= levels.length) return;
    this.levelIndex = index;
    this.level = levels[index];
    this.board = new BoardState(this.level);
    this.mode = 'play';
    this.complete = null;
    this.hintUsed = false;
    this.hintColor = -1;
    this.hintTimer = 0;
    this.dragging = false;
    this.sparks.length = 0;
  }

  private finishLevel(): void {
    if (!this.level || !this.board) return;
    const perfect = this.board.isPerfect();
    const stars = perfect && !this.hintUsed ? 3 : this.hintUsed ? 1 : 2;
    const previous = this.progress.stars[this.level.id] || 0;
    const first = previous === 0;
    const reward = first ? 10 + stars * 5 : 3;

    if (stars > previous) this.progress.stars[this.level.id] = stars;
    this.progress.dust += reward;
    this.saveNow();

    this.complete = {
      stars,
      perfect,
      reward,
      hasNext: this.levelIndex + 1 < this.chapterLevels.length,
    };
    this.host.audio.play(perfect ? 'unlock' : 'goal', 1);
    this.host.haptics.tap(0.8);
    this.burst(this.vp.width / 2, this.vp.height / 2, perfect ? 30 : 18);
  }

  private useHint(): void {
    if (!this.board) return;
    if (this.progress.dust < HINT_COST) {
      this.showToast('星屑不够，再点亮几关吧');
      return;
    }
    let target = -1;
    for (let i = 0; i < this.board.paths.length; i += 1) {
      if (!this.board.isConnected(i)) {
        target = i;
        break;
      }
    }
    if (target < 0) return;
    this.progress.dust -= HINT_COST;
    this.hintUsed = true;
    this.hintColor = target;
    this.hintTimer = 4;
    this.dirty = true;
    this.host.audio.play('press', 0.6);
  }

  private celebrateConnect(): void {
    const board = this.board;
    const layout = this.boardLayout;
    if (!board || !layout) return;
    this.host.audio.play('release', 0.8);
    this.host.haptics.tap(0.45);
    for (let color = 0; color < board.paths.length; color += 1) {
      if (!board.isConnected(color)) continue;
      const head = board.headOf(color);
      if (head < 0) continue;
      const point = cellCenter(layout, head);
      this.burst(point.x, point.y, 6, this.theme.lines[color % this.theme.lines.length]);
    }
  }

  private burst(x: number, y: number, count: number, color?: string): void {
    const tint = color ?? this.theme.accent;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + Math.random() * 0.4;
      const speed = 90 + Math.random() * 200;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 3 + Math.random() * 5,
        color: tint,
      });
    }
    if (this.sparks.length > 160) this.sparks.splice(0, this.sparks.length - 160);
  }

  private unlockedFlags(levels: readonly Level[]): boolean[] {
    const flags: boolean[] = [];
    const chapterOpen = this.chapterIndex === 0 || totalStars(this.progress) >= this.chapterIndex * 10;
    for (let i = 0; i < levels.length; i += 1) {
      if (!chapterOpen) {
        flags.push(false);
        continue;
      }
      if (i === 0) {
        flags.push(true);
        continue;
      }
      flags.push((this.progress.stars[levels[i - 1].id] || 0) > 0);
    }
    return flags;
  }

  private showToast(text: string): void {
    this.toast = text;
    this.toastTimer = 1.8;
  }

  private saveNow(): void {
    saveProgress(this.host.storage, this.progress);
    this.dirty = false;
    this.saveHold = 0;
  }

  // ------------------------------------------------------------- 更新

  private update(dt: number): void {
    const step = clamp(dt, 0, 0.05);
    this.time += step;

    if (this.hintTimer > 0) {
      this.hintTimer -= step;
      if (this.hintTimer <= 0) this.hintColor = -1;
    }
    if (this.toastTimer > 0) this.toastTimer = Math.max(0, this.toastTimer - step);

    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const spark = this.sparks[i];
      spark.life -= step;
      if (spark.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      spark.x += spark.vx * step;
      spark.y += spark.vy * step;
      spark.vx *= 1 - 2.2 * step;
      spark.vy *= 1 - 2.2 * step;
    }

    this.saveHold += step;
    if (this.dirty && this.saveHold > 3) this.saveNow();

    if (this.mode === 'play' && this.board) {
      const top = this.vp.insetTop + BOARD_TOP_GAP;
      const bottom = this.vp.height - this.vp.insetBottom - BOARD_BOTTOM_GAP;
      this.boardLayout = layoutBoard(this.vp, this.board.cols, this.board.rows, top, bottom);
    } else {
      this.boardLayout = null;
      this.map = mapLayout(this.vp, this.chapterLevels.length);
    }
  }

  // ------------------------------------------------------------- 渲染

  private render(): void {
    const ctx = this.host.ctx;
    const vp = this.vp;
    const theme = this.theme;

    const sky = ctx.createLinearGradient(0, 0, 0, vp.height);
    sky.addColorStop(0, theme.bgTop);
    sky.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, vp.width, vp.height);

    ctx.save();
    for (let i = 0; i < this.stars.length; i += 1) {
      const star = this.stars[i];
      const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.time * 1.2 + star.phase));
      ctx.globalAlpha = 0.28 * twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x, star.y % vp.height, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    if (this.mode === 'map') {
      this.renderMap(ctx);
    } else {
      this.renderPlay(ctx);
    }

    this.renderSparks(ctx);
    drawToast(ctx, vp, theme, this.toast, this.toastTimer > 0 ? Math.min(1, this.toastTimer / 0.4) : 0);
  }

  private renderMap(ctx: CanvasRenderingContext2D): void {
    const layout = this.map;
    if (!layout) return;
    const levels = this.chapterLevels;
    drawMap(
      ctx,
      this.vp,
      this.theme,
      layout,
      this.chapter.name,
      this.chapter.subtitle,
      levels,
      this.progress.stars,
      this.unlockedFlags(levels),
      totalStars(this.progress),
    );
  }

  private renderPlay(ctx: CanvasRenderingContext2D): void {
    const board = this.board;
    const layout = this.boardLayout;
    if (!board || !layout || !this.level) return;

    renderBoard(ctx, layout, board, this.theme, {
      hintColor: this.hintColor,
      hintAlpha: this.hintTimer > 0 ? Math.min(1, this.hintTimer) : 0,
      time: this.time,
    });

    drawPlayHeader(
      ctx,
      this.vp,
      this.theme,
      `第 ${this.chapter.id} 章 · ${this.level.index + 1}`,
      `${board.connectedCount()} / ${board.paths.length} 已连通`,
      this.progress.stars[this.level.id] || 0,
    );
    drawPlayFooter(ctx, this.vp, this.theme, this.progress.dust, this.progress.dust >= HINT_COST);

    if (this.complete) {
      drawComplete(ctx, this.vp, this.theme, completeLayout(this.vp), this.complete);
    }
  }

  private renderSparks(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = 0; i < this.sparks.length; i += 1) {
      const spark = this.sparks[i];
      const fade = spark.life / spark.maxLife;
      ctx.globalAlpha = clamp(fade, 0, 1) * 0.9;
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size * fade, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private headerRect(): Rect {
    const top = this.vp.insetTop + 20;
    return { x: 26, y: top, w: 92, h: 64 };
  }

  private hintRect(): Rect {
    const y = this.vp.height - this.vp.insetBottom - 104;
    return { x: this.vp.width - 244, y, w: 212, h: 68 };
  }
}

export function startLightweave(host: Host): Lightweave {
  return new Lightweave(host);
}
