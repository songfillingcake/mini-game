import { access, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SAVE_KEY = 'squishy-planet/save/v1';
const SCREEN_WIDTH = 375;
const SCREEN_HEIGHT = 812;
const DPR = 2;

/** 只记录调用的 2D 上下文，用来在 Node 里跑通整条渲染路径。 */
function createFakeContext(canvas) {
  const gradient = { addColorStop() {} };
  return {
    canvas,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    arc() {},
    fill() {},
    stroke() {},
    clip() {},
    fillRect() {},
    clearRect() {},
    translate() {},
    rotate() {},
    scale() {},
    setTransform() {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: (text) => ({ width: String(text).length * 11 }),
    fillText() {},
  };
}

function createHarness(apiName) {
  const canvas = { width: 0, height: 0, getContext: () => context };
  const context = createFakeContext(canvas);
  const storage = new Map();
  const handlers = { start: null, move: null, end: null, cancel: null };
  const log = { frames: 0, audioPlays: 0, vibrations: 0 };

  let pending = null;
  let clock = 0;

  globalThis.requestAnimationFrame = (callback) => {
    pending = callback;
    return 1;
  };

  globalThis[apiName] = {
    createCanvas: () => canvas,
    getSystemInfoSync: () => ({
      screenWidth: SCREEN_WIDTH,
      screenHeight: SCREEN_HEIGHT,
      pixelRatio: DPR,
      safeArea: { top: 44, bottom: 778, height: 734 },
    }),
    onTouchStart: (callback) => {
      handlers.start = callback;
    },
    onTouchMove: (callback) => {
      handlers.move = callback;
    },
    onTouchEnd: (callback) => {
      handlers.end = callback;
    },
    onTouchCancel: (callback) => {
      handlers.cancel = callback;
    },
    getStorageSync: (key) => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    createInnerAudioContext: () => ({
      src: '',
      volume: 0,
      loop: false,
      play() {
        log.audioPlays += 1;
      },
      stop() {},
      seek() {},
      destroy() {},
    }),
    vibrateShort: () => {
      log.vibrations += 1;
    },
  };

  const frame = (ms = 16) => {
    clock += ms;
    const callback = pending;
    pending = null;
    if (callback) callback(clock);
    log.frames += 1;
  };

  const touchEvent = (x, y, id = 1) => ({
    touches: [{ identifier: id, clientX: x, clientY: y }],
    changedTouches: [{ identifier: id, clientX: x, clientY: y }],
  });

  const tap = (x, y, hold = 4, id = 1) => {
    handlers.start(touchEvent(x, y, id));
    for (let i = 0; i < hold; i += 1) frame();
    handlers.end(touchEvent(x, y, id));
  };

  return { canvas, storage, handlers, log, frame, tap, touchEvent };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * 在 Node 里用假的平台 API 跑真实构建产物。
 * apiName 是运行时注入的全局名：'qg'（vivo）或 'wx'（微信小游戏）。
 */
export async function runSmoke({ bundlePath, apiName, label }) {
  try {
    await access(bundlePath);
  } catch {
    throw new Error(`找不到构建产物：${bundlePath}，请先执行 npm run build`);
  }

  const harness = createHarness(apiName);
  await import(pathToFileURL(bundlePath).href);
  assert(harness.handlers.start, '游戏没有注册触摸事件');

  const { frame, tap, handlers, log, storage, touchEvent, canvas } = harness;

  for (let i = 0; i < 12; i += 1) frame();
  const expectWidth = SCREEN_WIDTH * DPR;
  const expectHeight = SCREEN_HEIGHT * DPR;
  assert(
    canvas.width === expectWidth && canvas.height === expectHeight,
    `画布尺寸异常：${canvas.width}×${canvas.height}`,
  );

  // 1) 长按星球：软体凹陷 + 拖动 + 松手回弹
  handlers.start(touchEvent(187, 380));
  for (let i = 0; i < 40; i += 1) frame();
  handlers.move(touchEvent(207, 390));
  for (let i = 0; i < 20; i += 1) frame();
  handlers.end(touchEvent(207, 390));

  // 2) 点底部材质格与音效开关，确认 UI 命中测试不崩
  tap(223, 747, 2, 2);
  tap(29, 747, 2, 3);

  // 3) 连续轻点跨越 3.6s 呼吸周期，必然命中至少一次共振
  for (let i = 0; i < 24; i += 1) {
    tap(187, 380, 3, 10);
    for (let j = 0; j < 18; j += 1) frame();
  }
  for (let i = 0; i < 220; i += 1) frame();

  const raw = storage.get(SAVE_KEY);
  assert(raw, '没有写入存档');
  const saved = JSON.parse(raw);
  assert(saved.presses >= 5, `按压次数偏少：${saved.presses}`);
  assert(saved.resonances >= 1, '24 次轻点都没有触发共振，窗口判定可能失效');
  assert(saved.dust > saved.presses, `共振奖励没有生效：dust=${saved.dust} presses=${saved.presses}`);
  assert(log.frames > 600, '渲染帧数异常');
  assert(log.audioPlays >= 1, '没有触发音效');

  console.log(`✔ ${label} 主流程通过`);
  console.log(`  渲染帧数 ${log.frames} · 按压 ${saved.presses} · 共振 ${saved.resonances} · 星尘 ${saved.dust}`);

  // 4) 预置一份差 1 点星尘的存档，验证「跨过阈值自动解锁」
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  storage.set(
    SAVE_KEY,
    JSON.stringify({
      version: 1,
      dust: 149,
      paletteId: 'peach',
      unlocked: ['peach'],
      sound: false,
      presses: 3,
      resonances: 0,
      dailyDate: key,
      dailyProgress: 0,
      dailyDone: false,
      tutorialSeen: true,
    }),
  );

  // 用一个临时副本重新装载，模拟「第二次启动游戏」
  const previousStart = handlers.start;
  const reload = path.join(path.dirname(bundlePath), `.smoke-reload-${process.pid}.mjs`);
  await copyFile(bundlePath, reload);
  try {
    await import(pathToFileURL(reload).href);
  } finally {
    await unlink(reload).catch(() => undefined);
  }
  assert(handlers.start !== previousStart, '重新装载后没有重新绑定输入');

  for (let i = 0; i < 6; i += 1) frame();
  tap(187, 380, 4, 20);
  for (let i = 0; i < 220; i += 1) frame();

  const unlocked = JSON.parse(storage.get(SAVE_KEY));
  assert(unlocked.unlocked.includes('mint'), `没有自动解锁薄荷云朵：${unlocked.unlocked.join(',')}`);

  console.log(`✔ ${label} 存档与解锁通过`);
  console.log(`  星尘 ${unlocked.dust} · 已解锁 ${unlocked.unlocked.join(', ')}`);
}
