import { CanvasSurface } from '../core/CanvasSurface';
import { GameLoop } from '../core/GameLoop';
import { audio } from '../core/Audio';
import { HEIGHT, WIDTH, type GameControls, type GameId, type MiniGame } from '../core/Game';
import { exportSaveBackup, getBest, importSaveBackup, saveBest } from '../core/Storage';
import { createGame, gameCards } from '../games';
import { chooseAquariumDecoration, chooseCatAccessory, favoriteFishLimit, fishSpecies, fishingZones, getDailyFishingEvent, getDailyFishingSighting, getDailyFishingWeather, getFavoriteFishIds, getTrackedFish, getFishingDailyQuest, getFishingRodStats, getFishBestLengths, getFishCounts, getFishFriendship, getFishLengthRange, getFishSizeLabel, getFishTrophyRanks, savePreferredZone, toggleFavoriteFish, toggleTrackedFish, upgradeFishingRod, type FishingZoneId } from '../games/fishing/FishJournal';
import { renderHome } from '../ui/HomeScreen';
import { createFishCollectionCard } from '../ui/CollectionCard';
import { renderSoundToggle, syncSoundToggle } from '../ui/SoundToggle';

type AppState = 'home' | 'ready' | 'playing' | 'paused' | 'ended';

function saveCollectionCard(
  blob: Blob,
  fileName: string,
  finish: (label: string, ariaLabel: string) => void,
): void {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    finish('已保存图片 ✓', '鱼图鉴收藏卡片已保存到下载文件夹');
  } catch {
    finish('暂时无法保存', '暂时无法保存鱼图鉴收藏卡片');
  }
}

export class App {
  private state: AppState = 'home';
  private game: MiniGame | null = null;
  private surface: CanvasSurface | null = null;
  private loop: GameLoop | null = null;
  private keys = new Set<string>();
  private pointerX: number | null = null;
  private pointerSteering = false;
  private bestScore = 0;
  private fishingQuestCompletedAtRunStart = false;
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((event: KeyboardEvent) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {
    this.showHome();
  }

  private showHome(notice?: string): void {
    this.disposeGame();
    this.state = 'home';
    this.root.innerHTML = renderHome();
    this.bindSoundToggle();
    this.root.querySelectorAll<HTMLButtonElement>('[data-game]').forEach((button) => {
      button.addEventListener('click', () => this.openGame(button.dataset.game as GameId));
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-sighting-zone]').forEach((button) => {
      button.addEventListener('click', () => {
        savePreferredZone(button.dataset.sightingZone as FishingZoneId);
        this.openGame('fishing');
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-daily-event-zone]').forEach((button) => {
      button.addEventListener('click', () => {
        savePreferredZone(button.dataset.dailyEventZone as FishingZoneId);
        this.openGame('fishing');
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-fish-profile]').forEach((button) => {
      button.addEventListener('click', () => this.openFishProfile(button.dataset.fishProfile || ''));
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-aquarium-decor]').forEach((button) => {
      button.addEventListener('click', () => {
        const scrollY = window.scrollY;
        if (!chooseAquariumDecoration(button.dataset.aquariumDecor || '')) return;
        this.showHome();
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-cat-accessory]').forEach((button) => {
      button.addEventListener('click', () => {
        const scrollY = window.scrollY;
        if (!chooseCatAccessory(button.dataset.catAccessory || '')) return;
        this.showHome();
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      });
    });
    this.root.querySelector<HTMLButtonElement>('[data-rod-upgrade]')?.addEventListener('click', () => {
      const scrollY = window.scrollY;
      if (!upgradeFishingRod()) return;
      this.showHome();
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    });
    this.root.querySelector<HTMLButtonElement>('[data-collection-card]')?.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const defaultLabel = button.textContent || '晒晒图鉴';
      const defaultAriaLabel = button.getAttribute('aria-label');
      const finish = (label: string, ariaLabel: string): void => {
        if (!button.isConnected) return;
        button.textContent = label;
        button.setAttribute('aria-label', ariaLabel);
        window.setTimeout(() => {
          if (!button.isConnected) return;
          button.textContent = defaultLabel;
          if (defaultAriaLabel) button.setAttribute('aria-label', defaultAriaLabel);
          else button.removeAttribute('aria-label');
        }, 1800);
      };
      button.textContent = '正在生成…';
      button.setAttribute('aria-label', '正在生成鱼图鉴收藏卡片');
      try {
        const canvas = createFishCollectionCard();
        canvas.toBlob((blob) => {
          if (!blob) {
            finish('暂时无法生成', '暂时无法生成鱼图鉴收藏卡片');
            return;
          }
          const date = new Date();
          const dateKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
          const fileName = 'pocket-play-atlas-' + dateKey + '.png';
          const file = new File([blob], fileName, { type: 'image/png' });
          const share = navigator.share;
          const canShare = navigator.canShare;
          const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
          if (isTouchDevice && share && canShare && canShare.call(navigator, { files: [file] })) {
            void share.call(navigator, {
              title: '猫猫钓鱼 · 我的冒险鱼图鉴',
              text: '看看我的猫猫钓鱼收藏进度！',
              files: [file],
            }).then(() => {
              finish('分享面板已打开 ✓', '鱼图鉴收藏卡片已交给系统分享');
            }).catch((error: unknown) => {
              if (error instanceof DOMException && error.name === 'AbortError') {
                finish('已取消分享', '已取消分享鱼图鉴收藏卡片');
                return;
              }
              saveCollectionCard(blob, fileName, finish);
            });
          } else {
            saveCollectionCard(blob, fileName, finish);
          }
        }, 'image/png');
      } catch {
        finish('暂时无法保存', '暂时无法保存鱼图鉴收藏卡片');
      }
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-profile-close]').forEach((button) => {
      button.addEventListener('click', () => this.root.querySelector<HTMLDialogElement>('#fish-profile-dialog')?.close());
    });
    const saveDialog = this.root.querySelector<HTMLDialogElement>('#save-backup-dialog');
    const saveStatus = this.root.querySelector<HTMLElement>('[data-save-status]');
    this.root.querySelector<HTMLButtonElement>('[data-save-backup]')?.addEventListener('click', () => saveDialog?.showModal());
    this.root.querySelectorAll<HTMLButtonElement>('[data-save-close]').forEach((button) => {
      button.addEventListener('click', () => saveDialog?.close());
    });
    saveDialog?.addEventListener('click', (event) => {
      if (event.target === saveDialog) saveDialog.close();
    });
    this.root.querySelector<HTMLButtonElement>('[data-save-export]')?.addEventListener('click', () => {
      try {
        const blob = new Blob([exportSaveBackup()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pocket-play-save-' + new Date().toISOString().slice(0, 10) + '.json';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        if (saveStatus) saveStatus.textContent = '存档文件已导出。把它带到另一台设备后，可以从这里导入。';
      } catch {
        if (saveStatus) saveStatus.textContent = '暂时无法导出存档，请检查浏览器的下载设置。';
      }
    });
    const saveFile = this.root.querySelector<HTMLInputElement>('[data-save-file]');
    this.root.querySelector<HTMLButtonElement>('[data-save-import-trigger]')?.addEventListener('click', () => saveFile?.click());
    saveFile?.addEventListener('change', async () => {
      const file = saveFile.files?.[0];
      saveFile.value = '';
      if (!file) return;
      if (file.size > 262_144) {
        if (saveStatus) saveStatus.textContent = '这个存档文件太大，无法导入。';
        return;
      }
      try {
        if (!importSaveBackup(await file.text())) {
          if (saveStatus) saveStatus.textContent = '文件格式无法识别，当前进度没有改变。';
          return;
        }
        this.showHome('存档已导入，鱼图鉴、布景和纪录已更新。');
      } catch {
        if (saveStatus) saveStatus.textContent = '读取文件失败，当前进度没有改变。';
      }
    });
    if (notice) {
      const toast = document.createElement('div');
      toast.className = 'save-toast';
      toast.setAttribute('role', 'status');
      toast.textContent = notice;
      this.root.append(toast);
      window.setTimeout(() => toast.remove(), 3200);
    }
  }

  private openFishProfile(id: string): void {
    const fish = fishSpecies.find((item) => item.id === id);
    if (!fish) return;
    const count = getFishCounts()[fish.id] || 0;
    if (count < 1) return;
    const friendship = getFishFriendship(fish.id);
    const friendshipStatus = friendship.complete
      ? '猫猫和它已成为默契伙伴，专属故事和升阶奖励都解锁啦'
      : '再钓到 ' + friendship.remaining + ' 条，就成为' + friendship.nextTitle
        + (friendship.nextTitle === '熟络' && !friendship.story ? '并解锁专属小秘密' : '')
        + (friendship.nextScoreReward > 0 ? '，本局额外 +' + friendship.nextScoreReward + ' 分' : '');
    const friendshipProgressMax = friendship.complete ? 1 : Math.max(1, friendship.target);
    const friendshipProgressValue = friendship.complete ? 1 : friendship.progress;
    const friendshipProgressPercent = friendship.complete ? 100 : Math.round(friendship.progress / friendshipProgressMax * 100);
    const trophyRank = getFishTrophyRanks()[fish.id] || 0;
    const bestLength = getFishBestLengths()[fish.id] || 0;
    const lengthRange = getFishLengthRange(fish.id);
    const sizeProgressMax = Math.max(1, lengthRange.max - lengthRange.min);
    const sizeProgress = bestLength > 0 ? Math.max(0, Math.min(sizeProgressMax, bestLength - lengthRange.min)) : 0;
    const sizeProgressPercent = Math.round(sizeProgress / sizeProgressMax * 100);
    const sizeChaseHint = bestLength <= 0
      ? '再遇见它，看看能钓到多大'
      : bestLength >= lengthRange.max
        ? '已经钓到鱼种的最大体型'
        : '距离鱼种最大体型还差 ' + (lengthRange.max - bestLength) + ' cm';
    const favoriteFishIds = getFavoriteFishIds();
    const isFavorite = favoriteFishIds.includes(fish.id);
    const isTracked = getTrackedFish()?.id === fish.id;
    const zone = fishingZones.find((item) => item.id === fish.zoneId);
    const content = this.root.querySelector<HTMLElement>('#fish-profile-content');
    const dialog = this.root.querySelector<HTMLDialogElement>('#fish-profile-dialog');
    if (!content || !dialog) return;

    content.innerHTML = '<div class="fish-profile-topline">' + (zone?.label || '神秘海域') + ' · CAT’S LOG</div>' +
      '<span class="fish-profile-icon" aria-hidden="true">' + fish.icon + '</span>' +
      '<h2 id="fish-profile-title">' + fish.name + '</h2>' +
      '<span class="fish-profile-rarity">' + fish.rarity + '鱼 · ' + fish.points + ' 分</span>' +
      '<p class="fish-profile-story">' + fish.story + '</p>' +
      (friendship.story ? '<p class="fish-profile-bond-story"><strong>熟络后的小秘密</strong>' + friendship.story + '</p>' : '') +
      '<div class="fish-profile-habit">挣扎习性 · ' + fish.pullHint + '</div>' +
      '<div class="fish-profile-track-row"><button type="button" class="fish-profile-track' + (isTracked ? ' is-selected' : '') + '" data-fish-track="' + fish.id + '" aria-pressed="' + isTracked + '">' + (isTracked ? '🎯 正在追踪这条鱼' : '⌖ 设为追踪目标') + '</button><small>在对应海域出发时，这条鱼更容易出现</small></div>' +
      '<div class="fish-profile-friendship"><div><span>猫猫和它的关系</span><strong>' + friendship.title + '</strong></div><small>' + friendshipStatus + '</small><div class="fish-profile-friendship-track" role="progressbar" aria-label="' + fish.name + '鱼友情进度" aria-valuemin="0" aria-valuemax="' + friendshipProgressMax + '" aria-valuenow="' + friendshipProgressValue + '"><i style="width:' + friendshipProgressPercent + '%"></i></div></div>' +
      '<div class="fish-profile-trophy"><span>最佳收线章</span><strong>' + (trophyRank > 0 ? '★'.repeat(trophyRank) + '<i>' + '☆'.repeat(3 - trophyRank) + '</i>' : '尚无记录') + '</strong><small>' + (trophyRank === 3 ? '完美收线' : trophyRank === 2 ? '稳稳收线' : trophyRank === 1 ? '成功上岸' : '少失误可逐步升级，最高 3 星') + '</small></div>' +
      '<div class="fish-profile-length"><div class="fish-profile-length-top"><span>猫猫的最大鱼获</span><strong>' + (bestLength > 0 ? bestLength + ' cm · ' + getFishSizeLabel(fish.id, bestLength) : '待钓出纪录') + '</strong></div><small>' + sizeChaseHint + '</small><div class="fish-profile-length-track" role="progressbar" aria-label="' + fish.name + '最大尺寸纪录进度" aria-valuemin="0" aria-valuemax="' + sizeProgressMax + '" aria-valuenow="' + sizeProgress + '"><i style="width:' + sizeProgressPercent + '%"></i></div></div>' +
      '<div class="fish-profile-favorite-row"><button type="button" class="fish-profile-favorite' + (isFavorite ? ' is-selected' : '') + '" data-fish-favorite="' + fish.id + '" aria-pressed="' + isFavorite + '">' + (isFavorite ? '♥ 猫猫最爱的鱼' : '♡ 收为猫猫最爱') + '</button><small>' + favoriteFishIds.length + '/' + favoriteFishLimit + ' 个最爱位</small></div>' +
      '<p class="fish-profile-favorite-status" data-fish-favorite-status role="status" aria-live="polite">最多收藏 ' + favoriteFishLimit + ' 种已发现的鱼。</p>' +
      '<p class="fish-profile-count">累计钓获 · ' + count + ' 条</p>';
    content.querySelector<HTMLButtonElement>('[data-fish-favorite]')?.addEventListener('click', () => {
      const result = toggleFavoriteFish(fish.id);
      if (result === 'full') {
        const status = content.querySelector<HTMLElement>('[data-fish-favorite-status]');
        if (status) status.textContent = '三个最爱位都放满啦，先取消一位再收藏。';
        return;
      }
      if (result === 'added' || result === 'removed') {
        const scrollY = window.scrollY;
        this.showHome(result === 'added' ? '已把' + fish.name + '放进猫猫最爱' : '已将' + fish.name + '从猫猫最爱中移除');
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      }
    });
    content.querySelector<HTMLButtonElement>('[data-fish-track]')?.addEventListener('click', () => {
      const result = toggleTrackedFish(fish.id);
      if (result === 'selected' || result === 'cleared') {
        const scrollY = window.scrollY;
        this.showHome(result === 'selected' ? '已将' + fish.name + '设为追踪目标' : '已取消' + fish.name + '的追踪');
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      }
    });
    dialog.showModal();
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
      '<div class="play-actions">' + renderSoundToggle() + '<button class="pause-button" id="pause-button" aria-label="暂停游戏">Ⅱ <span>暂停</span></button></div></header>' +
      '<main class="play-main"><div class="game-heading"><div class="game-heading-icon">' + icon + '</div><div><span class="game-eyebrow">NOW PLAYING</span><h1>' + title + '</h1></div><div class="heading-decoration">✦</div></div>' +
      '<section class="game-panel"><div class="hud"><div class="hud-item"><span class="hud-label">得分</span><strong id="score-value">0</strong></div><div class="hud-item"><span class="hud-label">剩余时间</span><strong id="time-value">—</strong></div><div class="hud-item hud-status"><span class="hud-label">状态</span><strong id="status-value">准备中</strong></div><div class="hud-item hud-best"><span class="hud-label">个人最佳</span><strong id="best-value">' + this.bestScore + '</strong></div></div>' +
      '<div class="canvas-wrap"><canvas id="game-canvas" width="960" height="540" aria-label="' + title + '游戏区域"></canvas>' +
      '<div class="game-overlay" id="game-overlay"><div class="overlay-card"><span class="overlay-kicker">POCKET PLAY</span><h2 id="overlay-title"></h2><p id="overlay-description"></p><div class="result-next-step" id="result-next-step" hidden><p id="result-next-step-copy" aria-live="polite"></p><button class="result-next-action" id="result-next-action" type="button"></button></div><div class="setup-picker" id="setup-picker"></div><button class="primary-button" id="overlay-action"></button><button class="text-button" id="overlay-secondary">回到游戏大厅</button></div></div></div></section>' +
      '<div class="play-bottom"><div class="control-hint"><span class="hint-icon">⌨</span><span>' + controls + '</span><span class="hint-divider">·</span><span>Esc 返回大厅</span></div>' +
      '<div class="touch-controls" aria-label="触屏方向控制"><button type="button" data-key="left" aria-label="向左">←</button><button type="button" data-key="right" aria-label="向右">→</button></div>' +
      '<div class="bottom-tip"><span class="tip-star">✦</span> 玩得开心就好</div></div></main></div>';
  }

  private bindGameUi(): void {
    this.bindSoundToggle();
    this.root.querySelector('#back-button')?.addEventListener('click', () => this.showHome());
    this.root.querySelector('#pause-button')?.addEventListener('click', () => this.togglePause());
    this.root.querySelector('#overlay-action')?.addEventListener('click', () => {
      if (this.state === 'ready') this.startGame();
      else if (this.state === 'paused') this.resumeGame();
      else if (this.state === 'ended') this.restartGame();
    });
    this.root.querySelector('#overlay-secondary')?.addEventListener('click', () => this.showHome());
    this.root.querySelector<HTMLButtonElement>('#result-next-action')?.addEventListener('click', (event) => {
      const action = (event.currentTarget as HTMLButtonElement).dataset.resultAction;
      if (action === 'sighting') {
        const sighting = getDailyFishingSighting();
        savePreferredZone(sighting.zone.id);
        this.openGame('fishing');
      } else if (action === 'quest') {
        this.openGame('fishing');
      } else if (action === 'journal') {
        this.showHome();
        requestAnimationFrame(() => document.querySelector('#journal-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    });
    this.root.querySelector('#setup-picker')?.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const option = target.closest<HTMLButtonElement>('[data-setup-option]');
      if (!option || option.disabled || !option.dataset.setupOption) return;
      this.game?.selectSetupOption?.(option.dataset.setupOption);
      this.updateSetupPicker();
      this.root.querySelector<HTMLButtonElement>('[data-setup-option="' + option.dataset.setupOption + '"]')?.focus();
    });

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

  private bindSoundToggle(): void {
    this.root.querySelector('[data-sound-toggle]')?.addEventListener('click', () => {
      syncSoundToggle(this.root, audio.toggle());
    });
  }

  private bindGameInput(canvas: HTMLCanvasElement): void {
    this.keyDownHandler = (event: KeyboardEvent): void => {
      const key = this.normalizeKey(event.key);
      const onSetupOption = event.target instanceof Element && Boolean(event.target.closest('[data-setup-option]'));
      if (onSetupOption && (key === 'space' || event.key === 'Enter')) return;
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
        audio.play('finish');
        this.showOverlay();
      }
    }
    this.game.render(ctx, now);
    this.updateHud();
  }

  private startGame(): void {
    this.fishingQuestCompletedAtRunStart = this.game?.id === 'fishing' && getFishingDailyQuest().completed;
    this.game?.start();
    audio.play('start');
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
    const nextStep = this.root.querySelector<HTMLElement>('#result-next-step');
    const nextStepCopyElement = this.root.querySelector<HTMLElement>('#result-next-step-copy');
    const nextStepAction = this.root.querySelector<HTMLButtonElement>('#result-next-action');
    const action = this.root.querySelector<HTMLButtonElement>('#overlay-action');
    const secondary = this.root.querySelector<HTMLButtonElement>('#overlay-secondary');
    const pause = this.root.querySelector<HTMLButtonElement>('#pause-button');
    if (!overlay || !title || !description || !action || !secondary || !pause || !this.game) return;
    const weather = getDailyFishingWeather();
    const fishingQuest = this.game.id === 'fishing' ? getFishingDailyQuest() : null;
    const fishingSighting = this.game.id === 'fishing' ? getDailyFishingSighting() : null;
    const fishingEvent = this.game.id === 'fishing' ? getDailyFishingEvent() : null;
    const trackedFish = this.game.id === 'fishing' ? getTrackedFish() : null;
    const rod = fishingQuest ? getFishingRodStats() : null;
    const trackedFishZone = trackedFish ? fishingZones.find((zone) => zone.id === trackedFish.zoneId) : null;
    const sightingCopy = fishingSighting
      ? fishingSighting.completed
        ? ' 今日鱼影「' + fishingSighting.fish.name + '」已完成。'
        : ' 今日鱼影：「' + fishingSighting.fish.name + '」在' + fishingSighting.zone.label + '更容易遇见，首次钓到可得 ' + fishingSighting.reward + ' 枚贝壳。'
      : '';
    const eventCopy = fishingEvent
      ? ' 今日海域奇遇：「' + fishingEvent.label + '」在' + fishingEvent.zone.label + '发生，' + fishingEvent.detail + '，期间还能遇见一条限定鱼。'
      : '';
    const trackedFishCopy = trackedFish
      ? trackedFish.eventId && trackedFish.eventId !== fishingEvent?.id
        ? ' 当前追踪目标「' + trackedFish.name + '」是奇遇限定鱼，等对应海域奇遇轮换时再去寻找。'
        : ' 当前追踪目标「' + trackedFish.name + '」在' + (trackedFishZone?.label || '对应海域') + '出现机会提高。'
      : '';
    const questCopy = fishingQuest
      ? fishingQuest.completed
        ? this.state === 'ended' && !this.fishingQuestCompletedAtRunStart
          ? ' 本局完成今日委托，获得 ' + fishingQuest.reward + ' 枚贝壳！'
          : ' 今日委托已完成，贝壳奖励已到账。'
        : ' 今日委托「' + fishingQuest.title + '」：' + fishingQuest.description + '（' + fishingQuest.progress + '/' + fishingQuest.target + '），完成可得 ' + fishingQuest.reward + ' 枚贝壳。'
      : '';

    const copy: Record<Exclude<AppState, 'home'>, { title: string; body: string; action: string }> = {
      ready: {
        title: '准备好了吗？',
        body: this.game.id === 'fishing'
          ? '观察浮标信号，咬钩后按提示收竿，再趁鱼线进入绿色区拉线三次。少失误能提升这条鱼的收线章，逐星获得贝壳。每种鱼尺寸不同，鱼越大尺寸加分越高；刷新最大鱼长还能再加分。每局会从平潮转入回游潮和星潮，20 秒、40 秒时偏好的鱼群会变化。今日' + weather.label + '：' + weather.detail + '。当前使用' + rod?.label + ' Lv.' + rod?.level + '，' + rod?.detail + '。' + trackedFishCopy + eventCopy + sightingCopy + questCopy
          : this.game.id === 'dodger'
            ? '左右移动躲开石头和路锥。连续贴边闪过会逐步加分，连续捡到星星也能叠加奖励；跑到 20 秒和 40 秒会进入新的路线。'
            : this.game.id === 'jumper'
              ? '开局先选路线：追星小径的星星平台更多但稍窄；弹簧巡游有更多弹簧、星星略少；稳步登高的平台更宽。左右移动帮猫猫踩稳平台，落地后自动弹起；提前判断横移与裂纹平台，连着踩中星星会叠加奖励。'
              : '放轻松，跟着节奏玩就好。准备好后，按下按钮开始。',
        action: '开始游戏',
      },
      playing: { title: '', body: '', action: '' },
      paused: { title: '休息一下', body: '游戏已经暂停，准备好后继续挑战。', action: '继续游戏' },
      ended: { title: '这一局结束啦', body: this.game.outcome + ' · 本局得分 ' + this.game.score + questCopy, action: '再玩一次' },
    };
    const current = copy[this.state as Exclude<AppState, 'home'>];
    const nextStepCopy = fishingSighting && fishingQuest
      ? fishingSighting.completed
        ? fishingQuest.completed
          ? '今天的鱼影和委托都完成啦。回到大厅看看鱼图鉴，或者换一种鱼饵再出发。'
          : '今日鱼影已收入图鉴。委托「' + fishingQuest.title + '」还差 ' + Math.max(0, fishingQuest.target - fishingQuest.progress) + ' 次进度，完成可得 ' + fishingQuest.reward + ' 枚贝壳。'
        : '下局可以去' + fishingSighting.zone.label + '找今日鱼影「' + fishingSighting.fish.name + '」，首次钓到可得 ' + fishingSighting.reward + ' 枚贝壳。'
      : '';
    const nextStepActionCopy = fishingSighting && fishingQuest
      ? fishingSighting.completed
        ? fishingQuest.completed ? '打开鱼图鉴' : '继续钓鱼'
        : '前往' + fishingSighting.zone.label
      : '';
    const nextStepActionId = fishingSighting && fishingQuest
      ? fishingSighting.completed
        ? fishingQuest.completed ? 'journal' : 'quest'
        : 'sighting'
      : '';
    this.updateSetupPicker();
    title.textContent = current.title;
    description.textContent = current.body;
    if (nextStep) {
      if (nextStepCopyElement) nextStepCopyElement.textContent = nextStepCopy;
      nextStep.hidden = this.state !== 'ended' || !nextStepCopy;
    }
    action.textContent = current.action;
    if (nextStepAction) {
      nextStepAction.textContent = nextStepActionCopy;
      nextStepAction.dataset.resultAction = nextStepActionId;
    }
    overlay.classList.toggle('is-hidden', this.state === 'playing');
    secondary.textContent = this.state === 'ended' ? '选另一款游戏' : '回到游戏大厅';
    pause.disabled = this.state === 'ready' || this.state === 'ended';
    pause.classList.toggle('is-resume', this.state === 'paused');
    pause.innerHTML = this.state === 'paused' ? '▶ <span>继续</span>' : 'Ⅱ <span>暂停</span>';
  }

  private updateSetupPicker(): void {
    const picker = this.root.querySelector<HTMLElement>('#setup-picker');
    if (!picker || !this.game) return;
    const card = picker.closest<HTMLElement>('.overlay-card');
    const options = this.game.setupOptions || [];
    const visible = options.length > 0 && (this.state === 'ready' || this.state === 'ended');
    picker.classList.toggle('is-hidden', !visible);
    card?.classList.toggle('has-setup', visible);
    if (!visible) {
      picker.innerHTML = '';
      return;
    }

    const selectedOptions = this.game.selectedSetupOptions;
    const groups = Array.from(new Set(options.map((option) => option.group || '出发选项')));
    picker.innerHTML = groups.map((group) => {
      const groupOptions = options.filter((option) => (option.group || '出发选项') === group);
      const buttons = groupOptions.map((option) => {
        const selected = selectedOptions
          ? selectedOptions[group] === option.id
          : option.id === this.game?.selectedSetupOption;
        return '<button type="button" class="setup-option' + (selected ? ' is-selected' : '') + (option.unlocked ? '' : ' is-locked') + '" data-setup-option="' + option.id + '" aria-pressed="' + selected + '"' + (option.unlocked ? '' : ' disabled') + '>' +
          '<span class="setup-option-icon">' + option.icon + '</span><strong>' + option.label + '</strong><small>' + option.detail + '</small></button>';
      }).join('');
      return '<section class="setup-group"><span class="setup-label">选择' + group + '</span><div class="setup-options">' + buttons + '</div></section>';
    }).join('');
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
