/**
 * 织光 · 连线解谜。
 *
 * 平台工程只需要提供一个 Host（画布 / 输入 / 存储 / 音频 / 震动 / 主循环），
 * 玩法、关卡、存档、渲染全部在这里。
 */
export { DESIGN_WIDTH } from '@pocket-play/engine';
export { Lightweave, startLightweave } from './game/lightweave';
export { LEVELS, levelsOfChapter, levelCount } from './game/catalog';
export { CHAPTERS, type Level } from './game/types';
export { THEMES, type Theme } from './game/themes';
export { SAVE_KEY } from './game/save';
export type {
  AudioPort,
  HapticsPort,
  Host,
  InputSink,
  PointerSample,
  SfxName,
  StoragePort,
  Viewport,
} from '@pocket-play/engine';
