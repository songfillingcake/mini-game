import { startLightweave } from '@pocket-play/lightweave';
import { createWxHost, type WxApi } from '@pocket-play/engine/platform/wx';

const scope = globalThis as unknown as { wx?: WxApi };
const api = scope.wx;
if (!api) throw new Error('未检测到微信小游戏 wx 运行时');

startLightweave(createWxHost(api));
