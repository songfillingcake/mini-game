import { HEIGHT, WIDTH } from './Game';

export class CanvasSurface {
  readonly context: CanvasRenderingContext2D;
  private observer: ResizeObserver;
  private pixelRatio = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前浏览器无法创建 Canvas 画布');
    this.context = context;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * this.pixelRatio);
    const height = Math.round(rect.height * this.pixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.context.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
  }

  point(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  dispose(): void {
    this.observer.disconnect();
  }
}
