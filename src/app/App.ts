import { CanvasSurface } from '../core/CanvasSurface';
import { GameLoop } from '../core/GameLoop';
import { HEIGHT, WIDTH, type GameControls, type GameId, type MiniGame } from '../core/Game';
import { getBest, saveBest } from '../core/Storage';
import { createGame, gameCards } from '../games';
import { renderHome } from '../ui/HomeScreen';

type AppState = 'home' | 'ready' | 'playing' | 'paused' | 'ended';

export class App {
  private state: AppState = 'home';
  private game: MiniGame | null = null;
  private surface: CanvasSurface | null = null;
  private loop: GameLoop | null = null;
  private keys = new Set<string>();
  private pointerX: number | null = null;
  private pointerSteering = false;
  private bestScore = 0;
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((event: KeyboardEvent) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {
    this.showHome();
  }

  private showHome(): void {
    this.disposeGame();
    this.state = 'home';
    this.root.innerHTML = renderHome();
    this.root.querySelectorAll<HTMLButtonElement>('[data-game]').forEach((button) => {
      button.addEventListener('click', () => this.openGame(button.dataset.game as GameId));
    });
  }

  private openGame(id: GameId): void {
    this.disposeGame();
    this.game = createGame(id);
    this.bestScore = getBest(id);
    this.state = 'ready';
    const info = gameCards.find((card) => card.id === id);
    if (!info || !this.game) return;

    this.root.innerHTML = this.gameMarkup(info.title, info.icon, info.controls);
    const canvas = this.root.querySelector<HTMLCanvasElement>('#game-canvas');
    if (!canvas) return;
    this.surface = new CanvasSurface(canvas);
    this.bindGameUi();
    this.bindGameInput(canvas);
    this.loop = new GameLoop((dt, now) => this.step(dt, now));
    this.loop.start();
    this.updateHud();
    this.showOverlay();
  }

  private gameMarkup(title: string, icon: string, controls: string): string {
    return '<div class="play-page"><header class="play-header">' +
      '<button class="back-button" id="back-button" aria-label="返回游戏大厅"><span>←</span><span class="back-label">游戏大厅</span></button>' +
      '<a class="brand compact-brand" href="#" aria-label="口袋游乐场"><span class="brand-mark"><span></span><span></span><span></span><span></span></span><span class="brand-name">口袋游乐场<small>POCKET PLAY</small></span></a>' +
      '<button class="pause-button" id="pause-button" aria-label="暂停游戏">Ⅱ <span>暂停</span></button></header>' +
      '<main class="play-main"><div class="game-heading"><div class="game-heading-icon">' + icon + '</div><div><span class="game-eyebrow">NOW PLAYING</span><h1>' + title + '</h1></div><div class="heading-decoration">✦</div></div>' +
      '<section class="game-panel"><div class="hud"><div class="hud-item"><span class="hud-label">得分</span><strong id="score-value">0</strong></div><div class="hud-item"><span class="hud-label">剩余时间</span><strong id="time-value">—</strong></div><div class="hud-item hud-status"><span class="hud-label">状态</span><strong id="status-value">准备中</strong></div><div class="hud-item hud-best"><span class="hud-label">个人最佳</span><strong id="best-value">' + this.bestScore + '</strong></div></div>' +
      '<div class="canvas-wrap"><canvas id="game-canvas" width="960" height="540" aria-label="' + title + '游戏区域"></canvas>' +
      '<div class="game-overlay" id="game-overlay"><div class="overlay-card"><span class="overlay-kicker">POCKET PLAY</span><h2 id="overlay-title"></h2><p id="overlay-description"></p><button class="primary-button" id="overlay-action"></button><button class="text-button" id="overlay-secondary">回到游戏大厅</button></div></div></div></section>' +
      '<div class="play-bottom"><div class="control-hint"><span class="hint-icon">⌨</span><span>' + controls + '</span><span class="hint-divider">·</span><span>Esc 返回大厅</span></div>' +
      '<div class="touch-controls" aria-label="触屏方向控制"><button type="button" data-key="left" aria-label="向左">←</button><button type="button" data-key="right" aria-label="向右">→</button></div>' +
      '<div class="bottom-tip"><span class="tip-star">✦</span> 玩得开心就好</div></div></main></div>';
  }

  private bindGameUi(): void {
    this.root.querySelector('#back-button')?.addEventListener('click', () => this.showHome());
    this.root.querySelector('#pause-button')?.addEventListener('click', () => this.togglePause());
    this.root.querySelector('#overlay-action')?.addEventListener('click', () => {
      if (this.state === 'ready') this.startGame();
      else if (this.state === 'paused') this.resumeGame();
      else if (this.state === 'ended') this.restartGame();
    });
    this.root.querySelector('#overlay-secondary')?.addEventListener('click', () => this.showHome());

    this.root.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((button) => {
      const key = button.dataset.key;
      if (!key) return;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.keys.add(key);
        button.setPointerCapture(event.pointerId);
      });
      const release = (): void => { this.keys.delete(key); };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
  }

  private bindGameInput(canvas: HTMLCanvasElement): void {
    this.keyDownHandler = (event: KeyboardEvent): void => {
      const key = this.normalizeKey(event.key);
      if (['left', 'right', 'space'].includes(key)) event.preventDefault();
      if (event.key === 'Escape') {
        this.showHome();
        return;
      }
      if (key === 'pause' && (this.state === 'playing' || this.state === 'paused')) {
        this.togglePause();
        return;
      }
      if (this.state === 'ready' && (key === 'space' || event.key === 'Enter')) {
        this.startGame();
        return;
      }
      if ((this.state === 'ended' || this.state === 'paused') && event.key === 'Enter') {
        if (this.state === 'ended') this.restartGame(); else this.resumeGame();
        return;
      }
      if (this.state === 'playing' && key === 'space') this.game?.press?.();
      if (key === 'left' || key === 'right') this.keys.add(key);
    };
    this.keyUpHandler = (event: KeyboardEvent): void => {
      this.keys.delete(this.normalizeKey(event.key));
    };
    this.visibilityHandler = (): void => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    };
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);

    canvas.addEventListener('pointerdown', (event) => {
      if (this.state !== 'playing' || !this.surface || !this.game) return;
      const point = this.surface.point(event.clientX, event.clientY);
      if (this.game.id === 'fishing') {
        this.game.press?.(point.x, point.y);
      } else {
        this.pointerSteering = true;
        this.pointerX = point.x;
        this.game.pointerDown?.(point.x, point.y);
        canvas.setPointerCapture(event.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.pointerSteering || !this.surface) return;
      this.pointerX = this.surface.point(event.clientX, event.clientY).x;
    });
    const endPointer = (): void => {
      this.pointerSteering = false;
      this.pointerX = null;
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('lostpointercapture', endPointer);
  }

  private step(dt: number, now: number): void {
    if (!this.game || !this.surface) return;
    this.surface.resize();
    const ctx = this.surface.context;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (this.state === 'playing') {
      const controls: GameControls = {
        keys: this.keys,
        pointerX: this.pointerSteering ? this.pointerX : null,
      };
      this.game.update(dt, controls);
      if (this.game.score > this.bestScore) this.bestScore = saveBest(this.game.id, this.game.score);
      if (this.game.over) {
        this.state = 'ended';
        this.showOverlay();
      }
    }
    this.game.render(ctx, now);
    this.updateHud();
  }

  private startGame(): void {
    this.game?.start();
    this.state = 'playing';
    this.keys.clear();
    this.showOverlay();
  }

  private restartGame(): void {
    this.startGame();
  }

  private pauseGame(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.keys.clear();
    this.showOverlay();
  }

  private resumeGame(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.showOverlay();
  }

  private togglePause(): void {
    if (this.state === 'playing') this.pauseGame();
    else if (this.state === 'paused') this.resumeGame();
  }

  private showOverlay(): void {
    const overlay = this.root.querySelector<HTMLElement>('#game-overlay');
    const title = this.root.querySelector<HTMLElement>('#overlay-title');
    const description = this.root.querySelector<HTMLElement>('#overlay-description');
    const action = this.root.querySelector<HTMLButtonElement>('#overlay-action');
    const secondary = this.root.querySelector<HTMLButtonElement>('#overlay-secondary');
    const pause = this.root.querySelector<HTMLButtonElement>('#pause-button');
    if (!overlay || !title || !description || !action || !secondary || !pause || !this.game) return;

    const copy: Record<Exclude<AppState, 'home'>, { title: string; body: string; action: string }> = {
      ready: { title: '准备好了吗？', body: '放轻松，跟着节奏玩就好。准备好后，按下按钮开始。', action: '开始游戏' },
      playing: { title: '', body: '', action: '' },
      paused: { title: '休息一下', body: '游戏已经暂停，准备好后继续挑战。', action: '继续游戏' },
      ended: { title: '这一局结束啦', body: this.game.outcome + ' · 本局得分 ' + this.game.score, action: '再玩一次' },
    };
    const current = copy[this.state as Exclude<AppState, 'home'>];
    title.textContent = current.title;
    description.textContent = current.body;
    action.textContent = current.action;
    overlay.classList.toggle('is-hidden', this.state === 'playing');
    secondary.textContent = this.state === 'ended' ? '选另一款游戏' : '回到游戏大厅';
    pause.disabled = this.state === 'ready' || this.state === 'ended';
    pause.classList.toggle('is-resume', this.state === 'paused');
    pause.innerHTML = this.state === 'paused' ? '▶ <span>继续</span>' : 'Ⅱ <span>暂停</span>';
  }

  private updateHud(): void {
    if (!this.game) return;
    const score = this.root.querySelector<HTMLElement>('#score-value');
    const time = this.root.querySelector<HTMLElement>('#time-value');
    const timeLabel = time?.previousElementSibling;
    const status = this.root.querySelector<HTMLElement>('#status-value');
    const best = this.root.querySelector<HTMLElement>('#best-value');
    if (score) score.textContent = String(this.game.score);
    if (this.game.timeLeft === undefined) {
      if (timeLabel) timeLabel.textContent = '模式';
      if (time) time.textContent = '无尽';
    } else {
      if (timeLabel) timeLabel.textContent = '剩余时间';
      if (time) time.textContent = Math.ceil(this.game.timeLeft) + 's';
    }
    if (status) status.textContent = this.game.statusText;
    if (best) best.textContent = String(this.bestScore);
  }

  private normalizeKey(key: string): string {
    if (key === 'ArrowLeft' || key.toLowerCase() === 'a') return 'left';
    if (key === 'ArrowRight' || key.toLowerCase() === 'd') return 'right';
    if (key === ' ' || key === 'Spacebar') return 'space';
    if (key.toLowerCase() === 'p') return 'pause';
    return key;
  }

  private disposeGame(): void {
    this.loop?.stop();
    this.loop = null;
    this.surface?.dispose();
    this.surface = null;
    this.game?.dispose?.();
    this.game = null;
    this.keys.clear();
    this.pointerX = null;
    this.pointerSteering = false;
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.keyDownHandler = null;
    this.keyUpHandler = null;
    this.visibilityHandler = null;
  }
}
