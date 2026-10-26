import { dayIndex, dateKey } from '@pocket-play/engine/core/math';
import type { StoragePort } from '@pocket-play/engine/platform/types';
import { PALETTES, paletteById } from './palette';

export const SAVE_KEY = 'squishy-planet/save/v1';

export interface DailyGoal {
  readonly kind: 'press' | 'resonance';
  readonly target: number;
  readonly reward: number;
  /** HUD 上显示的短标题 */
  readonly label: string;
  /** 完成后的提示语 */
  readonly cheer: string;
}

export interface SaveState {
  version: 1;
  dust: number;
  paletteId: string;
  unlocked: string[];
  sound: boolean;
  presses: number;
  resonances: number;
  dailyDate: string;
  dailyProgress: number;
  dailyDone: boolean;
  tutorialSeen: boolean;
}

const MAX_COUNT = 9_999_999;

function toCount(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  return Math.min(MAX_COUNT, Math.floor(value));
}

function defaultUnlocked(): string[] {
  return [PALETTES[0].id];
}

export function createState(now: Date): SaveState {
  return {
    version: 1,
    dust: 0,
    paletteId: PALETTES[0].id,
    unlocked: defaultUnlocked(),
    sound: true,
    presses: 0,
    resonances: 0,
    dailyDate: dateKey(now),
    dailyProgress: 0,
    dailyDone: false,
    tutorialSeen: false,
  };
}

/** 每日目标按日期稳定派生：单双日交替「轻捏」与「共振」，不需要服务端。 */
export function goalFor(now: Date): DailyGoal {
  const index = dayIndex(now);
  if (index % 2 === 0) {
    const target = 18 + (index % 4) * 6;
    return {
      kind: 'press',
      target,
      reward: 40,
      label: `轻捏 ${target} 下`,
      cheer: '今天的星球被你揉得软软的',
    };
  }
  const target = 3 + (index % 3);
  return {
    kind: 'resonance',
    target,
    reward: 60,
    label: `呼吸共振 ${target} 次`,
    cheer: '你抓住了星球的呼吸节奏',
  };
}

export function refreshDaily(state: SaveState, now: Date): boolean {
  const key = dateKey(now);
  if (state.dailyDate === key) return false;
  state.dailyDate = key;
  state.dailyProgress = 0;
  state.dailyDone = false;
  return true;
}

function sanitize(source: Record<string, unknown>, now: Date): SaveState {
  const base = createState(now);
  const unlocked: string[] = [];
  if (Array.isArray(source.unlocked)) {
    for (let i = 0; i < source.unlocked.length; i += 1) {
      const id = source.unlocked[i];
      if (typeof id !== 'string') continue;
      if (unlocked.indexOf(id) < 0 && PALETTES.some((palette) => palette.id === id)) unlocked.push(id);
    }
  }
  if (unlocked.indexOf(base.paletteId) < 0) unlocked.unshift(base.paletteId);

  const paletteId = typeof source.paletteId === 'string' ? source.paletteId : base.paletteId;
  return {
    version: 1,
    dust: toCount(source.dust),
    paletteId: unlocked.indexOf(paletteId) >= 0 ? paletteId : base.paletteId,
    unlocked,
    sound: source.sound !== false,
    presses: toCount(source.presses),
    resonances: toCount(source.resonances),
    dailyDate: typeof source.dailyDate === 'string' ? source.dailyDate : base.dailyDate,
    dailyProgress: toCount(source.dailyProgress),
    dailyDone: source.dailyDone === true,
    tutorialSeen: source.tutorialSeen === true,
  };
}

export function loadState(storage: StoragePort, now: Date): SaveState {
  const raw = storage.read(SAVE_KEY);
  if (!raw) return createState(now);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return createState(now);
    const state = sanitize(parsed as Record<string, unknown>, now);
    refreshDaily(state, now);
    return state;
  } catch {
    return createState(now);
  }
}

export function saveState(storage: StoragePort, state: SaveState): void {
  try {
    storage.write(SAVE_KEY, JSON.stringify(state));
  } catch {
    // 存储失败不影响游戏本身，只是本局进度不会保留。
  }
}

/** 依据当前星尘解锁材质，返回新解锁的材质 id 列表。 */
export function unlockPalettes(state: SaveState): string[] {
  const gained: string[] = [];
  for (let i = 0; i < PALETTES.length; i += 1) {
    const palette = PALETTES[i];
    if (state.unlocked.indexOf(palette.id) >= 0) continue;
    if (state.dust < palette.unlock) continue;
    state.unlocked.push(palette.id);
    gained.push(palette.id);
  }
  return gained;
}

export function activePalette(state: SaveState) {
  return paletteById(state.paletteId);
}
