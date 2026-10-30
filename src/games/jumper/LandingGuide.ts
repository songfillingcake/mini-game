import { WIDTH } from '../../core/Game';

type GuidePlatform = { x: number; y: number; width: number; moving: boolean; moveSpeed: number; moveDirection: -1 | 1; broken: boolean };
export type LandingEstimate<T> = { platform: T; time: number; x: number; reachable: boolean };

/** Advisory only: descending crossing time under the game's unchanged gravity. */
export function estimateLandings<T extends GuidePlatform>(platforms: readonly T[], playerX: number, playerY: number, velocityY: number): LandingEstimate<T>[] {
  return platforms.flatMap(platform => {
    if (platform.broken) return [];
    const discriminant = velocityY * velocityY + 2 * 1120 * (platform.y - playerY - 22);
    if (discriminant < 0) return [];
    const time = (-velocityY + Math.sqrt(discriminant)) / 1120;
    if (time < .025 || time > 2) return [];
    let x = platform.x;
    if (platform.moving) {
      const range = WIDTH - platform.width - 48;
      const travel = platform.x - 24 + platform.moveDirection * platform.moveSpeed * time;
      const phase = ((travel % (range * 2)) + range * 2) % (range * 2);
      x = 24 + (phase <= range ? phase : range * 2 - phase);
    }
    const nearest = Math.max(x - 19, Math.min(x + platform.width + 19, playerX));
    // Use keyboard speed so touch steering does not make the estimate too optimistic.
    const reachable = Math.abs(nearest - playerX) <= 360 * time;
    return [{ platform, time, x, reachable }];
  }).sort((a, b) => a.time - b.time);
}
