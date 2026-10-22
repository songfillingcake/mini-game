import { clamp, drawText, HEIGHT, roundedRect, WIDTH } from '../../core/Game';
import { audio } from '../../core/Audio';
import type { GameControls, MiniGame } from '../../core/Game';

type ShellKind = 'shell' | 'bubble' | 'coral' | 'kelp' | 'pearl' | 'fish';

interface Gem {
  kind: ShellKind;
  starShell: boolean;
}

interface Cell {
  row: number;
  col: number;
}

interface MatchResult {
  indexes: number[];
  specialIndex: number | null;
}

const boardRows = 7;
const boardColumns = 7;
export const SHELL_SCORE_STAR_THRESHOLDS = [180, 450, 850] as const;
const tileSize = 48;
const tileGap = 7;
const tileStep = tileSize + tileGap;
const boardSize = boardColumns * tileSize + (boardColumns - 1) * tileGap;
const boardX = (WIDTH - boardSize) / 2;
const boardY = 94;
const kinds: ShellKind[] = ['shell', 'bubble', 'coral', 'kelp', 'pearl', 'fish'];
const gemStyle: Record<ShellKind, { icon: string; fill: string; ink: string }> = {
  shell: { icon: '🐚', fill: '#f5e2cb', ink: '#a66c53' },
  bubble: { icon: '🫧', fill: '#d8eef0', ink: '#4c91a0' },
  coral: { icon: '🪸', fill: '#f6ded4', ink: '#bd6e68' },
  kelp: { icon: '🌿', fill: '#e0edd7', ink: '#568169' },
  pearl: { icon: '💎', fill: '#e6e0f1', ink: '#8170a8' },
  fish: { icon: '🐟', fill: '#d9e8ec', ink: '#4f7f91' },
};

export class ShellMatchGame implements MiniGame {
  readonly id = 'shells' as const;
  readonly title = '贝壳消消乐';
  private grid: Array<Array<Gem | null>> = this.createBoard();
  private elapsed = 0;
  private ended = false;
  private scoreValue = 0;
  private moves = 0;
  private tilesCleared = 0;
  private combo = 0;
  private bestCombo = 0;
  private comboFlash = 0;
  private clearTimer = 0;
  private swapTimer = 0;
  private invalidFlash = 0;
  private clearingIndexes: number[] = [];
  private preservedSpecialIndex: number | null = null;
  private pendingSwap: [Cell, Cell] | null = null;
  private isResolving = false;
  private cursor: Cell = { row: 3, col: 3 };
  private selected: Cell | null = null;
  private idleTime = 0;
  private hintPair: [Cell, Cell] | null = null;
  private navigationCooldown = 0;
  private message = '交换相邻物件，连成三枚';

  get score(): number { return this.scoreValue; }
  get timeLeft(): number { return Math.max(0, 60 - this.elapsed); }
  get over(): boolean { return this.ended; }
  get statusText(): string {
    return '交换 ' + this.moves + ' 次' + (this.comboFlash > 0 && this.combo > 1 ? ' · 连锁 x' + this.combo : '');
  }
  get outcome(): string {
    const chain = this.bestCombo > 1 ? '最高连锁 x' + this.bestCombo : '下次试试连锁消除';
    return '60 秒里消除了 ' + this.tilesCleared + ' 枚海边宝物，完成 ' + this.moves + ' 次交换，' + chain + '。';
  }

  start(): void {
    this.createPlayableBoard();
    this.elapsed = 0;
    this.ended = false;
    this.scoreValue = 0;
    this.moves = 0;
    this.tilesCleared = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboFlash = 0;
    this.clearTimer = 0;
    this.swapTimer = 0;
    this.invalidFlash = 0;
    this.clearingIndexes = [];
    this.preservedSpecialIndex = null;
    this.pendingSwap = null;
    this.isResolving = false;
    this.cursor = { row: 3, col: 3 };
    this.selected = null;
    this.idleTime = 0;
    this.hintPair = null;
    this.navigationCooldown = 0;
    this.message = '交换相邻物件，连成三枚';
  }

  update(dt: number, controls: GameControls): void {
    if (this.ended) return;
    this.elapsed = Math.min(60, this.elapsed + dt);
    this.comboFlash = Math.max(0, this.comboFlash - dt);
    this.invalidFlash = Math.max(0, this.invalidFlash - dt);
    this.updateKeyboardCursor(dt, controls);

    if (this.swapTimer > 0) {
      this.swapTimer -= dt;
      if (this.swapTimer <= 0 && this.pendingSwap) this.resolveSwap();
    }
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.finishClear();
    }
    if (this.isResolving) {
      this.idleTime = 0;
      this.hintPair = null;
    } else if (!this.selected) {
      this.idleTime += dt;
      if (this.idleTime >= 6.5 && !this.hintPair) {
        this.hintPair = this.findHintSwap();
        if (!this.hintPair) {
          this.createPlayableBoard();
          this.message = '潮水换来一盘新宝物，继续寻宝';
        } else this.message = '猫猫提示：试试两枚闪光宝物';
      }
    }
    if (this.elapsed >= 60 && !this.isResolving) this.ended = true;
  }

  press(): void {
    if (this.elapsed >= 60 || this.ended || this.isResolving) return;
    this.activateCell(this.cursor);
  }

  pointerDown(x: number, y: number): void {
    if (this.elapsed >= 60 || this.ended || this.isResolving) return;
    const col = Math.floor((x - boardX) / tileStep);
    const row = Math.floor((y - boardY) / tileStep);
    if (row < 0 || row >= boardRows || col < 0 || col >= boardColumns) return;
    const localX = (x - boardX) - col * tileStep;
    const localY = (y - boardY) - row * tileStep;
    if (localX > tileSize || localY > tileSize) return;
    this.cursor = { row, col };
    this.activateCell(this.cursor);
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#e6f1e7');
    sky.addColorStop(0.56, '#eaf1df');
    sky.addColorStop(1, '#b9ded8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#fffdf4';
    for (let i = 0; i < 8; i += 1) {
      const x = (i * 173 + 44) % WIDTH;
      const y = 100 + (i * 67) % 360;
      ctx.beginPath();
      ctx.ellipse(x, y, 36 + i % 3 * 10, 5, Math.sin(now * 0.3 + i) * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawText(ctx, '贝壳消消乐 · 潮池寻宝', WIDTH / 2, 35, 20, '#48665d', 900);
    drawText(ctx, '三枚相连就能收进小桶；四连留下会清线的星星贝壳', WIDTH / 2, 61, 14, '#7d9183', 700);
    this.drawSideCard(ctx, 34, 120, 210, 295, '海边小提示');
    this.drawSideCard(ctx, 716, 120, 210, 295, '本局收获');
    this.drawBoard(ctx, now);

    if (this.invalidFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.invalidFlash * 4);
      ctx.fillStyle = 'rgba(255,250,231,.94)';
      roundedRect(ctx, 344, 484, 272, 28, 14);
      ctx.fill();
      drawText(ctx, this.message, WIDTH / 2, 498, 14, '#866c52', 800);
      ctx.restore();
    } else if (this.comboFlash > 0 && this.combo > 1) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.comboFlash * 2);
      ctx.fillStyle = 'rgba(255,248,219,.94)';
      roundedRect(ctx, 354, 484, 252, 28, 14);
      ctx.fill();
      drawText(ctx, this.message, WIDTH / 2, 498, 14, '#886638', 900);
      ctx.restore();
    } else {
      drawText(ctx, this.message, WIDTH / 2, 498, 14, '#55766a', 800);
    }
    drawText(ctx, '点击相邻物件交换 · 方向键移动，空格确认', WIDTH / 2, 523, 13, '#7a9085', 700);
  }

  private createBoard(): Array<Array<Gem | null>> {
    const board: Array<Array<Gem | null>> = Array.from({ length: boardRows }, () => Array(boardColumns).fill(null));
    for (let row = 0; row < boardRows; row += 1) {
      for (let col = 0; col < boardColumns; col += 1) {
        const allowed = kinds.filter((kind) => {
          const horizontalMatch = col >= 2 && board[row][col - 1]?.kind === kind && board[row][col - 2]?.kind === kind;
          const verticalMatch = row >= 2 && board[row - 1][col]?.kind === kind && board[row - 2][col]?.kind === kind;
          return !horizontalMatch && !verticalMatch;
        });
        board[row][col] = { kind: allowed[Math.floor(Math.random() * allowed.length)] || kinds[0], starShell: false };
      }
    }
    return board;
  }

  private createPlayableBoard(): void {
    this.grid = this.createBoard();
    while (!this.findHintSwap()) this.grid = this.createBoard();
  }

  private findHintSwap(): [Cell, Cell] | null {
    for (let row = 0; row < boardRows; row += 1) {
      for (let col = 0; col < boardColumns; col += 1) {
        const from = { row, col };
        const neighbors = [
          ...(col + 1 < boardColumns ? [{ row, col: col + 1 }] : []),
          ...(row + 1 < boardRows ? [{ row: row + 1, col }] : []),
        ];
        for (const to of neighbors) {
          this.swapGems(from, to);
          const hasMatch = this.findMatches().indexes.length > 0;
          this.swapGems(from, to);
          if (hasMatch) return [from, to];
        }
      }
    }
    return null;
  }

  private updateKeyboardCursor(dt: number, controls: GameControls): void {
    const direction = {
      row: Number(controls.keys.has('down')) - Number(controls.keys.has('up')),
      col: Number(controls.keys.has('right')) - Number(controls.keys.has('left')),
    };
    if (direction.row === 0 && direction.col === 0) {
      this.navigationCooldown = 0;
      return;
    }
    this.navigationCooldown -= dt;
    if (this.navigationCooldown > 0) return;
    this.cursor = {
      row: (this.cursor.row + direction.row + boardRows) % boardRows,
      col: (this.cursor.col + direction.col + boardColumns) % boardColumns,
    };
    this.navigationCooldown = 0.14;
  }

  private activateCell(cell: Cell): void {
    this.idleTime = 0;
    this.hintPair = null;
    if (!this.selected) {
      this.selected = { ...cell };
      return;
    }
    if (this.selected.row === cell.row && this.selected.col === cell.col) {
      this.selected = null;
      return;
    }
    const adjacent = Math.abs(this.selected.row - cell.row) + Math.abs(this.selected.col - cell.col) === 1;
    if (!adjacent) {
      this.selected = { ...cell };
      return;
    }
    const from = this.selected;
    const to = { ...cell };
    this.selected = null;
    this.swapGems(from, to);
    this.pendingSwap = [from, to];
    this.swapTimer = 0.11;
    this.isResolving = true;
  }

  private resolveSwap(): void {
    const match = this.findMatches();
    if (match.indexes.length === 0) {
      if (this.pendingSwap) this.swapGems(this.pendingSwap[0], this.pendingSwap[1]);
      this.pendingSwap = null;
      this.isResolving = false;
      this.invalidFlash = 0.5;
      this.idleTime = 0;
      this.message = '这次没有连成三枚，换个方向试试';
      audio.play('miss');
      return;
    }
    this.moves += 1;
    this.combo = 1;
    this.idleTime = 0;
    this.hintPair = null;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.beginClear(match);
  }

  private findMatches(): MatchResult {
    const matched = new Set<number>();
    const longRuns: number[][] = [];
    const scan = (cells: Cell[]): void => {
      let start = 0;
      while (start < cells.length) {
        const first = cells[start];
        const kind = this.grid[first.row][first.col]?.kind;
        if (!kind) {
          start += 1;
          continue;
        }
        let end = start + 1;
        while (end < cells.length && this.grid[cells[end].row][cells[end].col]?.kind === kind) end += 1;
        if (end - start >= 3) {
          const run = cells.slice(start, end).map((cell) => this.toIndex(cell));
          run.forEach((index) => matched.add(index));
          if (run.length >= 4) longRuns.push(run);
        }
        start = end;
      }
    };
    for (let row = 0; row < boardRows; row += 1) {
      scan(Array.from({ length: boardColumns }, (_, col) => ({ row, col })));
    }
    for (let col = 0; col < boardColumns; col += 1) {
      scan(Array.from({ length: boardRows }, (_, row) => ({ row, col })));
    }

    if (matched.size === 0) return { indexes: [], specialIndex: null };
    const seed = [...matched];
    for (const index of seed) {
      const cell = this.fromIndex(index);
      if (!this.grid[cell.row][cell.col]?.starShell) continue;
      for (let col = 0; col < boardColumns; col += 1) matched.add(this.toIndex({ row: cell.row, col }));
      for (let row = 0; row < boardRows; row += 1) matched.add(this.toIndex({ row, col: cell.col }));
    }

    const swappedTo = this.pendingSwap?.[1];
    const swappedIndex = swappedTo ? this.toIndex(swappedTo) : -1;
    const specialIndex = longRuns
      .map((run) => run.includes(swappedIndex) ? swappedIndex : run[Math.floor(run.length / 2)])
      .find((index) => matched.has(index)) ?? null;
    return { indexes: [...matched], specialIndex };
  }

  private beginClear(match: MatchResult): void {
    this.clearingIndexes = match.indexes;
    this.preservedSpecialIndex = match.specialIndex;
    this.clearTimer = 0.24;
    this.pendingSwap = null;
  }

  private finishClear(): void {
    const cleared = this.clearingIndexes.filter((index) => index !== this.preservedSpecialIndex);
    for (const index of cleared) {
      const cell = this.fromIndex(index);
      this.grid[cell.row][cell.col] = null;
    }
    if (this.preservedSpecialIndex !== null) {
      const cell = this.fromIndex(this.preservedSpecialIndex);
      const gem = this.grid[cell.row][cell.col];
      if (gem) gem.starShell = true;
    }
    const specialCreated = this.preservedSpecialIndex !== null;
    this.tilesCleared += cleared.length;
    this.scoreValue += cleared.length * 10 * Math.max(1, this.combo) + (this.combo > 1 ? (this.combo - 1) * 35 : 0) + (specialCreated ? 30 : 0);
    this.message = specialCreated
      ? '四连成形！星星贝壳会清除整行和整列'
      : this.combo > 1
        ? '连锁 x' + this.combo + '！潮水把新宝物送来啦'
        : '收进 ' + cleared.length + ' 枚海边宝物';
    audio.play(this.combo > 1 || specialCreated ? 'unlock' : 'star');
    this.comboFlash = 1.35;
    this.applyGravity();
    this.clearingIndexes = [];
    this.preservedSpecialIndex = null;

    const cascade = this.findMatches();
    if (cascade.indexes.length > 0) {
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.beginClear(cascade);
      return;
    }
    this.isResolving = false;
    this.combo = 0;
    if (!this.findHintSwap()) {
      this.createPlayableBoard();
      this.message = '潮水换来一盘新宝物，继续寻宝';
    }
    if (this.elapsed >= 60) this.ended = true;
  }

  private applyGravity(): void {
    for (let col = 0; col < boardColumns; col += 1) {
      const remaining: Gem[] = [];
      for (let row = boardRows - 1; row >= 0; row -= 1) {
        const gem = this.grid[row][col];
        if (gem) remaining.push(gem);
      }
      for (let row = boardRows - 1; row >= 0; row -= 1) {
        this.grid[row][col] = remaining[boardRows - 1 - row] || { kind: kinds[Math.floor(Math.random() * kinds.length)], starShell: false };
      }
    }
  }

  private swapGems(from: Cell, to: Cell): void {
    const gem = this.grid[from.row][from.col];
    this.grid[from.row][from.col] = this.grid[to.row][to.col];
    this.grid[to.row][to.col] = gem;
  }

  private toIndex(cell: Cell): number { return cell.row * boardColumns + cell.col; }

  private fromIndex(index: number): Cell {
    return { row: Math.floor(index / boardColumns), col: index % boardColumns };
  }

  private drawSideCard(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, title: string): void {
    ctx.fillStyle = 'rgba(255,253,245,.72)';
    roundedRect(ctx, x, y, width, height, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(73,112,94,.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawText(ctx, title, x + 18, y + 24, 14, '#62796d', 900, 'left');
    if (title === '海边小提示') {
      drawText(ctx, '🐱', x + width / 2, y + 85, 42, '#55766a', 700);
      drawText(ctx, '点击相邻物件交换', x + width / 2, y + 142, 13, '#71867b', 800);
      drawText(ctx, '横向或纵向连成三枚', x + width / 2, y + 166, 13, '#71867b', 800);
      drawText(ctx, '四连留下星星贝壳', x + width / 2, y + 202, 13, '#9a7a45', 900);
      drawText(ctx, '再次消除可清一行一列', x + width / 2, y + 226, 12, '#8d8875', 700);
      ctx.fillStyle = '#e9efe4';
      roundedRect(ctx, x + 12, y + 246, width - 24, 30, 15);
      ctx.fill();
      drawText(ctx, '停留片刻，猫猫会提示一步', x + width / 2, y + 261, 11, '#8a9689', 700);
    } else {
      const rating = SHELL_SCORE_STAR_THRESHOLDS.filter((threshold) => this.scoreValue >= threshold).length;
      const nextThreshold = SHELL_SCORE_STAR_THRESHOLDS[rating];
      for (let index = 0; index < SHELL_SCORE_STAR_THRESHOLDS.length; index += 1) {
        drawText(ctx, index < rating ? '★' : '☆', x + width / 2 + (index - 1) * 25, y + 73, 22, index < rating ? '#dfae4b' : '#c6d0c5', 900);
      }
      drawText(ctx, rating === 3 ? '潮池三星达成' : rating === 0 ? '争取第一颗潮池星' : '已获得 ' + rating + ' / 3 颗潮池星', x + width / 2, y + 99, 12, '#71867b', 900);
      drawText(ctx, String(this.tilesCleared) + ' 枚宝物', x + width / 2, y + 132, 18, '#62796d', 900);
      drawText(ctx, '交换 ' + this.moves + ' 次 · 最高连锁 x' + Math.max(this.bestCombo, this.combo), x + width / 2, y + 163, 12, '#829084', 800);
      const progress = clamp(this.scoreValue / SHELL_SCORE_STAR_THRESHOLDS[SHELL_SCORE_STAR_THRESHOLDS.length - 1], 0, 1);
      const barX = x + 18;
      const barWidth = width - 36;
      ctx.fillStyle = '#e8eee4';
      roundedRect(ctx, barX, y + 205, barWidth, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#e2bb66';
      roundedRect(ctx, barX, y + 205, barWidth * progress, 12, 6);
      ctx.fill();
      SHELL_SCORE_STAR_THRESHOLDS.slice(0, -1).forEach((threshold) => {
        const markerX = barX + barWidth * threshold / SHELL_SCORE_STAR_THRESHOLDS[SHELL_SCORE_STAR_THRESHOLDS.length - 1];
        ctx.fillStyle = '#fffdf5';
        ctx.fillRect(markerX - 1, y + 203, 2, 16);
      });
      drawText(ctx, nextThreshold === undefined ? '三颗星都拿到啦！' : '距下一颗星还差 ' + Math.max(0, nextThreshold - this.scoreValue) + ' 分', x + width / 2, y + 243, 12, '#8a784f', 800);
      drawText(ctx, '目标：180 · 450 · 850 分', x + width / 2, y + 267, 11, '#8a9689', 700);
    }
  }

  private drawBoard(ctx: CanvasRenderingContext2D, now: number): void {
    const frameX = boardX - 13;
    const frameY = boardY - 13;
    const frameSize = boardSize + 26;
    ctx.fillStyle = 'rgba(43,91,87,.12)';
    roundedRect(ctx, frameX, frameY + 5, frameSize, frameSize, 24);
    ctx.fill();
    ctx.fillStyle = 'rgba(252,251,241,.92)';
    roundedRect(ctx, frameX, frameY, frameSize, frameSize, 24);
    ctx.fill();

    const clearing = new Set(this.clearingIndexes);
    for (let row = 0; row < boardRows; row += 1) {
      for (let col = 0; col < boardColumns; col += 1) {
        const x = boardX + col * tileStep;
        const y = boardY + row * tileStep;
        const index = this.toIndex({ row, col });
        const gem = this.grid[row][col];
        if (!gem) continue;
        const style = gemStyle[gem.kind];
        const isClearing = clearing.has(index);
        const pulse = isClearing ? 0.68 + Math.sin(now * 36) * 0.12 : 1;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = style.fill;
        roundedRect(ctx, x, y, tileSize, tileSize, 14);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.58)';
        ctx.beginPath();
        ctx.arc(x + tileSize / 2, y + tileSize / 2, 17, 0, Math.PI * 2);
        ctx.fill();
        this.drawGemIcon(ctx, gem.kind, x + tileSize / 2, y + tileSize / 2, style.icon, style.ink);
        if (gem.starShell) {
          ctx.strokeStyle = '#d6a544';
          ctx.lineWidth = 2;
          roundedRect(ctx, x + 1.5, y + 1.5, tileSize - 3, tileSize - 3, 13);
          ctx.stroke();
          drawText(ctx, '✦', x + tileSize - 6, y + 6, 11, '#b17c2c', 900);
        }
        ctx.restore();
        if (this.selected?.row === row && this.selected.col === col) {
          ctx.strokeStyle = '#e7b852';
          ctx.lineWidth = 3;
          roundedRect(ctx, x + 1.5, y + 1.5, tileSize - 3, tileSize - 3, 13);
          ctx.stroke();
        } else if (this.hintPair?.some((cell) => cell.row === row && cell.col === col)) {
          ctx.save();
          ctx.globalAlpha = 0.76 + Math.sin(now * 5) * 0.18;
          ctx.shadowColor = '#e6bd66';
          ctx.shadowBlur = 7;
          ctx.strokeStyle = '#c99230';
          ctx.lineWidth = 3.5;
          roundedRect(ctx, x + 1.5, y + 1.5, tileSize - 3, tileSize - 3, 13);
          ctx.stroke();
          ctx.shadowBlur = 0;
          drawText(ctx, '✦', x + tileSize - 5, y + 5, 11, '#ae7929', 900);
          ctx.restore();
        } else if (this.cursor.row === row && this.cursor.col === col) {
          ctx.strokeStyle = 'rgba(66,112,100,.7)';
          ctx.lineWidth = 2;
          roundedRect(ctx, x + 2.5, y + 2.5, tileSize - 5, tileSize - 5, 12);
          ctx.stroke();
        }
      }
    }
  }

  private drawGemIcon(
    ctx: CanvasRenderingContext2D,
    kind: ShellKind,
    centerX: number,
    centerY: number,
    icon: string,
    ink: string,
  ): void {
    if (kind !== 'bubble' && kind !== 'coral') {
      drawText(ctx, icon, centerX, centerY + 1, 26, ink, 700);
      return;
    }

    ctx.save();
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'bubble') {
      [[-4, 2, 7], [8, -7, 4], [9, 8, 3]].forEach(([offsetX, offsetY, radius]) => {
        ctx.beginPath();
        ctx.arc(centerX + offsetX, centerY + offsetY, radius, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(centerX - 6, centerY - 1, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const branches = [
        [[0, 12], [0, 4], [-7, -2], [-7, -11]],
        [[0, 4], [7, -2], [7, -12]],
        [[0, 1], [-9, -5], [-12, -10]],
        [[3, 0], [11, -5], [12, -11]],
      ];
      branches.forEach((branch) => {
        ctx.beginPath();
        ctx.moveTo(centerX + branch[0][0], centerY + branch[0][1]);
        branch.slice(1).forEach(([offsetX, offsetY]) => ctx.lineTo(centerX + offsetX, centerY + offsetY));
        ctx.stroke();
      });
      [[-7, -11], [7, -12], [-12, -10], [12, -11]].forEach(([offsetX, offsetY]) => {
        ctx.beginPath();
        ctx.arc(centerX + offsetX, centerY + offsetY, 2.1, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }
}
