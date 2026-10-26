import type { Host, InputSink, Viewport } from '@pocket-play/engine';
import { DESIGN_WIDTH, InnerAudioBus, type InnerAudioLike } from '@pocket-play/engine';

interface QgCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
}

interface QgTouch {
  identifier?: number;
  clientX: number;
  clientY: number;
}

interface QgTouchEvent {
  touches: QgTouch[];
  changedTouches?: QgTouch[];
}

interface QgSafeArea {
  top: number;
  bottom: number;
  height: number;
}

interface QgSystemInfo {
  screenWidth: number;
  screenHeight: number;
  windowWidth?: number;
  windowHeight?: number;
  pixelRatio?: number;
  statusBarHeight?: number;
  safeArea?: QgSafeArea;
}

/** vivo 小游戏（快游戏联盟）运行时注入的 qg 命名空间里，本项目用到的部分。 */
export interface QgApi {
  createCanvas(): QgCanvas;
  getSystemInfoSync(): QgSystemInfo;
  onTouchStart(callback: (event: QgTouchEvent) => void): void;
  onTouchMove(callback: (event: QgTouchEvent) => void): void;
  onTouchEnd(callback: (event: QgTouchEvent) => void): void;
  onTouchCancel(callback: (event: QgTouchEvent) => void): void;
  getStorageSync(key: string): string;
  setStorageSync(key: string, value: string): void;
  createInnerAudioContext?: () => InnerAudioLike;
  vibrateShort?: (options?: { type?: 'light' | 'medium' | 'heavy' }) => void;
}

function pickCanvas(qg: QgApi): QgCanvas {
  const scope = globalThis as unknown as { canvas?: QgCanvas };
  if (scope.canvas && typeof scope.canvas.getContext === 'function') return scope.canvas;
  return qg.createCanvas();
}

/**
 * vivo 小游戏宿主。
 * 小游戏没有 DOM，所有尺寸/输入/存储/音频都通过 qg API 取得，
 * 再统一换算到 750 宽的设计坐标，游戏层因此完全感知不到平台差异。
 */
export function createQgHost(qg: QgApi): Host {
  const canvas = pickCanvas(qg);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('vivo 运行时无法创建 Canvas 2D 上下文');

  const info = qg.getSystemInfoSync();
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

  const audio = new InnerAudioBus(() => (qg.createInnerAudioContext ? qg.createInnerAudioContext() : null));

  return {
    ctx,
    storage: {
      read(key: string): string | null {
        try {
          const value = qg.getStorageSync(key);
          return typeof value === 'string' && value.length > 0 ? value : null;
        } catch {
          return null;
        }
      },
      write(key: string, value: string): void {
        try {
          qg.setStorageSync(key, value);
        } catch {
          // 存储配额不足时忽略。
        }
      },
    },
    audio,
    haptics: {
      tap(intensity: number): void {
        if (typeof qg.vibrateShort !== 'function') return;
        try {
          qg.vibrateShort({ type: intensity > 0.8 ? 'heavy' : intensity > 0.4 ? 'medium' : 'light' });
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
      qg.onTouchStart((event) => {
        const touches = event.changedTouches ?? event.touches;
        for (let i = 0; i < touches.length; i += 1) {
          const touch = touches[i];
          const point = toDesign(touch.clientX, touch.clientY);
          sink.pointerDown({ id: touch.identifier ?? i, x: point.x, y: point.y });
        }
      });
      qg.onTouchMove((event) => {
        const touches = event.changedTouches ?? event.touches;
        for (let i = 0; i < touches.length; i += 1) {
          const touch = touches[i];
          const point = toDesign(touch.clientX, touch.clientY);
          sink.pointerMove({ id: touch.identifier ?? i, x: point.x, y: point.y });
        }
      });
      qg.onTouchEnd((event) => {
        const touches = event.changedTouches ?? event.touches;
        for (let i = 0; i < touches.length; i += 1) {
          sink.pointerUp(touches[i].identifier ?? i);
        }
      });
      qg.onTouchCancel(() => sink.pointerCancel());
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
