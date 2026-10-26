import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderIcon, renderSound, SOUND_NAMES } from '@pocket-play/engine/tools';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIVO = path.join(ROOT, 'vivo');
const SRC = path.join(VIVO, 'src');

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function loadEsbuild() {
  try {
    return await import('esbuild');
  } catch {
    console.error('✖ 缺少依赖 esbuild。请先在 vivo-mini-game 目录执行：npm install');
    return null;
  }
}

/**
 * 调试签名缺失时从官方模板取一份（公开的调试密钥，只能用于真机调试）。
 * 正式包必须使用自己的 sign/release 证书。
 */
async function ensureDebugSign() {
  const dir = path.join(VIVO, 'sign', 'debug');
  await mkdir(dir, { recursive: true });
  const files = ['certificate.pem', 'private.pem'];
  const missing = [];
  for (const file of files) {
    if (!(await exists(path.join(dir, file)))) missing.push(file);
  }
  if (missing.length === 0) return 'ready';

  const base = 'https://unpkg.com/@vivo-minigame/cli/templates/default/sign/debug/';
  try {
    for (const file of missing) {
      const response = await fetch(`${base}${file}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!text.includes('-----BEGIN')) throw new Error('返回内容不是 PEM');
      await writeFile(path.join(dir, file), text, 'utf8');
    }
    console.log('✔ 已获取调试签名（仅真机调试可用，正式包请替换 vivo/sign/release）');
    return 'fetched';
  } catch (error) {
    console.warn(`! 调试签名准备失败：${error.message}`);
    console.warn('  可手动放入 vivo/sign/debug/certificate.pem 与 private.pem，或改用 vivo 快游戏 IDE 打包。');
    return 'missing';
  }
}

export async function buildVivo() {
  const manifestPath = path.join(SRC, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    console.error('✖ 读取 vivo/src/manifest.json 失败，请检查 JSON 是否合法。');
    return null;
  }
  if (!manifest.package || !manifest.name) {
    console.error('✖ manifest.json 必须包含 package 与 name 字段。');
    return null;
  }

  const esbuild = await loadEsbuild();
  if (!esbuild) return null;

  const outDir = path.join(SRC, 'js');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  console.log('· 打包游戏代码 src/entry/vivo.ts → vivo/src/js/main.js');
  try {
    await esbuild.build({
      entryPoints: [path.join(ROOT, 'src', 'entry', 'vivo.ts')],
      outfile: path.join(outDir, 'main.js'),
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

  await writeFile(
    path.join(SRC, 'game.js'),
    "// 由 npm run build 生成，请勿手动修改。入口：/src/entry/vivo.ts\nimport './js/main.js';\n",
    'utf8',
  );

  console.log('· 生成图标与音效');
  const imageDir = path.join(SRC, 'image');
  const audioDir = path.join(SRC, 'audio');
  await mkdir(imageDir, { recursive: true });
  await mkdir(audioDir, { recursive: true });
  const icon = renderIcon(192);
  await writeFile(path.join(imageDir, 'logo.png'), icon);
  for (const name of SOUND_NAMES) {
    await writeFile(path.join(audioDir, `${name}.wav`), renderSound(name));
  }

  const signStatus = await ensureDebugSign();
  const bundleSize = (await stat(path.join(outDir, 'main.js'))).size;

  console.log('');
  console.log('✔ vivo 运行时工程已就绪：');
  console.log(`  vivo/src/game.js        ${(bundleSize / 1024).toFixed(1)} KB（游戏代码）`);
  console.log(`  vivo/src/image/logo.png ${(icon.length / 1024).toFixed(1)} KB`);
  console.log(`  vivo/src/audio/         ${SOUND_NAMES.length} 个音效`);
  console.log(`  vivo/src/manifest.json  ${manifest.package} · v${manifest.versionName}(${manifest.versionCode})`);
  console.log(`  调试签名                ${signStatus === 'missing' ? '缺失（可先用 IDE 打包）' : '就绪'}`);
  console.log('');
  console.log('下一步：npm run pack（生成 rpk）');

  return { manifest, bundleSize, signStatus };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildVivo();
  if (!result) process.exitCode = 1;
}
