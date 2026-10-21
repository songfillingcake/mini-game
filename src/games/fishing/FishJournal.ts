export type FishRarity = '常见' | '少见' | '稀有' | '传说';

export interface FishSpecies {
  id: string;
  name: string;
  icon: string;
  rarity: FishRarity;
  points: number;
  weight: number;
}

export const fishSpecies: FishSpecies[] = [
  { id: 'blue-fish', name: '小蓝鱼', icon: '🐟', rarity: '常见', points: 10, weight: 32 },
  { id: 'sunny-fish', name: '暖阳鲷', icon: '🐠', rarity: '常见', points: 12, weight: 25 },
  { id: 'crystal-shrimp', name: '水晶虾', icon: '🦐', rarity: '少见', points: 17, weight: 16 },
  { id: 'puffy-perch', name: '胖鲈鱼', icon: '🐡', rarity: '少见', points: 22, weight: 12 },
  { id: 'coral-octopus', name: '珊瑚章鱼', icon: '🐙', rarity: '稀有', points: 30, weight: 7 },
  { id: 'moon-carp', name: '银月鲤', icon: '🐟', rarity: '稀有', points: 42, weight: 5 },
  { id: 'moon-ray', name: '月光鳐', icon: '🦈', rarity: '传说', points: 65, weight: 2 },
  { id: 'star-dolphin', name: '星光海豚', icon: '🐬', rarity: '传说', points: 90, weight: 1 },
];

const storageKey = 'pocket-play-fish-journal-v1';

export function getFishCounts(): Record<string, number> {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<string, unknown>;
    return Object.fromEntries(fishSpecies.map((fish) => {
      const count = saved[fish.id];
      return [fish.id, typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0];
    }));
  } catch {
    return Object.fromEntries(fishSpecies.map((fish) => [fish.id, 0]));
  }
}

export function recordFishCatch(id: string): boolean {
  const counts = getFishCounts();
  const isNew = counts[id] === 0;
  counts[id] = (counts[id] || 0) + 1;
  try {
    localStorage.setItem(storageKey, JSON.stringify(counts));
  } catch {
    // 图鉴无法保存时，当前这一局仍可正常进行。
  }
  return isNew;
}

export function getFishJournalSummary(): { discovered: number; total: number; caught: number } {
  const counts = getFishCounts();
  return {
    discovered: fishSpecies.filter((fish) => counts[fish.id] > 0).length,
    total: fishSpecies.length,
    caught: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}
