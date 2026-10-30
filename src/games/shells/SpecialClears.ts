/** Expand star-shell explosions transitively, without mutating the board. */
export function expandStarClears(seeds: readonly number[], rows: number, columns: number, isStar: (index: number) => boolean, prismKind?: (index: number) => string | undefined, kindAt?: (index: number) => string | undefined): number[] {
  const result = new Set(seeds);
  const queue = [...result];
  for (let i = 0; i < queue.length; i++) {
    const index = queue[i];
    const row = Math.floor(index / columns), col = index % columns;
    const add = (next: number): void => { if (!result.has(next)) { result.add(next); queue.push(next); } };
    if (isStar(index)) {
      for (let c = 0; c < columns; c++) add(row * columns + c);
      for (let r = 0; r < rows; r++) add(r * columns + col);
    }
    const kind = prismKind?.(index);
    if (kind && kindAt) for (let next = 0; next < rows * columns; next++) if (kindAt(next) === kind) add(next);
  }
  return [...result];
}
