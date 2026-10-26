import { createWebHost } from '@pocket-play/engine/platform/web';
import { startLightweave } from './game/lightweave';

/** 浏览器入口：各平台工程的 `npm run dev` 都走这里。 */
export function mountLightweave(container: HTMLElement): void {
  startLightweave(createWebHost(container));
}
