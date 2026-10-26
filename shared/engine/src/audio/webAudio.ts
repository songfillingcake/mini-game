import type { AudioPort, SfxName } from '../platform/types';

type ToneShape = 'sine' | 'triangle' | 'sawtooth' | 'square';

interface Tone {
  readonly frequency: number;
  readonly delay: number;
  readonly duration: number;
  readonly gain: number;
  readonly shape: ToneShape;
}

/**
 * 音色全部用振荡器现场合成，浏览器预览因此不需要任何音频资源。
 * vivo 端由 InnerAudioBus 播放构建期生成的 wav，两者音高一致。
 */
const SCORE: Record<SfxName, readonly Tone[]> = {
  press: [
    { frequency: 523.25, delay: 0, duration: 0.22, gain: 0.075, shape: 'sine' },
    { frequency: 1046.5, delay: 0, duration: 0.1, gain: 0.016, shape: 'sine' },
  ],
  release: [
    { frequency: 392, delay: 0, duration: 0.18, gain: 0.055, shape: 'sine' },
  ],
  resonance: [
    { frequency: 659.25, delay: 0, duration: 0.52, gain: 0.07, shape: 'sine' },
    { frequency: 987.77, delay: 0.045, duration: 0.56, gain: 0.045, shape: 'sine' },
    { frequency: 1318.51, delay: 0.09, duration: 0.4, gain: 0.022, shape: 'sine' },
  ],
  unlock: [
    { frequency: 523.25, delay: 0, duration: 0.34, gain: 0.055, shape: 'sine' },
    { frequency: 659.25, delay: 0.09, duration: 0.34, gain: 0.055, shape: 'sine' },
    { frequency: 783.99, delay: 0.18, duration: 0.46, gain: 0.055, shape: 'sine' },
  ],
  goal: [
    { frequency: 783.99, delay: 0, duration: 0.4, gain: 0.055, shape: 'sine' },
    { frequency: 1046.5, delay: 0.12, duration: 0.55, gain: 0.05, shape: 'sine' },
  ],
};

export class WebAudioBus implements AudioPort {
  enabled = true;
  private context: AudioContext | null = null;

  play(name: SfxName, intensity = 1): void {
    if (!this.enabled || intensity <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const base = ctx.currentTime + 0.002;
    const tones = SCORE[name];
    for (let i = 0; i < tones.length; i += 1) {
      const tone = tones[i];
      const start = base + tone.delay;
      const end = start + tone.duration;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = tone.shape;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(Math.max(0.0002, tone.gain * intensity), start + 0.014);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(envelope);
      envelope.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.03);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    }
    const scope = globalThis as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.context = new Ctor();
    } catch {
      return null;
    }
    return this.context;
  }
}
