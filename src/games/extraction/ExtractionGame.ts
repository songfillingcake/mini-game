import type { GameControls, MiniGame } from '../../core/Game';
import { MAP, relics } from './Content';
import { ExtractionModel } from './ExtractionModel';
import { renderExtraction } from './ExtractionRenderer';
import './extraction.css';

/** Adapter for the arcade lifecycle. Owns DOM and input only. */
export class ExtractionGame implements MiniGame {
  readonly id = 'extraction' as const;
  readonly title = '夺宝撤离';
  model = new ExtractionModel();
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private abort = new AbortController();
  private observer: ResizeObserver | null = null;
  private active = false;
  private started = false;
  private stick = { x: 0, y: 0 };
  private dash = false;
  private interact = false;
  private stickId: number | null = null;
  private lastHud = '';
  get score(): number { return this.model.phase === 'escaped' ? this.model.value : 0; }
  get over(): boolean { return this.model.phase !== 'playing'; }
  get timeLeft(): number { return Math.max(0, MAP.duration - this.model.elapsed); }
  get statusText(): string { return this.model.weight + '/10 负重 · 携带 ' + this.model.value; }
  get outcome(): string {
    const m = this.model;
    return m.phase === 'escaped' ? `成功带出 ${m.bag.length} 件宝物，价值 ${m.value}！击退 ${m.kills} 名守卫。` : (m.phase === 'dead' ? '探险者倒下，本次携带的宝物遗失。' : '遗迹已封锁，未能及时带出宝物。') + ' 下次可以提前返回撤离区。';
  }
  mount(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = `<section class="ex-game"><div class="ex-top"><div><span class="ex-eyebrow">RELIC RUN / 单人试玩</span><h2>夺宝撤离 <small>雾港遗迹</small></h2></div><div class="ex-clock"></div></div><div class="ex-meters"><span class="ex-health"></span><span class="ex-value"></span><span class="ex-weight"></span></div><div class="ex-viewport"><canvas aria-label="夺宝撤离地图，使用方向键移动，空格冲刺，E 拾取"></canvas><div class="ex-toast" aria-live="polite"></div></div><div class="ex-actions"><div class="ex-stick" aria-label="拖动摇杆移动"><span>移动</span></div><div class="ex-action-buttons"><button type="button" data-ex="pickup">拾取 · E</button><button type="button" data-ex="dash">冲刺 · 空格</button></div></div><div class="ex-pack"><div class="ex-pack-heading"><strong>战利品</strong><button type="button" data-ex="drop">放下最后一件</button></div><div class="ex-items"></div></div><p class="ex-help">方向键 / WASD 移动 · 自动攻击 · 携宝返回绿色撤离区，停留 4 秒</p></section>`;
    this.canvas = host.querySelector('canvas');
    const signal = this.abort.signal;
    host.addEventListener('click', event => {
      if (!this.active) return;
      const action = (event.target as Element).closest<HTMLElement>('[data-ex]')?.dataset.ex;
      if (action === 'pickup') this.model.pickup();
      if (action === 'drop') this.model.drop();
    }, { signal });
    const button = host.querySelector<HTMLButtonElement>('[data-ex="dash"]')!;
    button.addEventListener('pointerdown', event => { if (this.active) { this.dash = true; button.setPointerCapture(event.pointerId); } }, { signal });
    const release = (): void => { this.dash = false; };
    button.addEventListener('pointerup', release, { signal }); button.addEventListener('pointercancel', release, { signal }); button.addEventListener('lostpointercapture', release, { signal });
    button.addEventListener('click', event => { if (this.active && event.detail === 0) this.dash = true; }, { signal });
    const pad = host.querySelector<HTMLElement>('.ex-stick')!;
    const move = (event: PointerEvent): void => {
      const r = pad.getBoundingClientRect(), dx = (event.clientX - r.left - r.width / 2) / 36, dy = (event.clientY - r.top - r.height / 2) / 36;
      const length = Math.max(1, Math.hypot(dx, dy)); this.stick = { x: dx / length, y: dy / length };
      pad.style.setProperty('--sx', this.stick.x * 24 + 'px'); pad.style.setProperty('--sy', this.stick.y * 24 + 'px');
    };
    pad.addEventListener('pointerdown', event => { if (!this.active || this.stickId !== null) return; event.preventDefault(); this.stickId = event.pointerId; pad.setPointerCapture(event.pointerId); move(event); }, { signal });
    pad.addEventListener('pointermove', event => { if (event.pointerId === this.stickId) move(event); }, { signal });
    const stop = (event: PointerEvent): void => { if (event.pointerId !== this.stickId) return; this.stickId = null; this.stick = { x: 0, y: 0 }; pad.style.setProperty('--sx', '0px'); pad.style.setProperty('--sy', '0px'); };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, stop as EventListener, { signal });
    window.addEventListener('keydown', event => {
      if (!this.active || event.repeat || (event.target instanceof Element && event.target.closest('button,input,textarea'))) return;
      if (event.key.toLowerCase() === 'e') { event.preventDefault(); this.interact = true; }
    }, { signal });
    this.observer = new ResizeObserver(() => this.paint()); this.observer.observe(this.canvas!);
    this.paint(); this.hud();
  }
  start(): void { this.model = new ExtractionModel(); this.started = true; this.lastHud = ''; this.hud(); this.paint(); }
  setActive(active: boolean): void {
    this.active = active;
    if (this.host) this.host.inert = !active;
    if (!active) {
      this.stick = { x: 0, y: 0 }; this.stickId = null; this.dash = false; this.interact = false;
      const pad = this.host?.querySelector<HTMLElement>('.ex-stick');
      pad?.style.setProperty('--sx', '0px'); pad?.style.setProperty('--sy', '0px');
    }
  }
  press(): void { if (this.active) this.dash = true; }
  update(dt: number, controls: GameControls): void {
    if (!this.active || !this.started) return;
    const keys = controls.keys;
    this.model.update(dt, { x: this.stick.x + Number(keys.has('right')) - Number(keys.has('left')), y: this.stick.y + Number(keys.has('down')) - Number(keys.has('up')), dash: this.dash, interact: this.interact });
    this.dash = false; this.interact = false;
    this.hud(); this.paint();
  }
  private hud(): void {
    if (!this.host) return;
    const m = this.model;
    const set = (selector: string, text: string): void => { const el = this.host!.querySelector(selector); if (el && el.textContent !== text) el.textContent = text; };
    const time = Math.ceil(this.timeLeft);
    set('.ex-clock', `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`);
    set('.ex-health', `♥ ${Math.ceil(m.player.hp)} / 100`); set('.ex-value', `◆ ${m.value} 待带出`); set('.ex-weight', `背包 ${m.weight} / ${MAP.capacity}`);
    set('.ex-toast', m.extraction > 0 ? `撤离中 ${Math.min(100, Math.floor(m.extraction / 4 * 100))}% · 留在圈内` : m.messageTime > 0 ? m.message : '');
    const dash = this.host.querySelector<HTMLButtonElement>('[data-ex="dash"]')!;
    dash.disabled = m.player.dashCooldown > 0; dash.textContent = m.player.dashCooldown > 0 ? `冲刺 ${m.player.dashCooldown.toFixed(1)}s` : '冲刺 · 空格';
    const near = m.nearestLoot;
    set('[data-ex="pickup"]', near ? `拾取 ${relics[near.type].glyph} · E` : '拾取 · E');
    const signature = m.bag.map(p => `${p.id}:${p.bonus}`).join(',');
    if (signature !== this.lastHud || !this.host.querySelector('.ex-items')!.childElementCount) {
      this.lastHud = signature;
      this.host.querySelector('.ex-items')!.innerHTML = m.bag.length ? m.bag.map(p => { const d = relics[p.type]; return `<div class="ex-item" style="--relic:${d.color}"><span>${d.glyph}</span><div><strong>${d.name} <small>${d.value + p.bonus}</small></strong><p>${d.effect}</p></div></div>`; }).join('') : '<span class="ex-empty">背包空空 · 金色光点是宝物，绿色圆圈是撤离区</span>';
    }
    this.host.querySelector<HTMLButtonElement>('[data-ex="drop"]')!.disabled = !m.bag.length;
  }
  private paint(): void {
    if (!this.canvas) return;
    const r = this.canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2), w = Math.round(r.width * ratio), h = Math.round(r.height * ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const ctx = this.canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); renderExtraction(ctx, this.model, r.width, r.height);
  }
  render(): void { /* DOM-mounted canvas is painted by the shared update lifecycle. */ }
  dispose(): void { this.abort.abort(); this.observer?.disconnect(); this.host = null; this.canvas = null; }
}
