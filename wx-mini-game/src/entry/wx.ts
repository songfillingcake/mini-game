import { startSquishyPlanet } from '@pocket-play/squishy-planet';
import { createWxHost, type WxApi } from '../platform/wx';

const scope = globalThis as unknown as { wx?: WxApi };
const api = scope.wx;
if (!api) throw new Error('未检测到微信小游戏 wx 运行时');

startSquishyPlanet(createWxHost(api));
