type JumpRoute = 'star-chaser' | 'spring-rider' | 'steady-climb';
export interface PlatformPlan {
  label: string;
  delta: number;
  spring?: boolean;
  moving?: boolean;
  fragile?: boolean;
  hasStar?: boolean;
}

/** Six-platform phrases alternate direction, crossing and spring routes. */
export function composePlatform(index: number, route: JumpRoute): PlatformPlan {
  const step = index % 6, phrase = Math.floor(index / 6) % 3;
  if (phrase === 0) return {
    label: '追星弧桥', delta: [110, 110, -110, -110, 110, -110][step],
    spring: false, moving: false, fragile: false,
    hasStar: route === 'star-chaser' || step % 2 === 0,
  };
  if (phrase === 1) return {
    label: '横风回廊', delta: [-130, -90, 150, 110, -100, -100][step],
    spring: false, moving: route === 'steady-climb' ? step === 2 : step % 2 === 0,
    fragile: false, hasStar: step === 1 || step === 4,
  };
  return {
    label: '弹簧云梯', delta: [120, -100, 120, 100, -110, -90][step],
    spring: step === 2 || (route === 'spring-rider' && step === 5),
    moving: false, fragile: route !== 'steady-climb' && (step === 1 || step === 4),
    hasStar: step === 0 || step === 3,
  };
}
