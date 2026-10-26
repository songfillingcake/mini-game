const SAMPLE_RATE = 22050;

/** 16bit 单声道 WAV 编码。 */
export function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'latin1');
  header.write('fmt ', 12, 'latin1');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}

function tone(frequency, duration, options = {}) {
  const gain = options.gain ?? 0.5;
  const decay = options.decay ?? 6.5;
  const harmonics = options.harmonics ?? [1];
  const length = Math.max(1, Math.floor(duration * SAMPLE_RATE));
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const attack = 1 - Math.exp(-t * 420);
    const envelope = Math.exp(-t * decay) * attack;
    let value = 0;
    for (let h = 0; h < harmonics.length; h += 1) {
      value += harmonics[h] * Math.sin(2 * Math.PI * frequency * (h + 1) * t);
    }
    buffer[i] = value * envelope * gain;
  }
  return buffer;
}

function mixTracks(tracks) {
  let length = 0;
  for (const track of tracks) length = Math.max(length, track.offset + track.buffer.length);
  const output = new Float32Array(length);
  for (const track of tracks) {
    for (let i = 0; i < track.buffer.length; i += 1) output[track.offset + i] += track.buffer[i];
  }
  return output;
}

function normalize(samples, peak = 0.82) {
  let max = 0;
  for (let i = 0; i < samples.length; i += 1) max = Math.max(max, Math.abs(samples[i]));
  if (max <= 0.000001) return samples;
  const factor = peak / max;
  for (let i = 0; i < samples.length; i += 1) samples[i] *= factor;
  // 末尾 8ms 淡出，避免爆音。
  const fade = Math.min(samples.length, Math.floor(SAMPLE_RATE * 0.008));
  for (let i = 0; i < fade; i += 1) {
    samples[samples.length - 1 - i] *= i / fade;
  }
  return samples;
}

const offset = (seconds) => Math.round(seconds * SAMPLE_RATE);

/** 与 game/audio/webAudio.ts 的合成音阶一一对应，两端听感一致。 */
export const SOUND_SCORES = {
  press: [
    { buffer: tone(523.25, 0.3, { gain: 0.5, decay: 7.2, harmonics: [1, 0.16] }), offset: 0 },
    { buffer: tone(1046.5, 0.14, { gain: 0.14, decay: 12, harmonics: [1] }), offset: 0 },
  ],
  release: [{ buffer: tone(392, 0.26, { gain: 0.45, decay: 9, harmonics: [1, 0.1] }), offset: 0 }],
  resonance: [
    { buffer: tone(659.25, 0.7, { gain: 0.45, decay: 3.4, harmonics: [1, 0.12] }), offset: 0 },
    { buffer: tone(987.77, 0.75, { gain: 0.3, decay: 3.2, harmonics: [1] }), offset: offset(0.045) },
    { buffer: tone(1318.51, 0.55, { gain: 0.16, decay: 4.2, harmonics: [1] }), offset: offset(0.09) },
  ],
  unlock: [
    { buffer: tone(523.25, 0.45, { gain: 0.4, decay: 4.2, harmonics: [1, 0.12] }), offset: 0 },
    { buffer: tone(659.25, 0.45, { gain: 0.4, decay: 4.2, harmonics: [1, 0.12] }), offset: offset(0.09) },
    { buffer: tone(783.99, 0.6, { gain: 0.4, decay: 3.6, harmonics: [1, 0.12] }), offset: offset(0.18) },
  ],
  goal: [
    { buffer: tone(783.99, 0.5, { gain: 0.4, decay: 3.8 }), offset: 0 },
    { buffer: tone(1046.5, 0.7, { gain: 0.36, decay: 3.2 }), offset: offset(0.12) },
  ],
};

export function renderSound(name) {
  const score = SOUND_SCORES[name];
  if (!score) throw new Error(`未知音效：${name}`);
  return encodeWav(normalize(mixTracks(score)));
}
