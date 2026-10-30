import type { FishRarity } from './FishJournal';

export const fishingSpots = [
  { id: 'spot-open', label: '开阔水面', icon: '🌊', detail: '均衡鱼群，保持原有收线节奏', safeBonus: 0, timeBonus: 0, pullScale: 1 },
  { id: 'spot-reeds', label: '芦苇浅滩', icon: '🌿', detail: '常见鱼更多，绿区更宽、收线多 1 秒', safeBonus: .02, timeBonus: 1, pullScale: 1 },
  { id: 'spot-deep', label: '深水外沿', icon: '🔷', detail: '稀有鱼机会提升，拉力更大、收线少 1 秒', safeBonus: 0, timeBonus: -1, pullScale: 1.08 },
] as const;
export type FishingSpotId = typeof fishingSpots[number]['id'];
export function getFishingSpot(id: FishingSpotId): typeof fishingSpots[number] { return fishingSpots.find(spot => spot.id === id) || fishingSpots[0]; }
export function fishingSpotWeight(id: FishingSpotId, rarity: FishRarity): number {
  if (id === 'spot-reeds') return rarity === '常见' ? 1.4 : rarity === '稀有' || rarity === '传说' ? .8 : 1;
  if (id === 'spot-deep') return rarity === '稀有' || rarity === '传说' ? 1.45 : rarity === '常见' ? .75 : 1;
  return 1;
}
