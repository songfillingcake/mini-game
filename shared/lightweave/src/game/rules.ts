import type { Level } from './types';

/** 0=上 1=右 2=下 3=左 */
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** 拖拽时最多补多少格，防止异常输入把循环卡死。 */
const MAX_CATCH_UP = 96;

/**
 * 棋盘状态机：负责路径的新增 / 回退 / 截断，以及连通与完美的判定。
 * 纯逻辑、无渲染，便于单独测试。
 */
export class BoardState {
  readonly level: Level;
  readonly cols: number;
  readonly rows: number;
  readonly total: number;
  readonly wallCount: number;
  readonly wall: Uint8Array;
  readonly arrow: Int8Array;
  readonly endpoint: Int16Array;
  readonly mate: Int16Array;
  readonly owner: Int16Array;
  readonly paths: number[][];
  activeColor = -1;

  constructor(level: Level) {
    this.level = level;
    this.cols = level.cols;
    this.rows = level.rows;
    this.total = level.cols * level.rows;
    this.wall = new Uint8Array(this.total);
    this.arrow = new Int8Array(this.total);
    this.arrow.fill(-1);
    this.endpoint = new Int16Array(this.total);
    this.endpoint.fill(-1);
    this.mate = new Int16Array(this.total);
    this.mate.fill(-1);
    this.owner = new Int16Array(this.total);
    this.owner.fill(-1);
    this.paths = [];
    for (let i = 0; i < level.colors; i += 1) this.paths.push([]);

    let walls = 0;
    for (let i = 0; i < level.walls.length; i += 1) {
      const cell = level.walls[i];
      if (cell >= 0 && cell < this.total && !this.wall[cell]) {
        this.wall[cell] = 1;
        walls += 1;
      }
    }
    this.wallCount = walls;

    for (let i = 0; i < level.arrows.length; i += 1) {
      const arrow = level.arrows[i];
      if (arrow.cell >= 0 && arrow.cell < this.total) this.arrow[arrow.cell] = arrow.dir;
    }
    for (let i = 0; i < level.pairs.length; i += 1) {
      const pair = level.pairs[i];
      this.endpoint[pair.a] = pair.color;
      this.endpoint[pair.b] = pair.color;
      this.mate[pair.a] = pair.b;
      this.mate[pair.b] = pair.a;
    }
  }

  reset(): void {
    this.owner.fill(-1);
    for (let i = 0; i < this.paths.length; i += 1) this.paths[i].length = 0;
    this.activeColor = -1;
  }

  /** 开始编辑：命中端点开新线，命中已有线则从该格截断继续。 */
  startAt(cell: number): boolean {
    if (cell < 0 || cell >= this.total || this.wall[cell]) return false;
    const endpointColor = this.endpoint[cell];
    if (endpointColor >= 0) {
      this.clearColor(endpointColor);
      this.paths[endpointColor].push(cell);
      this.owner[cell] = endpointColor;
      this.activeColor = endpointColor;
      return true;
    }
    const owner = this.owner[cell];
    if (owner < 0) return false;
    const index = this.paths[owner].indexOf(cell);
    if (index < 0) return false;
    this.truncate(owner, index);
    this.activeColor = owner;
    return true;
  }

  /** 拖动到某个格子：自动补格、自动回退。 */
  dragTo(target: number): void {
    const color = this.activeColor;
    if (color < 0 || target < 0 || target >= this.total) return;
    for (let guard = 0; guard < MAX_CATCH_UP; guard += 1) {
      const path = this.paths[color];
      const head = path[path.length - 1];
      if (head === target) return;
      if (this.isConnected(color)) return;

      const existing = path.indexOf(target);
      if (existing >= 0) {
        this.truncate(color, existing);
        return;
      }

      const candidates = this.stepsToward(head, target);
      let advanced = false;
      for (let i = 0; i < candidates.length; i += 1) {
        if (this.extend(color, candidates[i])) {
          advanced = true;
          break;
        }
      }
      if (!advanced) return;
    }
  }

  release(): void {
    this.activeColor = -1;
  }

  isConnected(color: number): boolean {
    const path = this.paths[color];
    if (path.length < 2) return false;
    return path[path.length - 1] === this.mate[path[0]];
  }

  connectedCount(): number {
    let count = 0;
    for (let i = 0; i < this.paths.length; i += 1) if (this.isConnected(i)) count += 1;
    return count;
  }

  filledCount(): number {
    let count = 0;
    for (let i = 0; i < this.total; i += 1) if (this.owner[i] >= 0) count += 1;
    return count;
  }

  isSolved(): boolean {
    return this.connectedCount() === this.paths.length;
  }

  isPerfect(): boolean {
    return this.isSolved() && this.filledCount() === this.total - this.wallCount;
  }

  headOf(color: number): number {
    const path = this.paths[color];
    return path.length > 0 ? path[path.length - 1] : -1;
  }

  /** 某个颜色在正解里占据的格子，用于提示。 */
  solutionCells(color: number): number[] {
    const cells: number[] = [];
    const solution = this.level.solution;
    for (let i = 0; i < solution.length; i += 1) {
      if (solution[i] === color) cells.push(i);
    }
    return cells;
  }

  private clearColor(color: number): void {
    const path = this.paths[color];
    for (let i = 0; i < path.length; i += 1) this.owner[path[i]] = -1;
    path.length = 0;
  }

  private truncate(color: number, keep: number): void {
    const path = this.paths[color];
    for (let i = keep + 1; i < path.length; i += 1) this.owner[path[i]] = -1;
    path.length = keep + 1;
  }

  private extend(color: number, cell: number): boolean {
    const path = this.paths[color];
    const existing = path.indexOf(cell);
    if (existing >= 0) {
      this.truncate(color, existing);
      return true;
    }
    if (this.isConnected(color)) return false;
    const head = path[path.length - 1];
    if (!this.canEnter(color, head, cell)) return false;
    path.push(cell);
    this.owner[cell] = color;
    return true;
  }

  private canEnter(color: number, from: number, to: number): boolean {
    if (to < 0 || to >= this.total) return false;
    const fx = from % this.cols;
    const fy = (from - fx) / this.cols;
    const tx = to % this.cols;
    const ty = (to - tx) / this.cols;
    if (Math.abs(fx - tx) + Math.abs(fy - ty) !== 1) return false;
    if (this.wall[to]) return false;

    const arrow = this.arrow[to];
    if (arrow >= 0) {
      const dir = tx > fx ? 1 : tx < fx ? 3 : ty > fy ? 2 : 0;
      if (dir !== arrow) return false;
    }

    const owner = this.owner[to];
    if (owner >= 0 && owner !== color) return false;

    const endpointColor = this.endpoint[to];
    if (endpointColor >= 0 && endpointColor !== color) return false;

    return true;
  }

  /** 从 from 朝 to 走一步，返回优先尝试的 1~2 个相邻格。 */
  private stepsToward(from: number, to: number): number[] {
    const fx = from % this.cols;
    const fy = (from - fx) / this.cols;
    const tx = to % this.cols;
    const ty = (to - tx) / this.cols;
    const dx = tx - fx;
    const dy = ty - fy;

    const horizontal = dx === 0 ? -1 : from + (dx > 0 ? 1 : -1);
    const vertical = dy === 0 ? -1 : from + (dy > 0 ? this.cols : -this.cols);

    const result: number[] = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (horizontal >= 0) result.push(horizontal);
      if (vertical >= 0) result.push(vertical);
    } else {
      if (vertical >= 0) result.push(vertical);
      if (horizontal >= 0) result.push(horizontal);
    }
    return result;
  }
}

/** 供生成器与自检复用：一格到其四邻的索引。 */
export function neighbors(cell: number, cols: number, rows: number): number[] {
  const x = cell % cols;
  const y = (cell - x) / cols;
  const result: number[] = [];
  for (let d = 0; d < 4; d += 1) {
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
    result.push(ny * cols + nx);
  }
  return result;
}
