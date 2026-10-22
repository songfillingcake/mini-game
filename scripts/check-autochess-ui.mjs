import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch {
  if (!process.env.QA_NODE_MODULES) throw new Error('Install Playwright or set QA_NODE_MODULES.');
  playwright = createRequire(path.join(path.resolve(process.env.QA_NODE_MODULES), '__qa__.cjs'))('playwright');
}
const executablePath = [process.env.QA_CHROMIUM_EXECUTABLE, playwright.chromium.executablePath(),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
  '/usr/bin/chromium', '/usr/bin/google-chrome'].find((candidate) => candidate && existsSync(candidate));
if (!executablePath) throw new Error('A headless Chromium executable is required.');
const artifacts = mkdtempSync(path.join(tmpdir(), 'pocket-autochess-qa-'));
let vite, server, browser;
const errors = [], checks = [];
let origin;

async function pageFor(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, storageState: { cookies: [], origins: [] }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('pocket-play-sound-enabled', 'false');
    localStorage.setItem('pocket-play-autochess-view-v1', '2d');
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/src/main.ts*', (route) => route.fulfill({ contentType: 'application/javascript', body:
    "import '/src/styles.css';import {App} from '/src/app/App.ts';window.__qaApp=new App(document.getElementById('app'));" }));
  await page.goto(origin, { waitUntil: 'networkidle' });
  return { context, page };
}
async function open(page) {
  await page.locator('[data-game="autochess"]').click();
  await page.locator('#overlay-action').click();
  await page.evaluate(() => window.__qaApp.loop.stop());
}
async function tick(page, seconds) {
  await page.evaluate((seconds) => {
    const app = window.__qaApp;
    for (let time = 0; time < seconds; time += 0.05) app.step(0.05, time);
  }, seconds);
}
async function state(page) { return page.evaluate(() => structuredClone(window.__qaApp.game.model.state)); }
async function layout(page, label) {
  const metrics = await page.evaluate(() => {
    const host = document.querySelector('#game-content');
    const wrap = document.querySelector('.canvas-wrap');
    const candidates = [...document.querySelectorAll('.ac-game,.ac-board,.ac-market,.ac-inspector,.ac-runbar,.ac-bench,.ac-shop-card')];
    return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, hostWidth: host.scrollWidth,
      containerWidth: wrap.clientWidth, overflow: candidates.filter((element) => element.scrollWidth > element.clientWidth + 2).map((element) => element.className),
      shopFont: parseFloat(getComputedStyle(document.querySelector('.ac-shop-card strong')).fontSize),
      hostBottom: wrap.getBoundingClientRect().bottom, viewportHeight: innerHeight };
  });
  assert.ok(metrics.pageWidth <= metrics.viewport + 1 && Math.abs(metrics.hostWidth - metrics.containerWidth) <= 2, JSON.stringify(metrics));
  assert.deepEqual(metrics.overflow, [], JSON.stringify(metrics));
  assert.ok(metrics.shopFont >= 16);
  assert.ok(metrics.hostBottom <= metrics.viewportHeight + 1, JSON.stringify(metrics));
  await page.screenshot({ path: path.join(artifacts, label + '.png'), animations: 'disabled' });
  return metrics;
}

try {
  // Never bind to a player's preview port or connect to an existing browser.
  server = createHttpServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  vite = await createServer({ root, clearScreen: false, logLevel: 'error', server: { middlewareMode: true, hmr: { server }, open: false } });
  server.on('request', vite.middlewares);
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await playwright.chromium.launch({ executablePath, headless: true, args: ['--mute-audio'] });
  const desktop = await pageFor(1440, 1000);
  const page = desktop.page;
  assert.equal(await page.locator('[data-game]').count(), 6);
  const hallCards = await page.locator('.game-card').evaluateAll((cards) => cards.map((card) => ({ top: card.getBoundingClientRect().top, overflow: card.scrollWidth > card.clientWidth + 1 })));
  assert.ok(hallCards.every((card) => !card.overflow && Math.abs(card.top - hallCards[0].top) < 1), 'six concise game cards fit one desktop row');
  await page.screenshot({ path: path.join(artifacts, 'hall-desktop.png'), animations: 'disabled' });
  await open(page);
  const metrics = [await layout(page, 'preparation-desktop')];
  const boardWidth = (await page.locator('.ac-board').boundingBox()).width;
  await page.locator('.ac-help > summary').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('.ac-help').evaluate((element) => element.open), true);
  assert.equal((await state(page)).phase, 'prep', 'Space on help must not start combat');
  await page.locator('[data-buy="0"]').click();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-buy')), '1', 'keyboard focus moves to the next purchasable offer');
  await page.locator('[data-buy="1"]').click();
  assert.equal((await state(page)).units.find((unit) => unit.type === 'moss').star, 2);
  await page.locator('[data-buy="3"]').click();
  await page.locator('[data-action="auto"]').click();
  assert.equal((await state(page)).units.filter((unit) => unit.cell !== null).length, 3);
  await page.locator('[data-cell="26"]').click();
  assert.equal(await page.locator('.ac-inspector').isVisible(), true);
  await page.locator('[data-cell="24"]').click();
  assert.equal((await state(page)).units.find((unit) => unit.type === 'moss').cell, 24);
  checks.push('native recruit, automatic promotion, population fill, unit inspection, and board movement');
  const checkpoint = await page.evaluate(() => localStorage.getItem('pocket-play-autochess-run-v1'));
  await page.locator('[data-action="battle"]').click();
  await tick(page, 2);
  assert.ok(Math.abs((await page.locator('.ac-board').boundingBox()).width - boardWidth) <= 1, 'board must not shrink when shop becomes battle panel');
  assert.equal((await state(page)).phase, 'battle');
  assert.ok(await page.locator('[data-fighter]').count() >= 5);
  assert.equal(await page.locator('[data-buy]').count(), 0);
  const beforePause = await page.evaluate(() => window.__qaApp.game.model.combat.elapsed);
  await page.locator('#pause-button').click();
  await tick(page, 1);
  assert.equal(await page.evaluate(() => window.__qaApp.game.model.combat.elapsed), beforePause);
  assert.equal(await page.locator('#game-content').getAttribute('inert'), '');
  await page.locator('#overlay-action').click();
  await page.locator('[data-action="speed"]').click();
  assert.match(await page.locator('[data-action="speed"]').textContent(), /2×/);
  await tick(page, 1);
  const elapsed = await page.evaluate(() => window.__qaApp.game.model.combat.elapsed);
  assert.ok(elapsed >= beforePause + 1.9);
  await page.screenshot({ path: path.join(artifacts, 'combat-desktop.png'), animations: 'disabled' });
  checks.push('combat renders real fighters; pause freezes, inert blocks input, and 2x speed advances the simulation');
  await tick(page, 24);
  assert.equal((await state(page)).phase, 'reward');
  assert.equal((await state(page)).lastReport.win, true);
  assert.equal(await page.locator('[data-reward]').count(), 3);
  await page.screenshot({ path: path.join(artifacts, 'rewards-desktop.png'), animations: 'disabled' });
  const rewardCheckpoint = await state(page);
  await page.reload({ waitUntil: 'networkidle' });
  await open(page);
  assert.deepEqual(await state(page), rewardCheckpoint, 'unclaimed reward must survive reloading');
  assert.equal(await page.locator('[data-reward]').count(), 3);
  await page.locator('[data-reward="1"]').click();
  assert.equal((await state(page)).round, 2);
  const saved = await state(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-game="autochess"]').click();
  assert.equal(await page.locator('[data-setup-option="continue"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#overlay-action').click();
  await page.evaluate(() => window.__qaApp.loop.stop());
  assert.deepEqual(await state(page), saved);
  checks.push('reward and preparation checkpoints both survive reload; reward can be claimed only once');
  await page.evaluate((checkpoint) => localStorage.setItem('pocket-play-autochess-run-v1', checkpoint), checkpoint);
  // Reload is a real interruption; it does not dispose the old page into the new checkpoint.
  await page.reload({ waitUntil: 'networkidle' });
  await open(page);
  await page.locator('[data-action="battle"]').click();
  await tick(page, 0.5);
  await page.reload({ waitUntil: 'networkidle' });
  await open(page);
  assert.equal((await state(page)).phase, 'prep');
  assert.equal((await state(page)).round, 1);
  checks.push('interrupted combat restores the pre-battle preparation checkpoint');
  // A final-encounter fixture verifies App's terminal overlay/save/replay wiring;
  // budget-constrained eight-round expeditions are covered by the model check.
  await page.evaluate(() => {
    const game = window.__qaApp.game;
    Object.assign(game.model.state, { round: 8, xp: 24, nextUid: 7,
      units: ['moss','fox','deer','boar','badger','owl'].map((type,index)=>({uid:'unit-'+(index+1),type,star:3,cell:index<3?18+index:30+index})) });
    game.draw();
  });
  await page.locator('[data-action="battle"]').click();
  await tick(page, 46);
  assert.equal(await page.evaluate(() => window.__qaApp.state), 'ended');
  assert.match(await page.locator('#overlay-description').textContent(), /通关/);
  assert.equal(await page.evaluate(() => localStorage.getItem('pocket-play-autochess-run-v1')), null);
  assert.ok(Number(await page.evaluate(() => localStorage.getItem('pocket-play-best-autochess'))) >= 500);
  await page.locator('#overlay-action').click();
  assert.equal((await state(page)).round, 1);
  assert.equal((await state(page)).gold, 10);
  assert.equal((await state(page)).units.length, 2);
  checks.push('real final battle produces victory overlay, clears checkpoint, saves best, and restarts cleanly');
  await desktop.context.close();
  for (const [width, height] of [[390, 844], [320, 740], [844, 390]]) {
    const mobile = await pageFor(width, height);
    await open(mobile.page);
    metrics.push(await layout(mobile.page, 'preparation-' + width));
    await mobile.page.locator('[data-buy="0"]').click();
    await mobile.page.locator('[data-buy="1"]').click();
    const upgraded = (await state(mobile.page)).units.find((unit) => unit.type === 'moss');
    assert.equal(upgraded.star, 2);
    await mobile.page.locator('[data-cell="26"]').click();
    await mobile.page.locator('[data-cell="25"]').click();
    assert.equal((await state(mobile.page)).units.find((unit) => unit.type === 'moss').cell, 25);
    if (width === 390) {
      await mobile.page.locator('[data-action="battle"]').click();
      await tick(mobile.page, 1);
      const boardBounds = await mobile.page.locator('.ac-board').boundingBox();
      assert.ok(boardBounds.y >= 45 && boardBounds.y + boardBounds.height <= height, 'mobile combat should scroll the battlefield into view');
      await mobile.page.screenshot({ path: path.join(artifacts, 'combat-mobile.png'), animations: 'disabled' });
      await tick(mobile.page, 44);
      assert.equal((await state(mobile.page)).phase, 'reward');
      const rewardBounds = await mobile.page.locator('.ac-reward-panel').boundingBox();
      assert.ok(rewardBounds.y >= 45 && rewardBounds.y < height - 100, 'mobile round result should scroll to rewards');
    }
    await mobile.context.close();
  }
  checks.push('390px/320px portrait and short landscape: large text, contained layout, buying and repositioning');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, checks, metrics, artifacts }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (vite) await vite.close();
}
