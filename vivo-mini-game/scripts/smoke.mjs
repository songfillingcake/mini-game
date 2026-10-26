import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSmoke } from '@pocket-play/squishy-planet/tools';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await runSmoke({
  bundlePath: path.join(ROOT, 'vivo', 'src', 'js', 'main.js'),
  apiName: 'qg',
  label: 'vivo 小游戏',
});
