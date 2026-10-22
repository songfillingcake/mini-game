import type { GameId, MiniGame } from '../core/Game';
import { DodgerGame } from './dodger/DodgerGame';
import { FishingGame } from './fishing/FishingGame';
import { JumperGame } from './jumper/JumperGame';

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
];

export function createGame(id: GameId): MiniGame {
  switch (id) {
    case 'fishing': return new FishingGame();
    case 'dodger': return new DodgerGame();
    case 'jumper': return new JumperGame();
  }
}
