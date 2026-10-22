export type FishRarity = '常见' | '少见' | '稀有' | '传说';
export type FishPullStyle = 'steady' | 'flutter' | 'heavy' | 'dart';
export type FishingZoneId = 'lake' | 'reef' | 'moon' | 'aurora';

export interface FishSpecies {
  id: string;
  name: string;
  icon: string;
  rarity: FishRarity;
  points: number;
  weight: number;
  zoneId: FishingZoneId;
  pullStyle: FishPullStyle;
  pullHint: string;
  pullSpeed: number;
  pullAmplitude: number;
  secondarySpeed: number;
  secondaryAmplitude: number;
  story: string;
  eventId?: string;
}

export interface FishingZone {
  id: FishingZoneId;
  icon: string;
  label: string;
  detail: string;
  unlockAt: number;
  unlockHint: string;
}

export interface FishingWeather {
  id: 'sunny' | 'drizzle' | 'moon-tide' | 'breeze' | 'mist';
  icon: string;
  label: string;
  detail: string;
}

export interface FishingDayPhase {
  id: 'dawn' | 'day' | 'sunset' | 'night';
  icon: string;
  label: string;
  detail: string;
}

export type FishingDailyEventEffect = 'school' | 'undiscovered' | 'legendary' | 'calm';

export interface FishingDailyEvent {
  id: string;
  icon: string;
  label: string;
  detail: string;
  effect: FishingDailyEventEffect;
  zone: FishingZone;
}

export type BaitId = 'crumbs' | 'glow' | 'shrimp' | 'echo' | 'cloud' | 'starlight';

export interface FishingBait {
  id: BaitId;
  icon: string;
  label: string;
  detail: string;
  unlockAt: number;
  unlockHint: string;
}

export interface FishingDailyQuest {
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  completed: boolean;
  shells: number;
}

export interface FishingDailySighting {
  fish: FishSpecies;
  zone: FishingZone;
  reward: number;
  completed: boolean;
}

export interface FishLengthRange {
  min: number;
  max: number;
}

export interface FishFriendship {
  level: number;
  title: string;
  scoreReward: number;
  nextTitle: string;
  nextScoreReward: number;
  count: number;
  progress: number;
  target: number;
  remaining: number;
  complete: boolean;
  story: string;
}

export interface AquariumDecoration {
  id: string;
  icon: string;
  label: string;
  price: number;
  theme: string;
  unlocked: boolean;
  selected: boolean;
}

export type CatAccessoryId = 'none' | 'flower' | 'sailor' | 'moon-charm' | 'aurora-scarf';

export interface CatAccessory {
  id: CatAccessoryId;
  icon: string;
  label: string;
  price: number;
  requiredDiscoveries: number;
  unlocked: boolean;
  affordable: boolean;
  selected: boolean;
}

export interface FishingRodStats {
  level: number;
  label: string;
  safeStart: number;
  safeEnd: number;
  timeBonus: number;
  detail: string;
}

export interface FishingRodUpgrade extends FishingRodStats {
  price: number;
  requiredDiscoveries: number;
  affordable: boolean;
  discoveryReady: boolean;
}

export interface FishingMilestone {
  id: string;
  icon: string;
  title: string;
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
  zoneId?: FishingZoneId;
  perfectZone?: boolean;
}

export interface FishCatchRecord {
  isNew: boolean;
  trophyRank: number;
  trophyImproved: boolean;
  trophyShells: number;
  dailySightingReward: number;
  lengthCm: number;
  bestLengthCm: number;
  sizeRecord: boolean;
  sizeLabel: FishSizeLabel;
  sizeBonus: number;
  milestones: Array<{ title: string; reward: number }>;
}

export type FishSizeLabel = '小巧' | '匀称' | '大个头' | '鱼王级' | '待记录';

export const fishSpecies: FishSpecies[] = [
  { id: 'blue-fish', name: '小蓝鱼', icon: '🐟', rarity: '常见', points: 10, weight: 32, zoneId: 'lake', pullStyle: 'steady', pullHint: '平稳摆动', pullSpeed: 1.78, pullAmplitude: 0.31, secondarySpeed: 0.47, secondaryAmplitude: 0.04, story: '湖湾最常见的新朋友，喜欢沿着浅水边巡游。动作不急不慢，很适合练习看线。' },
  { id: 'sunny-fish', name: '暖阳鲷', icon: '🐠', rarity: '常见', points: 12, weight: 25, zoneId: 'lake', pullStyle: 'flutter', pullHint: '短促点头', pullSpeed: 2.1, pullAmplitude: 0.24, secondarySpeed: 2.25, secondaryAmplitude: 0.14, story: '它最喜欢晒过太阳的水面。浮标轻轻点两下，就是它在试探鱼饵。' },
  { id: 'crystal-shrimp', name: '水晶虾', icon: '🦐', rarity: '少见', points: 17, weight: 16, zoneId: 'lake', pullStyle: 'dart', pullHint: '突然连跳', pullSpeed: 2.38, pullAmplitude: 0.21, secondarySpeed: 3.4, secondaryAmplitude: 0.16, story: '透明外壳会映出水草的颜色。它一紧张就连续弹跳，记得别被第二下骗到。' },
  { id: 'puffy-perch', name: '胖鲈鱼', icon: '🐡', rarity: '少见', points: 22, weight: 12, zoneId: 'lake', pullStyle: 'heavy', pullHint: '慢拉重压', pullSpeed: 1.62, pullAmplitude: 0.43, secondarySpeed: 0.4, secondaryAmplitude: 0.08, story: '看起来圆滚滚，力气却不小。它会把鱼线往下压很久，再突然往回拽。' },
  { id: 'coral-octopus', name: '珊瑚章鱼', icon: '🐙', rarity: '稀有', points: 30, weight: 7, zoneId: 'lake', pullStyle: 'flutter', pullHint: '双段试探', pullSpeed: 2.58, pullAmplitude: 0.28, secondarySpeed: 1.85, secondaryAmplitude: 0.17, story: '喜欢躲在石头缝里观察钓客。拉线时会先轻轻试探，再用另一股力气扰乱节奏。' },
  { id: 'moon-carp', name: '银月鲤', icon: '🐟', rarity: '稀有', points: 42, weight: 5, zoneId: 'lake', pullStyle: 'steady', pullHint: '长线回摆', pullSpeed: 2, pullAmplitude: 0.36, secondarySpeed: 0.38, secondaryAmplitude: 0.09, story: '夜色降下来才会靠近岸边。它沿着长弧线回游，耐心等它摆回绿区。' },
  { id: 'moon-ray', name: '月光鳐', icon: '🦈', rarity: '传说', points: 65, weight: 2, zoneId: 'lake', pullStyle: 'heavy', pullHint: '深水猛冲', pullSpeed: 2.4, pullAmplitude: 0.43, secondarySpeed: 0.36, secondaryAmplitude: 0.1, story: '湖底传来的亮光其实是它的背鳍。它会先蓄力，再带着整条鱼线猛冲。' },
  { id: 'star-dolphin', name: '星光海豚', icon: '🐬', rarity: '传说', points: 90, weight: 1, zoneId: 'lake', pullStyle: 'dart', pullHint: '变速冲刺', pullSpeed: 2.85, pullAmplitude: 0.25, secondarySpeed: 3.1, secondaryAmplitude: 0.15, story: '传说它追着水面的星星游泳。冲刺速度忽快忽慢，抓住节奏才能把它带上岸。' },
  { id: 'reef-turtle', name: '珊瑚小龟', icon: '🐢', rarity: '常见', points: 16, weight: 30, zoneId: 'reef', pullStyle: 'steady', pullHint: '慢慢摆尾', pullSpeed: 1.55, pullAmplitude: 0.25, secondarySpeed: 0.3, secondaryAmplitude: 0.03, story: '常在珊瑚礁旁打盹，发现鱼饵后慢悠悠地摆尾。它的节奏最容易预测。' },
  { id: 'sunset-seahorse', name: '晚霞海马', icon: '🐴', rarity: '少见', points: 25, weight: 17, zoneId: 'reef', pullStyle: 'flutter', pullHint: '短短点头', pullSpeed: 1.95, pullAmplitude: 0.22, secondarySpeed: 2.8, secondaryAmplitude: 0.16, story: '晚霞把它染成了橘粉色。它常用一串小幅点头试探钓线。' },
  { id: 'pearl-clam', name: '珍珠贝', icon: '🦪', rarity: '稀有', points: 40, weight: 7, zoneId: 'reef', pullStyle: 'heavy', pullHint: '先松后紧', pullSpeed: 1.65, pullAmplitude: 0.33, secondarySpeed: 0.42, secondaryAmplitude: 0.14, story: '珍珠只在它愿意开壳时才会露面。鱼线先松一口气，随后会突然变紧。' },
  { id: 'rainbow-ray', name: '虹彩鳐', icon: '🐬', rarity: '传说', points: 88, weight: 2, zoneId: 'reef', pullStyle: 'dart', pullHint: '折返急冲', pullSpeed: 2.95, pullAmplitude: 0.2, secondarySpeed: 4.1, secondaryAmplitude: 0.16, story: '它的背上闪着七色光。每次冲刺后都会立刻折返，盯紧高速变化的线。' },
  { id: 'moon-jelly', name: '月光水母', icon: '🎐', rarity: '常见', points: 20, weight: 30, zoneId: 'moon', pullStyle: 'flutter', pullHint: '轻轻飘荡', pullSpeed: 1.45, pullAmplitude: 0.18, secondarySpeed: 1.8, secondaryAmplitude: 0.09, story: '半透明的伞盖会随着潮汐发光。它没有急促的拉扯，只轻轻飘过每一次绿区。' },
  { id: 'night-koi', name: '夜色锦鲤', icon: '🐟', rarity: '少见', points: 29, weight: 17, zoneId: 'moon', pullStyle: 'steady', pullHint: '绕圈回游', pullSpeed: 2.2, pullAmplitude: 0.32, secondarySpeed: 0.55, secondaryAmplitude: 0.06, story: '它会绕着船边游成一个圆圈。看起来很平稳，却比湖里的鲤鱼快上一拍。' },
  { id: 'glass-whale', name: '玻璃鲸', icon: '🐳', rarity: '稀有', points: 50, weight: 7, zoneId: 'moon', pullStyle: 'heavy', pullHint: '深处慢拉', pullSpeed: 1.5, pullAmplitude: 0.44, secondarySpeed: 0.25, secondaryAmplitude: 0.05, story: '身体像玻璃一样透亮，能看见星光从它背后穿过。它在深处缓缓转身，拉力很重。' },
  { id: 'aurora-dragon', name: '极光龙', icon: '🐉', rarity: '传说', points: 110, weight: 2, zoneId: 'moon', pullStyle: 'dart', pullHint: '忽远忽近', pullSpeed: 3.25, pullAmplitude: 0.27, secondarySpeed: 3.5, secondaryAmplitude: 0.18, story: '只有极光最亮的时候才会出现。它忽远忽近、连续变速，是月光海最难忘的相遇。' },
  { id: 'ice-seal', name: '浮冰海豹', icon: '🐧', rarity: '常见', points: 26, weight: 30, zoneId: 'aurora', pullStyle: 'steady', pullHint: '顺流慢游', pullSpeed: 1.6, pullAmplitude: 0.24, secondarySpeed: 0.38, secondaryAmplitude: 0.04, story: '它总趴在最暖的浮冰边晒太阳。只要不着急，鱼线就会随着它的节奏轻轻摆动。' },
  { id: 'frost-seahorse', name: '霜铃海马', icon: '🐴', rarity: '少见', points: 38, weight: 17, zoneId: 'aurora', pullStyle: 'flutter', pullHint: '三拍轻点', pullSpeed: 2.12, pullAmplitude: 0.23, secondarySpeed: 2.54, secondaryAmplitude: 0.13, story: '它游过冰晶时会发出细小的铃声。每组三次轻点之后，都会安静一小会儿。' },
  { id: 'aurora-skate', name: '极光鳐', icon: '🦈', rarity: '稀有', points: 68, weight: 7, zoneId: 'aurora', pullStyle: 'heavy', pullHint: '宽弧上扬', pullSpeed: 2.08, pullAmplitude: 0.38, secondarySpeed: 0.52, secondaryAmplitude: 0.1, story: '它会拖着一条绿色光带从深海缓缓上升，转弯时把鱼线拉成很宽的弧。' },
  { id: 'polar-whale', name: '北境鲸', icon: '🐋', rarity: '传说', points: 135, weight: 2, zoneId: 'aurora', pullStyle: 'dart', pullHint: '沉底后急升', pullSpeed: 2.72, pullAmplitude: 0.3, secondarySpeed: 3.08, secondaryAmplitude: 0.16, story: '古老的北境鲸会先沉到海底，再沿着极光一口气升向水面。抓准它回升的时机，就能听见远处的鲸歌。' },
  { id: 'bubble-carp', name: '泡泡鲤', icon: '🐠', rarity: '稀有', points: 52, weight: 2, zoneId: 'lake', eventId: 'warm-current', pullStyle: 'flutter', pullHint: '泡泡连点', pullSpeed: 2.28, pullAmplitude: 0.25, secondarySpeed: 2.92, secondaryAmplitude: 0.15, story: '暖流经过湖心时，它会追着一串泡泡游到岸边。每个气泡破开，鱼线就轻轻点一下。' },
  { id: 'coral-blossom', name: '珊瑚花冠鱼', icon: '🐠', rarity: '稀有', points: 58, weight: 2, zoneId: 'reef', eventId: 'coral-bloom', pullStyle: 'steady', pullHint: '花瓣慢摆', pullSpeed: 1.82, pullAmplitude: 0.34, secondarySpeed: 0.48, secondaryAmplitude: 0.1, story: '珊瑚盛开时，它头顶的花冠会跟着海流轻轻摇晃。别急着拉线，它总会慢半拍回到安全区。' },
  { id: 'comet-squid', name: '彗尾乌贼', icon: '🦑', rarity: '传说', points: 142, weight: 1, zoneId: 'moon', eventId: 'star-drift', pullStyle: 'dart', pullHint: '星尾变速', pullSpeed: 3.18, pullAmplitude: 0.28, secondarySpeed: 3.72, secondaryAmplitude: 0.18, story: '它沿着星屑留下的光带穿过月海，转眼就会从另一侧折返。看准那道亮线减速的一刻再拉。' },
  { id: 'ice-lantern', name: '冰晶灯笼鱼', icon: '🐟', rarity: '稀有', points: 82, weight: 2, zoneId: 'aurora', eventId: 'quiet-ice', pullStyle: 'heavy', pullHint: '冰下缓压', pullSpeed: 1.48, pullAmplitude: 0.42, secondarySpeed: 0.34, secondaryAmplitude: 0.08, story: '静潮时它会亮起冰蓝色的小灯，沿着浮冰缓缓经过。鱼线看似平静，回摆时却带着厚实的拉力。' },
];

const fishLengthRanges: Record<string, FishLengthRange> = {
  'blue-fish': { min: 12, max: 24 }, 'sunny-fish': { min: 18, max: 32 }, 'crystal-shrimp': { min: 4, max: 10 }, 'puffy-perch': { min: 28, max: 48 },
  'coral-octopus': { min: 32, max: 68 }, 'moon-carp': { min: 38, max: 82 }, 'moon-ray': { min: 70, max: 140 }, 'star-dolphin': { min: 110, max: 220 },
  'reef-turtle': { min: 45, max: 90 }, 'sunset-seahorse': { min: 10, max: 24 }, 'pearl-clam': { min: 6, max: 18 }, 'rainbow-ray': { min: 85, max: 165 },
  'moon-jelly': { min: 16, max: 45 }, 'night-koi': { min: 35, max: 75 }, 'glass-whale': { min: 160, max: 260 }, 'aurora-dragon': { min: 150, max: 300 },
  'ice-seal': { min: 90, max: 170 }, 'frost-seahorse': { min: 10, max: 26 }, 'aurora-skate': { min: 88, max: 190 }, 'polar-whale': { min: 230, max: 420 },
  'bubble-carp': { min: 25, max: 58 }, 'coral-blossom': { min: 42, max: 82 }, 'comet-squid': { min: 72, max: 155 }, 'ice-lantern': { min: 26, max: 64 },
};

export function rollFishLengthCm(id: string, random = Math.random()): number {
  const range = fishLengthRanges[id] || { min: 10, max: 30 };
  return range.min + Math.floor(Math.max(0, Math.min(0.999999, random)) * (range.max - range.min + 1));
}

export function getFishLengthRange(id: string): FishLengthRange {
  return { ...(fishLengthRanges[id] || { min: 10, max: 30 }) };
}

export function getFishSizeLabel(id: string, lengthCm: number): FishSizeLabel {
  const range = fishLengthRanges[id];
  if (!range || lengthCm <= 0) return '待记录';
  const sizeRatio = (Math.max(range.min, Math.min(range.max, lengthCm)) - range.min) / Math.max(1, range.max - range.min);
  if (sizeRatio >= 0.9) return '鱼王级';
  if (sizeRatio >= 0.7) return '大个头';
  if (sizeRatio >= 0.35) return '匀称';
  return '小巧';
}

const fishFriendshipStories: Record<string, string> = {
  'blue-fish': '它认得猫猫的脚步声了，每次都会先游到浅水边打招呼。',
  'sunny-fish': '它会把最暖和的那片水面留给猫猫，尾巴一摆就是熟悉的问候。',
  'crystal-shrimp': '它不再慌张地连跳，偶尔还会把亮晶晶的外壳转给猫猫看。',
  'puffy-perch': '它会把鼓鼓的脸贴在水面上，像是在等猫猫讲今天的故事。',
  'coral-octopus': '它在石缝里藏了一枚彩色贝壳，悄悄放进猫猫的鱼篓。',
  'moon-carp': '它开始沿着猫猫的船边回游，银色鳞片照亮了回家的路。',
  'moon-ray': '它放慢了深水里的冲刺，带猫猫看湖底最安静的星光。',
  'star-dolphin': '它会追着猫猫的浮标跃出水面，把一颗星光留在浪花里。',
  'reef-turtle': '它把最舒服的珊瑚礁位置让给猫猫，自己就在旁边慢慢晒太阳。',
  'sunset-seahorse': '它会在晚霞变粉的时候出现，陪猫猫一起看海面染上橘色。',
  'pearl-clam': '它只为猫猫开一次壳，露出里面被潮汐打磨得圆圆的珍珠。',
  'rainbow-ray': '它沿着船边画出一道彩虹弧线，邀请猫猫下次再来追浪。',
  'moon-jelly': '它把伞盖调成了柔柔的月白色，跟在猫猫身边照亮夜航。',
  'night-koi': '它绕着猫猫游了整整一圈，记住了这条最熟悉的回家路线。',
  'glass-whale': '它让星光穿过透明的背脊，给猫猫看海底最亮的一片天空。',
  'aurora-dragon': '它收起忽快忽慢的身影，第一次安静地陪猫猫等完一场极光。',
  'ice-seal': '它在暖和的浮冰上给猫猫留了位置，身边还放着一条小鱼。',
  'frost-seahorse': '它摇响三拍冰铃，猫猫一听就知道老朋友来啦。',
  'aurora-skate': '它拖着绿光绕船一圈，像是给猫猫的鱼竿系上了一条极光丝带。',
  'polar-whale': '它唱起熟悉的鲸歌，整片北境海湾都跟着轻轻回响。',
  'bubble-carp': '它把泡泡串成一顶小皇冠，跟在猫猫的浮标旁边玩了一整圈。',
  'coral-blossom': '它在珊瑚花间替猫猫留下一枚花瓣，每次潮起都会带来新的颜色。',
  'comet-squid': '它会用星墨画出猫猫的名字，再拖着彗尾陪猫猫游过月海。',
  'ice-lantern': '它在最冷的浮冰下点亮一盏灯，带猫猫找到回家的暖水湾。',
};

const fishFriendshipMilestones = [
  { count: 1, title: '初识', scoreReward: 0 },
  { count: 3, title: '熟络', scoreReward: 10 },
  { count: 6, title: '知心', scoreReward: 20 },
  { count: 10, title: '默契伙伴', scoreReward: 30 },
];

export function getFishFriendship(id: string, catchCount?: number): FishFriendship {
  const count = catchCount === undefined ? getFishCounts()[id] || 0 : Math.max(0, Math.floor(catchCount));
  let milestoneIndex = -1;
  for (let index = 0; index < fishFriendshipMilestones.length; index += 1) {
    if (count >= fishFriendshipMilestones[index].count) milestoneIndex = index;
  }
  const current = milestoneIndex >= 0 ? fishFriendshipMilestones[milestoneIndex] : { count: 0, title: '尚未相遇', scoreReward: 0 };
  const next = fishFriendshipMilestones[milestoneIndex + 1];
  const complete = !next;
  const target = next ? next.count - current.count : 0;
  const progress = next ? Math.max(0, count - current.count) : 0;
  return {
    level: milestoneIndex + 1,
    title: current.title,
    scoreReward: current.scoreReward,
    nextTitle: next?.title || current.title,
    nextScoreReward: next?.scoreReward || 0,
    count,
    progress,
    target,
    remaining: next ? Math.max(0, next.count - count) : 0,
    complete,
    story: count >= fishFriendshipMilestones[1].count ? fishFriendshipStories[id] || '它已经熟悉猫猫的陪伴了。' : '',
  };
}

function getFishSizeBonus(id: string, lengthCm: number): number {
  const range = fishLengthRanges[id];
  if (!range || lengthCm <= 0) return 0;
  const sizeRatio = (Math.max(range.min, Math.min(range.max, lengthCm)) - range.min) / Math.max(1, range.max - range.min);
  return Math.round(sizeRatio * 10);
}

export const fishingZones: FishingZone[] = [
  { id: 'lake', icon: '🌿', label: '青叶湖', detail: '平静湖面，鱼种均衡', unlockAt: 0, unlockHint: '初始海域' },
  { id: 'reef', icon: '🐚', label: '珊瑚湾', detail: '寻找海马、珍珠贝和虹彩鳐', unlockAt: 4, unlockHint: '图鉴发现 4 种鱼解锁' },
  { id: 'moon', icon: '🌙', label: '月光海', detail: '夜色里有发光的稀有鱼', unlockAt: 8, unlockHint: '图鉴发现 8 种鱼解锁' },
  { id: 'aurora', icon: '🌌', label: '极光湾', detail: '浮冰之间藏着北境鱼影', unlockAt: 12, unlockHint: '图鉴发现 12 种鱼解锁' },
];

export const fishingWeather: FishingWeather[] = [
  { id: 'sunny', icon: '☀️', label: '晴日', detail: '常见鱼更靠岸，咬钩提示更久' },
  { id: 'drizzle', icon: '🌦️', label: '细雨', detail: '少见鱼被雨声吸引，浮标假动作减少' },
  { id: 'moon-tide', icon: '🌕', label: '月潮', detail: '稀有和传说鱼更活跃，星潮时鱼线更急' },
  { id: 'breeze', icon: '🍃', label: '穿堂风', detail: '变速习性鱼更活跃，拉线时张力起伏更快' },
  { id: 'mist', icon: '🌫️', label: '晨雾', detail: '未发现的鱼更容易靠岸，咬钩提示更久' },
];

export function getDailyFishingWeather(date = new Date()): FishingWeather {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return fishingWeather[((day % fishingWeather.length) + fishingWeather.length) % fishingWeather.length];
}

export function getFishingDayPhase(date = new Date()): FishingDayPhase {
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) {
    return { id: 'dawn', icon: '🌅', label: '清晨', detail: '未发现的鱼更容易靠岸' };
  }
  if (hour >= 10 && hour < 16) {
    return { id: 'day', icon: '☀️', label: '日照', detail: '常见鱼更愿意靠近' };
  }
  if (hour >= 16 && hour < 20) {
    return { id: 'sunset', icon: '🌇', label: '暮色', detail: '稀有鱼更活跃' };
  }
  return { id: 'night', icon: '🌙', label: '夜航', detail: '传说鱼更活跃' };
}

const zoneEventDetails: Record<FishingZoneId, Omit<FishingDailyEvent, 'zone'>> = {
  lake: { id: 'warm-current', icon: '🍃', label: '暖流鱼群', detail: '常见和少见鱼出现权重提高 25%', effect: 'school' },
  reef: { id: 'coral-bloom', icon: '🪸', label: '珊瑚花期', detail: '未发现鱼种出现权重提高 35%', effect: 'undiscovered' },
  moon: { id: 'star-drift', icon: '🌠', label: '星屑鱼群', detail: '传说鱼出现权重提高 45%', effect: 'legendary' },
  aurora: { id: 'quiet-ice', icon: '❄️', label: '冰湾静潮', detail: '收竿时间延长 0.2 秒，安全区总宽增加 5%', effect: 'calm' },
};

let cachedFishingEventDay = -1;
let cachedFishingEvent: FishingDailyEvent | null = null;

export function getDailyFishingEvent(date = new Date()): FishingDailyEvent {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const discovered = getFishJournalSummary().discovered;
  if (cachedFishingEvent && cachedFishingEventDay === day && discovered >= cachedFishingEvent.zone.unlockAt) {
    return { ...cachedFishingEvent, zone: { ...cachedFishingEvent.zone } };
  }
  const unlockedZones = fishingZones.filter((zone) => discovered >= zone.unlockAt);
  const index = ((day % unlockedZones.length) + unlockedZones.length) % unlockedZones.length;
  const zone = unlockedZones[index] || fishingZones[0];
  cachedFishingEventDay = day;
  cachedFishingEvent = { ...zoneEventDetails[zone.id], zone };
  return { ...cachedFishingEvent, zone: { ...zone } };
}

export const fishingBaits: FishingBait[] = [
  { id: 'crumbs', icon: '🍞', label: '面包屑', detail: '鱼种均衡，适合认识新朋友', unlockAt: 0, unlockHint: '初始鱼饵' },
  { id: 'glow', icon: '✨', label: '荧光鱼饵', detail: '稀有和传说鱼更常出现，常见鱼机会略低', unlockAt: 3, unlockHint: '图鉴发现 3 种鱼解锁' },
  { id: 'shrimp', icon: '🦐', label: '虾肉鱼饵', detail: '偏爱当前海域的目标鱼，其他鱼机会略低', unlockAt: 5, unlockHint: '图鉴发现 5 种鱼解锁' },
  { id: 'echo', icon: '🫧', label: '回声鱼饵', detail: '偏爱未发现的鱼；找齐后偏爱未满三星的鱼', unlockAt: 8, unlockHint: '图鉴发现 8 种鱼解锁' },
  { id: 'cloud', icon: '☁️', label: '云絮软饵', detail: '绿区略宽，咬钩与拉线时间更长；稀有鱼机会略低', unlockAt: 12, unlockHint: '图鉴发现 12 种鱼解锁' },
  { id: 'starlight', icon: '🌟', label: '星光拟饵', detail: '传说鱼机会大幅提高；收竿窗口和拉线时间更短', unlockAt: 16, unlockHint: '图鉴发现 16 种鱼解锁' },
];

const storageKey = 'pocket-play-fish-journal-v1';
const baitStorageKey = 'pocket-play-fishing-bait-v1';
const zoneStorageKey = 'pocket-play-fishing-zone-v1';
const progressionStorageKey = 'pocket-play-fishing-progress-v1';
export const favoriteFishLimit = 3;

type DailyQuestDefinition = { title: string; description: string; target: number; reward: number; kind: 'catch' | 'new' | 'rare' | 'variety' };
type FishingProgressSave = { day: string; questProgress: number; questCompleted: boolean; varietyIds: string[]; shells: number; decorations: string[]; selectedDecoration: string; catAccessories: CatAccessoryId[]; selectedCatAccessory: CatAccessoryId; rodLevel: number; claimedMilestones: string[]; fishTrophies: Record<string, number>; sightingFishId: string; sightingCompleted: boolean; favoriteFishIds: string[]; trackedFishId: string; bestLengths: Record<string, number> };

const dailyQuests: DailyQuestDefinition[] = [
  { title: '湖边热身', description: '今天钓到 3 条鱼', target: 3, reward: 3, kind: 'catch' },
  { title: '换个新朋友', description: '钓到 1 种今天还没钓过的鱼', target: 1, reward: 4, kind: 'new' },
  { title: '珍稀来访', description: '钓到 1 条稀有或传说鱼', target: 1, reward: 5, kind: 'rare' },
  { title: '水族小队', description: '今天钓到 3 种不同的鱼', target: 3, reward: 4, kind: 'variety' },
];

const aquariumDecorations = [
  { id: 'pond', icon: '🌿', label: '青叶水草', price: 0, theme: 'pond' },
  { id: 'reef', icon: '🪸', label: '珊瑚花园', price: 3, theme: 'reef' },
  { id: 'moon', icon: '🌙', label: '月光星砂', price: 5, theme: 'moon' },
  { id: 'sunset', icon: '🌅', label: '晚霞湾', price: 8, theme: 'sunset' },
  { id: 'aurora', icon: '🌌', label: '极光深海', price: 13, theme: 'aurora' },
  { id: 'bamboo', icon: '🎋', label: '竹影溪涧', price: 18, theme: 'bamboo' },
];

const catAccessoryOptions: Array<{ id: CatAccessoryId; icon: string; label: string; price: number; requiredDiscoveries: number }> = [
  { id: 'none', icon: '🐾', label: '原本模样', price: 0, requiredDiscoveries: 0 },
  { id: 'flower', icon: '🌼', label: '小花花环', price: 0, requiredDiscoveries: 2 },
  { id: 'sailor', icon: '⚓', label: '水手领巾', price: 4, requiredDiscoveries: 4 },
  { id: 'moon-charm', icon: '🌙', label: '月牙铃铛', price: 7, requiredDiscoveries: 8 },
  { id: 'aurora-scarf', icon: '✨', label: '极光围巾', price: 10, requiredDiscoveries: 12 },
];

const fishingRods: FishingRodStats[] = [
  { level: 1, label: '竹枝竿', safeStart: 0.33, safeEnd: 0.67, timeBonus: 0, detail: '基础鱼竿，适合熟悉鱼线节奏' },
  { level: 2, label: '青竹竿', safeStart: 0.30, safeEnd: 0.70, timeBonus: 1.2, detail: '绿色安全区更宽，拉线时间 +1.2 秒' },
  { level: 3, label: '星潮竿', safeStart: 0.27, safeEnd: 0.73, timeBonus: 2.4, detail: '绿色安全区更宽，拉线时间 +2.4 秒' },
  { level: 4, label: '极光晶竿', safeStart: 0.24, safeEnd: 0.76, timeBonus: 3.6, detail: '绿色安全区更宽，拉线时间 +3.6 秒' },
];

const fishingRodUpgradeRules: Record<number, { price: number; requiredDiscoveries: number }> = {
  2: { price: 8, requiredDiscoveries: 4 },
  3: { price: 15, requiredDiscoveries: 8 },
  4: { price: 24, requiredDiscoveries: 12 },
};

const fishMilestones = [
  { id: 'reef', icon: '🐚', title: '踏浪见习', target: 4, reward: 2 },
  { id: 'moon', icon: '🌙', title: '月海向导', target: 8, reward: 4 },
  { id: 'complete', icon: '✦', title: '全图鉴收藏家', target: fishSpecies.length, reward: 8 },
  { id: 'lake-set', icon: '🌿', title: '湖湾熟客', target: 9, reward: 4, zoneId: 'lake' as const },
  { id: 'reef-set', icon: '🪸', title: '珊瑚巡游', target: 5, reward: 5, zoneId: 'reef' as const },
  { id: 'moon-set', icon: '🌌', title: '月海星图', target: 5, reward: 7, zoneId: 'moon' as const },
  { id: 'aurora-set', icon: '🧊', title: '北境来信', target: 5, reward: 9, zoneId: 'aurora' as const },
  { id: 'lake-perfect', icon: '🌿', title: '青叶金章', target: 9, reward: 12, zoneId: 'lake' as const, perfectZone: true },
  { id: 'reef-perfect', icon: '🪸', title: '珊瑚金章', target: 5, reward: 6, zoneId: 'reef' as const, perfectZone: true },
  { id: 'moon-perfect', icon: '🌙', title: '月海金章', target: 5, reward: 8, zoneId: 'moon' as const, perfectZone: true },
  { id: 'aurora-perfect', icon: '❄️', title: '北境金章', target: 5, reward: 10, zoneId: 'aurora' as const, perfectZone: true },
];

function getLocalDayKey(date = new Date()): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function getTodayQuest(): DailyQuestDefinition {
  const date = new Date();
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return dailyQuests[((day % dailyQuests.length) + dailyQuests.length) % dailyQuests.length];
}

function chooseDailySighting(day: string, counts: Record<string, number>, trophies: Record<string, number>): FishSpecies {
  const discovered = fishSpecies.filter((fish) => counts[fish.id] > 0).length;
  const unlockedZones = fishingZones.filter((zone) => discovered >= zone.unlockAt);
  const dailyEvent = getDailyFishingEvent();
  const availableFish = fishSpecies.filter((fish) => unlockedZones.some((zone) => zone.id === fish.zoneId) && (!fish.eventId || fish.eventId === dailyEvent.id));
  const undiscoveredFish = availableFish.filter((fish) => !counts[fish.id]);
  const practiceFish = availableFish.filter((fish) => (trophies[fish.id] || 0) < 3);
  const easyFirstFish = undiscoveredFish.filter((fish) => fish.rarity === '常见');
  const steadyFish = undiscoveredFish.filter((fish) => fish.rarity === '少见');
  const candidates = easyFirstFish.length > 0
    ? easyFirstFish
    : steadyFish.length > 0
      ? steadyFish
      : undiscoveredFish.length > 0
        ? undiscoveredFish
        : practiceFish.length > 0
          ? practiceFish
          : availableFish;
  const dayNumber = day.split('-').reduce((sum, part) => sum * 37 + Number(part), 0);
  return candidates[Math.abs(dayNumber) % candidates.length] || fishSpecies[0];
}

function readProgress(): FishingProgressSave {
  const today = getLocalDayKey();
  try {
    const parsed = JSON.parse(localStorage.getItem(progressionStorageKey) || '{}') as Partial<FishingProgressSave>;
    const decorations = Array.isArray(parsed.decorations) ? parsed.decorations.filter((id): id is string => typeof id === 'string' && aquariumDecorations.some((item) => item.id === id)) : ['pond'];
    const unlockedDecorations = decorations.includes('pond') ? decorations : ['pond', ...decorations];
    const selectedDecoration = typeof parsed.selectedDecoration === 'string' && unlockedDecorations.includes(parsed.selectedDecoration) ? parsed.selectedDecoration : 'pond';
    const catAccessories = Array.isArray(parsed.catAccessories)
      ? parsed.catAccessories.filter((id): id is CatAccessoryId => typeof id === 'string' && catAccessoryOptions.some((item) => item.id === id))
      : ['none' as const];
    const unlockedCatAccessories = catAccessories.includes('none') ? catAccessories : ['none' as const, ...catAccessories];
    const selectedCatAccessory = typeof parsed.selectedCatAccessory === 'string' && unlockedCatAccessories.includes(parsed.selectedCatAccessory as CatAccessoryId)
      ? parsed.selectedCatAccessory as CatAccessoryId
      : 'none';
    const fishTrophies = parsed.fishTrophies && typeof parsed.fishTrophies === 'object' ? Object.fromEntries(fishSpecies.flatMap((fish) => {
      const rank = (parsed.fishTrophies as Record<string, unknown>)[fish.id];
      return typeof rank === 'number' && Number.isFinite(rank) && rank >= 1 ? [[fish.id, Math.min(3, Math.floor(rank))]] : [];
    })) : {};
    const bestLengths = parsed.bestLengths && typeof parsed.bestLengths === 'object' ? Object.fromEntries(fishSpecies.flatMap((fish) => {
      const length = (parsed.bestLengths as Record<string, unknown>)[fish.id];
      const range = fishLengthRanges[fish.id];
      return typeof length === 'number' && Number.isInteger(length) && length >= range.min && length <= range.max ? [[fish.id, length]] : [];
    })) : {};
    const counts = getFishCounts();
    const discovered = fishSpecies.filter((fish) => counts[fish.id] > 0).length;
    const dailyEvent = getDailyFishingEvent();
    const selectedSighting = fishSpecies.find((fish) => fish.id === parsed.sightingFishId && fishingZones.some((zone) => zone.id === fish.zoneId && discovered >= zone.unlockAt) && (!fish.eventId || fish.eventId === dailyEvent.id));
    const sightingFishId = parsed.day === today && selectedSighting
      ? selectedSighting.id
      : chooseDailySighting(today, counts, fishTrophies).id;
    const progress: FishingProgressSave = {
      day: today,
      questProgress: parsed.day === today && typeof parsed.questProgress === 'number' ? Math.max(0, Math.floor(parsed.questProgress)) : 0,
      questCompleted: parsed.day === today && parsed.questCompleted === true,
      varietyIds: parsed.day === today && Array.isArray(parsed.varietyIds) ? parsed.varietyIds.filter((id): id is string => typeof id === 'string') : [],
      shells: typeof parsed.shells === 'number' && Number.isFinite(parsed.shells) ? Math.max(0, Math.floor(parsed.shells)) : 0,
      decorations: unlockedDecorations,
      selectedDecoration,
      catAccessories: unlockedCatAccessories,
      selectedCatAccessory,
      rodLevel: typeof parsed.rodLevel === 'number' ? Math.max(1, Math.min(fishingRods.length, Math.floor(parsed.rodLevel))) : 1,
      claimedMilestones: Array.isArray(parsed.claimedMilestones) ? parsed.claimedMilestones.filter((id): id is string => typeof id === 'string' && fishMilestones.some((milestone) => milestone.id === id)) : [],
      fishTrophies,
      sightingFishId,
      sightingCompleted: parsed.day === today && parsed.sightingFishId === sightingFishId && parsed.sightingCompleted === true,
      favoriteFishIds: Array.isArray(parsed.favoriteFishIds)
        ? [...new Set(parsed.favoriteFishIds.filter((id): id is string => typeof id === 'string' && counts[id] > 0 && fishSpecies.some((fish) => fish.id === id)))].slice(0, favoriteFishLimit)
        : [],
      trackedFishId: typeof parsed.trackedFishId === 'string' && counts[parsed.trackedFishId] > 0 && fishSpecies.some((fish) => fish.id === parsed.trackedFishId)
        ? parsed.trackedFishId
        : '',
      bestLengths,
    };
    if (parsed.day !== today || parsed.sightingFishId !== sightingFishId) saveProgress(progress);
    return progress;
  } catch {
    const counts = getFishCounts();
    const sightingFishId = chooseDailySighting(today, counts, {}).id;
    return { day: today, questProgress: 0, questCompleted: false, varietyIds: [], shells: 0, decorations: ['pond'], selectedDecoration: 'pond', catAccessories: ['none'], selectedCatAccessory: 'none', rodLevel: 1, claimedMilestones: [], fishTrophies: {}, sightingFishId, sightingCompleted: false, favoriteFishIds: [], trackedFishId: '', bestLengths: {} };
  }
}

function saveProgress(progress: FishingProgressSave): void {
  try {
    localStorage.setItem(progressionStorageKey, JSON.stringify(progress));
  } catch {
    // Daily goals and aquarium choices stay optional when local storage is unavailable.
  }
}

export function getFishingDailyQuest(): FishingDailyQuest {
  const progress = readProgress();
  const quest = getTodayQuest();
  return {
    title: quest.title,
    description: quest.description,
    progress: Math.min(progress.questProgress, quest.target),
    target: quest.target,
    reward: quest.reward,
    completed: progress.questCompleted,
    shells: progress.shells,
  };
}

export function getDailyFishingSighting(): FishingDailySighting {
  const progress = readProgress();
  const fish = fishSpecies.find((item) => item.id === progress.sightingFishId) || fishSpecies[0];
  const zone = fishingZones.find((item) => item.id === fish.zoneId) || fishingZones[0];
  return { fish, zone, reward: 3, completed: progress.sightingCompleted };
}

export function getFavoriteFishIds(): string[] {
  return readProgress().favoriteFishIds;
}

export function getTrackedFish(): FishSpecies | null {
  const trackedFishId = readProgress().trackedFishId;
  return fishSpecies.find((fish) => fish.id === trackedFishId) || null;
}

export function toggleTrackedFish(id: string): 'selected' | 'cleared' | 'invalid' {
  const progress = readProgress();
  if (progress.trackedFishId === id) {
    progress.trackedFishId = '';
    saveProgress(progress);
    return 'cleared';
  }
  if (!fishSpecies.some((fish) => fish.id === id) || getFishCounts()[id] < 1) return 'invalid';
  progress.trackedFishId = id;
  saveProgress(progress);
  return 'selected';
}

export function toggleFavoriteFish(id: string): 'added' | 'removed' | 'full' | 'invalid' {
  const progress = readProgress();
  if (!fishSpecies.some((fish) => fish.id === id) || getFishCounts()[id] < 1) return 'invalid';
  if (progress.favoriteFishIds.includes(id)) {
    progress.favoriteFishIds = progress.favoriteFishIds.filter((favoriteId) => favoriteId !== id);
    saveProgress(progress);
    return 'removed';
  }
  if (progress.favoriteFishIds.length >= favoriteFishLimit) return 'full';
  progress.favoriteFishIds.push(id);
  saveProgress(progress);
  return 'added';
}

export function getFishBestLengths(): Record<string, number> {
  return readProgress().bestLengths;
}

export function getFishingRodStats(): FishingRodStats {
  return { ...fishingRods[readProgress().rodLevel - 1] };
}

export function getFishingRodUpgrade(): FishingRodUpgrade | null {
  const progress = readProgress();
  const next = fishingRods[progress.rodLevel];
  if (!next) return null;
  const rule = fishingRodUpgradeRules[next.level];
  if (!rule) return null;
  return {
    ...next,
    price: rule.price,
    requiredDiscoveries: rule.requiredDiscoveries,
    affordable: progress.shells >= rule.price,
    discoveryReady: getFishJournalSummary().discovered >= rule.requiredDiscoveries,
  };
}

export function getFishMilestones(): FishingMilestone[] {
  recordFishMilestones();
  const counts = getFishCounts();
  const discovered = fishSpecies.filter((fish) => (counts[fish.id] || 0) > 0).length;
  const trophies = getFishTrophyRanks();
  const claimed = readProgress().claimedMilestones;
  return fishMilestones.map((milestone) => ({
    ...milestone,
    progress: getMilestoneProgress(milestone, counts, trophies, discovered),
    claimed: claimed.includes(milestone.id),
  }));
}

export function getFishTrophyRanks(): Record<string, number> {
  return { ...readProgress().fishTrophies };
}

export function getFishTrophySummary(): { earned: number; total: number } {
  const ranks = getFishTrophyRanks();
  return { earned: Object.values(ranks).reduce((sum, rank) => sum + rank, 0), total: fishSpecies.length * 3 };
}

function recordFishMilestones(): Array<{ title: string; reward: number }> {
  const counts = getFishCounts();
  const discovered = fishSpecies.filter((fish) => (counts[fish.id] || 0) > 0).length;
  const trophies = getFishTrophyRanks();
  const progress = readProgress();
  let changed = false;
  const earned: Array<{ title: string; reward: number }> = [];
  for (const milestone of fishMilestones) {
    const milestoneProgress = getMilestoneProgress(milestone, counts, trophies, discovered);
    if (milestoneProgress < milestone.target || progress.claimedMilestones.includes(milestone.id)) continue;
    progress.claimedMilestones.push(milestone.id);
    progress.shells += milestone.reward;
    earned.push({ title: milestone.title, reward: milestone.reward });
    changed = true;
  }
  if (changed) saveProgress(progress);
  return earned;
}

function getMilestoneProgress(
  milestone: typeof fishMilestones[number],
  counts: Record<string, number>,
  trophies: Record<string, number>,
  discovered: number,
): number {
  if (!milestone.zoneId) return discovered;
  const zoneFish = fishSpecies.filter((fish) => fish.zoneId === milestone.zoneId);
  return milestone.perfectZone
    ? zoneFish.filter((fish) => trophies[fish.id] === 3).length
    : zoneFish.filter((fish) => (counts[fish.id] || 0) > 0).length;
}

export function upgradeFishingRod(): boolean {
  const progress = readProgress();
  const next = fishingRods[progress.rodLevel];
  if (!next) return false;
  const rule = fishingRodUpgradeRules[next.level];
  if (!rule || progress.shells < rule.price || getFishJournalSummary().discovered < rule.requiredDiscoveries) return false;
  progress.shells -= rule.price;
  progress.rodLevel = next.level;
  saveProgress(progress);
  return true;
}

function recordDailyQuestProgress(id: string): void {
  const progress = readProgress();
  if (progress.questCompleted) return;
  const quest = getTodayQuest();
  const fish = fishSpecies.find((item) => item.id === id);
  const caughtToday = progress.varietyIds.includes(id);
  if (!caughtToday) progress.varietyIds.push(id);
  if (quest.kind === 'catch') progress.questProgress += 1;
  else if (quest.kind === 'new' && !caughtToday) progress.questProgress += 1;
  else if (quest.kind === 'rare' && (fish?.rarity === '稀有' || fish?.rarity === '传说')) progress.questProgress += 1;
  else if (quest.kind === 'variety') progress.questProgress = progress.varietyIds.length;
  progress.questProgress = Math.min(progress.questProgress, quest.target);
  if (progress.questProgress >= quest.target) {
    progress.questCompleted = true;
    progress.shells += quest.reward;
  }
  saveProgress(progress);
}

function recordDailySightingProgress(id: string): number {
  const progress = readProgress();
  if (progress.sightingCompleted || progress.sightingFishId !== id) return 0;
  progress.sightingCompleted = true;
  progress.shells += 3;
  saveProgress(progress);
  return 3;
}

export function getAquariumDecorations(): AquariumDecoration[] {
  const progress = readProgress();
  return aquariumDecorations.map((decoration) => ({
    ...decoration,
    unlocked: progress.decorations.includes(decoration.id),
    selected: progress.selectedDecoration === decoration.id,
  }));
}

export function chooseAquariumDecoration(id: string): boolean {
  const decoration = aquariumDecorations.find((item) => item.id === id);
  if (!decoration) return false;
  const progress = readProgress();
  if (progress.decorations.includes(id)) {
    progress.selectedDecoration = id;
    saveProgress(progress);
    return true;
  }
  if (progress.shells < decoration.price) return false;
  progress.shells -= decoration.price;
  progress.decorations.push(id);
  progress.selectedDecoration = id;
  saveProgress(progress);
  return true;
}

export function getCatAccessories(): CatAccessory[] {
  const progress = readProgress();
  const discovered = getFishJournalSummary().discovered;
  return catAccessoryOptions.map((accessory) => {
    const unlocked = progress.catAccessories.includes(accessory.id);
    return {
      ...accessory,
      unlocked,
      affordable: discovered >= accessory.requiredDiscoveries && progress.shells >= accessory.price,
      selected: progress.selectedCatAccessory === accessory.id,
    };
  });
}

export function chooseCatAccessory(id: string): boolean {
  const accessory = catAccessoryOptions.find((item) => item.id === id);
  if (!accessory) return false;
  const progress = readProgress();
  if (progress.catAccessories.includes(accessory.id)) {
    progress.selectedCatAccessory = accessory.id;
    saveProgress(progress);
    return true;
  }
  if (getFishJournalSummary().discovered < accessory.requiredDiscoveries || progress.shells < accessory.price) return false;
  progress.shells -= accessory.price;
  progress.catAccessories.push(accessory.id);
  progress.selectedCatAccessory = accessory.id;
  saveProgress(progress);
  return true;
}

export function getSelectedCatAccessory(): CatAccessoryId {
  return readProgress().selectedCatAccessory;
}

export function getFishCounts(): Record<string, number> {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<string, unknown>;
    return Object.fromEntries(fishSpecies.map((fish) => {
      const count = saved[fish.id];
      return [fish.id, typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0];
    }));
  } catch {
    return Object.fromEntries(fishSpecies.map((fish) => [fish.id, 0]));
  }
}

export function recordFishCatch(id: string, reelMistakes: number, lengthCm = 0): FishCatchRecord {
  const counts = getFishCounts();
  const isNew = counts[id] === 0;
  counts[id] = (counts[id] || 0) + 1;
  try {
    localStorage.setItem(storageKey, JSON.stringify(counts));
  } catch {
    // 图鉴无法保存时，当前这一局仍可正常进行。
  }
  recordDailyQuestProgress(id);
  const dailySightingReward = recordDailySightingProgress(id);
  const progress = readProgress();
  const range = fishLengthRanges[id] || { min: 0, max: 0 };
  const recordedLength = lengthCm > 0 ? Math.max(range.min, Math.min(range.max, Math.floor(lengthCm))) : 0;
  const previousBestLength = progress.bestLengths[id] || 0;
  const sizeRecord = recordedLength > previousBestLength;
  if (sizeRecord) progress.bestLengths[id] = recordedLength;
  const trophyRank = reelMistakes <= 0 ? 3 : reelMistakes === 1 ? 2 : 1;
  const previousRank = progress.fishTrophies[id] || 0;
  const trophyImproved = trophyRank > previousRank;
  if (trophyImproved) {
    progress.fishTrophies[id] = trophyRank;
    progress.shells += trophyRank - previousRank;
  }
  if (sizeRecord || trophyImproved) saveProgress(progress);
  const milestones = recordFishMilestones();
  return { isNew, trophyRank: Math.max(trophyRank, previousRank), trophyImproved, trophyShells: trophyImproved ? trophyRank - previousRank : 0, dailySightingReward, lengthCm: recordedLength, bestLengthCm: progress.bestLengths[id] || 0, sizeRecord, sizeLabel: getFishSizeLabel(id, recordedLength), sizeBonus: getFishSizeBonus(id, recordedLength), milestones };
}

export function getFishJournalSummary(): { discovered: number; total: number; caught: number } {
  const counts = getFishCounts();
  return {
    discovered: fishSpecies.filter((fish) => counts[fish.id] > 0).length,
    total: fishSpecies.length,
    caught: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}

export function getFishingBaitOptions(): Array<FishingBait & { unlocked: boolean }> {
  const discovered = getFishJournalSummary().discovered;
  return fishingBaits.map((bait) => ({ ...bait, unlocked: discovered >= bait.unlockAt }));
}

export function getFishingZoneOptions(): Array<FishingZone & { unlocked: boolean }> {
  const discovered = getFishJournalSummary().discovered;
  return fishingZones.map((zone) => ({ ...zone, unlocked: discovered >= zone.unlockAt }));
}

export function getPreferredBait(): BaitId {
  try {
    const saved = localStorage.getItem(baitStorageKey) as BaitId | null;
    return getFishingBaitOptions().some((bait) => bait.id === saved && bait.unlocked) ? saved as BaitId : 'crumbs';
  } catch {
    return 'crumbs';
  }
}

export function savePreferredBait(id: BaitId): void {
  if (!getFishingBaitOptions().some((bait) => bait.id === id && bait.unlocked)) return;
  try {
    localStorage.setItem(baitStorageKey, id);
  } catch {
    // 选中的鱼饵只影响下局的偏好，不影响当前这局。
  }
}

export function getPreferredZone(): FishingZoneId {
  try {
    const saved = localStorage.getItem(zoneStorageKey) as FishingZoneId | null;
    return getFishingZoneOptions().some((zone) => zone.id === saved && zone.unlocked) ? saved as FishingZoneId : 'lake';
  } catch {
    return 'lake';
  }
}

export function savePreferredZone(id: FishingZoneId): void {
  if (!getFishingZoneOptions().some((zone) => zone.id === id && zone.unlocked)) return;
  try {
    localStorage.setItem(zoneStorageKey, id);
  } catch {
    // 海域偏好无法保存时，当前这一局仍可正常进行。
  }
}
