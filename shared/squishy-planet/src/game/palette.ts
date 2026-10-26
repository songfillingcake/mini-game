/**
 * 星球材质。每种材质不仅换配色，也换软体的手感（弹性 / 阻尼），
 * 让「解锁新星球」在触感上真的有区别。
 */
export interface Palette {
  readonly id: string;
  readonly name: string;
  /** 解锁所需星尘 */
  readonly unlock: number;
  readonly skyTop: string;
  readonly skyBottom: string;
  readonly aura: string;
  readonly bodyLight: string;
  readonly bodyMid: string;
  readonly bodyDeep: string;
  readonly rim: string;
  readonly mote: string;
  readonly ink: string;
  readonly stiffness: number;
  readonly damping: number;
}

export const PALETTES: readonly Palette[] = [
  {
    id: 'peach',
    name: '蜜桃奶冻',
    unlock: 0,
    skyTop: '#2a1b31',
    skyBottom: '#0d0d1c',
    aura: '#ff9ec4',
    bodyLight: '#fff0f5',
    bodyMid: '#ffb7ce',
    bodyDeep: '#e0729d',
    rim: '#fff7fb',
    mote: '#ffd2e5',
    ink: '#4a2133',
    stiffness: 120,
    damping: 8.4,
  },
  {
    id: 'mint',
    name: '薄荷云朵',
    unlock: 150,
    skyTop: '#122a2d',
    skyBottom: '#080f1b',
    aura: '#8ff5d2',
    bodyLight: '#eefff9',
    bodyMid: '#a9f0d8',
    bodyDeep: '#59bda6',
    rim: '#f5fffc',
    mote: '#bbffe8',
    ink: '#123b33',
    stiffness: 96,
    damping: 7.2,
  },
  {
    id: 'starsea',
    name: '星海果冻',
    unlock: 450,
    skyTop: '#171d3f',
    skyBottom: '#06070f',
    aura: '#8aa8ff',
    bodyLight: '#eef2ff',
    bodyMid: '#aabaff',
    bodyDeep: '#6473d6',
    rim: '#f7faff',
    mote: '#c5d3ff',
    ink: '#1b2350',
    stiffness: 150,
    damping: 7.8,
  },
  {
    id: 'sunset',
    name: '落日布丁',
    unlock: 900,
    skyTop: '#2d1a1c',
    skyBottom: '#120c11',
    aura: '#ffb37a',
    bodyLight: '#fff2e0',
    bodyMid: '#ffc98f',
    bodyDeep: '#dd8752',
    rim: '#fff8ee',
    mote: '#ffdbaa',
    ink: '#4a2a15',
    stiffness: 108,
    damping: 9.2,
  },
  {
    id: 'aurora',
    name: '极光沙沙',
    unlock: 1600,
    skyTop: '#101f31',
    skyBottom: '#05080f',
    aura: '#7ef0ff',
    bodyLight: '#eafdff',
    bodyMid: '#9fe6f7',
    bodyDeep: '#4a9fc2',
    rim: '#f2feff',
    mote: '#baf5ff',
    ink: '#123341',
    stiffness: 84,
    damping: 6.6,
  },
];

export function paletteById(id: string): Palette {
  for (let i = 0; i < PALETTES.length; i += 1) {
    if (PALETTES[i].id === id) return PALETTES[i];
  }
  return PALETTES[0];
}

export function findPaletteIndex(id: string): number {
  for (let i = 0; i < PALETTES.length; i += 1) {
    if (PALETTES[i].id === id) return i;
  }
  return 0;
}

/** 返回下一个尚未解锁的材质，全部解锁时返回 undefined。 */
export function nextLockedPalette(dust: number, unlocked: readonly string[]): Palette | undefined {
  for (let i = 0; i < PALETTES.length; i += 1) {
    const palette = PALETTES[i];
    if (palette.unlock > dust || unlocked.indexOf(palette.id) >= 0) continue;
    return palette;
  }
  return undefined;
}
