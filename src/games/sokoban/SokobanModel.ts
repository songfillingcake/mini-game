import { boxIslands } from './Islands';
export type Cell = { x: number; y: number };
const key = (cell: Cell): string => cell.x + ':' + cell.y;
type Snapshot = { player: Cell; crates: Cell[]; moves: number; pushes: number };

/** Discrete board rules and reversible snapshots, independent of the UI. */
export class SokobanModel {
  stage = 0;
  phase: 'playing' | 'cleared' | 'won' = 'playing';
  player: Cell = { x: 0, y: 0 };
  crates: Cell[] = [];
  goals = new Set<string>();
  walls = new Set<string>();
  width = 0;
  height = 0;
  moves = 0;
  pushes = 0;
  score = 0;
  totalMoves = 0;
  message = '把所有箱子推到金色目标格';
  history: Snapshot[] = [];
  constructor() { this.load(); }
  get covered(): number { return this.crates.filter(c => this.goals.has(key(c))).length; }
  get over(): boolean { return this.phase === 'won'; }
  isWall(x: number, y: number): boolean { return x < 0 || y < 0 || x >= this.width || y >= this.height || this.walls.has(key({ x, y })); }
  isGoal(cell: Cell): boolean { return this.goals.has(key(cell)); }
  isCorner(cell: Cell): boolean {
    if (this.isGoal(cell)) return false;
    return (this.isWall(cell.x - 1, cell.y) || this.isWall(cell.x + 1, cell.y)) && (this.isWall(cell.x, cell.y - 1) || this.isWall(cell.x, cell.y + 1));
  }
  private load(): void {
    const rows = boxIslands[this.stage].rows;
    this.width = Math.max(...rows.map(row => row.length)); this.height = rows.length;
    this.walls = new Set(); this.goals = new Set(); this.crates = []; this.history = [];
    this.moves = 0; this.pushes = 0; this.phase = 'playing'; this.message = '把所有箱子推到金色目标格';
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const symbol = rows[y][x] ?? '#', cell = { x, y };
      if (symbol === '#') this.walls.add(key(cell));
      if (symbol === '.') this.goals.add(key(cell));
      if (symbol === '$') this.crates.push(cell);
      if (symbol === '@') this.player = cell;
    }
  }
  move(dx: number, dy: number): 'blocked' | 'walk' | 'push' | 'clear' {
    if (this.phase !== 'playing' || Math.abs(dx) + Math.abs(dy) !== 1) return 'blocked';
    const next = { x: this.player.x + dx, y: this.player.y + dy };
    if (this.isWall(next.x, next.y)) return 'blocked';
    const crate = this.crates.find(c => c.x === next.x && c.y === next.y);
    const beyond = { x: next.x + dx, y: next.y + dy };
    if (crate && (this.isWall(beyond.x, beyond.y) || this.crates.some(c => key(c) === key(beyond)))) return 'blocked';
    this.history.push({ player: { ...this.player }, crates: this.crates.map(c => ({ ...c })), moves: this.moves, pushes: this.pushes });
    if (this.history.length > 300) this.history.shift();
    this.player = next; this.moves++;
    if (crate) { crate.x = beyond.x; crate.y = beyond.y; this.pushes++; }
    this.message = crate && this.isCorner(crate) ? '箱子进了角落 · 空格可撤回' : '把所有箱子推到金色目标格';
    if (this.covered === this.goals.size) {
      this.totalMoves += this.moves; this.score += 200 + Math.max(0, 100 - this.moves * 3);
      this.phase = this.stage === boxIslands.length - 1 ? 'won' : 'cleared';
      this.message = '小岛完成！点击下一岛或按空格'; return 'clear';
    }
    return crate ? 'push' : 'walk';
  }
  undo(): boolean {
    if (this.phase !== 'playing') return false;
    const previous = this.history.pop(); if (!previous) return false;
    this.player = previous.player; this.crates = previous.crates; this.moves = previous.moves; this.pushes = previous.pushes;
    this.message = '已撤回一步'; return true;
  }
  restart(): void { if (this.phase === 'playing') this.load(); }
  next(): void { if (this.phase === 'cleared') { this.stage++; this.load(); } }
}
