/** Only first visits to higher platforms earn precision rewards. */
export class LandingRhythm {
  charge = 0;
  streak = 0;
  best = 0;
  rescues = 0;
  flash = 0;
  message = '';
  private highest = 420;
  get ready(): boolean { return this.charge >= 3; }
  land(x: number, platform: { x: number; y: number; width: number }): number {
    if (platform.y >= this.highest) return 0;
    this.highest = platform.y;
    if (Math.abs(x - platform.x - platform.width / 2) > Math.min(18, platform.width * .15)) { this.streak = 0; return 0; }
    this.streak++; this.best = Math.max(this.best, this.streak);
    this.charge = Math.min(3, this.charge + 1);
    const bonus = 20 + Math.min(3, this.streak - 1) * 5;
    this.flash = 1.1; this.message = `精准落点 +${bonus}`;
    return bonus;
  }
  rescue(): boolean {
    if (!this.ready) return false;
    this.charge = 0; this.streak = 0; this.rescues++;
    this.flash = 1.5; this.message = '救援云接住了你！';
    return true;
  }
}
