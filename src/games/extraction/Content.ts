// Pure content: no browser APIs or mutable run state.
export type Vec = { x: number; y: number };
export type Wall = Vec & { w: number; h: number };
export type RelicId = 'coin' | 'bell' | 'ice' | 'bag' | 'crown' | 'heart';
export const relics: Record<RelicId, { name: string; glyph: string; color: string; value: number; weight: number; effect: string }> = {
  coin: { name: '古金币', glyph: '◆', color: '#efcc76', value: 80, weight: 1, effect: '轻巧的稳定收益' },
  bell: { name: '黄金大钟', glyph: '♜', color: '#ffb658', value: 320, weight: 3, effect: '每隔 8 秒敲响，吸引远处敌人' },
  ice: { name: '冰霜宝箱', glyph: '❄', color: '#90e4f1', value: 220, weight: 2, effect: '移动时留下减速追兵的冰面' },
  bag: { name: '贪吃宝袋', glyph: '◈', color: '#c0a0ff', value: 160, weight: 2, effect: '拾取其他宝物后增值，自身体积增大' },
  crown: { name: '雷电王冠', glyph: '♛', color: '#eee681', value: 280, weight: 2, effect: '受伤时雷击周围敌人' },
  heart: { name: '生命琥珀', glyph: '♥', color: '#ff9caa', value: 140, weight: 1, effect: '携带时缓慢恢复生命' },
};
export const MAP = { width: 1800, height: 1200, duration: 300, capacity: 10, exit: { x: 150, y: 1020, radius: 82 } };
export const walls: Wall[] = [
  { x: 350, y: 780, w: 180, h: 95 }, { x: 650, y: 920, w: 100, h: 170 },
  { x: 260, y: 470, w: 110, h: 180 }, { x: 550, y: 430, w: 260, h: 90 },
  { x: 920, y: 690, w: 100, h: 240 }, { x: 1210, y: 890, w: 240, h: 100 },
  { x: 1080, y: 350, w: 260, h: 100 }, { x: 1440, y: 520, w: 100, h: 210 },
  { x: 650, y: 160, w: 120, h: 160 }, { x: 1470, y: 140, w: 170, h: 110 },
];
export const lootSpawns: (Vec & { type: RelicId })[] = [
  { x: 280, y: 970, type: 'coin' }, { x: 440, y: 1020, type: 'heart' },
  { x: 460, y: 650, type: 'ice' }, { x: 820, y: 820, type: 'coin' },
  { x: 870, y: 350, type: 'bag' }, { x: 1140, y: 600, type: 'crown' },
  { x: 1560, y: 340, type: 'bell' }, { x: 1550, y: 1040, type: 'coin' },
  { x: 410, y: 250, type: 'coin' }, { x: 1120, y: 160, type: 'heart' },
  { x: 1630, y: 810, type: 'ice' }, { x: 900, y: 1060, type: 'coin' },
];
