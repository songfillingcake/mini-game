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
    description: '盯住浮标，在鱼咬钩的瞬间收竿；钓到不同鱼种，就能填满湖边图鉴。',
    controls: '点击 / 空格',
    icon: '🎣',
    color: 'mint',
    tag: '收集图鉴',
  },
  {
    id: 'dodger',
    title: '躲障碍',
    subtitle: '闪开石头，顺手捡星星',
    description: '左右移动躲开跑道上的障碍，坚持到终点，看看能收集多少星星。',
    controls: '← → / A D',
    icon: '🏃',
    color: 'peach',
    tag: '反应挑战',
  },
  {
    id: 'jumper',
    title: '弹跳闯关',
    subtitle: '踩稳平台，一路往上跳',
    description: '落在平台上自动弹跳，踩中星星加分，弹簧平台能送你飞得更高。',
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
