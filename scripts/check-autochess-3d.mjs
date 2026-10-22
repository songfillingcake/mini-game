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
const artifacts = mkdtempSync(path.join(tmpdir(), 'pocket-autochess-3d-'));
let vite, server, browser, origin;
const errors = [], checks = [];
async function makePage(width, height, unsupported = false) {
  const context = await browser.newContext({ viewport: { width, height }, storageState: { cookies: [], origins: [] }, deviceScaleFactor: 1, isMobile: width <= 600, hasTouch: width <= 600 });
  await context.addInitScript(() => localStorage.setItem('pocket-play-sound-enabled', 'false'));
  if (unsupported) await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); };
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/src/main.ts*', (route) => route.fulfill({ contentType: 'application/javascript', body:
    "import '/src/styles.css';import {App} from '/src/app/App.ts';window.__qaApp=new App(document.getElementById('app'));" }));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('[data-game="autochess"]').click();
  await page.locator('#overlay-action').click();
  await page.evaluate(() => window.__qaApp.loop.stop());
  return { page, context };
}
async function ready(page) {
  await page.locator('.ac-3d-canvas').waitFor({ timeout: 45000 });
  await page.waitForFunction(() => window.__qaApp.game.boardView?.renderer.info.render.calls > 0);
}
async function tick(page, seconds) {
  await page.evaluate((duration) => {
    const app = window.__qaApp;
    for (let time = 0; time < duration; time += 0.05) app.step(0.05, time);
  }, seconds);
}
async function shot(page, name) {
  await page.locator('.ac-stage-heading').evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.__qaApp.game.boardView?.update(0, true));
  await page.screenshot({ path: path.join(artifacts, name + '.png'), animations: 'disabled' });
}
async function project(page, cell, actorUid) {
  return page.evaluate(({ cell, actorUid }) => {
    const view = window.__qaApp.game.boardView;
    const actor = actorUid ? view.actors.get(actorUid) : view.actors.values().next().value;
    const point = actor.rig.root.position.clone();
    if (actorUid) point.y += 0.65;
    else point.set((cell % 6 - 2.5) * 1.2, 0.08, (Math.floor(cell / 6) - 2.5) * 1.2);
    point.project(view.camera);
    const bounds = view.renderer.domElement.getBoundingClientRect();
    return { x: bounds.left + (point.x + 1) * bounds.width / 2, y: bounds.top + (1 - point.y) * bounds.height / 2 };
  }, { cell, actorUid });
}
try {
  server = createHttpServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  vite = await createServer({ root, clearScreen: false, logLevel: 'error', server: { middlewareMode: true, hmr: { server }, open: false } });
  server.on('request', vite.middlewares);
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await playwright.chromium.launch({ executablePath, headless: true, args: ['--mute-audio', '--enable-unsafe-swiftshader'] });
  const desktop = await makePage(1440, 1100);
  const page = desktop.page;
  await ready(page);
  const initial = await page.evaluate(() => {
    const view = window.__qaApp.game.boardView;
    window.__firstView = view;
    window.__firstCanvas = view.renderer.domElement;
    return { calls: view.renderer.info.render.calls, models: [...new Set([...view.actors.values()].filter(actor=>actor.rig.detailed).map(actor=>actor.unit.type))].sort(), geometries: view.renderer.info.memory.geometries, camera: view.camera.position.toArray(), distance: view.camera.position.distanceTo(view.controls.target) };
  });
  assert.ok(initial.calls > 80, 'the board must draw real scene geometry');
  assert.deepEqual(initial.models, ['cat','fox','moss']);
  await shot(page, 'three-characters-desktop');
  await page.locator('.ac-board').screenshot({ path: path.join(artifacts, 'board-desktop.png'), animations: 'disabled' });
  checks.push('real WebGL geometry renders a lit board and three distinct articulated character models');
  await page.locator('[data-action="view-left"]').click();
  assert.notDeepEqual(await page.evaluate(()=>window.__qaApp.game.boardView.camera.position.toArray()), initial.camera);
  await page.locator('[data-action="view-in"]').click();
  assert.ok(await page.evaluate(()=>{const view=window.__qaApp.game.boardView;return view.camera.position.distanceTo(view.controls.target);}) < initial.distance);
  await page.locator('[data-action="view-reset"]').click();
  const reset = await page.evaluate(()=>window.__qaApp.game.boardView.camera.position.toArray());
  assert.ok(reset.every((number,index)=>Math.abs(number-initial.camera[index])<0.001));
  const from = await project(page, null, 'unit-1');
  await page.mouse.click(from.x, from.y);
  assert.equal(await page.evaluate(()=>window.__qaApp.game.selected), 'unit-1');
  const target = await project(page, 18);
  await page.mouse.click(target.x, target.y);
  assert.equal(await page.evaluate(()=>window.__qaApp.game.model.state.units.find(unit=>unit.uid==='unit-1').cell),18);
  assert.equal(await page.evaluate(()=>window.__qaApp.game.boardView.renderer.domElement===window.__firstCanvas),true);
  checks.push('camera rotation, zoom, reset and real raycast selection/movement work without recreating WebGL');
  await page.locator('[data-buy="0"]').click();
  await page.locator('[data-buy="1"]').click();
  const upgrade = await page.evaluate(()=>{const actor=window.__qaApp.game.boardView.actors.get('unit-1');return {star:actor.unit.star,scale:actor.rig.root.scale.x,halo:actor.rig.halo.children.length,geometries:window.__qaApp.game.boardView.renderer.info.memory.geometries};});
  assert.equal(upgrade.star,2);assert.ok(upgrade.scale>0.88&&upgrade.halo>0);
  assert.ok(upgrade.geometries<=initial.geometries+3);
  await shot(page,'promoted-guardian-desktop');
  const rosterBefore = await page.evaluate(()=>JSON.stringify(window.__qaApp.game.model.state.units));
  const canvasBounds = await page.locator('.ac-3d-canvas').boundingBox();
  await page.mouse.move(canvasBounds.x+canvasBounds.width/2,canvasBounds.y+canvasBounds.height/2);
  await page.mouse.down();await page.mouse.move(canvasBounds.x+canvasBounds.width/2+80,canvasBounds.y+canvasBounds.height/2+35,{steps:8});await page.mouse.up();
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__qaApp.game.model.state.units)),rosterBefore,'orbit dragging must not move a chess piece');
  await page.locator('[data-action="view-reset"]').click();
  const afterDragReset = await page.evaluate(()=>window.__qaApp.game.boardView.camera.position.toArray());
  assert.ok(afterDragReset.every((number,index)=>Math.abs(number-initial.camera[index])<0.001), 'reset must clear orbit inertia after a drag');
  await page.locator('[data-action="view-toggle"]').click();
  assert.equal(await page.locator('.ac-3d-canvas').count(),0);
  await page.locator('[data-cell="18"]').click();
  await page.locator('[data-cell="26"]').click();
  await page.locator('[data-action="view-toggle"]').click();
  await ready(page);
  assert.equal(await page.evaluate(()=>window.__qaApp.game.boardView.renderer.domElement===window.__firstCanvas),true);
  checks.push('promotion changes figure size and halo; orbit gestures do not deploy; 2D/3D switching preserves roster and renderer');
  await page.locator('[data-action="battle"]').click();
  await tick(page,3);
  const pausedBefore = await page.evaluate(()=>({...window.__qaApp.game.boardView.stats,clock:window.__qaApp.game.boardView.clock}));
  await page.locator('#pause-button').click();await tick(page,1);
  assert.deepEqual(await page.evaluate(()=>({...window.__qaApp.game.boardView.stats,clock:window.__qaApp.game.boardView.clock})),pausedBefore);
  await page.locator('#overlay-action').click();
  await tick(page,3);
  await shot(page,'combat-and-skills-desktop');
  await tick(page,15);
  const animation = await page.evaluate(()=>({...window.__qaApp.game.boardView.stats,phase:window.__qaApp.game.model.state.phase,geometries:window.__qaApp.game.boardView.renderer.info.memory.geometries,effects:window.__qaApp.game.boardView.effects.length}));
  assert.ok(animation.attacks>0&&animation.casts>0&&animation.deaths>0&&animation.moves>0,JSON.stringify(animation));
  assert.equal(animation.phase,'reward');
  assert.ok(animation.effects<=28&&animation.geometries<=15);
  checks.push('real combat triggers walking, attacking, casting and falling; pause freezes animation; effects and geometry remain bounded');
  const savedBeforeLoss=await page.evaluate(()=>localStorage.getItem('pocket-play-autochess-run-v1'));
  await page.evaluate(()=>window.__qaApp.game.boardView.renderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  await page.locator('.ac-view-note').filter({hasText:'暂时不可用'}).waitFor();
  assert.equal(await page.locator('.ac-3d-canvas').count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pocket-play-autochess-run-v1')),savedBeforeLoss);
  assert.equal(await page.evaluate(()=>window.__firstView.disposed),true);
  await page.locator('[data-action="view-toggle"]').click();await ready(page);
  await page.evaluate(()=>{window.__lastView=window.__qaApp.game.boardView;});
  await page.locator('#back-button').click();
  assert.equal(await page.evaluate(()=>window.__lastView.disposed),true);
  assert.equal(await page.evaluate(()=>window.__lastView.renderer.domElement.isConnected),false);
  checks.push('context loss falls back without changing save; retry works; leaving disposes controls, observer and GPU context');
  await desktop.context.close();
  const mobile=await makePage(390,844);await ready(mobile.page);
  const mobileMetrics=await mobile.page.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth,canvas:document.querySelector('.ac-3d-canvas').getBoundingClientRect().width,buttons:[...document.querySelectorAll('.ac-viewbar button')].map(button=>button.getBoundingClientRect().height)}));
  assert.ok(mobileMetrics.page<=mobileMetrics.width&&mobileMetrics.buttons.every(height=>height>=44));
  await shot(mobile.page,'three-characters-mobile');
  const mobileActor = await project(mobile.page,null,'unit-1');
  await mobile.page.touchscreen.tap(mobileActor.x,mobileActor.y);
  assert.equal(await mobile.page.evaluate(()=>window.__qaApp.game.selected),'unit-1');
  const mobileTarget = await project(mobile.page,18);
  await mobile.page.touchscreen.tap(mobileTarget.x,mobileTarget.y);
  assert.equal(await mobile.page.evaluate(()=>window.__qaApp.game.model.state.units.find(unit=>unit.uid==='unit-1').cell),18);
  const beforePinch = await mobile.page.evaluate(()=>{const view=window.__qaApp.game.boardView;return {distance:view.camera.position.distanceTo(view.controls.target),roster:JSON.stringify(window.__qaApp.game.model.state.units)};});
  const bounds = await mobile.page.locator('.ac-3d-canvas').boundingBox();
  const cx=bounds.x+bounds.width/2, cy=bounds.y+bounds.height/2;
  const cdp=await mobile.context.newCDPSession(mobile.page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-55,y:cy,id:1},{x:cx+55,y:cy,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(await mobile.page.evaluate(()=>{const view=window.__qaApp.game.boardView;return view.camera.position.distanceTo(view.controls.target);})<beforePinch.distance,'two-finger spread zooms toward the board');
  assert.equal(await mobile.page.evaluate(()=>JSON.stringify(window.__qaApp.game.model.state.units)),beforePinch.roster,'pinch must not deploy a unit');
  await cdp.detach();
  await mobile.context.close();
  const unsupported=await makePage(390,844,true);
  await unsupported.page.locator('.ac-view-note').filter({hasText:'暂时不可用'}).waitFor();
  await unsupported.page.locator('[data-buy="0"]').click();
  assert.equal(await unsupported.page.evaluate(()=>window.__qaApp.game.model.state.gold),9);
  await unsupported.context.close();
  checks.push('mobile touch raycasts and real two-finger zoom work without accidental placement; unavailable WebGL preserves playable 2D');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,checks,initial,upgrade,animation,mobileMetrics,artifacts},null,2));
}finally{
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  if(vite)await vite.close();
}
