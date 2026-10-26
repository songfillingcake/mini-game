/** 0=上 1=右 2=下 3=左 */
export type Dir = 0 | 1 | 2 | 3;

/** 一对同色端点。cell 索引 = y * cols + x */
export interface LevelPair {
  readonly color: number;
  readonly a: number;
  readonly b: number;
}

/** 单向格：只能按 dir 方向穿过。 */
export interface LevelArrow {
  readonly cell: number;
  readonly dir: Dir;
}

export interface Level {
  readonly id: string;
  readonly chapter: number;
  readonly index: number;
  readonly cols: number;
  readonly rows: number;
  readonly colors: number;
  readonly pairs: readonly LevelPair[];
  readonly walls: readonly number[];
  readonly arrows: readonly LevelArrow[];
  /** 每种颜色在正解里的**有序**路径（用于提示与自检）。 */
  readonly paths: readonly (readonly number[])[];
  /** 每个格子的正确颜色，-1 表示墙；由 paths 推导。 */
  readonly solution: readonly number[];
}

export interface Chapter {
  readonly id: number;
  readonly name: string;
  readonly subtitle: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 1, name: '夜园', subtitle: '把光连起来' },
  { id: 2, name: '石径', subtitle: '绕开挡路的石头' },
  { id: 3, name: '风径', subtitle: '顺着风的方向穿行' },
];
