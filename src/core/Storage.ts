import type { GameId } from './Game';

const prefix = 'pocket-play-best-';

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
