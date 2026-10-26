import { clamp } from './math';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): Rgb {
  let value = hex.trim();
  if (value.startsWith('#')) value = value.slice(1);
  if (value.length === 3) {
    value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
  }
  const numeric = Number.parseInt(value, 16);
  if (!Number.isFinite(numeric) || value.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: (numeric >> 16) & 0xff,
    g: (numeric >> 8) & 0xff,
    b: numeric & 0xff,
  };
}

function toHex(rgb: Rgb): string {
  const part = (channel: number): string => {
    const value = Math.round(clamp(channel, 0, 255));
    return value < 16 ? `0${value.toString(16)}` : value.toString(16);
  };
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
}

/** 给十六进制颜色叠加透明度。 */
export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

/** 在两个十六进制颜色之间插值。 */
export function mixColor(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const k = clamp(t, 0, 1);
  return toHex({
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  });
}

/** 调整明度：amount > 0 变亮，< 0 变暗。 */
export function shade(hex: string, amount: number): string {
  return amount >= 0 ? mixColor(hex, '#ffffff', amount) : mixColor(hex, '#000000', -amount);
}
