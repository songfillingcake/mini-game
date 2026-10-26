/**
 * 捏捏星球 · 玩法入口。
 * 平台相关的能力全部来自 @pocket-play/engine 的 Host 契约。
 */
export { DESIGN_WIDTH } from '@pocket-play/engine';
export { PALETTES, paletteById, type Palette } from './game/palette';
export { SAVE_KEY, type SaveState } from './game/save';
export { SquishyPlanet, startSquishyPlanet } from './game/squishyPlanet';
export { InnerAudioBus, type InnerAudioLike } from '@pocket-play/engine';
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
