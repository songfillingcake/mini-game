import type { Vec } from './Content';

/** Stationary search channel; the model decides whether the action is still valid. */
export class LootSearch {
  id: number | null = null;
  progress = 0;
  origin: Vec = { x: 0, y: 0 };
  readonly duration = 2.2;
  begin(id: number, origin: Vec): void { if (this.id === id) return; this.id = id; this.origin = { ...origin }; this.progress = 0; }
  cancel(): void { this.id = null; this.progress = 0; }
  update(dt: number, valid: boolean): boolean {
    if (this.id === null) return false;
    if (!valid) { this.cancel(); return false; }
    this.progress = Math.min(1, this.progress + dt / this.duration);
    return this.progress >= 1;
  }
}
