import { HEIGHT, WIDTH } from './Game';

export class CanvasSurface {
  readonly context: CanvasRenderingContext2D;
  private observer: ResizeObserver;
  private pixelRatio = 1;
  private contentScale = 1;
  private offsetX = 0;
  private offsetY = 0;

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
    this.contentScale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
    this.offsetX = (rect.width - WIDTH * this.contentScale) / 2;
    this.offsetY = (rect.height - HEIGHT * this.contentScale) / 2;
    const scale = this.contentScale * this.pixelRatio;
    this.context.setTransform(scale, 0, 0, scale, this.offsetX * this.pixelRatio, this.offsetY * this.pixelRatio);
  }

  point(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.contentScale,
      y: (clientY - rect.top - this.offsetY) / this.contentScale,
    };
  }

  dispose(): void {
    this.observer.disconnect();
  }
}
