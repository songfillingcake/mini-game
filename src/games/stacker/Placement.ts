type Span = { x: number; width: number };
/** Shared by placement resolution and its preview, before any three-perfect repair. */
export function cloudPlacement(moving: Span, target: Span, tolerance: number): { perfect: boolean; left: number; width: number } {
  const perfect = Math.abs(moving.x - target.x) <= tolerance;
  if (perfect) return { perfect, left: target.x, width: target.width };
  const left = Math.max(moving.x, target.x);
  return { perfect, left, width: Math.min(moving.x + moving.width, target.x + target.width) - left };
}
