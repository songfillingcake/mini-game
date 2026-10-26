import { encodePng } from './png.mjs';

const SKY_TOP = [0x2a, 0x1b, 0x31];
const SKY_BOTTOM = [0x0d, 0x0d, 0x1c];
const BODY_LIGHT = [0xff, 0xf0, 0xf5];
const BODY_MID = [0xff, 0xb7, 0xce];
const BODY_DEEP = [0xe0, 0x72, 0x9d];
const AURA = [0xff, 0x9e, 0xc4];
const INK = [0x4a, 0x21, 0x33];
const BLUSH = [0xff, 0x8a, 0xb0];
const WHITE = [0xff, 0xff, 0xff];

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

function blend(out, target, alpha) {
  const a = clamp01(alpha);
  out[0] += (target[0] - out[0]) * a;
  out[1] += (target[1] - out[1]) * a;
  out[2] += (target[2] - out[2]) * a;
}

function samplePixel(px, py, width, height, cx, cy, radius, out) {
  const t = clamp01(py / height);
  out[0] = SKY_TOP[0] + (SKY_BOTTOM[0] - SKY_TOP[0]) * t;
  out[1] = SKY_TOP[1] + (SKY_BOTTOM[1] - SKY_TOP[1]) * t;
  out[2] = SKY_TOP[2] + (SKY_BOTTOM[2] - SKY_TOP[2]) * t;

  const distance = Math.hypot(px - cx, py - cy);
  const glow = clamp01(1 - distance / (radius * 2.35));
  blend(out, AURA, glow * glow * 0.5);

  const starAlpha = (sx, sy) => clamp01(1 - Math.hypot(px - sx * width, py - sy * height) / (width * 0.026));
  blend(out, WHITE, starAlpha(0.21, 0.25) * 0.85);
  blend(out, WHITE, starAlpha(0.79, 0.28) * 0.7);
  blend(out, WHITE, starAlpha(0.82, 0.76) * 0.75);

  if (distance > radius) return out;

  const lightX = (px - (cx - radius * 0.32)) / (radius * 1.25);
  const lightY = (py - (cy - radius * 0.36)) / (radius * 1.25);
  const light = Math.hypot(lightX, lightY);
  if (light < 0.45) {
    const k = clamp01(light / 0.45);
    out[0] = BODY_LIGHT[0] + (BODY_MID[0] - BODY_LIGHT[0]) * k;
    out[1] = BODY_LIGHT[1] + (BODY_MID[1] - BODY_LIGHT[1]) * k;
    out[2] = BODY_LIGHT[2] + (BODY_MID[2] - BODY_LIGHT[2]) * k;
  } else {
    const k = clamp01((light - 0.45) / 0.75);
    out[0] = BODY_MID[0] + (BODY_DEEP[0] - BODY_MID[0]) * k;
    out[1] = BODY_MID[1] + (BODY_DEEP[1] - BODY_MID[1]) * k;
    out[2] = BODY_MID[2] + (BODY_DEEP[2] - BODY_MID[2]) * k;
  }

  blend(out, WHITE, clamp01((distance / radius - 0.82) / 0.18) * 0.42);

  const fx = (px - cx) / radius;
  const fy = (py - cy) / radius;

  for (let side = -1; side <= 1; side += 2) {
    const dx = fx - side * 0.235;
    const dy = fy + 0.02;
    if (dx * dx + dy * dy < 0.075 * 0.075) blend(out, INK, 0.92);

    const cdx = (fx - side * 0.375) / 0.085;
    const cdy = (fy - 0.14) / 0.05;
    const cheek = cdx * cdx + cdy * cdy;
    if (cheek < 1) blend(out, BLUSH, 0.32 * (1 - cheek));
  }

  const mouthDistance = Math.hypot(fx, fy - 0.02);
  if (fy > 0.14 && Math.abs(mouthDistance - 0.19) < 0.026) blend(out, INK, 0.85);

  return out;
}

/**
 * 现算游戏图标（默认 192×192），2×2 超采样用于边缘抗锯齿。
 * 仓库里因此不需要任何二进制资源，改配色就是改代码。
 */
export function renderIcon(size = 192) {
  const supersample = 2;
  const hiSize = size * supersample;
  const cx = hiSize * 0.5;
  const cy = hiSize * 0.515;
  const radius = hiSize * 0.315;
  const pixels = new Uint8ClampedArray(size * size * 4);
  const sampleColor = [0, 0, 0];
  const accumulator = [0, 0, 0];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      accumulator[0] = 0;
      accumulator[1] = 0;
      accumulator[2] = 0;
      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          samplePixel(
            x * supersample + sx + 0.5,
            y * supersample + sy + 0.5,
            hiSize,
            hiSize,
            cx,
            cy,
            radius,
            sampleColor,
          );
          accumulator[0] += sampleColor[0];
          accumulator[1] += sampleColor[1];
          accumulator[2] += sampleColor[2];
        }
      }
      const count = supersample * supersample;
      const index = (y * size + x) * 4;
      pixels[index] = accumulator[0] / count;
      pixels[index + 1] = accumulator[1] / count;
      pixels[index + 2] = accumulator[2] / count;
      pixels[index + 3] = 255;
    }
  }

  return encodePng(size, size, pixels);
}
