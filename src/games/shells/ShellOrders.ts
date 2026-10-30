export const shellOrders = [
  { kind: 'shell', icon: '🐚', name: '贝壳', target: 6, reward: 80 },
  { kind: 'pearl', icon: '💎', name: '珍珠', target: 8, reward: 120 },
  { kind: 'fish', icon: '🐟', name: '小鱼', target: 10, reward: 180 },
] as const;

/** Orders count actual removed gems, never the special gem preserved after a four-match. */
export class ShellOrders {
  completed = 0;
  progress = 0;
  earned = 0;
  flash = 0;
  get current(): typeof shellOrders[number] | undefined { return shellOrders[this.completed]; }
  collect(kinds: readonly string[]): number {
    const order = this.current;
    if (!order) return 0;
    this.progress = Math.min(order.target, this.progress + kinds.filter(kind => kind === order.kind).length);
    if (this.progress < order.target) return 0;
    this.completed++; this.progress = 0; this.earned += order.reward; this.flash = 1.5;
    // This clear belongs to one order; excess gems do not silently fill the next.
    return order.reward;
  }
}
