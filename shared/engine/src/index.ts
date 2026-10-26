/**
 * 口袋游乐场 · 引擎层。
 *
 * 这里只放「所有小游戏都会用到」的东西：设计坐标、绘制工具、音频总线、Host 契约。
 * 具体玩法的依赖方向永远是：游戏包 → engine → 平台工程。
 */
export {
  DESIGN_WIDTH,
  TAU,
  angleDelta,
  clamp,
  dateKey,
  dayIndex,
  easeInOutSine,
  easeOutCubic,
  formatCount,
  lerp,
  mulberry32,
} from './core/math';
export { mixColor, rgba, shade } from './core/color';
export { FONT_STACK, drawPill, ellipsePath, roundRectPath, setFont, starPath } from './core/draw';
export { InnerAudioBus, type InnerAudioLike } from './audio/innerAudio';
export { WebAudioBus } from './audio/webAudio';
export { createWebHost } from './platform/web';
export { createWxHost, type WxApi } from './platform/wx';
export type {
  AudioPort,
  HapticsPort,
  Host,
  InputSink,
  PointerSample,
  SfxName,
  StoragePort,
  Viewport,
} from './platform/types';
