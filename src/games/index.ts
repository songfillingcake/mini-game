import type { GameId, MiniGame } from '../core/Game';
import { DodgerGame } from './dodger/DodgerGame';
import { FishingGame } from './fishing/FishingGame';
import { JumperGame } from './jumper/JumperGame';
import { ShellMatchGame } from './shells/ShellMatchGame';
import { CloudStackGame } from './stacker/CloudStackGame';

export interface GameCardInfo {
  id: GameId;
  title: string;
  subtitle: string;
  description: string;
  controls: string;
  icon: string;
  color: string;
  tag: string;
}

export const gameCards: GameCardInfo[] = [
  {
    id: 'fishing',
    title: '猫猫钓鱼',
    subtitle: '耐心钓鱼，遇见新伙伴',
    description: '跟着每日天气观察浮标，收竿钓鱼并解锁新海域，找到每处水面的专属鱼种。',
    controls: '点击 / 空格',
    icon: '🎣',
    color: 'mint',
    tag: '收集图鉴',
  },
  {
    id: 'dodger',
    title: '躲障碍',
    subtitle: '闪开石头，顺手捡星星',
    description: '开局选择星星更多、碰撞更宽容或贴边高分路线；左右闪避并顺手捡星，20 秒和 40 秒会驶入新的路线景色。',
    controls: '← → / A D',
    icon: '🏃',
    color: 'peach',
    tag: '反应挑战',
  },
  {
    id: 'jumper',
    title: '弹跳闯关',
    subtitle: '踩稳平台，一路往上跳',
    description: '先选追星、弹簧或稳步路线，再左右移动帮猫猫踩平台；连星加分，预判横移与裂纹平台，一路登上云朵海和星光天际。',
    controls: '← → / A D',
    icon: '🐸',
    color: 'lilac',
    tag: '高度挑战',
  },
  {
    id: 'shells',
    title: '贝壳消消乐',
    subtitle: '排成三枚，听海浪叮咚',
    description: '交换贝壳、泡泡和珊瑚连成三枚；四连会留下能清除整行整列的星星贝壳。',
    controls: '点击交换 / 方向键 + 空格',
    icon: '🐚',
    color: 'aqua',
    tag: '轻松益智',
  },
  {
    id: 'stacker',
    title: '云朵叠叠乐',
    subtitle: '对齐一朵云，搭起天空小屋',
    description: '看准时机放下左右移动的云砖，留下重叠部分。连续完美落点能补宽云塔，向着暮色和星空继续攀高。',
    controls: '点击 / 空格放下',
    icon: '☁️',
    color: 'sky',
    tag: '一键叠高',
  },
];

export function createGame(id: GameId): MiniGame {
  switch (id) {
    case 'fishing': return new FishingGame();
    case 'dodger': return new DodgerGame();
    case 'jumper': return new JumperGame();
    case 'shells': return new ShellMatchGame();
    case 'stacker': return new CloudStackGame();
  }
}
