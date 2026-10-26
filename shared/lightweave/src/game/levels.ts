import raw from './levels.json';
import type { Level } from './types';

interface RawLevel extends Omit<Level, 'solution'> {
  readonly paths: readonly (readonly number[])[];
}

/**
 * 关卡数据。由 `npm run levels`（tools/generate-levels.mjs）生成，
 * 种子固定，重复生成结果一致。
 *
 * JSON 里只存「每种颜色的有序路径」（paths），
 * 每格颜色（solution）在加载时推导——同一份信息不存两遍。
 */
const levels: Level[] = (raw as unknown as readonly RawLevel[]).map((level) => {
  const solution: number[] = new Array(level.cols * level.rows).fill(-1);
  for (let color = 0; color < level.paths.length; color += 1) {
    const path = level.paths[color];
    for (let i = 0; i < path.length; i += 1) solution[path[i]] = color;
  }
  return { ...level, solution };
});

export const LEVELS: readonly Level[] = levels;
