/** Predictable rhythm: 4s calm, 1s warning, 2s gust, 1s calm. */
export function cloudWind(elapsed: number): { phase: 'calm' | 'warning' | 'gust'; speed: number; remaining: number } {
  const time = elapsed % 8;
  if (time >= 4 && time < 5) return { phase: 'warning', speed: 1, remaining: 5 - time };
  if (time >= 5 && time < 7) {
    const edge = Math.min((time - 5) / .35, (7 - time) / .35, 1);
    return { phase: 'gust', speed: 1 + Math.max(0, edge) * .45, remaining: 7 - time };
  }
  return { phase: 'calm', speed: 1, remaining: time < 4 ? 4 - time : 12 - time };
}
