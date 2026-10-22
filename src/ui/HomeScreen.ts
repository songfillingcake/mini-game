import { getBest } from '../core/Storage';
import { gameCards } from '../games';
import { fishSpecies, fishingZones, getAquariumDecorations, getCatAccessories, getDailyFishingEvent, getDailyFishingSighting, getDailyFishingWeather, getFavoriteFishIds, getTrackedFish, getFishCounts, getFishFriendship, getFishJournalSummary, getFishMilestones, getFishTrophyRanks, getFishTrophySummary, getFishingDailyQuest, getFishingRodStats, getFishingRodUpgrade, getFishingZoneOptions } from '../games/fishing/FishJournal';
import { renderSoundToggle } from './SoundToggle';

export function renderHome(): string {
  const counts = getFishCounts();
  const journal = getFishJournalSummary();
  const milestones = getFishMilestones();
  const weather = getDailyFishingWeather();
  const dailyEvent = getDailyFishingEvent();
  const quest = getFishingDailyQuest();
  const sighting = getDailyFishingSighting();
  const trophyRanks = getFishTrophyRanks();
  const favoriteFishIds = new Set(getFavoriteFishIds());
  const trackedFishId = getTrackedFish()?.id || '';
  const trophySummary = getFishTrophySummary();
  const decorations = getAquariumDecorations();
  const catAccessories = getCatAccessories();
  const rod = getFishingRodStats();
  const rodUpgrade = getFishingRodUpgrade();
  const selectedDecoration = decorations.find((decoration) => decoration.selected) || decorations[0];
  const cards = gameCards.map((game, index) => {
    const best = getBest(game.id);
    const featured = game.id === 'fishing';
    const description = featured
      ? '游过青叶湖、珊瑚湾、月光海和极光湾，跟着每日天气找鱼，把猫猫的鱼图鉴慢慢填满。'
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

  const renderFishTile = (fish: typeof fishSpecies[number]) => {
    const count = counts[fish.id] || 0;
    const found = count > 0;
    const trophyRank = trophyRanks[fish.id] || 0;
    const tracked = fish.id === trackedFishId;
    const friendship = found ? getFishFriendship(fish.id, count) : null;
    const tag = found ? 'button' : 'div';
    const profileAttributes = found ? ' type="button" data-fish-profile="' + fish.id + '" title="点击查看鱼类小传"' : '';
    const friendshipLabel = friendship ? friendship.complete ? friendship.title : friendship.title + ' · 再钓 ' + friendship.remaining + ' 条' : '';
    const undiscoveredHint = fish.eventId
      ? dailyEvent.id === fish.eventId ? '奇遇限定 · 今日出现' : '奇遇限定 · 等待轮换'
      : '待发现';
    return '<' + tag + ' class="journal-fish' + (found ? ' is-found' : '') + (tracked ? ' is-tracked' : '') + '"' + profileAttributes + ' aria-label="' + (found ? (tracked ? '追踪目标，' : '') + fish.name + '，' + count + ' 条，' + fish.rarity + '，鱼友情：' + friendshipLabel + '，最佳收线章 ' + trophyRank + ' 星，挣扎习性：' + fish.pullHint + '，打开鱼类小传' : '尚未发现的鱼种') + '">' +
      '<span class="journal-fish-icon' + (found ? '' : ' is-hidden') + '">' + (found ? fish.icon : '？') + '</span>' +
      '<span class="journal-fish-name">' + (found ? fish.name : '未知鱼种') + '</span>' +
      (tracked ? '<span class="journal-fish-tracked">追踪中</span>' : '') +
      '<span class="journal-fish-meta">' + (found ? count + ' 条 · ' + fish.rarity + (fish.eventId ? ' · 奇遇鱼' : '') : undiscoveredHint) + '</span>' +
      (friendship ? '<span class="journal-fish-friendship">' + friendshipLabel + '</span>' : '') +
      (found ? '<span class="journal-fish-habit">' + fish.pullHint + '</span><span class="journal-fish-trophy" aria-label="最佳收线章 ' + trophyRank + ' 星">' + '★'.repeat(trophyRank) + '<i>' + '☆'.repeat(3 - trophyRank) + '</i></span>' : '') + '</' + tag + '>';
  };
  const zoneOptions = getFishingZoneOptions();
  const discoveredFish = fishSpecies.filter((fish) => (counts[fish.id] || 0) > 0);
  const aquariumColumns = 6;
  const aquariumRows = Math.max(1, Math.ceil(discoveredFish.length / aquariumColumns));
  const aquariumFishSize = aquariumRows >= 4 ? Math.max(18, Math.floor(112 / aquariumRows)) : 38;
  const aquariumFishIconSize = Math.round(aquariumFishSize * 0.78);
  const aquariumFish = discoveredFish.map((fish, index) => {
    const row = Math.floor(index / aquariumColumns);
    const rowStart = row * aquariumColumns;
    const rowCount = Math.min(aquariumColumns, discoveredFish.length - rowStart);
    const column = index - rowStart;
    const rowSpan = Math.min(84, (rowCount - 1) * 35);
    const left = rowCount === 1 ? 50 : (100 - rowSpan) / 2 + (column * rowSpan) / (rowCount - 1);
    const topStart = aquariumRows === 1 ? 50 : aquariumRows === 2 ? 32 : aquariumRows === 3 ? 20 : 24;
    const topEnd = aquariumRows === 1 ? 50 : aquariumRows === 2 ? 68 : aquariumRows === 3 ? 80 : 82;
    const top = aquariumRows === 1 ? 50 : topStart + row * ((topEnd - topStart) / (aquariumRows - 1));
    const duration = 5.5 + (index % 4) * 0.8;
    const delay = -(index % 6) * 0.7;
    const trophyRank = trophyRanks[fish.id] || 0;
    const favorite = favoriteFishIds.has(fish.id);
    const tracked = fish.id === trackedFishId;
    const friendship = getFishFriendship(fish.id, counts[fish.id] || 0);
    return '<button class="aquarium-fish' + (trophyRank === 3 ? ' has-perfect-trophy' : '') + (friendship.level >= 2 ? ' has-friendship' : '') + (favorite ? ' is-favorite' : '') + (tracked ? ' is-tracked' : '') + (aquariumRows >= 4 ? ' is-compact' : '') + '" type="button" data-fish-profile="' + fish.id + '" data-aquarium-fish="' + fish.id + '" aria-label="' + (tracked ? '正在追踪，' : '') + (favorite ? '猫猫最爱的 ' : '') + '查看' + fish.name + '鱼类小传，鱼友情：' + friendship.title + '，最佳收线章 ' + trophyRank + ' 星" style="left:' + left + '%;top:' + top + '%;width:' + aquariumFishSize + 'px;height:' + aquariumFishSize + 'px;margin-left:-' + aquariumFishSize / 2 + 'px;margin-top:-' + aquariumFishSize / 2 + 'px;font-size:' + aquariumFishIconSize + 'px;animation-duration:' + duration + 's;animation-delay:' + delay + 's">' + fish.icon + (friendship.level >= 2 ? '<span class="aquarium-friendship-mark" aria-hidden="true">✦</span>' : '') + (favorite ? '<span class="aquarium-favorite-mark" aria-hidden="true">♥</span>' : '') + (tracked ? '<span class="aquarium-tracked-mark" aria-hidden="true">⌖</span>' : '') + (trophyRank > 0 ? '<span class="aquarium-stars" aria-hidden="true">' + '★'.repeat(trophyRank) + '</span>' : '') + '</button>';
  }).join('');
  const decorOptions = decorations.map((decoration) => {
    const disabled = !decoration.unlocked && quest.shells < decoration.price;
    const action = decoration.selected ? '已布置' : decoration.unlocked ? '点击布置' : decoration.price + ' 🐚';
    return '<button type="button" class="aquarium-decor-option' + (decoration.selected ? ' is-selected' : '') + (disabled ? ' is-locked' : '') + '" data-aquarium-decor="' + decoration.id + '" aria-pressed="' + decoration.selected + '"' + (disabled ? ' disabled' : '') + '>' +
      '<span>' + decoration.icon + '</span><strong>' + decoration.label + '</strong><small>' + action + '</small></button>';
  }).join('');
  const accessoryOptions = catAccessories.map((accessory) => {
    const disabled = !accessory.unlocked && !accessory.affordable;
    const action = accessory.selected
      ? '佩戴中'
      : accessory.unlocked
        ? '点击佩戴'
        : journal.discovered < accessory.requiredDiscoveries
          ? '图鉴 ' + accessory.requiredDiscoveries + ' 种解锁'
          : accessory.price > 0 ? accessory.price + ' 🐚' : '免费解锁';
    return '<button type="button" class="aquarium-decor-option cat-accessory-option' + (accessory.selected ? ' is-selected' : '') + (disabled ? ' is-locked' : '') + '" data-cat-accessory="' + accessory.id + '" aria-pressed="' + accessory.selected + '"' + (disabled ? ' disabled' : '') + '>' +
      '<span>' + accessory.icon + '</span><strong>' + accessory.label + '</strong><small>' + action + '</small></button>';
  }).join('');
  const rodUpgradeHint = rodUpgrade
    ? !rodUpgrade.discoveryReady
      ? '图鉴还需发现 ' + (rodUpgrade.requiredDiscoveries - journal.discovered) + ' 种鱼'
      : !rodUpgrade.affordable
        ? '还差 ' + (rodUpgrade.price - quest.shells) + ' 枚贝壳'
        : '升级 · ' + rodUpgrade.price + ' 🐚'
    : '已经达到最高等级';
  const rodUpgradeButton = rodUpgrade
    ? '<button type="button" class="rod-upgrade-button' + (rodUpgrade.discoveryReady && rodUpgrade.affordable ? ' is-ready' : '') + '" data-rod-upgrade aria-label="升级至' + rodUpgrade.label + '"' + (rodUpgrade.discoveryReady && rodUpgrade.affordable ? '' : ' disabled') + '>' + rodUpgradeHint + '</button>'
    : '<span class="rod-upgrade-max">已满级</span>';
  const rodNextDetails = rodUpgrade
    ? '<small class="rod-next-detail">下一杆 ' + rodUpgrade.label + ' · ' + rodUpgrade.detail + ' · ' + rodUpgrade.price + ' 🐚</small>'
    : '';
  const sightingFound = (counts[sighting.fish.id] || 0) > 0;
  const eventFish = fishSpecies.find((fish) => fish.eventId === dailyEvent.id);
  const eventFishFound = eventFish ? (counts[eventFish.id] || 0) > 0 : false;
  const eventFishHint = eventFishFound
    ? '已遇见奇遇鱼「' + eventFish?.name + '」；还可以挑战更高收线章'
    : '这场奇遇还藏着一条限定鱼影，钓到后会收入图鉴';
  const sightingDescription = sighting.completed
    ? '今日的鱼影已经收入图鉴，明天会有新的目标。'
    : sightingFound
      ? '重遇这位鱼友也算数；目标鱼会更常出现，钓到后可领取奖励。'
      : '前往提示海域，目标鱼会更常出现；错过后也会再来。钓到可领奖励。';
  const eventCard = '<section class="daily-event" aria-label="今日海域奇遇"><div class="daily-event-top"><div><span class="daily-event-eyebrow">TODAY\'S SEA EVENT</span><strong>✨ 今日海域奇遇</strong></div><span class="daily-event-icon" aria-hidden="true">' + dailyEvent.icon + '</span></div>' +
    '<div class="daily-event-target"><span>' + dailyEvent.zone.icon + '</span><div><strong>' + dailyEvent.zone.label + ' · ' + dailyEvent.label + '</strong><small>' + dailyEvent.detail + '</small></div></div>' +
    '<p class="daily-event-fish-hint">' + eventFishHint + '</p>' +
    '<button class="daily-event-action" type="button" data-daily-event-zone="' + dailyEvent.zone.id + '">去奇遇海域看看 <span aria-hidden="true">→</span></button></section>';
  const sightingCard = '<section class="daily-sighting' + (sighting.completed ? ' is-complete' : '') + '" aria-label="今日鱼影目标"><div class="daily-sighting-top"><div><span class="daily-sighting-eyebrow">DAILY FISH TRACE</span><strong>🐾 今日鱼影</strong></div><span class="daily-sighting-reward">' + (sighting.completed ? '已完成 ✓' : '+' + sighting.reward + ' 🐚') + '</span></div>' +
    '<div class="daily-sighting-fish"><span aria-hidden="true">' + sighting.fish.icon + '</span><div><strong>' + sighting.fish.name + '</strong><small>' + sighting.zone.icon + ' ' + sighting.zone.label + ' · ' + sighting.fish.rarity + '鱼</small></div><i>' + '★'.repeat(trophyRanks[sighting.fish.id] || 0) + '<em>' + '☆'.repeat(3 - (trophyRanks[sighting.fish.id] || 0)) + '</em></i></div>' +
    '<p>' + sightingDescription + '</p><button class="daily-sighting-action" type="button" data-sighting-zone="' + sighting.zone.id + '">' + (sighting.completed ? '再访' : '前往') + sighting.zone.label + ' <span aria-hidden="true">→</span></button></section>';
  const milestoneCards = milestones.map((milestone) => {
    const progress = Math.min(milestone.progress, milestone.target);
    return '<div class="fish-milestone' + (milestone.claimed ? ' is-claimed' : '') + (milestone.perfectZone ? ' is-perfect' : '') + '"><span class="fish-milestone-icon">' + milestone.icon + '</span><strong>' + milestone.title + '</strong><small>' + progress + '/' + milestone.target + ' · +' + milestone.reward + ' 🐚</small><i><b style="width:' + Math.round(progress / milestone.target * 100) + '%"></b></i>' +
      (milestone.claimed ? '<em>已领取</em>' : '') + '</div>';
  }).join('');
  const zoneSections = fishingZones.map((zone) => {
    const zoneFish = fishSpecies.filter((fish) => fish.zoneId === zone.id);
    const found = zoneFish.filter((fish) => counts[fish.id] > 0).length;
    const option = zoneOptions.find((item) => item.id === zone.id);
    return '<section class="journal-zone" aria-label="' + zone.label + '鱼种"><div class="journal-zone-heading"><h3>' + zone.icon + ' ' + zone.label + '</h3><span>' + found + '/' + zoneFish.length + ' 已发现</span>' +
      (option && !option.unlocked ? '<small>' + zone.unlockHint + '</small>' : '') + '</div>' +
      '<div class="journal-grid">' + zoneFish.map(renderFishTile).join('') + '</div></section>';
  }).join('');

  return '<div class="home-page">' +
    '<header class="site-header"><a class="brand" href="#" aria-label="口袋游乐场首页"><span class="brand-mark"><span></span><span></span><span></span><span></span></span><span class="brand-name">口袋游乐场<small>POCKET PLAY</small></span></a>' +
    '<div class="header-actions"><button class="save-backup-button" type="button" data-save-backup aria-haspopup="dialog">存档</button>' + renderSoundToggle() + '<div class="header-note"><span class="online-dot"></span> 五款轻松小游戏 <span class="header-spark">✦</span></div></div></header>' +
    '<main class="home-main"><section class="intro"><div class="eyebrow"><span class="eyebrow-line"></span> 小小休息一下 <span class="eyebrow-line"></span></div>' +
    '<h1>今天想玩点<br /><span>什么？</span><i class="title-star">✳</i></h1>' +
      '<p>陪猫猫在湖边钓鱼、认识新朋友，<br class="mobile-break" />也可以随时玩一局轻松挑战。</p>' +
    '<div class="intro-stamp"><span>PLAY</span><span>ANYTIME</span><b>☺</b></div></section>' +
      '<section class="game-grid" aria-label="选择小游戏">' + cards + '</section>' +
      '<section class="journal-panel" aria-labelledby="journal-title"><div class="journal-heading"><div><span class="journal-eyebrow">FISH LOG</span><h2 id="journal-title">冒险鱼图鉴 <span>' + journal.discovered + '/' + journal.total + '</span></h2><p>每次钓到新朋友，都会记进猫猫的小本本。</p></div><div class="journal-catch-count"><strong>' + journal.caught + '</strong><span>条收获</span></div></div>' +
      '<div class="journal-progress" role="progressbar" aria-label="鱼种发现进度" aria-valuemin="0" aria-valuemax="' + journal.total + '" aria-valuenow="' + journal.discovered + '"><span style="width:' + Math.round(journal.discovered / journal.total * 100) + '%"></span></div>' +
      '<div class="fish-trophy-progress"><div><strong>精准鱼获章</strong><span>' + trophySummary.earned + '/' + trophySummary.total + ' 星</span></div><div class="fish-trophy-track" role="progressbar" aria-label="鱼获收线章进度" aria-valuemin="0" aria-valuemax="' + trophySummary.total + '" aria-valuenow="' + trophySummary.earned + '"><i><b style="width:' + Math.round(trophySummary.earned / trophySummary.total * 100) + '%"></b></i></div><small>每种鱼最多收集 3 星；提升最佳收线记录可获得贝壳</small></div>' +
      '<p class="journal-unlock-hint">鱼饵：发现 3、5、8、12、16 种依次解锁荧光、虾肉、回声、云絮和星光鱼饵 · 海域：发现 4、8、12 种依次解锁珊瑚湾、月光海和极光湾</p>' +
      '<p class="journal-daily-weather"><span>今日天气</span><strong>' + weather.icon + ' ' + weather.label + '</strong><em>' + weather.detail + '</em></p>' +
      eventCard +
      sightingCard +
      '<section class="daily-quest' + (quest.completed ? ' is-complete' : '') + '" aria-label="每日委托"><div class="daily-quest-top"><div><span class="daily-quest-eyebrow">DAILY REQUEST</span><strong>' + (quest.completed ? '✓ 今日委托完成' : '🐾 今日委托 · ' + quest.title) + '</strong></div><span class="shell-balance">🐚 ' + quest.shells + '</span></div>' +
      '<p>' + quest.description + '<span>' + quest.progress + '/' + quest.target + '</span></p><div class="daily-quest-progress" role="progressbar" aria-label="每日委托进度" aria-valuemin="0" aria-valuemax="' + quest.target + '" aria-valuenow="' + quest.progress + '"><i style="width:' + Math.round(quest.progress / quest.target * 100) + '%"></i></div>' +
      '<small>' + (quest.completed ? '贝壳奖励已经放进猫猫的小口袋' : '完成后获得 ' + quest.reward + ' 枚贝壳，可布置鱼缸或升级鱼竿') + '</small></section>' +
      '<section class="fish-milestones" aria-label="图鉴里程碑"><div class="fish-milestones-heading"><strong>图鉴里程碑</strong><span>集齐海域鱼册、收线得三星可领贝壳</span></div><div class="fish-milestone-list">' + milestoneCards + '</div></section>' +
      '<div class="fish-aquarium" data-aquarium-rows="' + aquariumRows + '" data-aquarium-theme="' + (selectedDecoration?.theme || 'pond') + '" role="region" aria-label="猫猫的小鱼缸，已发现 ' + journal.discovered + ' 种鱼"><span class="aquarium-title">猫猫的小鱼缸 · ' + (selectedDecoration?.label || '青叶水草') + '</span><span class="aquarium-count">' + journal.discovered + '/' + journal.total + '</span>' +
      (aquariumFish || '<p class="aquarium-empty">钓到的第一位朋友，会住进这里</p>') + '<span class="aquarium-bubble bubble-a"></span><span class="aquarium-bubble bubble-b"></span></div>' +
      '<p class="aquarium-hint"><span>点鱼看鱼友进度；熟络后会解锁新故事</span><button type="button" class="collection-share-button" data-collection-card aria-label="分享或保存鱼图鉴收藏卡片">分享图鉴</button></p>' +
      '<div class="aquarium-shop"><div class="aquarium-shop-heading"><strong>给小鱼缸换个景</strong><span>每日委托奖励也能升级鱼竿</span></div><div class="aquarium-decor-options">' + decorOptions + '</div></div>' +
      '<div class="aquarium-shop cat-wardrobe"><div class="aquarium-shop-heading"><strong>猫猫的小衣橱</strong><span>收集贝壳和图鉴，给出海的猫猫换装</span></div><div class="cat-accessory-options">' + accessoryOptions + '</div></div>' +
      '<div class="fishing-workshop"><div><span>🎣 猫猫装备角</span><strong>' + rod.label + ' · Lv.' + rod.level + '</strong><small>' + rod.detail + '</small>' + rodNextDetails + '</div>' + rodUpgradeButton + '</div>' +
      '<div class="journal-zones">' + zoneSections + '</div></section>' +
    '<dialog class="fish-profile-dialog" id="fish-profile-dialog" aria-labelledby="fish-profile-title"><button class="fish-profile-close" type="button" data-profile-close aria-label="关闭鱼类小传">×</button><div id="fish-profile-content"></div><button class="fish-profile-return" type="button" data-profile-close>收进图鉴</button></dialog>' +
    '<dialog class="save-backup-dialog" id="save-backup-dialog" aria-labelledby="save-backup-title"><button class="fish-profile-close" type="button" data-save-close aria-label="关闭存档窗口">×</button><span class="save-dialog-kicker">POCKET PLAY</span><h2 id="save-backup-title">带上你的游戏进度</h2><p>导出一个存档文件，在另一台设备打开本游戏后再导入。存档只保存在你选择的文件里，不会上传。</p><div class="save-dialog-actions"><button class="save-export-button" type="button" data-save-export>导出本机存档</button><button class="save-import-button" type="button" data-save-import-trigger>选择存档文件</button><input type="file" accept=".json,application/json" data-save-file hidden /></div><p class="save-dialog-warning">导入会替换当前浏览器的游戏纪录、鱼图鉴、贝壳和偏好。建议先导出备份。</p><p class="save-dialog-status" data-save-status role="status" aria-live="polite">包含五款游戏的最佳纪录和猫猫钓鱼的收集进度。</p><button class="fish-profile-return" type="button" data-save-close>完成</button></dialog>' +
    '<footer class="home-footer"><span>准备好了就出发</span><span class="footer-dots"><i></i><i></i><i></i></span><span>键盘和触屏都能玩</span></footer></main>' +
    '<div class="floating-shape shape-one"></div><div class="floating-shape shape-two"></div></div>';
}
