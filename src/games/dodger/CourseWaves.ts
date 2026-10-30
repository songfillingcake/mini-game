export type WaveSpawn = { x: number; y: number; kind: 'cone' | 'star'; wave: number };
const lanes = [176, 328, 480, 632, 784];
const patterns = [
  { name: '侧移双门', openings: [2, 3] },
  { name: '阶梯三门', openings: [1, 2, 3] },
  { name: '折返三门', openings: [3, 2, 3] },
  { name: '星夜回旋', openings: [2, 1, 2, 3] },
] as const;
const laneLabels = ['左侧', '左中', '中间', '右中', '右侧'];

/** Announced two-row gates with reachable adjacent openings, separate from random traffic. */
export class CourseWaves {
  state: 'idle' | 'warning' | 'active' = 'idle';
  index = 0;
  clean = 0;
  damaged = false;
  private nextAt = 8;
  private releaseAt = 0;
  get suppressTraffic(): boolean { return this.state !== 'idle'; }
  get preview(): { x: number; label: string } {
    const wave = Math.min(3, this.state === 'active' ? this.index - 1 : this.index);
    const pattern = patterns[wave], first = pattern.openings[0];
    return { x: lanes[first], label: pattern.name + ' · 先到' + laneLabels[first] };
  }
  update(elapsed: number): WaveSpawn[] {
    if (this.index >= 4 && this.state === 'idle') return [];
    if (this.state === 'idle' && elapsed >= this.nextAt) {
      this.state = 'warning'; this.releaseAt = elapsed + 1.5;
    }
    if (this.state !== 'warning' || elapsed < this.releaseAt) return [];
    this.state = 'active'; this.index++; this.damaged = false;
    return patterns[this.index - 1].openings.flatMap((opening, row) => lanes.map((x, lane) => ({ x, y: -50 - row * 250, kind: lane === opening ? 'star' as const : 'cone' as const, wave: this.index })));
  }
  finish(): number {
    if (this.state !== 'active') return 0;
    this.state = 'idle'; this.nextAt += 12;
    if (this.damaged) return 0;
    this.clean++;
    return 60 + this.index * 10;
  }
}
