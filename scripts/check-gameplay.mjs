import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// This check launches a new, headless browser and an ephemeral server. It never
// attaches to an existing browser, profile, preview port, or player save.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  if (!process.env.QA_NODE_MODULES) throw new Error('Install Playwright or set QA_NODE_MODULES to a directory that already contains it.');
  playwright = createRequire(path.join(path.resolve(process.env.QA_NODE_MODULES), '__pocket_play_qa__.cjs'))('playwright');
}
const installedBrowser = [
  process.env.QA_CHROMIUM_EXECUTABLE,
  playwright.chromium.executablePath(),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((candidate) => candidate && existsSync(candidate));
if (!installedBrowser) throw new Error('No headless Chromium executable found; set QA_CHROMIUM_EXECUTABLE.');
const artifacts = process.env.QA_ARTIFACT_DIR
  ? path.resolve(process.env.QA_ARTIFACT_DIR)
  : mkdtempSync(path.join(tmpdir(), 'pocket-play-qa-'));
mkdirSync(artifacts, { recursive: true });
const checks = [];
const pageErrors = [];
let server;
let httpServer;
let browser;

function record(name) { checks.push(name); }

async function makePage(viewport, mobile = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, storageState: { cookies: [], origins: [] } });
  await context.addInitScript(() => localStorage.setItem('pocket-play-sound-enabled', 'false'));
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // Expose only this QA page's App instance so a scenario actor can advance its
  // real game clock. Production source files and the public app stay untouched.
  await page.route('**/src/main.ts*', (route) => route.fulfill({ contentType: 'application/javascript', body:
    "import '/src/styles.css'; import { App } from '/src/app/App.ts'; window.__qaApp = new App(document.getElementById('app')); window.__qaNow = 0;" }));
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('[data-game="stacker"]').waitFor();
  return { context, page };
}

async function openStacker(page) {
  await page.locator('[data-game="stacker"]').click();
  await page.locator('#game-canvas').waitFor();
  await page.evaluate(() => window.__qaApp.loop.stop());
  assert.equal(await page.locator('#game-tap-action').isDisabled(), true);
  assert.equal(await page.locator('[data-key]').count(), 0);
}

async function tick(page, seconds) {
  await page.evaluate((duration) => {
    for (let remaining = duration; remaining > 0; remaining -= 1 / 60) {
      const dt = Math.min(remaining, 1 / 60);
      window.__qaNow += dt;
      window.__qaApp.step(dt, window.__qaNow);
    }
  }, seconds);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const app = window.__qaApp;
    const game = app.game;
    return { state: app.state, score: game.score, layers: game.layers, elapsed: game.elapsed,
      x: game.active?.x ?? null, width: game.blocks.at(-1).width, ending: game.endingTimer,
      status: game.statusText, route: game.selectedSetupOption, over: game.over,
      blocks: game.blocks.length, fragments: game.fragments.length, sparks: game.sparks.length };
  });
}

// The actor waits on real movement; it never moves a block or changes scores.
async function waitForPlacement(page, kind = 'perfect') {
  return page.evaluate((placement) => {
    const app = window.__qaApp;
    const game = app.game;
    for (let frame = 0; frame < 1800; frame += 1) {
      window.__qaNow += 1 / 120;
      app.step(1 / 120, window.__qaNow);
      if (!game.active || game.placementCooldown > 0 || app.state !== 'playing') continue;
      const moving = game.active;
      const target = game.blocks.at(-1);
      const overlap = Math.min(moving.x + moving.width, target.x + target.width) - Math.max(moving.x, target.x);
      const matched = placement === 'perfect' ? Math.abs(moving.x - target.x) <= 2.5
        : placement === 'partial' ? overlap >= 48 && overlap <= 64
        : overlap <= 0;
      if (matched) return { overlap, x: moving.x };
    }
    throw new Error('Scenario actor did not reach placement: ' + placement);
  }, kind);
}

async function verifyStorage(page) {
  const result = await page.evaluate(async () => {
    const storage = await import('/src/core/Storage.ts');
    localStorage.clear();
    storage.setSoundEnabled(false);
    storage.saveBest('stacker', 217);
    storage.saveBest('shells', 84);
    const v3 = JSON.parse(storage.exportSaveBackup());
    if (v3.version !== 3 || v3.data['pocket-play-best-stacker'] !== '217') throw new Error('v3 stacker export missing');
    const v1 = structuredClone(v3);
    v1.version = 1;
    delete v1.data['pocket-play-best-stacker'];
    delete v1.data['pocket-play-best-shells'];
    v1.data['pocket-play-best-fishing'] = '123';
    if (!storage.importSaveBackup(JSON.stringify(v1))) throw new Error('v1 rejected');
    if (storage.getBest('stacker') !== 217 || storage.getBest('shells') !== 84 || storage.getBest('fishing') !== 123) throw new Error('v1 migration damaged newer records');
    const v2 = structuredClone(v3);
    v2.version = 2;
    delete v2.data['pocket-play-best-stacker'];
    v2.data['pocket-play-best-shells'] = '150';
    if (!storage.importSaveBackup(JSON.stringify(v2)) || storage.getBest('stacker') !== 217 || storage.getBest('shells') !== 150) throw new Error('v2 migration damaged newer record');
    const invalid = structuredClone(v3);
    invalid.data['pocket-play-best-stacker'] = 'not-a-score';
    const before = JSON.stringify({ ...localStorage });
    if (storage.importSaveBackup(JSON.stringify(invalid)) || before !== JSON.stringify({ ...localStorage })) throw new Error('invalid save modified data');
    v3.data['pocket-play-best-stacker'] = '99';
    if (!storage.importSaveBackup(JSON.stringify(v3)) || storage.getBest('stacker') !== 99) throw new Error('v3 import failed');
    v3.data['pocket-play-best-stacker'] = null;
    if (!storage.importSaveBackup(JSON.stringify(v3)) || storage.getBest('stacker') !== 0) throw new Error('v3 null record failed');
    localStorage.clear();
    storage.setSoundEnabled(false);
    return 'v1/v2 migrate without losing newer records; v3 round-trip and null reset; invalid save atomic rejection';
  });
  record(result);
}

let baseURL;
try {
  server = await createServer({ root, clearScreen: false, logLevel: 'error', server: { middlewareMode: true, hmr: false, open: false } });
  // Vite normalizes a configured port of 0 to its default port; bind the Node
  // server directly so the OS really allocates a fresh ephemeral port.
  httpServer = createHttpServer(server.middlewares);
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const address = httpServer.address();
  assert.equal(typeof address, 'object');
  assert.ok(address && ![5173, 5174, 5175].includes(address.port));
  baseURL = 'http://127.0.0.1:' + address.port + '/';
  browser = await playwright.chromium.launch({ executablePath: installedBrowser, headless: true, args: ['--mute-audio'] });
  const desktop = await makePage({ width: 1440, height: 1000 });
  const page = desktop.page;
  await verifyStorage(page);
  assert.equal(await page.locator('[data-game]').count(), 5);
  await openStacker(page);
  await page.locator('[data-setup-option="soft-cloud"]').click();
  await page.locator('#overlay-action').click();
  await page.locator('#game-canvas').focus();
  assert.equal((await snapshot(page)).state, 'playing');
  assert.equal(await page.locator('#game-tap-action').isEnabled(), true);

  await waitForPlacement(page);
  await page.keyboard.down('Space');
  await tick(page, 0.001);
  const first = await snapshot(page);
  assert.equal(first.layers, 1);
  assert.ok(first.score > 0);
  await waitForPlacement(page);
  await page.keyboard.down('Space');
  await tick(page, 0.001);
  assert.equal((await snapshot(page)).layers, 1, 'holding Space must not place a second block');
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  await tick(page, 0.001);
  assert.equal((await snapshot(page)).layers, 2);
  record('real Space input places blocks; key repeat cannot auto-place a tower');

  await page.keyboard.press('p');
  const paused = await snapshot(page);
  assert.equal(paused.state, 'paused');
  assert.equal(await page.locator('#game-tap-action').isDisabled(), true);
  await tick(page, 0.75);
  assert.deepEqual(await snapshot(page), paused, 'pause must freeze movement, score, and timers');
  await page.keyboard.press('p');
  assert.equal((await snapshot(page)).state, 'playing');
  await page.locator('#pause-button').focus();
  await page.keyboard.press('Space');
  assert.equal((await snapshot(page)).state, 'paused', 'focused pause button must retain native Space activation');
  await page.locator('#pause-button').focus();
  await page.keyboard.press('Space');
  assert.equal((await snapshot(page)).state, 'playing');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'game-canvas', 'resume returns focus to the game');
  await waitForPlacement(page);
  await page.locator('#game-tap-action').click();
  await tick(page, 0.001);
  assert.equal((await snapshot(page)).layers, 3);
  record('pause freezes game state; focused pause Space, resume focus, and native action button work');

  await waitForPlacement(page, 'partial');
  await page.locator('#game-canvas').click();
  await tick(page, 0.001);
  const trimmed = await snapshot(page);
  assert.equal(trimmed.layers, 4);
  assert.ok(trimmed.width >= 48 && trimmed.width <= 64);
  await waitForPlacement(page, 'miss');
  await page.locator('#game-canvas').click();
  await tick(page, 1);
  assert.equal((await snapshot(page)).state, 'ended');
  assert.equal(await page.locator('#game-tap-action').isDisabled(), true);
  assert.match(await page.locator('#overlay-description').textContent(), /4 层/);
  record('canvas pointer placement trims overlap; complete miss produces a result');

  await page.locator('[data-setup-option="wind-tower"]').click();
  await page.locator('#overlay-action').click();
  const restarted = await snapshot(page);
  assert.equal(restarted.route, 'wind-tower');
  assert.equal(restarted.width, 270);
  assert.equal(restarted.layers, 0);
  assert.equal(restarted.score, 0);
  assert.equal(restarted.ending, -1);
  for (let index = 0; index < 22; index += 1) {
    await waitForPlacement(page);
    await page.locator('#game-tap-action').click();
    await tick(page, 0.001);
  }
  const highTower = await snapshot(page);
  assert.equal(highTower.layers, 22);
  assert.match(await page.evaluate(() => window.__qaApp.game.outcome), /星光天际/);
  assert.ok(highTower.blocks <= 32 && highTower.fragments <= 16 && highTower.sparks <= 36);
  const desktopGeometry = await page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas');
    const wrap = document.querySelector('.canvas-wrap');
    const a = canvas.getBoundingClientRect(); const b = wrap.getBoundingClientRect();
    return { canvas: { width: a.width, height: a.height, top: a.top, bottom: a.bottom }, wrap: { width: b.width, height: b.height, top: b.top, bottom: b.bottom } };
  });
  console.log('Desktop canvas geometry:', JSON.stringify(desktopGeometry));
  await page.screenshot({ path: path.join(artifacts, 'stacker-desktop.png'), animations: 'disabled' });
  assert.ok(desktopGeometry.canvas.bottom <= desktopGeometry.wrap.bottom + 1 && desktopGeometry.canvas.height <= desktopGeometry.wrap.height + 1,
    'Canvas is clipped by its wrapper; screenshot: ' + path.join(artifacts, 'stacker-desktop.png'));
  record('restart clears run state and uses selected route; a 22-floor tower reaches the night sky');

  const mobile = await makePage({ width: 390, height: 844 }, true);
  await openStacker(mobile.page);
  await mobile.page.locator('#overlay-action').click();
  const bounds = await mobile.page.locator('#game-canvas').boundingBox();
  assert.ok(bounds && bounds.height > bounds.width * 540 / 960 + 20, 'portrait canvas must contain letterbox space');
  await mobile.page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + 3);
  assert.equal((await snapshot(mobile.page)).ending, -1);
  assert.equal((await snapshot(mobile.page)).layers, 0);
  const canvasCheck = await mobile.page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas');
    const ctx = canvas.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#f00'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    window.__qaApp.step(0, window.__qaNow);
    return { outsideAlpha: ctx.getImageData(2, 2, 1, 1).data[3], insideAlpha: ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3],
      pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, buttonHeight: document.querySelector('#game-tap-action').getBoundingClientRect().height };
  });
  assert.equal(canvasCheck.outsideAlpha, 0, 'letterbox must be cleared every frame');
  assert.equal(canvasCheck.insideAlpha, 255, 'game scene must render');
  assert.ok(canvasCheck.pageWidth <= canvasCheck.viewportWidth + 1, 'mobile page must not overflow sideways');
  assert.ok(canvasCheck.buttonHeight >= 44, 'mobile action target must be usable');
  await waitForPlacement(mobile.page);
  await mobile.page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await tick(mobile.page, 0.001);
  assert.equal((await snapshot(mobile.page)).layers, 1);
  await mobile.page.screenshot({ path: path.join(artifacts, 'stacker-mobile.png'), animations: 'disabled' });
  record('portrait touch works, letterbox taps are ignored, scene renders, full-canvas clear removes ghost pixels');
  const landscape = await makePage({ width: 844, height: 390 }, true);
  await openStacker(landscape.page);
  await landscape.page.locator('#overlay-action').click();
  const landscapeGeometry = await landscape.page.evaluate(() => {
    const page = document.querySelector('.play-page').getBoundingClientRect();
    const canvas = document.querySelector('#game-canvas').getBoundingClientRect();
    const wrap = document.querySelector('.canvas-wrap').getBoundingClientRect();
    return { pageHeight: page.height, viewportHeight: innerHeight, canvasHeight: canvas.height, wrapHeight: wrap.height };
  });
  console.log('Landscape geometry:', JSON.stringify(landscapeGeometry));
  await landscape.page.screenshot({ path: path.join(artifacts, 'stacker-landscape.png'), animations: 'disabled' });
  assert.ok(landscapeGeometry.pageHeight <= landscapeGeometry.viewportHeight + 1, 'landscape play page exceeds its viewport');
  assert.ok(landscapeGeometry.canvasHeight <= landscapeGeometry.wrapHeight + 1, 'landscape canvas is clipped');
  record('short landscape viewport contains the full game');
  assert.deepEqual(pageErrors, [], 'browser runtime errors');
  console.log(JSON.stringify({ ok: true, checks, artifacts, screenshots: ['stacker-desktop.png', 'stacker-mobile.png', 'stacker-landscape.png'], origin: baseURL }, null, 2));
} finally {
  if (browser) await browser.close();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (server) await server.close();
}
