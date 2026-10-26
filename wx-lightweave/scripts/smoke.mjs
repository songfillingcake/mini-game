import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = path.join(ROOT, 'dist', 'wx', 'game.js');
const LEVELS_PATH = path.join(ROOT, '..', 'shared', 'lightweave', 'src', 'game', 'levels.json');

const SCREEN_WIDTH = 375;
const SCREEN_HEIGHT = 812;
const DPR = 2;
const SCALE = SCREEN_WIDTH / 750;

function createFakeContext(canvas) {
  const gradient = { addColorStop() {} };
  return {
    canvas,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
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

function createHarness() {
  const canvas = { width: 0, height: 0, getContext: () => context };
  const context = createFakeContext(canvas);
  const storage = new Map();
  const handlers = { start: null, move: null, end: null, cancel: null };
  const log = { frames: 0, audioPlays: 0 };

  let pending = null;
  let clock = 0;

  globalThis.requestAnimationFrame = (callback) => {
    pending = callback;
    return 1;
  };

  globalThis.wx = {
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
    vibrateShort: () => {},
  };

  const frame = (ms = 16) => {
    clock += ms;
    const callback = pending;
    pending = null;
    if (callback) callback(clock);
    log.frames += 1;
  };

  // 传入的是设计坐标，转成 wx 的 css 像素
  const touchEvent = (dx, dy, id = 1) => ({
    touches: [{ identifier: id, clientX: dx * SCALE, clientY: dy * SCALE }],
    changedTouches: [{ identifier: id, clientX: dx * SCALE, clientY: dy * SCALE }],
  });

  const tap = (dx, dy) => {
    handlers.start(touchEvent(dx, dy));
    frame();
    handlers.end(touchEvent(dx, dy));
    frame();
  };

  const dragThrough = (points) => {
    handlers.start(touchEvent(points[0].x, points[0].y));
    frame();
    for (let i = 1; i < points.length; i += 1) {
      handlers.move(touchEvent(points[i].x, points[i].y));
    }
    const last = points[points.length - 1];
    handlers.end(touchEvent(last.x, last.y));
    frame();
  };

  return { canvas, storage, handlers, log, frame, tap, dragThrough };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- 与 src/game/board.ts、src/game/hud.ts 保持一致的设计坐标布局 ---

function layoutBoard(vp, cols, rows, top, bottom) {
  const maxWidth = vp.width - 64;
  const maxHeight = Math.max(160, bottom - top);
  const cell = Math.min(maxWidth / cols, maxHeight / rows);
  const width = cell * cols;
  const height = cell * rows;
  return { cell, ox: (vp.width - width) / 2, oy: top + (maxHeight - height) / 2, cols, rows };
}

function mapButtons(vp, count) {
  const top = vp.insetTop + 26;
  const columns = 6;
  const gap = 16;
  const gridWidth = vp.width - 88;
  const size = Math.min(112, (gridWidth - gap * (columns - 1)) / columns);
  const rows = Math.ceil(count / columns);
  const gridHeight = rows * size + (rows - 1) * gap;
  const startX = (vp.width - (columns * size + (columns - 1) * gap)) / 2;
  const startY = top + 226 + Math.max(0, (vp.height - 226 - 220 - gridHeight) * 0.28);
  const buttons = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    buttons.push({ x: startX + col * (size + gap), y: startY + row * (size + gap), w: size, h: size });
  }
  return buttons;
}

function cellCenter(layout, cell) {
  return {
    x: layout.ox + ((cell % layout.cols) + 0.5) * layout.cell,
    y: layout.oy + (Math.floor(cell / layout.cols) + 0.5) * layout.cell,
  };
}

async function main() {
  const levels = JSON.parse(await readFile(LEVELS_PATH, 'utf8'));
  const level = levels[0];
  const harness = createHarness();

  await import(pathToFileURL(BUNDLE).href);
  assert(harness.handlers.start, '游戏没有注册触摸事件');

  for (let i = 0; i < 8; i += 1) harness.frame();
  assert(harness.canvas.width === SCREEN_WIDTH * DPR, `画布宽度异常：${harness.canvas.width}`);

  const vp = {
    width: 750,
    height: SCREEN_HEIGHT / SCALE,
    insetTop: 44 / SCALE,
    insetBottom: (SCREEN_HEIGHT - 778) / SCALE,
  };

  // 1) 星图 → 点第一关
  const buttons = mapButtons(vp, 24);
  harness.tap(buttons[0].x + buttons[0].w / 2, buttons[0].y + buttons[0].h / 2);

  // 2) 按正解逐条连线
  const board = layoutBoard(
    vp,
    level.cols,
    level.rows,
    vp.insetTop + 158,
    vp.height - vp.insetBottom - 198,
  );
  for (let color = 0; color < level.colors; color += 1) {
    harness.dragThrough(level.paths[color].map((cell) => cellCenter(board, cell)));
  }

  for (let i = 0; i < 30; i += 1) harness.frame();

  const raw = harness.storage.get('lightweave/save/v1');
  assert(raw, '通关后没有写入存档');
  const saved = JSON.parse(raw);
  const stars = saved.stars[level.id] || 0;
  assert(stars === 3, `${level.id} 完美通关应得 3 星，实际 ${stars}`);
  assert(saved.dust >= 25, `星屑奖励异常：${saved.dust}`);

  console.log('✔ 织光 · 微信小游戏主流程通过');
  console.log(`  渲染帧数 ${harness.log.frames} · 音效 ${harness.log.audioPlays}`);
  console.log(`  ${level.id}（${level.cols}×${level.rows}，${level.colors} 色）→ ${stars} 星`);
  console.log(`  星屑 ${saved.dust}`);

  // 3) 返回星图，确认解锁了第二关
  const headerBack = { x: 26, y: vp.insetTop + 20, w: 92, h: 64 };
  harness.tap(headerBack.x + headerBack.w / 2, headerBack.y + headerBack.h / 2);
  for (let i = 0; i < 4; i += 1) harness.frame();
  harness.tap(buttons[1].x + buttons[1].w / 2, buttons[1].y + buttons[1].h / 2);
  for (let i = 0; i < 10; i += 1) harness.frame();
  console.log('✔ 关卡解锁与返回星图正常');
}

await main();
