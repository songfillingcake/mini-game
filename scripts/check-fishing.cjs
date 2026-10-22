// Run with: node scripts/check-fishing.cjs
// Uses only in-memory data and drawing/audio stubs. No browser, save files, or
// emitted JavaScript artifacts are needed. The project build checks types.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function makeFish(id, zoneId = 'lake', rarity = '常见', eventId) {
  return {
    id, name: id, zoneId, rarity, eventId, weight: 10, points: 10,
    pullStyle: 'steady', pullSpeed: 1, pullAmplitude: 0.3,
    secondarySpeed: 1, secondaryAmplitude: 0, pullHint: '平稳',
  };
}

const fishes = [
  makeFish('known'), makeFish('new'), makeFish('rare', 'lake', '稀有'),
  makeFish('locked', 'lake', '传说', 'not-today'), makeFish('moon', 'moon'),
];
let counts = { known: 1, rare: 1 };
let trophies = {};
let phase = { id: 'dawn', label: '清晨', icon: '', detail: '' };
let countReads = 0;
const journal = {
  fishSpecies: fishes,
  fishingBaits: [],
  fishingZones: [{ id: 'lake', label: '湖', unlockAt: 0 }],
  getPreferredBait: () => 'crumbs',
  getPreferredZone: () => 'lake',
  getTrackedFish: () => null,
  getDailyFishingWeather: () => ({ id: 'sunny', label: '晴', icon: '', detail: '' }),
  getFishingDayPhase: () => ({ ...phase }),
  getDailyFishingEvent: () => ({ id: 'none', effect: 'calm', zone: { id: 'moon' }, label: '事件' }),
  getFishingRodStats: () => ({ level: 1, label: '鱼竿', timeBonus: 0, safeZoneBonus: 0 }),
  getSelectedCatAccessory: () => 'none',
  getDailyFishingSighting: () => ({ fish: { id: 'absent' }, completed: true, reward: 3 }),
  getFishJournalSummary: () => ({ discovered: Object.keys(counts).length }),
  getFishCounts: () => { countReads += 1; return { ...counts }; },
  getFishTrophyRanks: () => ({ ...trophies }),
};

const draws = [];
const core = {
  WIDTH: 960, HEIGHT: 540,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  roundedRect() {},
  drawText: (_context, text, x, y) => draws.push({ text, x, y }),
};
const math = Object.create(Math);
math.random = () => 0.5;
const dependencies = {
  '../../core/Game': core,
  '../../core/Audio': { audio: { play() {} } },
  './FishJournal': journal,
};
const sourcePath = path.join(__dirname, '..', 'src', 'games', 'fishing', 'FishingGame.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
  fileName: sourcePath,
});
const errors = (compiled.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
const exportsStub = {};
vm.runInNewContext(compiled.outputText, {
  exports: exportsStub,
  require(request) {
    assert.ok(Object.hasOwn(dependencies, request), 'Unexpected dependency: ' + request);
    return dependencies[request];
  },
  Math: math,
}, { filename: sourcePath });

const { FishingGame } = exportsStub;
const empty = { keys: new Set(), pointerX: null };
const down = { keys: new Set(['down']), pointerX: null };
let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function makeGame() {
  const game = new FishingGame();
  game.start();
  return game;
}

// Dawn must read collection data with ordinary bait and non-misty weather.
const dawn = makeGame();
const sampled = {};
const originalWeight = dawn.getFishWeight.bind(dawn);
dawn.getFishWeight = (fish, catches, ranks) => {
  const weight = originalWeight(fish, catches, ranks);
  sampled[fish.id] = weight;
  return weight;
};
dawn.pickFish();
check(countReads > 0, 'Dawn reads actual catches');
check(Math.abs(sampled.new / sampled.known - 1.2) < 1e-9, 'Only undiscovered fish receive the dawn bonus');

// Only the currently available pool determines the shore boost fallback.
counts = { known: 1, new: 1, rare: 1 };
trophies = { known: 3, new: 2, rare: 3 };
const trophy = makeGame();
trophy.elapsed = 13;
trophy.shoreMomentAvailable = true;
trophy.activateShoreMoment();
check(trophy.shoreMomentFocus === 'trophy', 'Completed current sea selects trophies despite undiscovered locked/other-sea fish');
const boostedWeight = trophy.getFishWeight(fishes[1], counts, trophies);
trophy.shoreMomentBoost = false;
check(Math.abs(boostedWeight / trophy.getFishWeight(fishes[1], counts, trophies) - 1.45) < 1e-9, 'Unfinished trophies receive the fallback bonus');
trophies = { known: 3, new: 3, rare: 3 };
trophy.shoreMomentAvailable = true;
trophy.activateShoreMoment();
check(trophy.shoreMomentFocus === 'rare', 'Mastered current sea selects rare fish');

// A fake nibble preserves the boost. Exactly one real bite consumes it.
counts = {};
trophies = {};
const one = makeGame();
one.elapsed = 13;
one.shoreMomentAvailable = true;
const position = one.getShoreMomentPoint();
one.press(position.x, position.y);
check(one.shoreMomentBoost, 'Pointer activates the shore response');
one.phaseTimer = 0;
math.random = () => 0;
one.update(0.01, empty);
check(one.phase === 'fake' && one.shoreMomentBoost, 'Fake nibble does not consume the boost');
one.phaseTimer = 0;
one.update(0.01, empty);
one.phaseTimer = 0;
math.random = () => 0.9;
one.update(0.01, empty);
check(one.phase === 'bite' && !one.shoreMomentBoost && one.shoreMomentFishBoost, 'Real bite consumes the boost once');
one.nextWait();
one.pickFish();
check(!one.shoreMomentFishBoost, 'Subsequent fish does not repeat the bonus');
one.shoreMomentBoost = true;
one.dailySightingFishId = 'known';
one.dailySightingCompleted = false;
one.sightingBitesSinceLast = 4;
check(one.pickFish().id === 'known' && !one.shoreMomentBoost && one.shoreMomentFishBoost, 'Guaranteed daily fish also consumes the boost once');

// Bites and catch animations pause the response timer; expiry wins over input.
const timer = makeGame();
timer.elapsed = 11.9;
timer.phaseTimer = 100;
timer.update(0.1, empty);
check(timer.shoreMomentTimeLeft === 7, 'Appearance provides a full seven-second response window');
timer.update(2, empty);
check(timer.shoreMomentTimeLeft === 5, 'Visible waiting spends response time');
timer.phase = 'bite';
timer.phaseTimer = 100;
timer.update(2, empty);
check(timer.shoreMomentTimeLeft === 5 && !timer.isShoreMomentVisible(), 'Bites pause and hide the response window');
timer.phase = 'waiting';
timer.catchFlash = 1;
timer.update(0.2, empty);
check(timer.shoreMomentTimeLeft === 5 && !timer.isShoreMomentVisible(), 'Catch feedback pauses and hides the response window');
timer.catchFlash = 0;
timer.update(1, empty);
timer.update(4, down);
check(!timer.shoreMomentAvailable && !timer.shoreMomentBoost, 'Expired responses cannot activate with late keyboard input');
const ended = makeGame();
ended.elapsed = 59.9;
ended.phaseTimer = 100;
ended.update(0.2, empty);
check(ended.over && !ended.shoreMomentAvailable, 'No shore event appears after the session ends');

// Drawing and hit geometry share elapsed time, and the visible hint is tappable.
const geometry = makeGame();
geometry.elapsed = 14;
geometry.shoreMomentAvailable = true;
geometry.shoreMomentTimeLeft = 7;
const context = { save() {}, restore() {}, beginPath() {}, ellipse() {}, arc() {}, stroke() {}, fill() {} };
geometry.drawShoreMoment(context, 99999);
const point = geometry.getShoreMomentPoint();
check(draws[0].x === point.x && draws[0].y === point.y, 'Render and hit positions agree regardless of an external render clock');
check(geometry.isShoreMomentHit(point.x + 125, point.y + 50), 'The hint pill is clickable');
geometry.phase = 'bite';
geometry.currentFish = fishes[0];
geometry.press(point.x, point.y);
check(geometry.phase === 'reeling' && !geometry.shoreMomentBoost, 'Fish input retains priority outside the waiting stage');

// Replay resets all temporary state and refreshes local day phase.
phase = { id: 'night', label: '夜航', icon: '', detail: '' };
geometry.start();
check(!geometry.shoreMomentAvailable && !geometry.shoreMomentBoost && !geometry.shoreMomentFishBoost && !geometry.shoreMomentResolved, 'Restart resets shore interaction state');
check(geometry.dayPhase.id === 'night', 'Restart refreshes the local day phase');

console.log('Fishing checks passed: ' + assertions + '. In-memory stubs only; no browser or user save access.');
