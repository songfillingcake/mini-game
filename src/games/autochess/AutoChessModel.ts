import { Combat } from './Combat';
import { emptyRelics, sellValue, unitById, unitDefinitions } from './Units';
import type { Piece, Relics } from './Units';
import { enemiesForRound } from './Units';

export const AUTO_CHESS_SAVE_KEY = 'pocket-play-autochess-run-v1';
export const FINAL_ROUND = 8;
export const BENCH_SIZE = 7;
export type Phase = 'prep' | 'battle' | 'reward' | 'ended';
export interface RoundReport { win: boolean; round: number; income: number; interest: number; damage: number }
export interface RunSnapshot {
  version: 1; phase: Phase; round: number; health: number; gold: number; xp: number;
  units: Piece[]; shop: (string | null)[]; locked: boolean; relics: Relics;
  rewards: string[]; score: number; wins: number; nextUid: number; lastReport: RoundReport | null;
}
const xpThresholds = [0, 6, 14, 24];
export const capacityForXp = (xp: number): number => 3 + xpThresholds.filter((threshold) => threshold > 0 && xp >= threshold).length;
export function rewardInfo(id: string): { icon: string; name: string; detail: string } {
  const relics: Record<string, { icon: string; name: string; detail: string }> = {
    gold: { icon: '💰', name: '远征补给', detail: '立即获得 6 金币' },
    'relic-attack': { icon: '⚔️', name: '锋芒徽记', detail: '此后全队攻击 +6' },
    'relic-armor': { icon: '🛡️', name: '守望徽记', detail: '此后全队护甲 +5' },
    'relic-health': { icon: '💚', name: '丰饶徽记', detail: '此后全队生命 +40' },
    'relic-speed': { icon: '🍃', name: '轻羽徽记', detail: '此后全队攻速 +8%' },
  };
  if (relics[id]) return relics[id];
  const unit = unitById[id.replace('recruit-', '')];
  return { icon: unit?.icon || '🎁', name: unit?.name || '伙伴增援', detail: '免费招募一名伙伴，可参与合成' };
}

export function parseRun(serialized: string): RunSnapshot | null {
  try {
    const data = JSON.parse(serialized) as RunSnapshot;
    const validType = (id: unknown): id is string => typeof id === 'string' && Object.hasOwn(unitById, id);
    const integer = (value: unknown, min: number, max: number): boolean => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
    if (!data || typeof data !== 'object' || data.version !== 1 || !['prep', 'reward', 'ended'].includes(data.phase)) return null;
    if (!integer(data.round, 1, FINAL_ROUND) || !integer(data.health, 0, 6) || !integer(data.gold, 0, 500) || !integer(data.xp, 0, 24) || !integer(data.score, 0, 100000) || !integer(data.wins, 0, data.round) || !integer(data.nextUid, 1, 100000)) return null;
    if (data.phase !== 'ended' && data.health === 0) return null;
    if (!Array.isArray(data.units) || data.units.length > 13 || !Array.isArray(data.shop) || data.shop.length !== 5 || typeof data.locked !== 'boolean') return null;
    const occupied = new Set<number>(), uids = new Set<string>();
    for (const piece of data.units) {
      if (!piece || typeof piece !== 'object' || typeof piece.uid !== 'string' || !/^unit-\d+$/.test(piece.uid) || uids.has(piece.uid) || !validType(piece.type) || !integer(piece.star, 1, 3)) return null;
      if (Number(piece.uid.slice(5)) >= data.nextUid) return null;
      uids.add(piece.uid);
      if (piece.cell !== null) {
        if (!integer(piece.cell, 18, 35) || occupied.has(piece.cell)) return null;
        occupied.add(piece.cell);
      }
    }
    if (occupied.size > capacityForXp(data.xp) || data.units.length - occupied.size > BENCH_SIZE) return null;
    if (!data.shop.every((id) => id === null || validType(id))) return null;
    if (!data.relics || !['attack', 'armor', 'health', 'speed'].every((key) => integer(data.relics[key as keyof Relics], 0, FINAL_ROUND))) return null;
    if (!Array.isArray(data.rewards) || data.rewards.length > 3 || new Set(data.rewards).size !== data.rewards.length) return null;
    if (!data.rewards.every((id) => typeof id === 'string' && (['gold', 'relic-attack', 'relic-armor', 'relic-health', 'relic-speed'].includes(id) || (id.startsWith('recruit-') && validType(id.slice(8)))))) return null;
    if (data.phase === 'reward' && (data.rewards.length !== 3 || data.round === FINAL_ROUND)) return null;
    if (data.lastReport !== null) {
      const report = data.lastReport;
      if (!report || typeof report.win !== 'boolean' || !integer(report.round, 1, data.round) || !integer(report.income, 0, 30) || !integer(report.interest, 0, 5) || !integer(report.damage, 0, 2)) return null;
    }
    // Return a clean value rather than spreading unknown saved fields into the model.
    return {
      version: 1, phase: data.phase, round: data.round, health: data.health, gold: data.gold, xp: data.xp,
      units: data.units.map(({ uid, type, star, cell }) => ({ uid, type, star, cell })), shop: [...data.shop], locked: data.locked,
      relics: { attack: data.relics.attack, armor: data.relics.armor, health: data.relics.health, speed: data.relics.speed },
      rewards: [...data.rewards], score: data.score, wins: data.wins, nextUid: data.nextUid,
      lastReport: data.lastReport ? { win: data.lastReport.win, round: data.lastReport.round, income: data.lastReport.income, interest: data.lastReport.interest, damage: data.lastReport.damage } : null,
    };
  } catch { return null; }
}

export class AutoChessModel {
  state: RunSnapshot;
  combat: Combat | null = null;
  notice = '招募伙伴，再点击绿色格子上阵';
  constructor(snapshot?: RunSnapshot, private readonly random: () => number = Math.random) {
    this.state = snapshot ? structuredClone(snapshot) : {
      version: 1, phase: 'prep', round: 1, health: 6, gold: 10, xp: 0,
      units: [{ uid: 'unit-1', type: 'moss', star: 1, cell: 26 }, { uid: 'unit-2', type: 'fox', star: 1, cell: 33 }],
      shop: ['moss', 'moss', 'fox', 'boar', 'cat'], locked: false, relics: emptyRelics(),
      rewards: [], score: 0, wins: 0, nextUid: 3, lastReport: null,
    };
  }
  get capacity(): number { return capacityForXp(this.state.xp); }
  get deployed(): Piece[] { return this.state.units.filter((unit) => unit.cell !== null); }
  get bench(): Piece[] { return this.state.units.filter((unit) => unit.cell === null); }
  get nextLevelXp(): number | null { return xpThresholds.find((threshold) => threshold > this.state.xp) ?? null; }
  get interest(): number { return Math.min(5, Math.floor(this.state.gold / 10)); }
  get enemies(): Piece[] { return enemiesForRound(this.state.round); }
  snapshot(): string { return JSON.stringify({ ...this.state, phase: this.state.phase === 'battle' ? 'prep' : this.state.phase }); }

  private addUnit(type: string): boolean {
    const previous = structuredClone(this.state.units);
    const nextUid = this.state.nextUid;
    this.state.units.push({ uid: 'unit-' + this.state.nextUid++, type, star: 1, cell: null });
    let promoted = false;
    for (let star = 1; star <= 2; star++) {
      let copies = this.state.units.filter((unit) => unit.type === type && unit.star === star)
        .sort((a, b) => Number(a.cell === null) - Number(b.cell === null) || Number(a.uid.slice(5)) - Number(b.uid.slice(5)));
      while (copies.length >= 3) {
        const [keep, ...consume] = copies.slice(0, 3);
        keep.star += 1;
        this.state.units = this.state.units.filter((unit) => !consume.includes(unit));
        promoted = true;
        copies = this.state.units.filter((unit) => unit.type === type && unit.star === star);
      }
    }
    if (this.bench.length > BENCH_SIZE) { this.state.units = previous; this.state.nextUid = nextUid; return false; }
    this.notice = promoted ? unitById[type].name + '合成升星！' : '已招募' + unitById[type].name;
    return true;
  }

  buy(index: number): boolean {
    const id = this.state.shop[index];
    if (this.state.phase !== 'prep' || !id || this.state.gold < unitById[id].cost) return false;
    if (!this.addUnit(id)) { this.notice = '备战席已满，先上阵或出售伙伴'; return false; }
    this.state.gold -= unitById[id].cost;
    this.state.shop[index] = null;
    return true;
  }

  refresh(): boolean {
    if (this.state.phase !== 'prep' || this.state.gold < 2) return false;
    this.state.gold -= 2;
    this.rollShop();
    this.notice = '新的伙伴抵达了';
    return true;
  }

  private rollShop(): void {
    const probabilities = this.capacity >= 5 ? [0.35, 0.73] : this.capacity === 4 ? [0.5, 0.88] : [0.7, 0.95];
    this.state.shop = Array.from({ length: 5 }, () => {
      const roll = this.random();
      const cost = roll < probabilities[0] ? 1 : roll < probabilities[1] ? 2 : 3;
      const candidates = unitDefinitions.filter((unit) => unit.cost === cost);
      return candidates[Math.min(candidates.length - 1, Math.floor(this.random() * candidates.length))].id;
    });
  }

  toggleLock(): boolean {
    if (this.state.phase !== 'prep') return false;
    this.state.locked = !this.state.locked;
    this.notice = this.state.locked ? '已锁定商店，下回合保留这些伙伴' : '已解锁商店';
    return true;
  }

  buyXp(): boolean {
    if (this.state.phase !== 'prep' || this.state.gold < 4 || this.capacity === 6) return false;
    const oldCapacity = this.capacity;
    this.state.gold -= 4;
    this.state.xp = Math.min(24, this.state.xp + 4);
    this.notice = this.capacity > oldCapacity ? '人口提升，可上阵 ' + this.capacity + ' 名伙伴' : '获得 4 点经验';
    return true;
  }

  move(uid: string, cell: number | null): boolean {
    if (this.state.phase !== 'prep' || (cell !== null && (!Number.isInteger(cell) || cell < 18 || cell > 35))) return false;
    const unit = this.state.units.find((piece) => piece.uid === uid);
    if (!unit) return false;
    if (cell === unit.cell) return true;
    if (cell === null && this.bench.length >= BENCH_SIZE) { this.notice = '备战席已满'; return false; }
    const occupant = cell === null ? undefined : this.state.units.find((piece) => piece.cell === cell);
    if (unit.cell === null && cell !== null && !occupant && this.deployed.length >= this.capacity) { this.notice = '上阵人数已满，可交换棋子或升级人口'; return false; }
    if (occupant) occupant.cell = unit.cell;
    unit.cell = cell;
    this.notice = cell === null ? '伙伴已回到备战席' : '阵容已调整';
    return true;
  }

  sell(uid: string): boolean {
    if (this.state.phase !== 'prep') return false;
    const unit = this.state.units.find((piece) => piece.uid === uid);
    if (!unit) return false;
    this.state.gold = Math.min(500, this.state.gold + sellValue(unit));
    this.state.units = this.state.units.filter((piece) => piece.uid !== uid);
    this.notice = '已出售' + unitById[unit.type].name;
    return true;
  }

  autoDeploy(): boolean {
    if (this.state.phase !== 'prep') return false;
    const candidates = [...this.bench].sort((a, b) => {
      const power = (unit: Piece): number => (unitById[unit.type].hp + unitById[unit.type].attack * 8) * [1, 1.9, 3.6][unit.star - 1];
      return power(b) - power(a);
    });
    for (const piece of candidates) {
      if (this.deployed.length >= this.capacity) break;
      const cells = unitById[piece.type].range === 1 ? [20, 21, 19, 22, 18, 23, 26, 27] : [32, 33, 31, 34, 30, 35, 25, 28];
      const cell = cells.find((position) => !this.state.units.some((unit) => unit.cell === position));
      if (cell !== undefined) piece.cell = cell;
    }
    this.notice = '已补齐空位，点棋子可继续调整';
    return true;
  }

  beginBattle(): boolean {
    if (this.state.phase !== 'prep') return false;
    if (!this.deployed.length) { this.notice = '至少上阵一名伙伴才能出战'; return false; }
    this.combat = new Combat(this.deployed, this.enemies, this.state.relics);
    this.state.phase = 'battle';
    return true;
  }

  update(dt: number): boolean {
    if (this.state.phase !== 'battle' || !this.combat) return false;
    this.combat.update(dt);
    if (!this.combat.result) return false;
    this.resolve(this.combat.result === 'win');
    return true;
  }

  private resolve(win: boolean): void {
    const damage = win ? 0 : this.state.round >= 5 ? 2 : 1;
    const interest = this.interest;
    const income = 5 + interest + (win ? 1 : 0);
    this.state.health = Math.max(0, this.state.health - damage);
    this.state.gold = Math.min(500, this.state.gold + income);
    this.state.xp = Math.min(24, this.state.xp + 2);
    this.state.score += win ? 100 + this.state.round * 15 : 20;
    if (win) this.state.wins += 1;
    this.state.lastReport = { win, round: this.state.round, damage, income, interest };
    if (this.state.health === 0 || this.state.round === FINAL_ROUND) {
      this.state.phase = 'ended';
      if (win && this.state.round === FINAL_ROUND) this.state.score += 500 + this.state.health * 50;
      return;
    }
    const relic = ['attack', 'armor', 'health', 'speed'][Math.floor(this.random() * 4) % 4];
    const recruit = unitDefinitions.filter((unit) => unit.cost >= 2);
    this.state.rewards = ['gold', 'relic-' + relic, 'recruit-' + recruit[Math.floor(this.random() * recruit.length) % recruit.length].id];
    this.state.phase = 'reward';
  }

  chooseReward(index: number): boolean {
    if (this.state.phase !== 'reward') return false;
    const reward = this.state.rewards[index];
    if (!reward) return false;
    if (reward === 'gold') this.state.gold = Math.min(500, this.state.gold + 6);
    else if (reward.startsWith('relic-')) this.state.relics[reward.slice(6) as keyof Relics] += 1;
    else if (!this.addUnit(reward.slice(8))) { this.notice = '备战席已满，请选择金币或徽记'; return false; }
    this.state.round += 1;
    this.state.phase = 'prep';
    this.state.rewards = [];
    if (!this.state.locked) this.rollShop();
    this.combat = null;
    this.notice = '已领取' + rewardInfo(reward).name + '，准备下一关';
    return true;
  }
}
