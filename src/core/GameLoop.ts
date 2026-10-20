export class GameLoop {
  private frameId = 0;
  private lastTime = 0;
  private active = false;

  constructor(private readonly step: (dt: number, now: number) => void) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.lastTime = 0;
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.active = false;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  private tick = (timestamp: number): void => {
    if (!this.active) return;
    const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = timestamp;
    this.step(dt, timestamp / 1000);
    this.frameId = requestAnimationFrame(this.tick);
  };
}
