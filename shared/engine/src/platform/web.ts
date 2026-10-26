import { DESIGN_WIDTH } from '../core/math';
import { WebAudioBus } from '../audio/webAudio';
import type { Host, InputSink, Viewport } from './types';

/** 浏览器预览宿主：用 DOM 事件 / localStorage / WebAudio 模拟小游戏能力。 */
export function createWebHost(container: HTMLElement): Host {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器无法创建 Canvas 2D 上下文');

  const activePointers = new Set<number>();
  let scale = 1;

  const toDesign = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  const host: Host = {
    ctx,
    storage: {
      read(key: string): string | null {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      write(key: string, value: string): void {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // 隐私模式下写入可能失败，忽略即可。
        }
      },
    },
    audio: new WebAudioBus(),
    haptics: {
      tap(intensity: number): void {
        if (typeof navigator.vibrate !== 'function') return;
        try {
          navigator.vibrate(Math.round(6 + intensity * 20));
        } catch {
          // 部分浏览器禁止无手势震动，忽略。
        }
      },
    },
    beginFrame(): Viewport {
      const cssWidth = Math.max(1, container.clientWidth);
      const cssHeight = Math.max(1, container.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      scale = cssWidth / DESIGN_WIDTH;

      const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
      const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, DESIGN_WIDTH, cssHeight / scale);
      return { width: DESIGN_WIDTH, height: cssHeight / scale, dpr, insetTop: 0, insetBottom: 0 };
    },
    bindInput(sink: InputSink): void {
      canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        activePointers.add(event.pointerId);
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // 部分浏览器不支持捕获，不影响后续事件。
        }
        const point = toDesign(event.clientX, event.clientY);
        sink.pointerDown({ id: event.pointerId, x: point.x, y: point.y });
      });

      canvas.addEventListener('pointermove', (event) => {
        if (!activePointers.has(event.pointerId)) return;
        event.preventDefault();
        const point = toDesign(event.clientX, event.clientY);
        sink.pointerMove({ id: event.pointerId, x: point.x, y: point.y });
      });

      const release = (event: PointerEvent): void => {
        if (!activePointers.delete(event.pointerId)) return;
        sink.pointerUp(event.pointerId);
      };
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
      canvas.addEventListener('lostpointercapture', release);

      // 浏览器预览里禁用右键菜单与长按选中，贴近小游戏手感。
      canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    },
    loop(step: (dt: number, now: number) => void): void {
      let previous = 0;
      const frame = (now: number): void => {
        const dt = previous === 0 ? 0 : Math.min((now - previous) / 1000, 0.05);
        previous = now;
        step(dt, now / 1000);
        window.requestAnimationFrame(frame);
      };
      window.requestAnimationFrame(frame);
    },
  };

  return host;
}
