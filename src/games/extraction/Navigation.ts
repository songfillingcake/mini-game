import { MAP, walls, type Vec } from './Content';

const clearance = 21;
const length = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Segment visibility against expanded walls, including the enemy's body radius. */
export function traversable(a: Vec, b: Vec): boolean {
  for (const w of walls) {
    let enter = 0, leave = 1;
    const slabs = [
      [a.x, b.x - a.x, w.x - clearance, w.x + w.w + clearance],
      [a.y, b.y - a.y, w.y - clearance, w.y + w.h + clearance],
    ];
    let intersects = true;
    for (const [origin, delta, min, max] of slabs) {
      if (Math.abs(delta) < 1e-8) { if (origin < min || origin > max) { intersects = false; break; } }
      else {
        const first = (min - origin) / delta, last = (max - origin) / delta;
        enter = Math.max(enter, Math.min(first, last)); leave = Math.min(leave, Math.max(first, last));
        if (enter > leave) { intersects = false; break; }
      }
    }
    if (intersects) return false;
  }
  return true;
}

/** Static corner graph, with one shared reverse shortest-path field per player position. */
export class ExtractionNavigation {
  private nodes: Vec[];
  private edges: { to: number; cost: number }[][];
  private costs: number[] = [];
  private clock = 0;
  private goal: Vec = { x: -1000, y: -1000 };

  constructor() {
    const margin = clearance + 3;
    this.nodes = walls.flatMap(w => [
      { x: w.x - margin, y: w.y - margin }, { x: w.x + w.w + margin, y: w.y - margin },
      { x: w.x - margin, y: w.y + w.h + margin }, { x: w.x + w.w + margin, y: w.y + w.h + margin },
    ]).filter(p => p.x > clearance && p.y > clearance && p.x < MAP.width - clearance && p.y < MAP.height - clearance && traversable(p, p));
    this.edges = this.nodes.map((a, i) => this.nodes.flatMap((b, j) => i !== j && traversable(a, b) ? [{ to: j, cost: length(a, b) }] : []));
  }

  update(goal: Vec, dt: number): void {
    this.clock -= dt;
    if (this.costs.length && this.clock > 0) return;
    if (this.costs.length && length(goal, this.goal) < 12) return;
    this.clock = .25; this.goal = { ...goal };
    this.costs = this.nodes.map(p => traversable(p, goal) ? length(p, goal) : Infinity);
    const visited = new Set<number>();
    // Dijkstra from the goal. With <=40 static nodes a linear queue is sufficient.
    for (let count = 0; count < this.nodes.length; count++) {
      let at = -1, best = Infinity;
      for (let i = 0; i < this.nodes.length; i++) if (!visited.has(i) && this.costs[i] < best) { at = i; best = this.costs[i]; }
      if (at < 0) break;
      visited.add(at);
      for (const edge of this.edges[at]) this.costs[edge.to] = Math.min(this.costs[edge.to], best + edge.cost);
    }
  }

  waypoint(from: Vec, target: Vec): Vec {
    if (traversable(from, target)) return target;
    let result = from, best = Infinity;
    this.nodes.forEach((p, i) => {
      const travel = length(from, p);
      if (travel < 1.5) return;
      const cost = travel + this.costs[i];
      if (cost < best && traversable(from, p)) { result = p; best = cost; }
    });
    // The player can squeeze closer to walls than an enemy. In that case approach
    // a visible corner near the player instead of becoming stuck with no path.
    if (result === from) this.nodes.forEach(p => {
      if (length(from, p) < 1.5) return;
      const cost = length(from, p) + length(p, target) * 2;
      if (cost < best && traversable(from, p)) { result = p; best = cost; }
    });
    return result;
  }
}
