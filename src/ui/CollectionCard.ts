import { fishSpecies, fishingZones, getCatAccessories, getFavoriteFishIds, getFishBestLengths, getFishCounts, getFishSizeLabel, getFishTrophyRanks, getFishTrophySummary } from '../games/fishing/FishJournal';

const posterWidth = 1080;
const posterHeight = 1350;
const posterFont = '"Trebuchet MS", "Microsoft YaHei", sans-serif';

function fillRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function setPosterText(ctx: CanvasRenderingContext2D, size: number, weight = 700, color = '#49645a', align: CanvasTextAlign = 'left'): void {
  ctx.font = weight + ' ' + size + 'px ' + posterFont;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
}

export function createFishCollectionCard(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = posterWidth;
  canvas.height = posterHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法生成鱼图鉴卡片');

  const counts = getFishCounts();
  const trophies = getFishTrophyRanks();
  const favorites = new Set(getFavoriteFishIds());
  const bestLengths = getFishBestLengths();
  const selectedAccessory = getCatAccessories().find((accessory) => accessory.selected);
  const trophySummary = getFishTrophySummary();
  const discovered = fishSpecies.filter((fish) => (counts[fish.id] || 0) > 0).length;
  const catches = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const longestCatchCm = Math.max(0, ...Object.values(bestLengths));
  const longestFish = fishSpecies.find((fish) => bestLengths[fish.id] === longestCatchCm && longestCatchCm > 0);
  const masteredZones = fishingZones.filter((zone) => {
    const zoneFish = fishSpecies.filter((fish) => fish.zoneId === zone.id);
    return zoneFish.length > 0 && zoneFish.every((fish) => trophies[fish.id] === 3);
  }).length;

  const background = ctx.createLinearGradient(0, 0, posterWidth, posterHeight);
  background.addColorStop(0, '#e0f0df');
  background.addColorStop(.48, '#f7f0dc');
  background.addColorStop(1, '#f6dfd0');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, posterWidth, posterHeight);

  ctx.fillStyle = 'rgba(255,255,255,.36)';
  for (let i = 0; i < 18; i += 1) {
    const x = (i * 197 + 73) % posterWidth;
    const y = (i * 139 + 54) % 420;
    ctx.beginPath();
    ctx.arc(x, y, i % 4 === 0 ? 12 : 6, 0, Math.PI * 2);
    ctx.fill();
  }
  fillRoundedRect(ctx, 26, 26, posterWidth - 52, posterHeight - 52, 42, 'rgba(255,253,245,.5)', 'rgba(255,255,255,.72)');

  setPosterText(ctx, 20, 800, '#9a8068');
  ctx.fillText('POCKET PLAY  ·  FISHING ATLAS', 74, 83);
  setPosterText(ctx, 54, 900, '#35574f');
  ctx.fillText('猫猫钓鱼 · 我的冒险鱼图鉴', 72, 152);
  setPosterText(ctx, 21, 600, '#788d7e');
  ctx.fillText('每一条鱼，都有一段属于我们的相遇。', 76, 198);
  setPosterText(ctx, 52, 400, '#edac78');
  ctx.fillText('🐱', 1004, 126);
  setPosterText(ctx, 28, 500, '#75948a', 'center');
  ctx.fillText(selectedAccessory?.icon || '🐾', 1004, 174);
  setPosterText(ctx, 13, 700, '#849185', 'center');
  ctx.fillText(selectedAccessory?.label || '原本模样', 1004, 196);

  const stats = [
    { label: '发现鱼种', value: discovered + ' / ' + fishSpecies.length, icon: '🐟', color: '#e4f1e6' },
    { label: '累计钓获', value: String(catches) + ' 条', icon: '🐚', color: '#f7e9d4' },
    { label: '精准鱼获', value: trophySummary.earned + ' / ' + trophySummary.total + ' 星', icon: '★', color: '#f4edd2' },
    { label: '海域金章', value: masteredZones + ' / ' + fishingZones.length, icon: '✦', color: '#ece9f5' },
  ];
  const statWidth = 232;
  stats.forEach((stat, index) => {
    const x = 54 + index * 248;
    fillRoundedRect(ctx, x, 235, statWidth, 112, 22, stat.color, 'rgba(77,101,83,.12)');
    setPosterText(ctx, 27, 500, '#987949');
    ctx.fillText(stat.icon, x + 23, 271);
    setPosterText(ctx, 29, 900, '#405c4e');
    ctx.fillText(stat.value, x + 66, 272);
    setPosterText(ctx, 18, 700, '#8c978b');
    ctx.fillText(stat.label, x + 23, 317);
  });

  setPosterText(ctx, 22, 900, '#60766a');
  ctx.fillText('四处海域 · 猫猫最大鱼获 ' + (longestFish ? longestFish.name + ' ' + longestCatchCm + ' cm · ' + getFishSizeLabel(longestFish.id, longestCatchCm) : '待上岸'), 58, 383);
  const zoneWidth = 232;
  fishingZones.forEach((zone, index) => {
    const zoneFish = fishSpecies.filter((fish) => fish.zoneId === zone.id);
    const found = zoneFish.filter((fish) => (counts[fish.id] || 0) > 0).length;
    const perfect = zoneFish.filter((fish) => trophies[fish.id] === 3).length;
    const x = 54 + index * 248;
    fillRoundedRect(ctx, x, 405, zoneWidth, 83, 18, 'rgba(255,255,255,.72)', 'rgba(77,101,83,.12)');
    setPosterText(ctx, 20, 800, '#49645a');
    ctx.fillText(zone.icon + ' ' + zone.label, x + 17, 433);
    setPosterText(ctx, 15, 700, '#879284');
    ctx.fillText(found + '/' + zoneFish.length + ' · 三星 ' + perfect + '/' + zoneFish.length, x + 17, 464);
  });

  const tileWidth = 180;
  const tileHeight = 130;
  fishSpecies.forEach((fish, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    const x = 54 + column * 198;
    const y = 513 + row * 132;
    const found = (counts[fish.id] || 0) > 0;
    const rank = trophies[fish.id] || 0;
    fillRoundedRect(ctx, x, y, tileWidth, tileHeight, 19, found ? 'rgba(255,255,255,.84)' : 'rgba(243,242,231,.6)', found ? 'rgba(97,143,111,.2)' : 'rgba(117,127,113,.13)');
    if (found && favorites.has(fish.id)) {
      fillRoundedRect(ctx, x + tileWidth - 32, y + 8, 24, 24, 12, '#f8e2da');
      setPosterText(ctx, 14, 900, '#b96f67', 'center');
      ctx.fillText('♥', x + tileWidth - 20, y + 20);
    }
    setPosterText(ctx, 48, 500, found ? '#4f7b77' : '#b4b8aa', 'center');
    ctx.fillText(found ? fish.icon : '？', x + tileWidth / 2, y + 37);
    setPosterText(ctx, 18, 900, found ? '#526a5c' : '#a5aa9d', 'center');
    ctx.fillText(found ? fish.name : '待发现', x + tileWidth / 2, y + 75);
    setPosterText(ctx, 13, 700, found ? '#9b8a6a' : '#b5b6aa', 'center');
    ctx.fillText(found ? (counts[fish.id] || 0) + ' 条 · ' + fish.rarity : '神秘鱼影', x + tileWidth / 2, y + 93);
    if (found) {
      setPosterText(ctx, 12, 800, '#648476', 'center');
      ctx.fillText(bestLengths[fish.id] ? bestLengths[fish.id] + ' cm · ' + getFishSizeLabel(fish.id, bestLengths[fish.id]) : '尺寸待记录', x + tileWidth / 2, y + 108);
      setPosterText(ctx, 14, 900, '#c29545', 'center');
      ctx.fillText('★'.repeat(rank) + '☆'.repeat(3 - rank), x + tileWidth / 2, y + 123);
    }
  });

  setPosterText(ctx, 18, 700, '#829084', 'center');
  ctx.fillText('继续出发，下一位新朋友正在水面下等你。', posterWidth / 2, 1220);
  setPosterText(ctx, 13, 500, '#a59c88', 'center');
  ctx.fillText('POCKET PLAY  ·  ' + new Date().toLocaleDateString(), posterWidth / 2, 1264);
  return canvas;
}
