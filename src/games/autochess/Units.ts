export type Faction = 'forest' | 'iron' | 'star' | 'wind';
export type Skill = 'shield' | 'heal' | 'volley' | 'nova' | 'stun' | 'snipe';
export interface UnitDefinition {
  id: string; name: string; icon: string; faction: Faction; cost: number;
  hp: number; attack: number; armor: number; range: number; interval: number;
  skill: Skill; skillName: string; detail: string;
}
export const factions: Record<Faction, { name: string; icon: string; color: string; detail: string }> = {
  forest: { name: '森灵', icon: '🌿', color: '#72b898', detail: '2 / 3 种：每秒回复 1.5% / 3% 最大生命' },
  iron: { name: '磐甲', icon: '🛡️', color: '#91a9c4', detail: '2 / 3 种：护甲 +12 / +24' },
  star: { name: '星辉', icon: '✨', color: '#b69ae3', detail: '2 / 3 种：技能效果 +30% / +65%' },
  wind: { name: '逐风', icon: '🍃', color: '#d4ba76', detail: '2 / 3 种：攻击速度 +20% / +40%' },
};
export const unitDefinitions: readonly UnitDefinition[] = [
  { id: 'moss', name: '苔石卫士', icon: '🐢', faction: 'forest', cost: 1, hp: 350, attack: 25, armor: 16, range: 1, interval: 1.15, skill: 'shield', skillName: '苔石护盾', detail: '获得最大生命 35% 的护盾。' },
  { id: 'fox', name: '林间弓手', icon: '🦊', faction: 'forest', cost: 1, hp: 205, attack: 34, armor: 3, range: 3, interval: 1.0, skill: 'volley', skillName: '飞叶连射', detail: '向最多 3 个敌人各造成 160% 攻击伤害。' },
  { id: 'deer', name: '森鹿祭司', icon: '🦌', faction: 'forest', cost: 3, hp: 290, attack: 29, armor: 6, range: 3, interval: 1.1, skill: 'heal', skillName: '林泉祝福', detail: '为生命比例最低的两名友军回复 90 点生命。' },
  { id: 'boar', name: '铁甲先锋', icon: '🐗', faction: 'iron', cost: 1, hp: 380, attack: 29, armor: 20, range: 1, interval: 1.25, skill: 'stun', skillName: '重盾冲击', detail: '重击目标造成 220% 攻击伤害，并眩晕 1.3 秒。' },
  { id: 'badger', name: '岩锤工匠', icon: '🦡', faction: 'iron', cost: 2, hp: 390, attack: 39, armor: 15, range: 1, interval: 1.05, skill: 'nova', skillName: '震地重锤', detail: '对目标及相邻敌人造成 230% 攻击伤害。' },
  { id: 'owl', name: '铜羽哨兵', icon: '🦉', faction: 'iron', cost: 3, hp: 285, attack: 48, armor: 10, range: 4, interval: 1.1, skill: 'snipe', skillName: '贯星之矢', detail: '对最远的敌人造成 400% 攻击伤害。' },
  { id: 'cat', name: '星火学徒', icon: '🐱', faction: 'star', cost: 1, hp: 200, attack: 30, armor: 3, range: 3, interval: 1.15, skill: 'nova', skillName: '星火绽放', detail: '对目标及相邻敌人造成 230% 攻击伤害。' },
  { id: 'rabbit', name: '月铃使者', icon: '🐰', faction: 'star', cost: 2, hp: 265, attack: 30, armor: 5, range: 3, interval: 1.05, skill: 'heal', skillName: '月铃回响', detail: '为生命比例最低的两名友军回复 90 点生命。' },
  { id: 'dragon', name: '星穹幼龙', icon: '🐉', faction: 'star', cost: 3, hp: 400, attack: 46, armor: 9, range: 2, interval: 1.15, skill: 'nova', skillName: '星穹吐息', detail: '对目标及相邻敌人造成 230% 攻击伤害。' },
  { id: 'wolf', name: '疾风斥候', icon: '🐺', faction: 'wind', cost: 1, hp: 280, attack: 35, armor: 6, range: 1, interval: 0.8, skill: 'stun', skillName: '掠影扑击', detail: '重击目标造成 220% 攻击伤害，并眩晕 1.3 秒。' },
  { id: 'eagle', name: '飞羽猎手', icon: '🦅', faction: 'wind', cost: 2, hp: 230, attack: 41, armor: 4, range: 4, interval: 0.9, skill: 'volley', skillName: '疾风箭雨', detail: '向最多 3 个敌人各造成 160% 攻击伤害。' },
  { id: 'tiger', name: '岚牙剑客', icon: '🐯', faction: 'wind', cost: 3, hp: 440, attack: 50, armor: 11, range: 1, interval: 0.85, skill: 'shield', skillName: '风障剑意', detail: '获得最大生命 35% 的护盾。' },
];
export const unitById = Object.fromEntries(unitDefinitions.map((unit) => [unit.id, unit])) as Record<string, UnitDefinition>;
export const guardian: UnitDefinition = { id: 'guardian', name: '黯星守门者', icon: '👑', faction: 'star', cost: 0, hp: 1250, attack: 64, armor: 24, range: 2, interval: 1.0, skill: 'nova', skillName: '黯星风暴', detail: '轰击目标附近的敌人。' };
export interface Piece { uid: string; type: string; star: number; cell: number | null }
export interface Relics { attack: number; armor: number; health: number; speed: number }
export const emptyRelics = (): Relics => ({ attack: 0, armor: 0, health: 0, speed: 0 });
export function synergyCounts(pieces: readonly Pick<Piece, 'type'>[]): Record<Faction, number> {
  const result: Record<Faction, number> = { forest: 0, iron: 0, star: 0, wind: 0 };
  for (const id of new Set(pieces.map((piece) => piece.type))) {
    const definition = unitById[id] || (id === guardian.id ? guardian : null);
    if (definition) result[definition.faction] += 1;
  }
  return result;
}
export const starMultiplier = (star: number): number => [1, 1.9, 3.6][star - 1] || 1;
export const sellValue = (piece: Piece): number => unitById[piece.type].cost * 3 ** (piece.star - 1);

export const encounterNames = ['林间试炼', '铁甲小队', '逐风哨站', '月铃守望', '星火营地', '双阵夹击', '星穹近卫', '黯星之门'];
const encounters: [string, number, number][][] = [
  [['moss', 1, 8], ['cat', 1, 3]],
  [['boar', 1, 8], ['wolf', 1, 9], ['fox', 1, 3]],
  [['wolf', 2, 8], ['eagle', 1, 2], ['wolf', 1, 10]],
  [['moss', 2, 8], ['boar', 1, 9], ['rabbit', 1, 2], ['fox', 1, 3]],
  [['boar', 2, 8], ['badger', 2, 9], ['cat', 2, 2], ['eagle', 1, 4]],
  [['tiger', 2, 7], ['moss', 2, 9], ['fox', 2, 2], ['deer', 1, 3], ['rabbit', 1, 4]],
  [['boar', 2, 7], ['badger', 2, 9], ['dragon', 2, 10], ['cat', 2, 1], ['rabbit', 2, 3]],
  [['guardian', 1, 8], ['moss', 2, 7], ['wolf', 2, 10], ['cat', 2, 2], ['rabbit', 1, 4]],
];
export function enemiesForRound(round: number): Piece[] {
  return encounters[round - 1].map(([type, star, cell], index) => ({ uid: 'enemy-' + index, type, star, cell }));
}
