/** 主题：只换配色与材质，不改玩法。 */
export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  readonly bgTop: string;
  readonly bgBottom: string;
  readonly cell: string;
  readonly cellEdge: string;
  readonly wall: string;
  readonly wallEdge: string;
  readonly ink: string;
  readonly accent: string;
  readonly lines: readonly [string, string, string, string, string, string];
}

export const THEMES: readonly Theme[] = [
  {
    id: 'night',
    name: '夜园',
    cost: 0,
    bgTop: '#0a0f22',
    bgBottom: '#04060f',
    cell: '#141c33',
    cellEdge: '#22304f',
    wall: '#0b1020',
    wallEdge: '#28334d',
    ink: '#e8f3ff',
    accent: '#5ee7ff',
    lines: ['#5ee7ff', '#ff8fd0', '#ffe066', '#9d8cff', '#7ef0b0', '#ff9f6e'],
  },
  {
    id: 'deepsea',
    name: '深海',
    cost: 200,
    bgTop: '#061a26',
    bgBottom: '#020a10',
    cell: '#0d2a38',
    cellEdge: '#194557',
    wall: '#04121a',
    wallEdge: '#1b4657',
    ink: '#e2fbff',
    accent: '#4bd8e8',
    lines: ['#4bd8e8', '#8affc1', '#c9f45a', '#5aa6ff', '#ff9ecb', '#ffd27a'],
  },
  {
    id: 'bamboo',
    name: '竹林',
    cost: 400,
    bgTop: '#0b1a12',
    bgBottom: '#040b07',
    cell: '#122a1c',
    cellEdge: '#1f432d',
    wall: '#07140d',
    wallEdge: '#204631',
    ink: '#eafff0',
    accent: '#9be36a',
    lines: ['#9be36a', '#ffe08a', '#6fd8c0', '#f08fb0', '#c7a6ff', '#ffb27a'],
  },
];

export function themeById(id: string): Theme {
  for (let i = 0; i < THEMES.length; i += 1) {
    if (THEMES[i].id === id) return THEMES[i];
  }
  return THEMES[0];
}
