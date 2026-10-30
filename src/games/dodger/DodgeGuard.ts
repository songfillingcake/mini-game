/** One run's earned protection. Stars earn one pip; risky near misses earn two. */
export class DodgeGuard {
  readonly capacity = 6;
  charge = 0;
  blocks = 0;
  flash = 0;
  grace = 0;
  get ready(): boolean { return this.charge >= this.capacity; }
  earn(points: number): void { this.charge = Math.min(this.capacity, this.charge + points); }
  update(dt: number): void { this.flash = Math.max(0, this.flash - dt); this.grace = Math.max(0, this.grace - dt); }
  absorb(): boolean {
    if (this.grace > 0) return true;
    if (!this.ready) return false;
    this.charge = 0; this.blocks++; this.flash = .8; this.grace = .8;
    return true;
  }
}
