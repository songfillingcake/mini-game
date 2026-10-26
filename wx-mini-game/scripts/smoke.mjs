import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSmoke } from '@pocket-play/squishy-planet/tools';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await runSmoke({
  bundlePath: path.join(ROOT, 'dist', 'wx', 'game.js'),
  apiName: 'wx',
  label: '微信小游戏',
});
