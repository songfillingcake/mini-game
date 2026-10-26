import { DESIGN_WIDTH, TAU, clamp, lerp, mulberry32 } from '@pocket-play/engine/core/math';
import type { Dent } from './jelly';
import { rgba } from '@pocket-play/engine/core/color';
import { starPath } from '@pocket-play/engine/core/draw';
import type { Host, InputSink, PointerSample, Viewport } from '@pocket-play/engine/platform/types';
import { Backdrop } from './backdrop';
import { Hud, type HudModel } from './hud';
import { Particles } from './particles';
import { Planet, type FaceState } from './planet';
import { PALETTES, paletteById, type Palette } from './palette';
import { goalFor, loadState, refreshDaily, saveState, unlockPalettes, type DailyGoal, type SaveState } from './save';

/** 星球「呼吸」周期（秒）。呼吸走到后半段时轻按即可触发共振。 */
const PULSE_PERIOD = 3.6;
const RESONANCE_FROM = 0.58;
const RESONANCE_TO = 0.78;
const BLINK_DURATION = 0.17;
const SAVE_INTERVAL = 3;

interface ActivePointer {
  id: number;
  x: number;
  y: number;
}

interface Sparkle {
  angle: number;
  distance: number;
  speed: number;
  size: number;
  phase: number;
}

/**
 * 捏捏星球：一个没有失败、没有倒计时的解压玩具。
 * 核心循环 = 按住星球 → 软体凹陷 / 星尘飘散 / 音高反馈 → 松手回弹 → 攒星尘解锁新材质。
 */
export class SquishyPlanet implements InputSink {
  private readonly host: Host;
  private readonly backdrop = new Backdrop(20_240_607);
  private readonly particles = new Particles();
  private readonly hud = new Hud();
  private readonly planet = new Planet();
  private readonly pointers: ActivePointer[] = [];
  private readonly dents: Dent[] = [];
  private readonly sparkles: Sparkle[] = [];

  private state: SaveState;
  private goal: DailyGoal;
  private vp: Viewport = {
    width: DESIGN_WIDTH,
    height: 1334,
    dpr: 2,
    insetTop: 0,
    insetBottom: 0,
  };

  private time = 0;
  private pulsePhase = 0;
  private centerX = DESIGN_WIDTH / 2;
  private centerY = 660;
  private comfort = 0.3;
  private joy = 0.34;
  private squint = 0;
  private blink = 0;
  private blinkTimer = 2.4;
  private blinkLeft = 0;
  private lookX = 0;
  private lookY = 0;
  private resonanceFlash = 0;
  private tutorialAlpha = 0;
  private saveHold = 0;
  private dirty = false;
  private dayHold = 0;

  constructor(host: Host) {
    this.host = host;
    const now = new Date();
    this.state = loadState(host.storage, now);
    this.goal = goalFor(now);
    this.tutorialAlpha = this.state.tutorialSeen ? 0 : 1;
    host.audio.setEnabled(this.state.sound);

    const random = mulberry32(97_331);
    for (let i = 0; i < 7; i += 1) {
      this.sparkles.push({
        angle: random() * TAU,
        distance: 1.14 + random() * 0.3,
        speed: (0.08 + random() * 0.12) * (random() < 0.5 ? -1 : 1),
        size: 7 + random() * 9,
        phase: random() * TAU,
      });
    }

    host.bindInput(this);
    host.loop(this.step);
  }

  private readonly step = (dt: number): void => {
    const vp = this.host.beginFrame();
    this.vp = vp;
    this.layout(vp);
    this.update(dt);
    this.render();
  };

  private layout(vp: Viewport): void {
    const top = vp.insetTop + 108;
    const bottom = vp.height - vp.insetBottom - 168;
    this.centerX = vp.width / 2;
    this.centerY = lerp(top, bottom, 0.5);
    const radius = Math.min(vp.width * 0.355, Math.max(90, (bottom - top) * 0.42));
    this.planet.layout(this.centerX, this.centerY, radius);
    this.hud.layout(vp);
  }

  private palette(): Palette {
    return paletteById(this.state.paletteId);
  }

  // ---------------------------------------------------------------- 输入

  pointerDown(sample: PointerSample): void {
    if (this.hud.hitSound(sample.x, sample.y)) {
      this.toggleSound();
      return;
    }
    const dockIndex = this.hud.hitDock(sample.x, sample.y);
    if (dockIndex >= 0) {
      this.selectPalette(dockIndex);
      return;
    }

    // 星球之外的空白区域不响应，避免点顶栏也涨星尘。
    const dx = sample.x - this.centerX;
    const dy = sample.y - this.centerY;
    const reach = this.planet.radius * 1.14;
    if (dx * dx + dy * dy > reach * reach) return;

    this.pointers.push({ id: sample.id, x: sample.x, y: sample.y });
    this.host.audio.play('press', 0.85);
    this.host.haptics.tap(0.3);
    this.particles.ring(sample.x, sample.y, this.palette().mote, 16, 260, 0.5);
    this.registerPress(sample);
  }

  pointerMove(sample: PointerSample): void {
    for (let i = 0; i < this.pointers.length; i += 1) {
      const pointer = this.pointers[i];
      if (pointer.id !== sample.id) continue;
      pointer.x = sample.x;
      pointer.y = sample.y;
      return;
    }
  }

  pointerUp(id: number): void {
    for (let i = 0; i < this.pointers.length; i += 1) {
      const pointer = this.pointers[i];
      if (pointer.id !== id) continue;
      this.pointers.splice(i, 1);
      const angle = Math.atan2(pointer.y - this.centerY, pointer.x - this.centerX);
      this.planet.jelly.impulse(angle, 54);
      this.particles.ring(pointer.x, pointer.y, this.palette().mote, 10, 210, 0.42);
      this.host.audio.play('release', 0.5);
      return;
    }
  }

  pointerCancel(): void {
    this.pointers.length = 0;
  }

  // ---------------------------------------------------------------- 规则

  private registerPress(sample: PointerSample): void {
    const palette = this.palette();
    const resonance = this.isResonanceWindow();
    this.state.presses += 1;
    this.comfort = clamp(this.comfort + (resonance ? 0.26 : 0.07), 0, 1);

    if (this.tutorialAlpha > 0 && !this.state.tutorialSeen) {
      this.state.tutorialSeen = true;
      this.markDirty();
    }

    if (resonance) {
      this.state.resonances += 1;
      this.resonanceFlash = 1;
      const unlocked = this.gain(8);
      if (unlocked.length === 0) this.hud.showToast('呼吸共振 +8 星尘', 1.6);
      this.particles.burst(sample.x, sample.y, 18, palette.aura, 1.5);
      this.particles.ring(this.centerX, this.centerY, palette.aura, this.planet.radius * 0.92, 560, 0.85);
      this.host.audio.play('resonance', 1);
      this.host.haptics.tap(1);
      this.advanceGoal('resonance');
      return;
    }

    this.gain(1);
    this.particles.burst(sample.x, sample.y, 5, palette.mote, 0.7);
    this.host.haptics.tap(0.15);
    this.advanceGoal('press');
  }

  private isResonanceWindow(): boolean {
    return this.pulsePhase >= RESONANCE_FROM && this.pulsePhase <= RESONANCE_TO;
  }

  /** 返回本次新增解锁的材质 id。 */
  private gain(amount: number): string[] {
    this.state.dust = Math.min(9_999_999, this.state.dust + amount);
    this.markDirty();
    const unlocked = unlockPalettes(this.state);
    if (unlocked.length > 0) {
      const palette = paletteById(unlocked[0]);
      this.hud.showToast(`解锁新材质「${palette.name}」`, 3);
      this.host.audio.play('unlock', 1);
      this.particles.burst(this.centerX, this.centerY - this.planet.radius * 0.9, 26, palette.aura, 1.9);
      this.host.haptics.tap(0.8);
    }
    return unlocked;
  }

  private advanceGoal(kind: 'press' | 'resonance'): void {
    if (this.state.dailyDone || this.goal.kind !== kind) return;
    this.state.dailyProgress = Math.min(this.goal.target, this.state.dailyProgress + 1);
    this.markDirty();
    if (this.state.dailyProgress < this.goal.target) return;

    this.state.dailyDone = true;
    this.comfort = 1;
    this.hud.showToast(`今日完成 · ${this.goal.cheer}（+${this.goal.reward} 星尘）`, 3.2);
    this.host.audio.play('goal', 1);
    this.host.haptics.tap(0.6);
    this.gain(this.goal.reward);
  }

  private selectPalette(index: number): void {
    const item = PALETTES[index];
    if (!item) return;
    if (this.state.unlocked.indexOf(item.id) < 0) {
      const missing = Math.max(0, item.unlock - this.state.dust);
      this.hud.showToast(`再攒 ${missing} 星尘解锁「${item.name}」`, 2);
      this.host.audio.play('press', 0.4);
      return;
    }
    if (this.state.paletteId === item.id) return;
    this.state.paletteId = item.id;
    this.markDirty();
    this.hud.showToast(`换成「${item.name}」`, 1.3);
    this.host.audio.play('release', 0.7);
    this.joy = 1;
    this.particles.ring(this.centerX, this.centerY, item.mote, this.planet.radius * 0.5, 420, 0.7);
  }

  private toggleSound(): void {
    this.state.sound = !this.state.sound;
    this.host.audio.setEnabled(this.state.sound);
    this.markDirty();
    if (this.state.sound) this.host.audio.play('press', 0.8);
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private flush(): void {
    saveState(this.host.storage, this.state);
    this.dirty = false;
    this.saveHold = 0;
  }

  // ---------------------------------------------------------------- 更新

  private update(dt: number): void {
    const step = clamp(dt, 0, 0.05);
    this.time += step;
    this.pulsePhase = (this.time % PULSE_PERIOD) / PULSE_PERIOD;
    this.resonanceFlash = Math.max(0, this.resonanceFlash - step * 1.8);

    this.buildDents();
    this.planet.update(step, this.dents, this.palette());
    this.particles.update(step);
    this.hud.update(step);

    const deformation = this.planet.jelly.deformation();
    this.squint = lerp(this.squint, clamp(deformation * 3.2, 0, 1), Math.min(1, step * 14));
    this.comfort = clamp(this.comfort - step * 0.02, 0, 1);
    this.joy = lerp(this.joy, clamp(0.3 + this.comfort * 0.72, 0, 1), Math.min(1, step * 2.4));

    this.updateFace(step);
    this.updateTutorial(step);

    this.saveHold += step;
    if (this.dirty && this.saveHold >= SAVE_INTERVAL) this.flush();

    this.dayHold += step;
    if (this.dayHold >= 2) {
      this.dayHold = 0;
      const now = new Date();
      if (refreshDaily(this.state, now)) {
        this.goal = goalFor(now);
        this.markDirty();
        this.hud.showToast('新的一天 · 今日小目标刷新啦', 2.4);
      }
    }
  }

  private buildDents(): void {
    this.dents.length = 0;
    const radius = this.planet.radius;
    const reach = radius * 1.12;
    for (let i = 0; i < this.pointers.length; i += 1) {
      const pointer = this.pointers[i];
      const dx = pointer.x - this.centerX;
      const dy = pointer.y - this.centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > reach) continue;
      const angle = Math.atan2(dy, dx);
      const depth = clamp((reach - distance) / (radius * 0.92), 0, 1) * 0.78;
      if (distance < radius * 0.34) {
        // 按在正中心时分成对称的两处凹陷，视觉上更像「整颗被压扁」。
        const half = depth * 0.52;
        this.dents.push({ angle, depth: half });
        this.dents.push({ angle: angle + Math.PI, depth: half });
      } else {
        this.dents.push({ angle, depth });
      }
    }
  }

  private updateFace(step: number): void {
    const pointer = this.pointers.length > 0 ? this.pointers[0] : null;
    const targetLookX = pointer ? clamp((pointer.x - this.centerX) / (this.planet.radius * 1.1), -1, 1) : 0;
    const targetLookY = pointer ? clamp((pointer.y - this.centerY) / (this.planet.radius * 1.1), -1, 1) : 0;
    const follow = Math.min(1, step * 6);
    this.lookX = lerp(this.lookX, targetLookX, follow);
    this.lookY = lerp(this.lookY, targetLookY, follow);

    if (this.blinkLeft > 0) {
      this.blinkLeft = Math.max(0, this.blinkLeft - step);
      this.blink = Math.sin((1 - this.blinkLeft / BLINK_DURATION) * Math.PI);
    } else {
      this.blink = 0;
      this.blinkTimer -= step;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = 2.4 + Math.random() * 3.6;
        this.blinkLeft = BLINK_DURATION;
      }
    }
  }

  private updateTutorial(step: number): void {
    if (this.state.tutorialSeen && this.tutorialAlpha > 0) {
      this.tutorialAlpha = Math.max(0, this.tutorialAlpha - step * 1.6);
    }
  }

  // ---------------------------------------------------------------- 渲染

  private render(): void {
    const ctx = this.host.ctx;
    const vp = this.vp;
    const palette = this.palette();

    this.backdrop.render(ctx, vp, palette, this.time);
    this.drawBreathRing(ctx, palette);

    const face: FaceState = {
      joy: this.joy,
      squint: this.squint,
      lookX: this.lookX,
      lookY: this.lookY,
      blink: this.blink,
    };
    const glow = clamp(this.comfort * 0.45 + this.planet.jelly.deformation() * 0.9 + this.resonanceFlash * 0.5, 0, 1);
    this.planet.render(ctx, palette, face, this.dents, glow);
    this.drawSparkles(ctx, palette);
    this.particles.render(ctx);

    const model: HudModel = {
      dust: this.state.dust,
      goal: this.goal,
      goalProgress: this.state.dailyProgress,
      goalDone: this.state.dailyDone,
      soundOn: this.state.sound,
      tutorialAlpha: this.tutorialAlpha,
      time: this.time,
    };
    this.hud.render(ctx, vp, palette, model, this.state.unlocked);
  }

  private drawBreathRing(ctx: CanvasRenderingContext2D, palette: Palette): void {
    const phase = this.pulsePhase;
    const radius = this.planet.radius * (0.99 + phase * 0.62);
    const fade = Math.pow(1 - phase, 1.5);
    const inWindow = this.isResonanceWindow();
    ctx.save();
    ctx.globalAlpha = fade * (inWindow ? 0.5 : 0.22);
    ctx.strokeStyle = inWindow ? rgba(palette.rim, 0.95) : rgba(palette.aura, 0.8);
    ctx.lineWidth = inWindow ? 3.4 : 2;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  private drawSparkles(ctx: CanvasRenderingContext2D, palette: Palette): void {
    const radius = this.planet.radius;
    ctx.save();
    for (let i = 0; i < this.sparkles.length; i += 1) {
      const sparkle = this.sparkles[i];
      const angle = sparkle.angle + this.time * sparkle.speed;
      const distance = radius * sparkle.distance + Math.sin(this.time * 0.9 + sparkle.phase) * 10;
      const x = this.centerX + Math.cos(angle) * distance;
      const y = this.centerY + Math.sin(angle) * distance * 0.92;
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 1.6 + sparkle.phase));
      ctx.globalAlpha = twinkle * 0.75;
      starPath(ctx, x, y, sparkle.size, sparkle.size * 0.34, 4, this.time * 0.2 + sparkle.phase);
      ctx.fillStyle = palette.mote;
      ctx.fill();
    }
    ctx.restore();
  }
}

/** 统一入口：浏览器与 vivo 运行时都调用它。 */
export function startSquishyPlanet(host: Host): SquishyPlanet {
  return new SquishyPlanet(host);
}
