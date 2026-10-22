import { getSoundEnabled, setSoundEnabled } from './Storage';

export type SoundCue = 'start' | 'bite' | 'reel' | 'strain' | 'catch' | 'fake' | 'miss' | 'hit' | 'star' | 'bounce' | 'spring' | 'unlock' | 'finish';

const notes: Record<SoundCue, number[]> = {
  start: [440, 660],
  bite: [620, 880],
  reel: [520, 720],
  strain: [260, 190],
  catch: [523, 659, 784],
  fake: [400, 330],
  miss: [392, 294],
  hit: [220, 165],
  star: [880, 1175],
  bounce: [390],
  spring: [520, 780],
  unlock: [523, 784, 1047, 1319],
  finish: [659, 523, 392],
};

class AudioManager {
  private context: AudioContext | null = null;
  private enabled = getSoundEnabled();

  isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    setSoundEnabled(this.enabled);
    return this.enabled;
  }

  play(cue: SoundCue): void {
    if (!this.enabled) return;
    try {
      const context = this.getContext();
      if (context.state === 'suspended') void context.resume();
      const now = context.currentTime;
      const toneLength = cue === 'bounce' ? 0.075 : 0.1;
      notes[cue].forEach((frequency, index) => {
        const start = now + index * 0.055;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = cue === 'hit' || cue === 'miss' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        if (cue === 'hit' || cue === 'miss') {
          oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.68), start + toneLength);
        }
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.035, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + toneLength);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + toneLength + 0.015);
      });
    } catch {
      // 音频不可用时不影响游戏流程。
    }
  }

  private getContext(): AudioContext {
    if (!this.context) this.context = new AudioContext();
    return this.context;
  }
}

export const audio = new AudioManager();
