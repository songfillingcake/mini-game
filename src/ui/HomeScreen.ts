import { getBest } from '../core/Storage';
import { gameCards } from '../games';

export function renderHome(): string {
  const cards = gameCards.map((game, index) => {
    const best = getBest(game.id);
    return '<button class="game-card ' + game.color + '" data-game="' + game.id + '" style="--card-order:' + index + '">' +
      '<span class="card-tag">' + game.tag + '</span>' +
      '<span class="card-art"><span class="art-orbit"></span><span class="art-icon">' + game.icon + '</span><span class="art-spark spark-one">✦</span><span class="art-spark spark-two">✧</span></span>' +
      '<span class="card-copy"><span class="card-title">' + game.title + '<span class="card-arrow">↗</span></span>' +
      '<span class="card-subtitle">' + game.subtitle + '</span>' +
      '<span class="card-description">' + game.description + '</span>' +
      '<span class="card-footer"><span>⌨ ' + game.controls + '</span><span class="best-score">最佳 ' + best + '</span></span></span>' +
    '</button>';
  }).join('');

  return '<div class="home-page">' +
    '<header class="site-header"><a class="brand" href="#" aria-label="口袋游乐场首页"><span class="brand-mark"><span></span><span></span><span></span><span></span></span><span class="brand-name">口袋游乐场<small>POCKET PLAY</small></span></a>' +
    '<div class="header-note"><span class="online-dot"></span> 三款轻松小游戏 <span class="header-spark">✦</span></div></header>' +
    '<main class="home-main"><section class="intro"><div class="eyebrow"><span class="eyebrow-line"></span> 小小休息一下 <span class="eyebrow-line"></span></div>' +
    '<h1>今天想玩点<br /><span>什么？</span><i class="title-star">✳</i></h1>' +
    '<p>选一款小游戏，马上开始。<br class="mobile-break" />每一局都很短，再玩一次也没关系。</p>' +
    '<div class="intro-stamp"><span>PLAY</span><span>ANYTIME</span><b>☺</b></div></section>' +
    '<section class="game-grid" aria-label="选择小游戏">' + cards + '</section>' +
    '<footer class="home-footer"><span>准备好了就出发</span><span class="footer-dots"><i></i><i></i><i></i></span><span>键盘和触屏都能玩</span></footer></main>' +
    '<div class="floating-shape shape-one"></div><div class="floating-shape shape-two"></div></div>';
}
