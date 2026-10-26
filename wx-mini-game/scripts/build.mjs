import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderSound, SOUND_NAMES } from '@pocket-play/engine/tools';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist', 'wx');

async function loadEsbuild() {
  try {
    return await import('esbuild');
  } catch {
    console.error('✖ 缺少依赖 esbuild。请先在 wx-mini-game 目录执行：npm install');
    return null;
  }
}

/**
 * 微信小游戏的包结构非常简单：根目录一个 game.js + game.json。
 * 所以这里直接把 esbuild 产物写成 game.js，不需要再套一层打包器。
 */
export async function buildWx() {
  const esbuild = await loadEsbuild();
  if (!esbuild) return null;

  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'audio'), { recursive: true });

  console.log('· 打包游戏代码 src/entry/wx.ts → dist/wx/game.js');
  try {
    await esbuild.build({
      entryPoints: [path.join(ROOT, 'src', 'entry', 'wx.ts')],
      outfile: path.join(OUT, 'game.js'),
      bundle: true,
      format: 'iife',
      target: 'es2017',
      platform: 'browser',
      charset: 'utf8',
      minify: false,
      sourcemap: false,
      legalComments: 'none',
      logLevel: 'warning',
    });
  } catch {
    console.error('✖ esbuild 打包失败，请检查 TypeScript 报错。');
    return null;
  }

  await copyFile(path.join(ROOT, 'game.json'), path.join(OUT, 'game.json'));
  await copyFile(path.join(ROOT, 'project.config.json'), path.join(OUT, 'project.config.json'));

  console.log('· 生成音效');
  for (const name of SOUND_NAMES) {
    await writeFile(path.join(OUT, 'audio', `${name}.wav`), renderSound(name));
  }

  const bundle = await stat(path.join(OUT, 'game.js'));
  const audioFiles = await Promise.all(SOUND_NAMES.map((name) => stat(path.join(OUT, 'audio', `${name}.wav`))));
  const audioBytes = audioFiles.reduce((total, info) => total + info.size, 0);

  console.log('');
  console.log('✔ 微信小游戏包已就绪：dist/wx/');
  console.log(`  game.js              ${(bundle.size / 1024).toFixed(1)} KB`);
  console.log(`  game.json / project.config.json`);
  console.log(`  audio/               ${SOUND_NAMES.length} 个音效 ${(audioBytes / 1024).toFixed(0)} KB`);
  console.log(`  合计                 ${((bundle.size + audioBytes) / 1024).toFixed(0)} KB（主包上限 4 MB）`);
  console.log('');
  console.log('下一步：用微信开发者工具「导入项目」选择 dist/wx 目录');

  return { size: bundle.size + audioBytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildWx();
  if (!result) process.exitCode = 1;
}
