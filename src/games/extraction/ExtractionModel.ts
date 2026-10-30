import { MAP, lootSpawns, relics, walls, type RelicId, type Vec } from './Content';
import { ExtractionNavigation } from './Navigation';
import { extractionLoadouts, type ExtractionLoadoutId } from './Loadouts';
import { LootSearch } from './LootSearch';

export type Enemy = Vec & { id: number; type: 'scout' | 'brute' | 'sentry'; hp: number; maxHp: number; cooldown: number; alert: number; windup: number; rush: number; aim: Vec };
export type Loot = Vec & { id: number; type: RelicId; bonus: number; sealed?: boolean };
export type Effect = Vec & { kind: 'shot' | 'ice' | 'ring' | 'hit' | 'number'; life: number; max: number; to?: Vec; label?: string; color?: string };
export type RunInput = Vec & { dash: boolean; interact: boolean };
const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Owns one run. Rendering, input devices and persistence stay outside the model. */
export class ExtractionModel {
  player = { x: 150, y: 950, hp: 100, invincible: 0, dashTime: 0, dashCooldown: 0, facing: { x: 0, y: -1 } };
  enemies: Enemy[] = [];
  loot: Loot[] = lootSpawns.map((p, id) => ({ ...p, id, bonus: 0, sealed: [2, 4, 6, 9].includes(id) }));
  search = new LootSearch();
  bag: Loot[] = [];
  effects: Effect[] = [];
  elapsed = 0;
  extraction = 0;
  phase: 'playing' | 'escaped' | 'dead' | 'timeout' = 'playing';
  message = '前方有宝物 · 靠近后拾取';
  messageTime = 5;
  kills = 0;
  private shot = 0;
  private iceClock = 0;
  private bellClock = 0;
  private spawnClock = 0;
  private nextId = 20;
  private lastDash = false;
  private lastInteract = false;
  private navigation = new ExtractionNavigation();
  private collected = new Set<number>();
  readonly loadout: typeof extractionLoadouts[ExtractionLoadoutId];

  constructor(loadoutId: ExtractionLoadoutId = 'runner') {
    this.loadout = extractionLoadouts[loadoutId];
    this.player.hp = this.loadout.hp;
    const starts = [{ x: 700, y: 690 }, { x: 500, y: 300 }, { x: 1000, y: 560 }, { x: 1450, y: 380 }, { x: 1280, y: 1050 }, { x: 1570, y: 910 }];
    starts.forEach((p, i) => this.spawn(p, i % 3 as 0 | 1 | 2));
  }
  get weight(): number { return this.bag.reduce((sum, p) => sum + relics[p.type].weight, 0); }
  get value(): number { return this.bag.reduce((sum, p) => sum + relics[p.type].value + p.bonus, 0); }
  get radius(): number { return this.has('bag') ? 23 : 17; }
  get nearestLoot(): Loot | undefined { return this.loot.filter(p => distance(p, this.player) < 70).sort((a, b) => distance(a, this.player) - distance(b, this.player))[0]; }
  has(type: RelicId): boolean { return this.bag.some(p => p.type === type); }
  notify(message: string): void { this.message = message; this.messageTime = 3; }
  private effect(p: Vec, kind: Effect['kind'], life: number, to?: Vec): void {
    this.effects.push({ x: p.x, y: p.y, kind, life, max: life, to: to && { ...to } });
    if (this.effects.length > 100) this.effects.shift();
  }
  private number(p: Vec, label: string, color: string): void {
    this.effects.push({ x: p.x, y: p.y - 24, kind: 'number', life: .8, max: .8, label, color });
    if (this.effects.length > 100) this.effects.shift();
  }
  private spawn(p: Vec, kind: 0 | 1 | 2): void {
    const hp = [45, 110, 65][kind];
    this.enemies.push({ ...p, id: this.nextId++, type: (['scout', 'brute', 'sentry'] as const)[kind], hp, maxHp: hp, cooldown: 1, alert: 0, windup: 0, rush: 0, aim: { ...p } });
  }
  private move(p: Vec, dx: number, dy: number, r: number): void {
    const free = (x: number, y: number): boolean => x >= r && y >= r && x <= MAP.width - r && y <= MAP.height - r && !walls.some(w => x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h);
    if (free(p.x + dx, p.y)) p.x += dx;
    if (free(p.x, p.y + dy)) p.y += dy;
  }
  private visible(a: Vec, b: Vec): boolean {
    const steps = Math.ceil(distance(a, b) / 14);
    for (let i = 1; i < steps; i++) {
      const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
      if (walls.some(w => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h)) return false;
    }
    return true;
  }
  pickup(): void {
    if (this.phase !== 'playing') return;
    const item = this.nearestLoot;
    if (!item) { this.notify('靠近发光宝物后拾取'); return; }
    if (item.sealed) {
      this.search.begin(item.id, this.player);
      this.enemies.forEach(e => { if (distance(e, this.player) < 450) e.alert = Math.max(e.alert, 5); });
      this.notify('正在搜寻宝箱 · 保持不动');
      return;
    }
    this.collect(item);
  }
  private collect(item: Loot): void {
    if (this.weight + relics[item.type].weight > MAP.capacity) { this.notify('背包已满 · 可丢下最后一件'); return; }
    // Each world item feeds a bag only on its first pickup in this run.
    if (!this.collected.has(item.id)) for (const p of this.bag) if (p.type === 'bag') p.bonus += 60;
    this.collected.add(item.id);
    this.bag.push(item);
    this.loot = this.loot.filter(p => p !== item);
    this.notify(relics[item.type].name + ' · ' + relics[item.type].effect);
    this.number(this.player, '◆ ' + (relics[item.type].value + item.bonus), relics[item.type].color);
    this.effect(this.player, 'ring', .5);
  }
  drop(id?: number): void {
    if (this.phase !== 'playing') return;
    const index = id === undefined ? this.bag.length - 1 : this.bag.findIndex(item => item.id === id);
    if (index < 0) return;
    const [item] = this.bag.splice(index, 1);
    if (item) { this.loot.push({ ...item, x: this.player.x, y: this.player.y }); this.notify('已放下' + relics[item.type].name); }
  }
  private damage(amount: number): void {
    const p = this.player;
    if (p.invincible > 0 || p.dashTime > 0) return;
    p.hp = Math.max(0, p.hp - amount); p.invincible = .85;
    if (this.search.id !== null) { this.search.cancel(); this.notify('受到攻击 · 搜寻中断'); }
    this.number(p, '−' + amount, '#ffa998');
    if (this.extraction > 0) { this.extraction = 0; this.notify('受到攻击 · 撤离中断'); }
    this.effect(p, 'hit', .3);
    if (this.has('crown')) {
      this.effect(p, 'ring', .6);
      this.enemies.forEach(e => { if (e.hp > 0 && distance(e, p) < 170) { e.hp -= 50; this.number(e, '−50', '#e6d3ff'); } });
    }
    if (p.hp <= 0) { this.phase = 'dead'; this.notify('倒在遗迹中 · 本次宝物遗失'); }
  }
  update(dt: number, input: RunInput): void {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .05);
    this.elapsed += dt; this.messageTime -= dt;
    const p = this.player;
    this.navigation.update(p, dt);
    p.invincible = Math.max(0, p.invincible - dt); p.dashCooldown = Math.max(0, p.dashCooldown - dt); p.dashTime = Math.max(0, p.dashTime - dt);
    if (input.interact && !this.lastInteract) this.pickup();
    this.lastInteract = input.interact;
    let dx = input.x, dy = input.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) { dx /= Math.max(1, length); dy /= Math.max(1, length); p.facing = { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) }; }
    if (input.dash && !this.lastDash && p.dashCooldown <= 0) { p.dashTime = .2; p.dashCooldown = this.loadout.dashCooldown; this.effect(p, 'ring', .25); }
    this.lastDash = input.dash;
    const speed = this.loadout.speed * (1 - this.weight * .024);
    if (p.dashTime > 0) { dx = p.facing.x; dy = p.facing.y; }
    const velocity = p.dashTime > 0 ? 650 : speed;
    // The bag enlarges the visible/hit silhouette, not the wall collider:
    // collecting it beside a wall must not trap the player inside that wall.
    this.move(p, dx * velocity * dt, dy * velocity * dt, 17);
    if (this.search.id !== null) {
      const item = this.loot.find(loot => loot.id === this.search.id);
      const valid = Boolean(item && distance(item, p) < 70 && distance(this.search.origin, p) < 8 && length < .05 && p.dashTime <= 0);
      if (this.search.update(dt, valid) && item) {
        item.sealed = false; this.search.cancel(); this.collect(item);
      } else if (!valid) this.notify('已停止搜寻');
    }
    if (this.has('heart')) p.hp = Math.min(this.loadout.hp, p.hp + 1.2 * dt);
    this.effects.forEach(e => e.life -= dt); this.effects = this.effects.filter(e => e.life > 0);
    this.iceClock += dt; this.bellClock += dt;
    if (this.has('ice') && length > 0 && this.iceClock > .32) { this.iceClock = 0; this.effect(p, 'ice', 2.5); }
    if (this.has('bell') && this.bellClock >= 8) { this.bellClock = 0; this.enemies.forEach(e => e.alert = 10); this.effect(p, 'ring', 1); this.notify('大钟敲响 · 追兵正在靠近！'); }
    this.shot -= dt;
    const target = this.enemies.filter(e => e.hp > 0 && distance(e, p) < 320 && this.visible(p, e)).sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (target && this.shot <= 0) { this.shot = this.loadout.reload; target.hp -= this.loadout.damage; this.effect(p, 'shot', .14, target); this.number(target, '−' + this.loadout.damage, '#fff1c2'); }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.cooldown -= dt; e.alert = Math.max(0, e.alert - dt);
      const d = distance(e, p);
      if (e.rush > 0) {
        e.rush = Math.max(0, e.rush - dt);
        const remaining = distance(e, e.aim);
        if (remaining > 1) {
          const step = Math.min(remaining, 540 * dt);
          this.move(e, (e.aim.x - e.x) / remaining * step, (e.aim.y - e.y) / remaining * step, 19);
        } else e.rush = 0;
        if (distance(e, p) < this.radius + 25 && this.visible(e, p)) { this.damage(25); e.rush = 0; }
        continue;
      }
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          if (e.type === 'brute') { e.rush = .4; this.effect(e, 'ring', .25); }
          else { this.effect(e, 'shot', .2, e.aim); if (distance(p, e.aim) < 48 && this.visible(e, p)) this.damage(18); }
        }
        continue;
      }
      if (d > (this.elapsed > 240 ? 900 : 430) && e.alert <= 0) continue;
      if (e.type === 'brute' && d < 175 && e.cooldown <= 0 && this.visible(e, p)) {
        e.cooldown = 2.8; e.windup = .7; e.aim = { x: p.x, y: p.y };
        continue;
      }
      if (e.type === 'sentry' && d < 350 && this.visible(e, p)) {
        if (e.cooldown <= 0) { e.cooldown = 2.4; e.windup = .8; e.aim = { x: p.x, y: p.y }; }
        continue;
      }
      if (d > 1) {
        const slow = this.effects.some(f => f.kind === 'ice' && distance(f, e) < 48) ? .35 : 1;
        const v = (e.type === 'brute' ? 76 : e.type === 'scout' ? 132 : 95) * slow * dt;
        const waypoint = this.navigation.waypoint(e, p);
        const remaining = distance(e, waypoint);
        if (remaining > .1) this.move(e, (waypoint.x - e.x) / remaining * Math.min(v, remaining), (waypoint.y - e.y) / remaining * Math.min(v, remaining), 19);
      }
      if (d < this.radius + 25 && e.cooldown <= 0) { this.damage(e.type === 'brute' ? 25 : 12); e.cooldown = 1.1; }
    }
    const dead = this.enemies.filter(e => e.hp <= 0);
    this.kills += dead.length; dead.forEach(e => this.effect(e, 'hit', .4));
    this.enemies = this.enemies.filter(e => e.hp > 0);
    this.spawnClock += dt;
    if (this.spawnClock > (this.elapsed > 240 ? 6 : 18) && this.enemies.length < 22) {
      this.spawnClock = 0;
      const angle = this.nextId * 2.399;
      const spot = { x: Math.max(50, Math.min(MAP.width - 50, p.x + Math.cos(angle) * 540)), y: Math.max(50, Math.min(MAP.height - 50, p.y + Math.sin(angle) * 540)) };
      if (!walls.some(w => spot.x > w.x - 25 && spot.x < w.x + w.w + 25 && spot.y > w.y - 25 && spot.y < w.y + w.h + 25)) this.spawn(spot, this.nextId % 3 as 0 | 1 | 2);
    }
    if (this.phase !== 'playing') return;
    const onExit = distance(p, MAP.exit) < MAP.exit.radius - 12;
    if (onExit && this.bag.length && p.invincible <= 0) this.extraction += dt; else this.extraction = 0;
    if (this.extraction >= 4) { this.phase = 'escaped'; this.notify('撤离成功 · 战利品已带出'); }
    else if (this.elapsed >= MAP.duration) { this.phase = 'timeout'; this.notify('遗迹封锁 · 未能及时撤离'); }
  }
}
