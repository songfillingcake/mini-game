/** 设计坐标宽度：所有布局与绘制都以 750 为基准宽度，由 Host 统一缩放到设备像素。 */
export const DESIGN_WIDTH = 750;

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** 取两个角度之间的最短差值，结果落在 [-PI, PI]。 */
export function angleDelta(a: number, b: number): number {
  let delta = (a - b) % TAU;
  if (delta > Math.PI) delta -= TAU;
  else if (delta < -Math.PI) delta += TAU;
  return delta;
}

/** 稳定可复现的伪随机数发生器。 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 本地日期键，用于每日目标。 */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 自 1970-01-01 起的天数，用于稳定地派生每日内容。 */
export function dayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** 把数值格式化成带千分位的短字符串（星尘数量较大时使用）。 */
export function formatCount(value: number): string {
  const rounded = Math.floor(value);
  if (rounded < 10_000) return String(rounded);
  return `${(rounded / 1000).toFixed(1)}k`;
}
