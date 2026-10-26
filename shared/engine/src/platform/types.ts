export type SfxName = 'press' | 'release' | 'resonance' | 'unlock' | 'goal';

export interface PointerSample {
  readonly id: number;
  /** 设计坐标（750 宽基准） */
  readonly x: number;
  readonly y: number;
}

export interface InputSink {
  pointerDown(sample: PointerSample): void;
  pointerMove(sample: PointerSample): void;
  pointerUp(id: number): void;
  pointerCancel(): void;
}

export interface Viewport {
  /** 设计坐标宽度，恒为 DESIGN_WIDTH */
  readonly width: number;
  /** 设计坐标高度，随设备比例变化 */
  readonly height: number;
  readonly dpr: number;
  /** 顶部安全区，已换算到设计坐标 */
  readonly insetTop: number;
  /** 底部安全区，已换算到设计坐标 */
  readonly insetBottom: number;
}

export interface StoragePort {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export interface AudioPort {
  play(name: SfxName, intensity?: number): void;
  setEnabled(enabled: boolean): void;
  readonly enabled: boolean;
}

export interface HapticsPort {
  tap(intensity: number): void;
}

/**
 * 运行时宿主：把「画布 / 输入 / 存储 / 音频 / 震动」这些平台差异收敛到一处，
 * 游戏逻辑只面向这个接口，因此浏览器预览与 vivo 小游戏共用同一份代码。
 */
export interface Host {
  readonly ctx: CanvasRenderingContext2D;
  readonly storage: StoragePort;
  readonly audio: AudioPort;
  readonly haptics: HapticsPort;
  /** 同步画布尺寸、设置设计坐标变换并清屏，返回本帧视口。 */
  beginFrame(): Viewport;
  bindInput(sink: InputSink): void;
  /** 启动主循环，step 的 dt 单位为秒且已被安全钳制。 */
  loop(step: (dt: number, now: number) => void): void;
}
