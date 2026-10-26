import { DESIGN_WIDTH } from '../core/math';
import { InnerAudioBus, type InnerAudioLike } from '../audio/innerAudio';
import type { Host, InputSink, Viewport } from './types';

interface WxCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
}

interface WxTouch {
  identifier?: number;
  clientX: number;
  clientY: number;
}

interface WxTouchEvent {
  touches: WxTouch[];
  changedTouches?: WxTouch[];
}

interface WxSafeArea {
  top: number;
  bottom: number;
  height: number;
}

interface WxSystemInfo {
  screenWidth: number;
  screenHeight: number;
  windowWidth?: number;
  windowHeight?: number;
  pixelRatio?: number;
  statusBarHeight?: number;
  safeArea?: WxSafeArea;
}

/** 微信小游戏 wx 命名空间里我们用到的部分。 */
export interface WxApi {
  createCanvas(): WxCanvas;
  getSystemInfoSync(): WxSystemInfo;
  onTouchStart(callback: (event: WxTouchEvent) => void): void;
  onTouchMove(callback: (event: WxTouchEvent) => void): void;
  onTouchEnd(callback: (event: WxTouchEvent) => void): void;
  onTouchCancel(callback: (event: WxTouchEvent) => void): void;
  getStorageSync(key: string): string;
  setStorageSync(key: string, value: string): void;
  createInnerAudioContext?: () => InnerAudioLike;
  vibrateShort?: (options?: { type?: 'light' | 'medium' | 'heavy' }) => void;
}

function pickCanvas(wx: WxApi): WxCanvas {
  const scope = globalThis as unknown as { canvas?: WxCanvas };
  if (scope.canvas && typeof scope.canvas.getContext === 'function') return scope.canvas;
  // 微信小游戏里第一次 createCanvas() 拿到的就是展示到屏幕上的主画布。
  return wx.createCanvas();
}

/**
 * 微信小游戏宿主。所有游戏共用这一份适配层：
 * 游戏包只依赖 Host 契约，平台工程只需要把 wx 传进来。
 *
 * @param audioBase 音频目录，包内相对路径（默认 'audio'）
 */
export function createWxHost(wx: WxApi, audioBase = 'audio'): Host {
  const canvas = pickCanvas(wx);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('微信小游戏无法创建 Canvas 2D 上下文');

  const info = wx.getSystemInfoSync();
  const screenWidth = Math.max(1, info.screenWidth || info.windowWidth || 360);
  const screenHeight = Math.max(1, info.screenHeight || info.windowHeight || 640);
  const dpr = Math.min(info.pixelRatio || 1, 3);
  const scale = screenWidth / DESIGN_WIDTH;
  const designHeight = screenHeight / scale;

  const safeTop = info.safeArea?.top ?? info.statusBarHeight ?? 0;
  const safeBottom = info.safeArea ? Math.max(0, screenHeight - info.safeArea.bottom) : 0;

  const resize = (): void => {
    const pixelWidth = Math.round(screenWidth * dpr);
    const pixelHeight = Math.round(screenHeight * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  };
  resize();

  const toDesign = (clientX: number, clientY: number): { x: number; y: number } => ({
    x: clientX / scale,
    y: clientY / scale,
  });

  const audio = new InnerAudioBus(
    () => (wx.createInnerAudioContext ? wx.createInnerAudioContext() : null),
    audioBase,
  );

  return {
    ctx,
    storage: {
      read(key: string): string | null {
        try {
          const value = wx.getStorageSync(key);
          return typeof value === 'string' && value.length > 0 ? value : null;
        } catch {
          return null;
        }
      },
      write(key: string, value: string): void {
        try {
          wx.setStorageSync(key, value);
        } catch {
          // 存储超限时忽略，游戏本身不受影响。
        }
      },
    },
    audio,
    haptics: {
      tap(intensity: number): void {
        if (typeof wx.vibrateShort !== 'function') return;
        try {
          wx.vibrateShort({ type: intensity > 0.8 ? 'heavy' : intensity > 0.4 ? 'medium' : 'light' });
        } catch {
          // 部分机型不支持震动。
        }
      },
    },
    beginFrame(): Viewport {
      resize();
      ctx.clearRect(0, 0, DESIGN_WIDTH, designHeight);
      return {
        width: DESIGN_WIDTH,
        height: designHeight,
        dpr,
        insetTop: safeTop / scale,
        insetBottom: safeBottom / scale,
      };
    },
    bindInput(sink: InputSink): void {
      wx.onTouchStart((event) => {
        const touches = event.changedTouches ?? event.touches;
        for (let i = 0; i < touches.length; i += 1) {
          const touch = touches[i];
          const point = toDesign(touch.clientX, touch.clientY);
          sink.pointerDown({ id: touch.identifier ?? i, x: point.x, y: point.y });
        }
      });
      wx.onTouchMove((event) => {
        const touches = event.changedTouches ?? event.touches;
        for (let i = 0; i < touches.length; i += 1) {
          const touch = touches[i];
          const point = toDesign(touch.clientX, touch.clientY);
          sink.pointerMove({ id: touch.identifier ?? i, x: point.x, y: point.y });
        }
      });
      wx.onTouchEnd((event) => {
        const touches = event.changedTouches ?? event.touches;
        for (let i = 0; i < touches.length; i += 1) {
          sink.pointerUp(touches[i].identifier ?? i);
        }
      });
      wx.onTouchCancel(() => sink.pointerCancel());
    },
    loop(step: (dt: number, now: number) => void): void {
      const scope = globalThis as unknown as {
        requestAnimationFrame?: (callback: (time: number) => void) => number;
      };
      const raf = scope.requestAnimationFrame;
      if (typeof raf !== 'function') return;
      let previous = 0;
      const frame = (now: number): void => {
        const dt = previous === 0 ? 0 : Math.min((now - previous) / 1000, 0.05);
        previous = now;
        step(dt, now / 1000);
        raf(frame);
      };
      raf(frame);
    },
  };
}
