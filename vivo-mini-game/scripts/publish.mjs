import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildVivo } from './build-vivo.mjs';
import { packVivo } from './pack-vivo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 一键发布：构建 vivo 运行时工程 → 调用官方打包器产出 rpk。
 * 任何一步失败都会中断并给出下一步指引。
 */
export async function publish() {
  console.log('=== 捏捏星球 · vivo 小游戏一键发布 ===');
  console.log(`工作目录：${ROOT}`);
  console.log('');

  const buildResult = await buildVivo();
  if (!buildResult) {
    console.error('');
    console.error('✖ 构建阶段失败，已停止。');
    return null;
  }

  console.log('');
  const outputs = await packVivo();
  if (!outputs) {
    console.error('');
    console.error('✖ 打包阶段失败。运行时工程本身已构建完成，可手动打包：');
    console.error(`  cd ${path.join(ROOT, 'vivo')} && mgs build`);
    return null;
  }

  console.log('');
  console.log('=== 发布产物 ===');
  for (const output of outputs) console.log(`  ${output}`);
  console.log('');
  console.log('提审清单：');
  console.log('  1. vivo/src/manifest.json 中的 versionCode 每次提审 +1');
  console.log('  2. 把 vivo/sign/release 换成自己的正式签名');
  console.log('  3. 在 vivo 开放平台（或快游戏联盟）上传 rpk 并提交审核');
  return outputs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await publish();
  if (!result) process.exitCode = 1;
}
