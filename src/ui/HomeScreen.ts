import { getBest } from '../core/Storage';
import { gameCards } from '../games';
import { fishSpecies, getFishCounts, getFishJournalSummary } from '../games/fishing/FishJournal';
import { renderSoundToggle } from './SoundToggle';

export function renderHome(): string {
  const counts = getFishCounts();
  const journal = getFishJournalSummary();
  const cards = gameCards.map((game, index) => {
    const best = getBest(game.id);
    const featured = game.id === 'fishing';
    const description = featured
      ? '钓到鱼儿、发现新品种，把猫猫湖边的鱼图鉴慢慢填满。'
      : game.description;
    const progress = featured ? '图鉴 ' + journal.discovered + '/' + journal.total : '最佳 ' + best;
    return '<button class="game-card ' + game.color + (featured ? ' is-featured' : '') + '" data-game="' + game.id + '" style="--card-order:' + index + '">' +
      '<span class="card-tag">' + game.tag + '</span>' +
      '<span class="card-art"><span class="art-orbit"></span><span class="art-icon">' + game.icon + '</span><span class="art-spark spark-one">✦</span><span class="art-spark spark-two">✧</span></span>' +
      '<span class="card-copy"><span class="card-title">' + game.title + '<span class="card-arrow">↗</span></span>' +
      '<span class="card-subtitle">' + game.subtitle + '</span>' +
      '<span class="card-description">' + description + '</span>' +
      '<span class="card-footer"><span>⌨ ' + game.controls + '</span><span class="best-score">' + progress + '</span></span></span>' +
    '</button>';
  }).join('');

  const fishTiles = fishSpecies.map((fish) => {
    const count = counts[fish.id] || 0;
    const found = count > 0;
    return '<div class="journal-fish' + (found ? ' is-found' : '') + '" aria-label="' + (found ? fish.name + '，' + count + ' 条，' + fish.rarity : '尚未发现的鱼种') + '">' +
      '<span class="journal-fish-icon' + (found ? '' : ' is-hidden') + '">' + (found ? fish.icon : '？') + '</span>' +
      '<span class="journal-fish-name">' + (found ? fish.name : '未知鱼种') + '</span>' +
      '<span class="journal-fish-meta">' + (found ? count + ' 条 · ' + fish.rarity : '待发现') + '</span></div>';
  }).join('');

  return '<div class="home-page">' +
    '<header class="site-header"><a class="brand" href="#" aria-label="口袋游乐场首页"><span class="brand-mark"><span></span><span></span><span></span><span></span></span><span class="brand-name">口袋游乐场<small>POCKET PLAY</small></span></a>' +
    '<div class="header-actions">' + renderSoundToggle() + '<div class="header-note"><span class="online-dot"></span> 三款轻松小游戏 <span class="header-spark">✦</span></div></div></header>' +
    '<main class="home-main"><section class="intro"><div class="eyebrow"><span class="eyebrow-line"></span> 小小休息一下 <span class="eyebrow-line"></span></div>' +
    '<h1>今天想玩点<br /><span>什么？</span><i class="title-star">✳</i></h1>' +
      '<p>陪猫猫在湖边钓鱼、认识新朋友，<br class="mobile-break" />也可以随时玩一局轻松挑战。</p>' +
    '<div class="intro-stamp"><span>PLAY</span><span>ANYTIME</span><b>☺</b></div></section>' +
      '<section class="game-grid" aria-label="选择小游戏">' + cards + '</section>' +
      '<section class="journal-panel" aria-labelledby="journal-title"><div class="journal-heading"><div><span class="journal-eyebrow">FISH LOG</span><h2 id="journal-title">湖边鱼图鉴 <span>' + journal.discovered + '/' + journal.total + '</span></h2><p>每次钓到新朋友，都会记进猫猫的小本本。</p></div><div class="journal-catch-count"><strong>' + journal.caught + '</strong><span>条收获</span></div></div>' +
      '<div class="journal-progress" role="progressbar" aria-label="鱼种发现进度" aria-valuemin="0" aria-valuemax="' + journal.total + '" aria-valuenow="' + journal.discovered + '"><span style="width:' + Math.round(journal.discovered / journal.total * 100) + '%"></span></div>' +
      '<div class="journal-grid">' + fishTiles + '</div></section>' +
    '<footer class="home-footer"><span>准备好了就出发</span><span class="footer-dots"><i></i><i></i><i></i></span><span>键盘和触屏都能玩</span></footer></main>' +
    '<div class="floating-shape shape-one"></div><div class="floating-shape shape-two"></div></div>';
}
