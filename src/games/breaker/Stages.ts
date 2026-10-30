export type BrickKind = 'normal' | 'armour' | 'blast' | 'crystal' | 'core';
export interface Brick { id: number; x: number; y: number; width: number; height: number; hp: number; maxHp: number; kind: BrickKind; cooldown: number }
export const breakerStages = [
  { name: '晨光花园', color: '#80ddbd', layout: ['..NNNNNN..', '.NNNNNNNN.', 'NN.NNNN.NN', '.C..EE..C.'] },
  { name: '珊瑚回廊', color: '#f0a391', layout: ['AANN..NNAA', '.NEE..EEN.', 'NN..AA..NN', '.C.NNNN.C.'] },
  { name: '水晶矿洞', color: '#b9a4f2', layout: ['C.AAEEAA.C', '.NNANANNN.', 'AA..CC..AA', 'N.E.NN.E.N', '..N.AA.N..'] },
  { name: '风之阶梯', color: '#9dc9ef', layout: ['A.........', 'NAE.......', '.NNAE...CC', '..NNNAE.NN', '...NNNNAAA'] },
  { name: '星海环城', color: '#e7cb84', layout: ['..AAAAAA..', '.ACNNNNCA.', 'AN.E..E.NA', '.ACNNNNCA.', '..AAAAAA..'] },
  { name: '黯星之核', color: '#f497ba', layout: ['....K.....', '..AAEEAA..', '.ACANNACA.', 'AN.EAAE.NA', '.N.N..N.N.'] },
] as const;

export function createBricks(stage: number): Brick[] {
  const bricks: Brick[] = [];
  breakerStages[stage].layout.forEach((line, row) => [...line].forEach((letter, col) => {
    if (letter === '.') return;
    const kind: BrickKind = letter === 'A' ? 'armour' : letter === 'E' ? 'blast' : letter === 'C' ? 'crystal' : letter === 'K' ? 'core' : 'normal';
    const hp = kind === 'core' ? 8 : kind === 'armour' ? 2 : 1;
    bricks.push({ id: row * 10 + col, x: 80 + col * 80, y: 100 + row * 34, width: kind === 'core' ? 154 : 74, height: 25, hp, maxHp: hp, kind, cooldown: 0 });
  }));
  return bricks;
}
export const breakerUpgrades = [
  { id: 'paddle', icon: '↔', name: '加宽挡板', detail: '永久加宽 24，最高 216' },
  { id: 'power', icon: '✦', name: '重击弹珠', detail: '每次伤害 +1，最高 3' },
  { id: 'life', icon: '♥', name: '修复营地', detail: '生命 +1，最多 5 次机会' },
] as const;
export type BreakerUpgrade = typeof breakerUpgrades[number]['id'];
