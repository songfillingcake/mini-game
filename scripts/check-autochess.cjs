const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
const memory = new Map();
const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: (key) => memory.delete(key) };
function load(file) {
  file = path.resolve(file);
  if (!file.endsWith('.ts')) file += '.ts';
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext('(function(require,module,exports){' + source + '\n})', { console, structuredClone, localStorage: storage, Math, Set, Map })(
    (id) => load(path.resolve(path.dirname(file), id)), module, module.exports);
  return module.exports;
}
const { AutoChessModel, parseRun, AUTO_CHESS_SAVE_KEY } = load(path.join(root, 'src/games/autochess/AutoChessModel.ts'));
const { Combat } = load(path.join(root, 'src/games/autochess/Combat.ts'));
const { synergyCounts, unitById, enemiesForRound, emptyRelics } = load(path.join(root, 'src/games/autochess/Units.ts'));
const save = load(path.join(root, 'src/core/Storage.ts'));
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
const clone = (value) => JSON.parse(JSON.stringify(value));
function resolve(model) {
  check(model.beginBattle(), 'deployed army can start');
  for (let frame = 0; frame < 1100 && model.state.phase === 'battle'; frame++) model.update(0.05);
  check(model.state.phase !== 'battle', 'combat must resolve within 45 seconds');
}

const model = new AutoChessModel();
check(model.buy(0) && model.buy(1), 'recruit starter duplicates');
const moss = model.state.units.filter((unit) => unit.type === 'moss');
check(moss.length === 1 && moss[0].star === 2 && moss[0].cell === 26, 'triple merge preserves the deployed piece and position');
check(model.state.gold === 8 && model.state.shop[0] === null, 'purchase charges once and consumes the offer');
check(!model.buy(0) && model.state.gold === 8, 'sold offer cannot be purchased twice');
check(!model.move(moss[0].uid, 3), 'cannot deploy in enemy territory');
check(model.buy(3) && model.autoDeploy() && model.deployed.length === 3, 'bench can deploy to available population');
const fox = model.state.units.find((unit) => unit.type === 'fox');
const boar = model.state.units.find((unit) => unit.type === 'boar');
const oldFox = fox.cell, oldBoar = boar.cell;
check(model.move(fox.uid, oldBoar) && fox.cell === oldBoar && boar.cell === oldFox, 'occupied cells swap without losing a piece');
check(model.sell(boar.uid) && model.state.gold === 8, 'selling returns the correct cost');
check(model.buyXp() && model.state.xp === 4, 'population XP consumes four coins');
check(model.buyXp() && model.capacity === 4 && model.state.gold === 0, 'crossing XP threshold increases population');
check(!model.refresh() && !model.buy(4), 'no purchases or rerolls when broke');

const counts = synergyCounts([{ type: 'moss' }, { type: 'moss' }, { type: 'fox' }]);
check(counts.forest === 2, 'synergies count different types, not duplicates');
const fight = new Combat([{ uid: 'a', type: 'moss', star: 2, cell: 26 }, { uid: 'b', type: 'fox', star: 1, cell: 33 }], enemiesForRound(1));
check(fight.fighters[0].regen === 0.015, 'two forest types activate regeneration');
for (let frame = 0; frame < 1000 && !fight.result; frame++) {
  fight.update(0.05);
  const live = fight.fighters.filter((unit) => unit.hp > 0);
  check(new Set(live.map((unit) => unit.cell)).size === live.length, 'living fighters never overlap');
}
check(fight.result === 'win', 'the starter upgrade can clear the tutorial encounter');
check(fight.fighters.some((unit) => unit.dealt > 0), 'real damage is applied');

const frozen = new AutoChessModel();
frozen.beginBattle();
const before = frozen.snapshot();
check(!frozen.buy(0) && !frozen.sell('unit-1') && !frozen.move('unit-1', 20) && !frozen.buyXp() && !frozen.refresh() && !frozen.toggleLock(), 'preparation actions are blocked in combat');
check(frozen.snapshot() === before && parseRun(before).phase === 'prep', 'battle checkpoint returns to pre-combat preparation');

const reward = new AutoChessModel(undefined, () => 0.2);
reward.buy(0); reward.buy(1); reward.buy(3); reward.autoDeploy();
reward.state.gold = 20;
reward.toggleLock();
const lockedShop = JSON.stringify(reward.state.shop);
resolve(reward);
check(reward.state.phase === 'reward' && reward.state.lastReport.win, 'victory opens the reward choice');
check(reward.state.lastReport.interest === 2 && reward.state.lastReport.income === 8, 'income includes capped bank interest and victory bonus');
check(parseRun(reward.snapshot()) !== null, 'reward checkpoint is restorable');
check(reward.chooseReward(1) && reward.state.round === 2 && reward.state.phase === 'prep', 'one choice advances the round');
check(Object.values(reward.state.relics).reduce((sum, value) => sum + value, 0) === 1, 'relic persists for the expedition');
check(JSON.stringify(reward.state.shop) === lockedShop && !reward.chooseReward(0), 'shop lock persists and reward cannot be claimed twice');

const fullBench = new AutoChessModel();
fullBench.state.units.push(...Array.from({ length: 7 }, (_, index) => ({ uid: 'unit-' + (index + 3), type: index < 2 ? 'moss' : 'owl', star: 1, cell: null })));
fullBench.state.nextUid = 10;
fullBench.state.shop[0] = 'rabbit';
const fullBefore = fullBench.snapshot();
check(!fullBench.buy(0) && fullBench.snapshot() === fullBefore, 'full bench rejects purchase atomically');
fullBench.state.shop[0] = 'moss';
check(fullBench.buy(0) && fullBench.bench.length <= 7 && fullBench.state.units.some((unit) => unit.type === 'moss' && unit.star === 2), 'a full bench still permits a purchase that merges');

const nine = new AutoChessModel();
nine.state.units = Array.from({ length: 8 }, (_, index) => ({ uid: 'unit-' + (index + 1), type: 'moss', star: index < 2 ? 2 : 1, cell: index === 0 ? 26 : null }));
nine.state.nextUid = 9;
nine.state.shop[0] = 'moss';
check(nine.buy(0), 'multi-tier merge purchase accepted');
check(nine.state.units.some((unit) => unit.star === 3 && unit.cell === 26), 'merging cascades to three stars on board');

const final = new AutoChessModel();
final.state.round = 8; final.state.xp = 24;
final.state.units = ['moss','fox','deer','boar','badger','owl'].map((type,index)=>({uid:'unit-'+(index+1),type,star:3,cell:index<3?18+index:30+index}));
final.state.nextUid = 7;
resolve(final);
check(final.state.phase === 'ended' && final.state.lastReport.win && final.state.score >= 500, 'final boss can be defeated and gives a terminal victory');
const defeated = new AutoChessModel();
defeated.state.round = 7; defeated.state.health = 2; defeated.state.units = [{uid:'unit-1',type:'cat',star:1,cell:35}];
resolve(defeated);
check(defeated.state.phase === 'ended' && defeated.state.health === 0, 'camp health depletion ends the run');

const snapshot = reward.snapshot();
check(parseRun(snapshot) !== null, 'valid state round-trips');
for (const corrupt of [null, { ...clone(reward.state), gold: -1 }, { ...clone(reward.state), units: [{uid:'unit-1',type:'__proto__',star:1,cell:26}] }, { ...clone(reward.state), shop: ['constructor',null,null,null,null] }, { ...clone(reward.state), units: [reward.state.units[0], reward.state.units[0]] }]) check(parseRun(JSON.stringify(corrupt)) === null, 'invalid run data is rejected');
storage.setItem(AUTO_CHESS_SAVE_KEY, snapshot); save.saveBest('autochess', 500);
const v4 = JSON.parse(save.exportSaveBackup());
check(v4.version === 4 && save.importSaveBackup(JSON.stringify(v4)), 'v4 exports and imports expedition state');
for (const version of [1,2,3]) {
  const old = clone(v4); old.version = version;
  delete old.data['pocket-play-best-autochess']; delete old.data[AUTO_CHESS_SAVE_KEY];
  if(version<3)delete old.data['pocket-play-best-stacker']; if(version<2)delete old.data['pocket-play-best-shells'];
  check(save.importSaveBackup(JSON.stringify(old)) && save.getBest('autochess') === 500 && storage.getItem(AUTO_CHESS_SAVE_KEY) === snapshot, 'old backup preserves newer game state');
}
const invalidSave = clone(v4); invalidSave.data[AUTO_CHESS_SAVE_KEY] = '{"version":999}';
const beforeInvalid = JSON.stringify([...memory]);
check(!save.importSaveBackup(JSON.stringify(invalidSave)) && JSON.stringify([...memory]) === beforeInvalid, 'invalid expedition import leaves all storage unchanged');
// Play a real budget-constrained expedition: recruit/merge, level, deploy, fight,
// choose rewards. No injected health, coins, stars, enemies, or combat results.
function playExpedition(seed) {
  let randomState = seed;
  const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
  const expedition = new AutoChessModel(undefined, random);
  const core = new Set(['moss','fox','deer','boar','badger','owl']);
  const power = (unit) => (unitById[unit.type].hp + unitById[unit.type].attack * 8 + unitById[unit.type].armor * 5) * [1,1.9,3.6][unit.star-1];
  const rounds = [];
  while(expedition.state.phase !== 'ended') {
    if(expedition.state.phase === 'reward') {
      const free = expedition.state.rewards.findIndex(id=>id.startsWith('recruit-')&&core.has(id.slice(8))&&!expedition.state.units.some(unit=>unit.type===id.slice(8)&&unit.star>=2));
      if(free<0||!expedition.chooseReward(free))expedition.chooseReward(0);
    }
    const desired = Math.min(6,3+Math.floor(expedition.state.round/2));
    while(expedition.capacity<desired && expedition.state.gold>=4)expedition.buyXp();
    for(let turn=0;turn<4;turn++) {
      const offers=expedition.state.shop.map((id,index)=>({id,index})).filter(({id})=>id&&core.has(id)&&!expedition.state.units.some(unit=>unit.type===id&&unit.star>=2))
        .sort((a,b)=>expedition.state.units.filter(unit=>unit.type===b.id).length-expedition.state.units.filter(unit=>unit.type===a.id).length);
      for(const {index} of offers)expedition.buy(index);
      expedition.autoDeploy();
      for(let iteration=0;iteration<10;iteration++) {
        const weakest=[...expedition.deployed].sort((a,b)=>power(a)-power(b))[0];
        const best=[...expedition.bench].sort((a,b)=>power(b)-power(a))[0];
        if(!best||!weakest||power(best)<=power(weakest)*1.05)break;
        expedition.move(best.uid,weakest.cell);
      }
      if(turn<3 && expedition.state.gold>=3)expedition.refresh();
    }
    for(const piece of [...expedition.deployed]) {
      const ranged=unitById[piece.type].range>1;
      const cells=ranged?[32,33,31,34,30,35]:[20,21,19,22,18,23];
      const cell=cells.find(cell=>!expedition.deployed.some(unit=>unit.cell===cell));
      if(cell!==undefined)expedition.move(piece.uid,cell);
    }
    resolve(expedition);
    rounds.push({round:expedition.state.round,win:expedition.state.lastReport.win,health:expedition.state.health});
  }
  return {seed,victory:expedition.state.round===8&&expedition.state.lastReport.win,rounds};
}
const expeditions=Array.from({length:12},(_,index)=>playExpedition(index+1));
check(expeditions.some(run=>run.victory), 'a legal economy-and-recruitment strategy can complete all eight encounters');
console.log('Auto-chess checks passed: ' + checks + '. Pure model and in-memory saves; no player browser or files accessed.');
console.log(JSON.stringify({expeditionWins:expeditions.filter(run=>run.victory).length,outOf:expeditions.length,sample:expeditions.find(run=>run.victory)||expeditions[0]},null,2));
