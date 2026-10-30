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
    const progress = featured ? '图鉴 ' + journal.discovered + '/' + journal.total : '最佳 ' + best;
    return '<button class="game-card ' + game.color + '" data-game="' + game.id + '" style="--card-order:' + index + '">' +
      '<span class="card-art"><span class="art-orbit"></span><span class="art-icon">' + game.icon + '</span><span class="art-spark spark-one">✦</span><span class="art-spark spark-two">✧</span></span>' +
      '<span class="card-copy"><span class="card-title">' + game.title + '</span>' +
      '<span class="card-subtitle">' + game.tag + '</span>' +
      '<span class="card-footer"><span class="best-score">' + progress + '</span><span>开始玩 →</span></span></span>' +
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
      (tracked ? '<span class="journal-fish-tracked" aria-label="正在追踪">⌖</span>' : '') +
      '<span class="journal-fish-meta">' + (found ? fish.rarity + (fish.eventId ? ' · 奇遇' : '') : undiscoveredHint) + '</span>' +
      (found ? '<span class="journal-fish-trophy" aria-label="最佳收线章 ' + trophyRank + ' 星">' + '★'.repeat(trophyRank) + '<i>' + '☆'.repeat(3 - trophyRank) + '</i></span>' : '') + '</' + tag + '>';
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
  const eventCard = '<section class="daily-event" aria-label="今日海域奇遇"><div class="daily-event-top"><strong>海域奇遇</strong></div>' +
    '<div class="daily-event-target"><span aria-hidden="true">' + dailyEvent.icon + '</span><div><strong>' + dailyEvent.label + '</strong><small>' + dailyEvent.zone.label + '</small></div></div>' +
    '<button class="daily-event-action" type="button" data-daily-event-zone="' + dailyEvent.zone.id + '">前往奇遇 <span aria-hidden="true">→</span></button></section>';
  const sightingCard = '<section class="daily-sighting' + (sighting.completed ? ' is-complete' : '') + '" aria-label="今日鱼影目标"><div class="daily-sighting-top"><strong>今日鱼影</strong><span class="daily-sighting-reward">' + (sighting.completed ? '已完成 ✓' : '+' + sighting.reward + ' 🐚') + '</span></div>' +
    '<div class="daily-sighting-fish"><span aria-hidden="true">' + sighting.fish.icon + '</span><div><strong>' + sighting.fish.name + '</strong><small>' + sighting.zone.label + '</small></div></div>' +
    '<button class="daily-sighting-action" type="button" data-sighting-zone="' + sighting.zone.id + '">' + (sighting.completed ? '再去钓鱼' : '寻找鱼影') + ' <span aria-hidden="true">→</span></button></section>';
  const questCard = '<section class="daily-quest' + (quest.completed ? ' is-complete' : '') + '" aria-label="每日委托"><div class="daily-quest-top"><strong>每日委托</strong><span class="daily-sighting-reward">' + (quest.completed ? '已完成 ✓' : '+' + quest.reward + ' 🐚') + '</span></div>' +
    '<p>' + quest.description + '</p><div class="quest-count">' + quest.progress + '<span> / ' + quest.target + '</span></div><div class="daily-quest-progress" role="progressbar" aria-label="每日委托进度" aria-valuemin="0" aria-valuemax="' + quest.target + '" aria-valuenow="' + quest.progress + '"><i style="width:' + Math.round(quest.progress / quest.target * 100) + '%"></i></div></section>';
  const milestoneCards = milestones.map((milestone) => {
    const progress = Math.min(milestone.progress, milestone.target);
    return '<div class="fish-milestone' + (milestone.claimed ? ' is-claimed' : '') + (milestone.perfectZone ? ' is-perfect' : '') + '"><span class="fish-milestone-icon">' + milestone.icon + '</span><strong>' + milestone.title + '</strong><small>' + progress + '/' + milestone.target + ' · +' + milestone.reward + ' 🐚</small><i><b style="width:' + Math.round(progress / milestone.target * 100) + '%"></b></i>' +
      (milestone.claimed ? '<em>已领取</em>' : '') + '</div>';
  }).join('');
  const zoneSections = fishingZones.map((zone) => {
    const zoneFish = fishSpecies.filter((fish) => fish.zoneId === zone.id);
    const found = zoneFish.filter((fish) => counts[fish.id] > 0).length;
    const option = zoneOptions.find((item) => item.id === zone.id);
    return '<details class="journal-zone" data-home-section="zone-' + zone.id + '"' + (zone.id === 'lake' ? ' open' : '') + '><summary class="journal-zone-heading"><h3>' + zone.icon + ' ' + zone.label + '</h3><span>' + (option && !option.unlocked ? '未解锁' : found + '/' + zoneFish.length) + '</span></summary>' +
      (option && !option.unlocked ? '<p class="zone-unlock-hint">' + zone.unlockHint + '</p>' : '') +
      '<div class="journal-grid">' + zoneFish.map(renderFishTile).join('') + '</div></details>';
  }).join('');

  const disclosure = (id: string, title: string, meta: string, content: string, open = false): string =>
    '<details class="home-disclosure" data-home-section="' + id + '"' + (open ? ' open' : '') + '><summary><span>' + title + '</span><small>' + meta + '</small><span class="disclosure-chevron" aria-hidden="true">⌄</span></summary><div class="disclosure-content">' + content + '</div></details>';
  const equipment = '<div class="fishing-workshop"><div><strong>' + rod.label + ' · Lv.' + rod.level + '</strong><small>' + rod.detail + '</small>' + rodNextDetails + '</div>' + rodUpgradeButton + '</div>' +
    '<div class="aquarium-shop"><div class="aquarium-shop-heading"><strong>鱼缸布景</strong></div><div class="aquarium-decor-options">' + decorOptions + '</div></div>' +
    '<div class="aquarium-shop cat-wardrobe"><div class="aquarium-shop-heading"><strong>猫猫配饰</strong></div><div class="cat-accessory-options">' + accessoryOptions + '</div></div>';
  const achievements = '<div class="fish-trophy-progress"><div><strong>精准鱼获章</strong><span>' + trophySummary.earned + '/' + trophySummary.total + ' 星</span></div><div class="fish-trophy-track" role="progressbar" aria-label="鱼获收线章进度" aria-valuemin="0" aria-valuemax="' + trophySummary.total + '" aria-valuenow="' + trophySummary.earned + '"><i><b style="width:' + Math.round(trophySummary.earned / trophySummary.total * 100) + '%"></b></i></div></div>' +
    '<div class="fish-milestone-list">' + milestoneCards + '</div>';
  const explorationGuide = '<dl class="exploration-guide"><div><dt>今日天气 · ' + weather.label + '</dt><dd>' + weather.detail + '</dd></div>' +
    '<div><dt>' + dailyEvent.label + '</dt><dd>' + dailyEvent.detail + '。' + eventFishHint + '</dd></div><div><dt>今日鱼影</dt><dd>' + sightingDescription + '</dd></div>' +
    '<div><dt>新海域</dt><dd>发现 4 / 8 / 12 种鱼，依次开放珊瑚湾、月光海和极光湾。</dd></div>' +
    '<div><dt>新鱼饵</dt><dd>发现 3 / 5 / 8 / 12 / 16 种鱼，依次解锁荧光、虾肉、回声、云絮和星光鱼饵。</dd></div>' +
    '<div><dt>收线与奖励</dt><dd>每种鱼最高 3 星；刷新星级和完成成就可获得贝壳。贝壳可升级鱼竿、解锁装扮。</dd></div></dl>';

  return '<div class="home-page">' +
    '<header class="site-header"><a class="brand" href="#" aria-label="口袋游乐场首页"><span class="brand-mark"><span></span><span></span><span></span><span></span></span><span class="brand-name">口袋游乐场<small>POCKET PLAY</small></span></a>' +
    '<div class="header-actions"><button class="save-backup-button" type="button" data-save-backup aria-haspopup="dialog">存档</button>' + renderSoundToggle() + '<div class="header-note"><span class="online-dot"></span> ' + gameCards.length + ' 款小游戏 <span class="header-spark">✦</span></div></div></header>' +
    '<main class="home-main"><section class="intro"><div class="eyebrow"><span class="eyebrow-line"></span> 小小休息一下 <span class="eyebrow-line"></span></div>' +
    '<h1>今天想玩点<br /><span>什么？</span><i class="title-star">✳</i></h1>' +
      '<p>挑一款，轻松玩一会儿。</p>' +
    '<div class="intro-stamp"><span>PLAY</span><span>ANYTIME</span><b>☺</b></div></section>' +
      '<section class="game-grid" aria-label="选择小游戏">' + cards + '</section>' +
      '<section class="journal-panel" aria-labelledby="journal-title"><div class="journal-heading"><h2 id="journal-title">猫猫的收藏 <span>' + journal.discovered + '/' + journal.total + '</span></h2><div class="collection-meta"><span>' + weather.icon + ' ' + weather.label + '</span><span class="shell-balance" aria-label="贝壳余额 ' + quest.shells + '">🐚 ' + quest.shells + '</span></div></div>' +
      '<div class="journal-progress" role="progressbar" aria-label="鱼种发现进度" aria-valuemin="0" aria-valuemax="' + journal.total + '" aria-valuenow="' + journal.discovered + '"><span style="width:' + Math.round(journal.discovered / journal.total * 100) + '%"></span></div>' +
      '<div class="daily-board" aria-label="今日目标">' + sightingCard + eventCard + questCard + '</div>' +
      '<div class="fish-aquarium" data-aquarium-rows="' + aquariumRows + '" data-aquarium-theme="' + (selectedDecoration?.theme || 'pond') + '" role="region" aria-label="猫猫的小鱼缸，已发现 ' + journal.discovered + ' 种鱼"><span class="aquarium-title">猫猫的小鱼缸</span><span class="aquarium-count">' + journal.discovered + '/' + journal.total + '</span>' +
      (aquariumFish || '<p class="aquarium-empty">钓到的第一位朋友，会住进这里</p>') + '<span class="aquarium-bubble bubble-a"></span><span class="aquarium-bubble bubble-b"></span></div>' +
      '<p class="aquarium-hint"><span>点鱼查看小传</span><button type="button" class="collection-share-button" data-collection-card aria-label="分享或保存鱼图鉴收藏卡片">分享图鉴</button></p>' +
      disclosure('atlas', '鱼种图鉴', journal.discovered + '/' + journal.total, '<div class="journal-zones">' + zoneSections + '</div>', true) +
      disclosure('equipment', '装备与装扮', '鱼竿 Lv.' + rod.level, equipment) +
      disclosure('achievements', '收集成就', milestones.filter((milestone) => milestone.claimed).length + '/' + milestones.length, achievements) +
      disclosure('guide', '探索说明', '天气 · 解锁', explorationGuide) + '</section>' +
    '<dialog class="fish-profile-dialog" id="fish-profile-dialog" aria-labelledby="fish-profile-title"><button class="fish-profile-close" type="button" data-profile-close aria-label="关闭鱼类小传">×</button><div id="fish-profile-content"></div><button class="fish-profile-return" type="button" data-profile-close>收进图鉴</button></dialog>' +
    '<dialog class="save-backup-dialog" id="save-backup-dialog" aria-labelledby="save-backup-title"><button class="fish-profile-close" type="button" data-save-close aria-label="关闭存档窗口">×</button><span class="save-dialog-kicker">POCKET PLAY</span><h2 id="save-backup-title">带上你的游戏进度</h2><p>导出一个存档文件，在另一台设备打开本游戏后再导入。存档只保存在你选择的文件里，不会上传。</p><div class="save-dialog-actions"><button class="save-export-button" type="button" data-save-export>导出本机存档</button><button class="save-import-button" type="button" data-save-import-trigger>选择存档文件</button><input type="file" accept=".json,application/json" data-save-file hidden /></div><p class="save-dialog-warning">导入会替换当前浏览器的游戏纪录、鱼图鉴、贝壳和偏好。建议先导出备份。</p><p class="save-dialog-status" data-save-status role="status" aria-live="polite">包含全部游戏纪录、猫猫钓鱼收集进度和自走棋远征存档。</p><button class="fish-profile-return" type="button" data-save-close>完成</button></dialog>' +
    '<footer class="home-footer"><span>准备好了就出发</span><span class="footer-dots"><i></i><i></i><i></i></span><span>键盘和触屏都能玩</span></footer></main>' +
    '<div class="floating-shape shape-one"></div><div class="floating-shape shape-two"></div></div>';
}
