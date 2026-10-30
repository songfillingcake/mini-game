export const skyBlueprintStages = [
  { layer: 8, ratio: .6, reward: 80, name: '草甸屋顶' },
  { layer: 16, ratio: .45, reward: 120, name: '云海露台' },
  { layer: 24, ratio: .35, reward: 180, name: '星空尖塔' },
] as const;

/** Checkpoint rules only. The normal placement and width recovery still do the work. */
export class SkyBlueprint {
  completed = 0;
  get next(): typeof skyBlueprintStages[number] | undefined { return skyBlueprintStages[this.completed]; }
  inspect(layer: number, width: number, startingWidth: number): { result: 'none' | 'pass' | 'fail' | 'complete'; reward: number; name: string } {
    const stage = this.next;
    if (!stage || layer !== stage.layer) return { result: 'none', reward: 0, name: '' };
    if (width + .001 < startingWidth * stage.ratio) return { result: 'fail', reward: 0, name: stage.name };
    this.completed++;
    return { result: this.next ? 'pass' : 'complete', reward: stage.reward, name: stage.name };
  }
}
