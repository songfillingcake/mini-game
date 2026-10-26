import { LEVELS } from './levels';
import type { Level } from './types';

const byChapter = new Map<number, Level[]>();
for (let i = 0; i < LEVELS.length; i += 1) {
  const level = LEVELS[i];
  const bucket = byChapter.get(level.chapter);
  if (bucket) bucket.push(level);
  else byChapter.set(level.chapter, [level]);
}

export function levelsOfChapter(chapter: number): readonly Level[] {
  return byChapter.get(chapter) ?? [];
}

export function levelCount(): number {
  return LEVELS.length;
}

export { LEVELS };
