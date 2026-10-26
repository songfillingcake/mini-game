import type { AudioPort, SfxName } from '../platform/types';

/** qg.createInnerAudioContext() 返回对象里我们用到的那部分能力。 */
export interface InnerAudioLike {
  src: string;
  volume: number;
  loop: boolean;
  play(): void;
  stop(): void;
  seek?(time: number): void;
  destroy?(): void;
  onError?(callback: (error: unknown) => void): void;
}

const NAMES: readonly SfxName[] = ['press', 'release', 'resonance', 'unlock', 'goal'];
const POOL_SIZE = 2;

/**
 * vivo 端音频：播放构建期由 scripts/gen-assets.mjs 生成的短 wav。
 * 每种音效准备两个实例，连续快速点击时不会互相打断。
 */
export class InnerAudioBus implements AudioPort {
  enabled = true;
  private readonly pools = new Map<SfxName, InnerAudioLike[]>();
  private readonly cursors = new Map<SfxName, number>();

  constructor(create: () => InnerAudioLike | null, basePath = '/audio') {
    for (let n = 0; n < NAMES.length; n += 1) {
      const name = NAMES[n];
      const pool: InnerAudioLike[] = [];
      for (let i = 0; i < POOL_SIZE; i += 1) {
        const voice = create();
        if (!voice) break;
        try {
          voice.src = `${basePath}/${name}.wav`;
          voice.loop = false;
          voice.volume = 0.6;
          voice.onError?.(() => undefined);
        } catch {
          break;
        }
        pool.push(voice);
      }
      if (pool.length > 0) {
        this.pools.set(name, pool);
        this.cursors.set(name, 0);
      }
    }
  }

  play(name: SfxName, intensity = 1): void {
    if (!this.enabled || intensity <= 0) return;
    const pool = this.pools.get(name);
    if (!pool || pool.length === 0) return;
    const cursor = this.cursors.get(name) ?? 0;
    const voice = pool[cursor % pool.length];
    this.cursors.set(name, cursor + 1);
    try {
      voice.volume = Math.max(0.05, Math.min(1, 0.25 + intensity * 0.55));
      voice.stop();
      voice.seek?.(0);
      voice.play();
    } catch {
      // 音频失败不影响玩法。
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
