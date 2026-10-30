/** A centered pull slows the next second without jumping the tension's phase. */
export class SteadyReel {
  phaseTime = 0;
  remaining = 0;
  get active(): boolean { return this.remaining > 0; }
  steady(): void { this.remaining = 1; }
  forecast(seconds: number): number {
    const slowed = Math.min(seconds, this.remaining);
    return this.phaseTime + slowed * .65 + (seconds - slowed);
  }
  update(dt: number): void { this.phaseTime = this.forecast(dt); this.remaining = Math.max(0, this.remaining - dt); }
}
