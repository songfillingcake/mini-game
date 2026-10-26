import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'game', 'levels.json');

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const MIN_SEGMENT = 3;

/** 每章的生成参数。单向格暂不生成（见 README 的说明）。 */
const CHAPTERS = [
  { chapter: 1, cols: 5, rows: 7, colors: 4, walls: 0, levels: 24 },
  { chapter: 2, cols: 5, rows: 8, colors: 5, walls: 3, levels: 24 },
  { chapter: 3, cols: 6, rows: 9, colors: 6, walls: 4, levels: 24 },
];

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

function neighborsOf(cell, cols, rows) {
  const x = cell % cols;
  const y = (cell - x) / cols;
  const result = [];
  for (let d = 0; d < 4; d += 1) {
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
    result.push(ny * cols + nx);
  }
  return result;
}

/** 在去掉墙之后的格子上找一条覆盖全部剩余格子的哈密顿路径。 */
function hamiltonian(cols, rows, wallSet, rng) {
  const total = cols * rows;
  const free = [];
  for (let i = 0; i < total; i += 1) if (!wallSet.has(i)) free.push(i);
  if (free.length === 0) return null;

  const visited = new Uint8Array(total);
  const stack = [];
  let steps = 0;
  let aborted = false;

  const dfs = (cell) => {
    if (aborted) return false;
    steps += 1;
    if (steps > 240_000) {
      aborted = true;
      return false;
    }
    visited[cell] = 1;
    stack.push(cell);
    if (stack.length === free.length) return true;

    const options = [];
    const neighbors = neighborsOf(cell, cols, rows);
    for (let i = 0; i < neighbors.length; i += 1) {
      const next = neighbors[i];
      if (!visited[next] && !wallSet.has(next)) options.push(next);
    }
    shuffle(options, rng);
    for (let i = 0; i < options.length; i += 1) {
      if (dfs(options[i])) return true;
    }
    visited[cell] = 0;
    stack.pop();
    return false;
  };

  const starts = shuffle(free.slice(), rng);
  const maxStarts = Math.min(starts.length, 8);
  for (let i = 0; i < maxStarts; i += 1) {
    stack.length = 0;
    visited.fill(0);
    steps = 0;
    aborted = false;
    if (dfs(starts[i])) return stack.slice();
    if (aborted) return null;
  }
  return null;
}

function cutIntoSegments(path, colors, rng) {
  const n = path.length;
  if (n < colors * MIN_SEGMENT) return null;
  const lengths = new Array(colors).fill(MIN_SEGMENT);
  let rest = n - colors * MIN_SEGMENT;
  while (rest > 0) {
    lengths[Math.floor(rng() * colors)] += 1;
    rest -= 1;
  }
  shuffle(lengths, rng);

  const segments = [];
  let cursor = 0;
  for (let i = 0; i < colors; i += 1) {
    segments.push(path.slice(cursor, cursor + lengths[i]));
    cursor += lengths[i];
  }
  return segments;
}

function validate(level) {
  const total = level.cols * level.rows;
  const walls = new Set(level.walls);
  const seen = new Set();
  for (let color = 0; color < level.paths.length; color += 1) {
    const path = level.paths[color];
    if (path.length < MIN_SEGMENT) return `颜色 ${color} 只有 ${path.length} 格`;
    for (let i = 0; i < path.length; i += 1) {
      const cell = path[i];
      if (cell < 0 || cell >= total) return `颜色 ${color} 越界 ${cell}`;
      if (walls.has(cell)) return `颜色 ${color} 压到墙 ${cell}`;
      if (seen.has(cell)) return `格子 ${cell} 被重复占用`;
      seen.add(cell);
      if (i > 0) {
        const prev = path[i - 1];
        const gap =
          Math.abs((prev % level.cols) - (cell % level.cols)) +
          Math.abs(Math.floor(prev / level.cols) - Math.floor(cell / level.cols));
        if (gap !== 1) return `颜色 ${color} 的路径不连续`;
      }
    }
    const pair = level.pairs[color];
    if (pair.a !== path[0] || pair.b !== path[path.length - 1]) return `颜色 ${color} 的端点不匹配`;
  }
  if (seen.size !== total - walls.size) return `没有覆盖全部空格（${seen.size}/${total - walls.size}）`;
  return null;
}

function generateLevel(config, index, rng) {
  const { cols, rows, colors } = config;
  const total = cols * rows;
  const wallCount = config.walls + (index % 3);

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const wallSet = new Set();
    let guard = 0;
    while (wallSet.size < wallCount && guard < 600) {
      wallSet.add(Math.floor(rng() * total));
      guard += 1;
    }
    const path = hamiltonian(cols, rows, wallSet, rng);
    if (!path) continue;
    const segments = cutIntoSegments(path, colors, rng);
    if (!segments) continue;

    const pairs = [];
    for (let color = 0; color < segments.length; color += 1) {
      const segment = segments[color];
      pairs.push({ color, a: segment[0], b: segment[segment.length - 1] });
    }

    const level = {
      id: `${config.chapter}-${String(index + 1).padStart(2, '0')}`,
      chapter: config.chapter,
      index,
      cols,
      rows,
      colors,
      pairs,
      walls: Array.from(wallSet).sort((a, b) => a - b),
      arrows: [],
      paths: segments,
    };
    const problem = validate(level);
    if (problem) continue;
    return level;
  }
  return null;
}

function toJson(levels) {
  return `${JSON.stringify(levels)}\n`;
}

const all = [];
for (const config of CHAPTERS) {
  for (let index = 0; index < config.levels; index += 1) {
    const seed = config.chapter * 100_003 + index * 7919 + 17;
    const level = generateLevel(config, index, mulberry32(seed));
    if (!level) {
      console.error(`✖ 第 ${config.chapter} 章第 ${index + 1} 关生成失败`);
      process.exitCode = 1;
    } else {
      all.push(level);
    }
  }
}

if (process.exitCode) process.exit();

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, toJson(all), 'utf8');
console.log(`✔ 生成 ${all.length} 关 → ${path.relative(ROOT, OUT)}`);
for (const config of CHAPTERS) {
  const count = all.filter((level) => level.chapter === config.chapter).length;
  console.log(`  第 ${config.chapter} 章 ${config.cols}×${config.rows} · ${config.colors} 色 · ${count} 关`);
}
