import { startSquishyPlanet } from '@pocket-play/squishy-planet';
import { createQgHost, type QgApi } from '../platform/qg';

const scope = globalThis as unknown as { qg?: QgApi };
const api = scope.qg;
if (!api) throw new Error('未检测到 vivo 小游戏 qg 运行时');

startSquishyPlanet(createQgHost(api));
