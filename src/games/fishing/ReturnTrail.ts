/** One escaped fish per run can return on the next genuine bite. No persistent rewards. */
export class ReturnTrail {
  pendingId: string | null = null;
  active = false;
  recovered = 0;
  private spent = false;
  reserve(fishId: string | undefined, elapsed: number): boolean {
    if (!fishId || this.spent || elapsed >= 52) return false;
    this.spent = true; this.pendingId = fishId;
    return true;
  }
  take(): string | null { const id = this.pendingId; this.pendingId = null; this.active = Boolean(id); return id; }
  caught(): void { if (this.active) { this.recovered++; this.active = false; } }
}
