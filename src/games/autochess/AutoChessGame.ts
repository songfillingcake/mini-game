import { audio } from '../../core/Audio';
import type { GameControls, GameSetupOption, MiniGame } from '../../core/Game';
import { AUTO_CHESS_SAVE_KEY, AutoChessModel, BENCH_SIZE, FINAL_ROUND, parseRun, rewardInfo } from './AutoChessModel';
import type { RunSnapshot } from './AutoChessModel';
import { encounterNames, factions, guardian, sellValue, starMultiplier, synergyCounts, unitById } from './Units';
import type { Faction, Piece } from './Units';
import type { Board3D } from './Board3D';
import './autochess.css';

function readCheckpoint(): RunSnapshot | null {
  try {
    const snapshot = parseRun(localStorage.getItem(AUTO_CHESS_SAVE_KEY) || '');
    return snapshot?.phase !== 'ended' ? snapshot : null;
  } catch { return null; }
}
const stars = (star: number): string => '★'.repeat(star);
export const AUTO_CHESS_VIEW_KEY = 'pocket-play-autochess-view-v1';
function preferredView(): '3d' | '2d' {
  try { return localStorage.getItem(AUTO_CHESS_VIEW_KEY) === '2d' ? '2d' : '3d'; }
  catch { return '3d'; }
}

export class AutoChessGame implements MiniGame {
  readonly id = 'autochess' as const;
  readonly title = '星岛自走棋';
  model = new AutoChessModel();
  private host: HTMLElement | null = null;
  private listener: AbortController | null = null;
  private checkpoint = readCheckpoint();
  private mode = this.checkpoint ? 'continue' : 'fresh';
  private started = false;
  private active = false;
  private selected: string | null = null;
  private inspectedFaction: Faction | null = null;
  private speed = 1;
  private paintClock = 0;
  private effects: { node: HTMLElement; life: number }[] = [];
  private saveUnavailable = false;
  private boardView: Board3D | null = null;
  private viewMode = preferredView();
  private viewLoading = false;
  private viewError = false;

  get score(): number { return this.model.state.score; }
  get over(): boolean { return this.model.state.phase === 'ended'; }
  get statusText(): string { return '第 ' + this.model.state.round + '/' + FINAL_ROUND + ' 关 · ' + ({ prep: '准备', battle: '交战', reward: '奖励', ended: '结束' }[this.model.state.phase]); }
  get outcome(): string {
    const state = this.model.state;
    const victory = state.round === FINAL_ROUND && state.lastReport?.win;
    return (victory ? '黯星守门者已被击败，星岛远征通关！' : '小队在第 ' + state.round + ' 关结束了远征。') + ' 共获胜 ' + state.wins + ' 场，留下 ' + state.units.filter((unit) => unit.star >= 2).length + ' 名高星伙伴。';
  }
  get setupOptions(): readonly GameSetupOption[] {
    return this.checkpoint && !this.started ? [
      { id: 'continue', group: '旅程', icon: '🧭', label: '继续远征', detail: '第 ' + this.checkpoint.round + ' 关 · ' + this.checkpoint.gold + ' 金币', unlocked: true },
      { id: 'fresh', group: '旅程', icon: '✨', label: '新的旅程', detail: '从第 1 关重新出发，替换本次远征', unlocked: true },
    ] : [];
  }
  get selectedSetupOption(): string { return this.mode; }
  selectSetupOption(id: string): void { if (id === 'continue' || id === 'fresh') this.mode = id; }

  mount(host: HTMLElement): void {
    this.host = host;
    this.listener = new AbortController();
    host.addEventListener('click', (event) => this.onClick(event), { signal: this.listener.signal });
    this.draw();
  }
  setActive(active: boolean): void {
    this.active = active;
    if (this.host) this.host.inert = !active;
    this.boardView?.setActive(active);
  }
  start(): void {
    this.model = new AutoChessModel(!this.started && this.mode === 'continue' ? this.checkpoint || undefined : undefined);
    this.started = true;
    this.selected = null;
    this.inspectedFaction = null;
    this.speed = 1;
    this.save();
    this.draw();
    if (this.model.state.phase === 'reward') this.scrollToPhase();
  }
  press(): void {
    if (!this.active || this.model.state.phase !== 'prep') return;
    this.command('battle');
  }
  update(dt: number, _controls: GameControls): void {
    if (!this.active) return;
    for (const effect of this.effects) {
      effect.life -= dt;
      if (effect.life <= 0) effect.node.remove();
    }
    this.effects = this.effects.filter((effect) => effect.life > 0);
    if (this.model.state.phase !== 'battle') { this.boardView?.update(dt); return; }
    const resolved = this.model.update(dt * this.speed);
    if (resolved) {
      audio.play(this.model.state.lastReport?.win ? 'catch' : 'miss');
      this.save();
      this.draw();
      this.scrollToPhase();
      this.boardView?.update(dt * this.speed, false, dt);
      return;
    }
    this.paintClock += dt;
    if (this.paintClock >= 0.08) { this.paintClock = 0; this.paintCombat(); }
    this.boardView?.update(dt * this.speed, false, dt);
  }
  render(_context: CanvasRenderingContext2D, _now: number): void { /* The strategy board uses responsive HTML. */ }

  private onClick(event: MouseEvent): void {
    if (!this.active || !(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.action) { this.command(button.dataset.action); return; }
    if (button.dataset.buy !== undefined) { this.command('buy', Number(button.dataset.buy)); return; }
    if (button.dataset.reward !== undefined) { this.command('reward', Number(button.dataset.reward)); return; }
    if (button.dataset.trait) {
      this.inspectedFaction = button.dataset.trait as Faction;
      this.selected = null;
      this.draw();
      return;
    }
    if (this.model.state.phase !== 'prep') return;
    if (button.dataset.cell !== undefined) {
      this.pickCell(Number(button.dataset.cell));
    } else if (button.dataset.unit) {
      this.selected = this.selected === button.dataset.unit ? null : button.dataset.unit;
      this.inspectedFaction = null;
      this.draw();
    } else if (button.dataset.bench !== undefined && this.selected) {
      if (this.model.move(this.selected, null)) { this.selected = null; this.save(); }
      this.draw();
    }
  }

  private pickCell(cell: number): void {
    if (!this.active || this.model.state.phase !== 'prep' || cell < 18 || cell > 35) return;
    const occupant = this.model.state.units.find((unit) => unit.cell === cell);
    if (this.selected && this.selected !== occupant?.uid) {
      if (this.model.move(this.selected, cell)) { this.selected = null; this.save(); }
    } else this.selected = this.selected === occupant?.uid ? null : occupant?.uid || null;
    this.inspectedFaction = null;
    this.draw();
  }

  private command(action: string, index = 0): void {
    if (action.startsWith('view-')) { this.viewCommand(action); return; }
    const previousPhase = this.model.state.phase;
    let changed = false;
    switch (action) {
      case 'buy': changed = this.model.buy(index); if (changed) audio.play(this.model.notice.includes('升星') ? 'unlock' : 'star'); break;
      case 'refresh': changed = this.model.refresh(); break;
      case 'xp': changed = this.model.buyXp(); break;
      case 'lock': changed = this.model.toggleLock(); break;
      case 'auto': changed = this.model.autoDeploy(); break;
      case 'sell': if (this.selected) changed = this.model.sell(this.selected); this.selected = null; break;
      case 'recall': if (this.selected) changed = this.model.move(this.selected, null); if (changed) this.selected = null; break;
      case 'deploy': {
        const unit = this.model.state.units.find((piece) => piece.uid === this.selected);
        if (unit?.cell === null) {
          const cells = unitById[unit.type].range === 1 ? [20, 21, 19, 22, 18, 23, 26, 27, 24, 25, 28, 29, 30, 31, 32, 33, 34, 35] : [32, 33, 31, 34, 30, 35, 26, 27, 24, 25, 28, 29, 18, 19, 20, 21, 22, 23];
          const cell = cells.find((position) => !this.model.state.units.some((piece) => piece.cell === position));
          if (cell !== undefined) changed = this.model.move(unit.uid, cell);
          if (changed) this.selected = null;
        }
        break;
      }
      case 'battle': changed = this.model.beginBattle(); if (changed) { this.selected = null; audio.play('start'); } break;
      case 'reward': changed = this.model.chooseReward(index); if (changed) audio.play('unlock'); break;
      case 'speed': if (this.model.state.phase !== 'battle') return; this.speed = this.speed === 1 ? 2 : 1; this.syncSpeed(); return;
      default: return;
    }
    if (changed) this.save();
    if (this.selected && !this.model.state.units.some((unit) => unit.uid === this.selected)) this.selected = null;
    this.draw();
    if (previousPhase !== this.model.state.phase) this.scrollToPhase();
  }

  private viewCommand(action: string): void {
    if (action === 'view-toggle') {
      this.viewMode = this.viewMode === '3d' ? '2d' : '3d';
      this.viewError = false;
      try { localStorage.setItem(AUTO_CHESS_VIEW_KEY, this.viewMode); } catch { /* The view is still available for this visit. */ }
      this.draw();
    } else if (action === 'view-left') this.boardView?.turn(-1);
    else if (action === 'view-right') this.boardView?.turn(1);
    else if (action === 'view-in') this.boardView?.zoom(1);
    else if (action === 'view-out') this.boardView?.zoom(-1);
    else if (action === 'view-reset') this.boardView?.resetCamera();
  }

  private connect3D(): void {
    const board = this.host?.querySelector<HTMLElement>('.ac-board');
    if (!board) return;
    if (this.viewMode === '2d') { this.boardView?.setEnabled(false); return; }
    if (this.boardView) {
      this.boardView.setEnabled(true);
      this.boardView.setActive(this.active);
      this.boardView.attach(board);
      board.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((cell) => { cell.tabIndex = -1; cell.setAttribute('aria-hidden', 'true'); });
      return;
    }
    if (this.viewLoading) return;
    this.viewLoading = true;
    const lifetime = this.listener;
    void import('./Board3D').then(({ Board3D }) => {
      if (!this.host || this.listener !== lifetime) return;
      this.viewLoading = false;
      if (this.viewMode === '2d') return;
      try {
        this.boardView = new Board3D(() => ({ phase: this.model.state.phase, allies: this.model.deployed, enemies: this.model.enemies,
          fighters: this.model.combat?.fighters || null, selected: this.selected }), (cell) => this.pickCell(cell), () => this.fallback3D());
        this.draw();
      } catch { this.fallback3D(); }
    }).catch(() => { if (this.host && this.listener === lifetime) this.fallback3D(); });
  }

  private fallback3D(): void {
    this.boardView?.dispose();
    this.boardView = null;
    this.viewMode = '2d';
    this.viewLoading = false;
    this.viewError = true;
    if (this.host) this.draw();
  }

  private viewControls(): string {
    const ready = this.viewMode === '3d' && Boolean(this.boardView);
    return '<div class="ac-viewbar" role="group" aria-label="战场视角">' +
      '<button type="button" data-action="view-toggle" aria-pressed="' + (this.viewMode === '3d') + '">' + (this.viewError ? '重试 3D' : this.viewMode === '3d' ? '二维布阵' : '切换 3D') + '</button>' +
      (ready ? '<button type="button" data-action="view-left" aria-label="向左旋转视角">↶</button><button type="button" data-action="view-right" aria-label="向右旋转视角">↷</button><button type="button" data-action="view-in" aria-label="放大棋盘">＋</button><button type="button" data-action="view-out" aria-label="缩小棋盘">−</button><button type="button" data-action="view-reset">复位</button>' : '') + '</div>' +
      '<p class="ac-view-note" role="status">' + (this.viewError ? '3D 暂时不可用，已切换二维棋盘。' : ready ? '拖动旋转 · 双指或滚轮缩放｜首批角色：盾卫、弓手、法师' : this.viewMode === '3d' ? '正在准备 3D 棋盘，可先招募伙伴…' : '点选格子布阵，也可用键盘逐格选择。') + '</p>';
  }

  private scrollToPhase(): void {
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    this.host?.querySelector(this.model.state.phase === 'reward' ? '.ac-reward-panel' : '.ac-stage-heading')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  private save(): void {
    try {
      if (this.over) localStorage.removeItem(AUTO_CHESS_SAVE_KEY);
      else localStorage.setItem(AUTO_CHESS_SAVE_KEY, this.model.snapshot());
      this.saveUnavailable = false;
    } catch { this.saveUnavailable = true; }
  }

  private token(piece: Piece): string {
    const definition = unitById[piece.type] || guardian;
    return '<span class="ac-avatar" aria-hidden="true">' + definition.icon + '</span><span class="ac-unit-name">' + definition.name + '</span><span class="ac-stars" aria-label="' + piece.star + ' 星">' + stars(piece.star) + '</span>';
  }

  private board(): string {
    const prep = this.model.state.phase === 'prep';
    const showFormation = prep || !this.model.combat;
    const enemies = this.model.enemies;
    const cells = Array.from({ length: 36 }, (_, cell) => {
      const friendly = cell >= 18;
      const piece = showFormation ? (friendly ? this.model.state.units : enemies).find((unit) => unit.cell === cell) : undefined;
      const name = piece ? (unitById[piece.type] || guardian).name + '，' + piece.star + ' 星' : '空位';
      const content = piece ? this.token(piece) : '<span class="ac-empty-cell" aria-hidden="true">' + (friendly && prep && this.selected ? '+' : '') + '</span>';
      const className = 'ac-cell ' + (friendly ? 'is-friendly' : 'is-enemy') + (piece?.uid === this.selected ? ' is-selected' : '');
      return prep && friendly
        ? '<button class="' + className + '" type="button" data-cell="' + cell + '" aria-label="己方第 ' + (Math.floor(cell / 6) - 2) + ' 排第 ' + (cell % 6 + 1) + ' 格，' + name + '">' + content + '</button>'
        : '<div class="' + className + '" title="' + name + '">' + content + '</div>';
    }).join('');
    const fighters = !prep && this.model.combat ? this.model.combat.fighters.map((fighter) =>
      '<div class="ac-fighter is-' + fighter.team + '" data-fighter="' + fighter.uid + '" style="left:' + fighter.cell % 6 / 6 * 100 + '%;top:' + Math.floor(fighter.cell / 6) / 6 * 100 + '%" title="' + fighter.definition.name + '">' +
      this.token({ uid: fighter.uid, type: fighter.definition.id, star: fighter.star, cell: fighter.cell }) + '<span class="ac-health"><i></i></span><span class="ac-mana"><i></i></span></div>').join('') : '';
    return '<div class="ac-board" aria-label="战场：上方敌军，下方己方">' + cells + '<div class="ac-combat-layer">' + fighters + '</div><div class="ac-effects" aria-hidden="true"></div></div>';
  }

  private bench(): string {
    const units = this.model.bench;
    return '<div class="ac-bench-heading"><strong>备战席 <span>' + units.length + '/' + BENCH_SIZE + '</span></strong><small>3 个同星同名自动合成</small></div><div class="ac-bench">' +
      Array.from({ length: BENCH_SIZE }, (_, index) => {
        const unit = units[index];
        return '<button type="button" class="ac-bench-slot' + (unit?.uid === this.selected ? ' is-selected' : '') + '" ' + (unit ? 'data-unit="' + unit.uid + '" aria-label="选择' + unitById[unit.type].name + '，' + unit.star + ' 星"' : 'data-bench="' + index + '" aria-label="空备战席，可放回选中伙伴"') + (this.model.state.phase !== 'prep' ? ' disabled' : '') + '>' + (unit ? this.token(unit) : '<span aria-hidden="true">＋</span>') + '</button>';
      }).join('') + '</div>';
  }

  private traits(): string {
    const counts = synergyCounts(this.model.deployed);
    const relevant = (Object.keys(counts) as Faction[]).filter((faction) => counts[faction] > 0);
    return '<div class="ac-traits" aria-label="队伍羁绊">' + (relevant.length ? relevant.map((faction) =>
      '<button type="button" data-trait="' + faction + '" class="ac-trait' + (counts[faction] >= 2 ? ' is-active' : '') + '" aria-label="查看' + factions[faction].name + '羁绊，已有 ' + counts[faction] + ' 种" title="' + factions[faction].detail + '">' + factions[faction].icon + ' ' + factions[faction].name + ' ' + counts[faction] + '/3</button>').join('') : '<span>上阵不同伙伴，激活羁绊</span>') + '</div>';
  }

  private inspector(): string {
    if (this.inspectedFaction) {
      const faction = factions[this.inspectedFaction];
      return '<section class="ac-inspector"><strong>' + faction.icon + ' ' + faction.name + '</strong><p>' + faction.detail + '</p><small>只计算上阵的不同棋子，效果作用于同族伙伴。</small></section>';
    }
    const piece = this.model.state.units.find((unit) => unit.uid === this.selected);
    if (!piece) return '<p class="ac-notice" role="status" aria-live="polite">' + (this.saveUnavailable ? '本次进度暂时无法保存，仍可继续游玩' : this.model.notice) + '</p>';
    const definition = unitById[piece.type];
    return '<section class="ac-inspector"><div class="ac-inspector-heading"><strong>' + definition.icon + ' ' + definition.name + ' <span class="ac-stars">' + stars(piece.star) + '</span></strong><small>' + factions[definition.faction].name + '</small></div>' +
      '<div class="ac-unit-stats"><span>基础生命 ' + Math.round(definition.hp * starMultiplier(piece.star)) + '</span><span>基础攻击 ' + Math.round(definition.attack * starMultiplier(piece.star)) + '</span><span>射程 ' + definition.range + '</span></div><p><strong>' + definition.skillName + '</strong> · ' + (definition.skill === 'heal' ? definition.detail.replace('90', String(Math.round(90 * starMultiplier(piece.star)))) : definition.detail) + '</p>' +
      '<div class="ac-inspector-actions"><button type="button" data-action="' + (piece.cell === null ? 'deploy' : 'recall') + '">' + (piece.cell === null ? '上阵' : '放回备战席') + '</button><button type="button" data-action="sell">出售 +' + sellValue(piece) + ' 金</button></div><small>选中后点己方格子，可移动或交换。</small></section>';
  }

  private market(): string {
    const state = this.model.state;
    const nextXp = this.model.nextLevelXp;
    return '<section class="ac-market" aria-label="招募商店"><div class="ac-section-heading"><h3>招募伙伴</h3><button type="button" data-action="lock" class="ac-small-button" aria-pressed="' + state.locked + '">' + (state.locked ? '🔒 已锁定' : '锁定商店') + '</button></div>' +
      '<div class="ac-shop">' + state.shop.map((id, index) => {
        if (!id) return '<div class="ac-shop-empty">已招募</div>';
        const definition = unitById[id];
        const owned = state.units.filter((unit) => unit.type === id).length;
        return '<button type="button" class="ac-shop-card cost-' + definition.cost + '" data-buy="' + index + '"' + (state.gold < definition.cost ? ' disabled' : '') + ' aria-label="招募' + definition.name + '，' + definition.cost + ' 金币" title="' + definition.skillName + '：' + definition.detail + '"><span class="ac-shop-icon" aria-hidden="true">' + definition.icon + '</span><strong>' + definition.name + '</strong><small>' + factions[definition.faction].name + (owned ? ' · 持有 ' + owned : '') + '</small><span class="ac-price">' + definition.cost + ' 金</span></button>';
      }).join('') + '</div><div class="ac-economy-actions"><button type="button" data-action="refresh"' + (state.gold < 2 ? ' disabled' : '') + '>刷新 · 2 金</button><button type="button" data-action="xp"' + (state.gold < 4 || !nextXp ? ' disabled' : '') + '>' + (nextXp ? '经验 +4 · 4 金' : '人口已满级') + '</button></div>' +
      '<div class="ac-level"><span>人口 ' + this.model.capacity + '</span><span>' + (nextXp ? '经验 ' + state.xp + '/' + nextXp : '最高人口') + '</span></div></section>';
  }

  private rewardPanel(): string {
    const report = this.model.state.lastReport!;
    const topDamage = this.model.combat?.fighters.filter((unit) => unit.team === 'ally').sort((a, b) => b.dealt - a.dealt)[0];
    return '<section class="ac-reward-panel"><span class="ac-result-mark">' + (report.win ? '✦ 胜利' : '重整旗鼓') + '</span><h3>' + (report.win ? '这一关拿下了' : '挑一份补给，再来') + '</h3><p>回合收入 +' + report.income + ' 金' + (report.interest ? '，含利息 ' + report.interest : '') + (report.damage ? ' · 营地生命 −' + report.damage : '') + '</p>' +
      (topDamage ? '<p class="ac-mvp">本场输出 · ' + topDamage.definition.name + ' ' + Math.round(topDamage.dealt) + '</p>' : '') +
      (this.model.notice.startsWith('备战席已满') ? '<p class="ac-notice" role="status">' + this.model.notice + '</p>' : '') +
      '<div class="ac-rewards" aria-label="三选一回合奖励">' + this.model.state.rewards.map((id, index) => {
        const reward = rewardInfo(id);
        return '<button type="button" data-reward="' + index + '"><span aria-hidden="true">' + reward.icon + '</span><div><strong>' + reward.name + '</strong><small>' + reward.detail + '</small></div><span aria-hidden="true">→</span></button>';
      }).join('') + '</div></section>';
  }

  private draw(): void {
    if (!this.host) return;
    const focused = this.host.contains(document.activeElement) ? document.activeElement : null;
    const focusAttribute = ['data-action', 'data-buy', 'data-cell', 'data-unit', 'data-bench', 'data-trait', 'data-reward'].find((attribute) => focused?.hasAttribute(attribute));
    const focusValue = focusAttribute ? focused?.getAttribute(focusAttribute) : null;
    const helpOpen = this.host.querySelector<HTMLDetailsElement>('.ac-help')?.open || false;
    const state = this.model.state;
    const prep = state.phase === 'prep';
    this.effects = [];
    this.host.innerHTML = '<div class="ac-game"><header class="ac-runbar"><div><span class="ac-kicker">单人远征</span><h2>星岛自走棋</h2></div><div class="ac-run-stats"><span><small>营地生命</small><strong>♥ ' + state.health + '</strong></span><span><small>金币</small><strong>金 ' + state.gold + '</strong></span><span><small>关卡</small><strong>' + state.round + ' / ' + FINAL_ROUND + '</strong></span></div></header>' +
      '<div class="ac-layout"><section class="ac-arena"><div class="ac-stage-heading"><strong>' + encounterNames[state.round - 1] + '</strong><span data-battle-time>' + (prep ? '上方敌军 · 下方己方' : '') + '</span><button type="button" class="ac-small-button" data-action="speed"' + (state.phase !== 'battle' ? ' hidden' : '') + '>' + this.speed + '× 加速</button></div>' + this.board() + this.viewControls() +
      '<div class="ac-team-tools"><strong>上阵 ' + this.model.deployed.length + ' / ' + this.model.capacity + '</strong>' + (prep ? '<button type="button" class="ac-small-button" data-action="auto">一键补位</button>' : '<span data-alive-count></span>') + '</div>' + this.traits() + this.bench() + '</section>' +
      '<aside class="ac-command">' + (prep ? '<button type="button" class="ac-battle-button" data-action="battle"' + (!this.model.deployed.length ? ' disabled' : '') + '>开始战斗 <span>第 ' + state.round + ' 关 →</span></button>' + this.inspector() + this.market() : state.phase === 'reward' ? this.rewardPanel() : '<section class="ac-battle-panel"><span class="ac-result-mark">⚔️ 自动交战</span><h3>小队正在战斗</h3><p data-battle-log>双方开始交锋</p><p>30 秒后进入加时，45 秒按剩余生命比例总和结算。</p></section>') +
      '<details class="ac-help"><summary>怎么玩</summary><ol><li>招募伙伴，点伙伴再点己方格子上阵。近战在前，远程在后。</li><li>3 个同名同星自动合成；不同同族棋子激活 2 / 3 羁绊。</li><li>留存金币，每 10 金币带来 1 利息，上限 5。锁定商店可留到下回合。</li><li>每回合 +2 经验；购买经验可提高人口。战后选一份奖励，击败第 8 关守门者。</li></ol><p>准备与领奖阶段自动存档；战斗中离开，下次从出战前继续。</p></details></aside></div></div>';
    if (!prep) this.paintCombat();
    this.connect3D();
    this.host.inert = !this.active;
    const help = this.host.querySelector<HTMLDetailsElement>('.ac-help');
    if (help) help.open = helpOpen;
    if (focusAttribute && focusValue !== null) {
      const replacement = this.host.querySelector<HTMLElement>('[' + focusAttribute + '="' + focusValue + '"]:not(:disabled)');
      (replacement || this.host.querySelector<HTMLElement>('[data-buy]:not(:disabled)') || this.host).focus({ preventScroll: true });
    }
  }

  private syncSpeed(): void {
    const button = this.host?.querySelector<HTMLButtonElement>('[data-action="speed"]');
    if (button) button.textContent = this.speed + '× 加速';
  }

  private paintCombat(): void {
    const combat = this.model.combat;
    if (!this.host || !combat) return;
    for (const fighter of combat.fighters) {
      const element = this.host.querySelector<HTMLElement>('[data-fighter="' + fighter.uid + '"]');
      if (!element) continue;
      element.style.left = fighter.cell % 6 / 6 * 100 + '%';
      element.style.top = Math.floor(fighter.cell / 6) / 6 * 100 + '%';
      element.classList.toggle('is-dead', fighter.hp <= 0);
      element.classList.toggle('is-attacking', fighter.flash > 0);
      element.classList.toggle('is-stunned', fighter.stunned > 0);
      element.classList.toggle('has-shield', fighter.shield > 0);
      const health = element.querySelector<HTMLElement>('.ac-health i');
      const mana = element.querySelector<HTMLElement>('.ac-mana i');
      if (health) health.style.width = Math.max(0, fighter.hp / fighter.maxHp * 100) + '%';
      if (mana) mana.style.width = fighter.mana / 4 * 100 + '%';
    }
    const time = this.host.querySelector('[data-battle-time]');
    if (time) time.textContent = Math.floor(combat.elapsed) + 's' + (combat.elapsed >= 30 ? ' · 加时' : '');
    const alive = this.host.querySelector('[data-alive-count]');
    if (alive) alive.textContent = '存活 ' + combat.fighters.filter((unit) => unit.team === 'ally' && unit.hp > 0).length + ' : ' + combat.fighters.filter((unit) => unit.team === 'enemy' && unit.hp > 0).length;
    const log = this.host.querySelector('[data-battle-log]');
    if (log && log.textContent !== combat.log) log.textContent = combat.log;
    const layer = this.host.querySelector('.ac-effects');
    for (const event of combat.events.splice(0)) {
      if (!layer || this.effects.length >= 20) continue;
      const node = document.createElement('span');
      node.className = 'ac-float is-' + event.kind;
      node.textContent = event.text;
      node.style.left = (event.cell % 6 + 0.5) / 6 * 100 + '%';
      node.style.top = (Math.floor(event.cell / 6) + 0.35) / 6 * 100 + '%';
      layer.append(node);
      this.effects.push({ node, life: 0.85 });
    }
  }

  dispose(): void {
    if (this.started) this.save();
    this.listener?.abort();
    this.boardView?.dispose();
    this.boardView = null;
    this.effects = [];
    this.host = null;
  }
}
