import type { StoragePort } from '@pocket-play/engine';
import { THEMES } from './themes';

export const SAVE_KEY = 'lightweave/save/v1';

export interface Progress {
  version: 1;
  /** levelId → 1~3 星 */
  stars: Record<string, number>;
  dust: number;
  theme: string;
  owned: string[];
}

export function createProgress(): Progress {
  return {
    version: 1,
    stars: {},
    dust: 0,
    theme: THEMES[0].id,
    owned: [THEMES[0].id],
  };
}

export function totalStars(progress: Progress): number {
  let total = 0;
  const ids = Object.keys(progress.stars);
  for (let i = 0; i < ids.length; i += 1) total += progress.stars[ids[i]] || 0;
  return total;
}

export function loadProgress(storage: StoragePort): Progress {
  const raw = storage.read(SAVE_KEY);
  if (!raw) return createProgress();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return createProgress();
    const source = parsed as Record<string, unknown>;
    const progress = createProgress();

    if (source.stars && typeof source.stars === 'object' && !Array.isArray(source.stars)) {
      const entries = Object.entries(source.stars as Record<string, unknown>);
      for (let i = 0; i < entries.length; i += 1) {
        const [id, value] = entries[i];
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        const stars = Math.max(0, Math.min(3, Math.floor(value)));
        if (stars > 0) progress.stars[id] = stars;
      }
    }
    if (typeof source.dust === 'number' && Number.isFinite(source.dust)) {
      progress.dust = Math.max(0, Math.min(9_999_999, Math.floor(source.dust)));
    }
    if (Array.isArray(source.owned)) {
      for (let i = 0; i < source.owned.length; i += 1) {
        const id = source.owned[i];
        if (typeof id !== 'string') continue;
        if (THEMES.some((theme) => theme.id === id) && progress.owned.indexOf(id) < 0) progress.owned.push(id);
      }
    }
    if (typeof source.theme === 'string' && progress.owned.indexOf(source.theme) >= 0) {
      progress.theme = source.theme;
    }
    return progress;
  } catch {
    return createProgress();
  }
}

export function saveProgress(storage: StoragePort, progress: Progress): void {
  try {
    storage.write(SAVE_KEY, JSON.stringify(progress));
  } catch {
    // 存储失败不影响本局。
  }
}
