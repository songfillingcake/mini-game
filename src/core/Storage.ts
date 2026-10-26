import type { GameId } from './Game';
import { AUTO_CHESS_SAVE_KEY, parseRun } from '../games/autochess/AutoChessModel';

const prefix = 'pocket-play-best-';
const soundKey = 'pocket-play-sound-enabled';
const fishJournalKey = 'pocket-play-fish-journal-v1';
const fishingBaitKey = 'pocket-play-fishing-bait-v1';
const fishingZoneKey = 'pocket-play-fishing-zone-v1';
const fishingProgressKey = 'pocket-play-fishing-progress-v1';
const shellGameBestKey = prefix + 'shells';
const stackerGameBestKey = prefix + 'stacker';
const autoChessBestKey = prefix + 'autochess';
const saveKeys = [
  prefix + 'fishing',
  prefix + 'dodger',
  prefix + 'jumper',
  shellGameBestKey,
  stackerGameBestKey,
  autoChessBestKey,
  prefix + 'extraction',
  AUTO_CHESS_SAVE_KEY,
  soundKey,
  fishJournalKey,
  fishingBaitKey,
  fishingZoneKey,
  fishingProgressKey,
] as const;
const saveFormat = 'pocket-play-save';

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidSaveValue(key: typeof saveKeys[number], value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string' || value.length > 262_144) return false;
  if (key.startsWith(prefix)) {
    const score = Number(value);
    return Number.isFinite(score) && score >= 0 && score <= 1_000_000_000;
  }
  if (key === soundKey) return value === 'true' || value === 'false';
  if (key === fishingBaitKey) return value === 'crumbs' || value === 'glow' || value === 'shrimp' || value === 'echo' || value === 'cloud' || value === 'starlight';
  if (key === fishingZoneKey) return value === 'lake' || value === 'reef' || value === 'moon' || value === 'aurora';
  if (key === AUTO_CHESS_SAVE_KEY) return parseRun(value) !== null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isObject(parsed)) return false;
    if (key === fishJournalKey) {
      return Object.entries(parsed).every(([id, count]) => /^[a-z][a-z0-9-]*$/.test(id) && typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 1_000_000);
    }
    const shells = parsed.shells;
    return shells === undefined || (typeof shells === 'number' && Number.isInteger(shells) && shells >= 0 && shells <= 1_000_000);
  } catch {
    return false;
  }
}

export function getBest(id: GameId): number {
  try {
    return Number(localStorage.getItem(prefix + id)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(id: GameId, score: number): number {
  const best = Math.max(getBest(id), Math.floor(score));
  try {
    localStorage.setItem(prefix + id, String(best));
  } catch {
    // 游戏仍可正常进行，只是不保存本次纪录。
  }
  return best;
}

export function getSoundEnabled(): boolean {
  try {
    return localStorage.getItem(soundKey) !== 'false';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(soundKey, String(enabled));
  } catch {
    // 静音偏好只在浏览器允许时保存。
  }
}

export function exportSaveBackup(): string {
  const data = Object.fromEntries(saveKeys.map((key) => [key, localStorage.getItem(key)]));
  return JSON.stringify({ format: saveFormat, version: 5, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function importSaveBackup(serialized: string): boolean {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isObject(parsed) || parsed.format !== saveFormat || (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4 && parsed.version !== 5) || !isObject(parsed.data)) return false;
    const data = parsed.data;
    const keys = Object.keys(data);
    const expectedKeys = saveKeys.filter((key) => {
      if (parsed.version === 1 && key === shellGameBestKey) return false;
      if ((parsed.version === 1 || parsed.version === 2) && key === stackerGameBestKey) return false;
      if (parsed.version !== 4 && parsed.version !== 5 && (key === autoChessBestKey || key === AUTO_CHESS_SAVE_KEY)) return false;
      if (parsed.version !== 5 && key === prefix + 'extraction') return false;
      return true;
    });
    if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(data, key))) return false;
    if (!expectedKeys.every((key) => isValidSaveValue(key, data[key]))) return false;

    const previous = Object.fromEntries(saveKeys.map((key) => [key, localStorage.getItem(key)]));
    try {
      for (const key of expectedKeys) {
        const value = data[key];
        if (typeof value === 'string') localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      }
      return true;
    } catch {
      for (const key of saveKeys) {
        try {
          const value = previous[key];
          if (typeof value === 'string') localStorage.setItem(key, value);
          else localStorage.removeItem(key);
        } catch {
          // A storage failure may prevent rollback, but must not crash the game.
        }
      }
      return false;
    }
  } catch {
    return false;
  }
}
