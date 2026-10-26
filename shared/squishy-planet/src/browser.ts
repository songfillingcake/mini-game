import { createWebHost } from '@pocket-play/engine/platform/web';
import { startSquishyPlanet } from './game/squishyPlanet';

/**
 * 浏览器入口：在给定容器里铺一块画布并启动游戏。
 * 各平台工程的 `npm run dev` 都走这里，保证预览与真机是同一份玩法代码。
 */
export function mountSquishyPlanet(container: HTMLElement): void {
  startSquishyPlanet(createWebHost(container));
}
