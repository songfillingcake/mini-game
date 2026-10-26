import { spawn } from 'node:child_process';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIVO = path.join(ROOT, 'vivo');
const DIST = path.join(ROOT, 'dist', 'vivo');
const IS_WINDOWS = process.platform === 'win32';

function quote(part) {
  return /[\s"]/.test(part) ? `"${part}"` : part;
}

/**
 * 执行外部命令。Windows 上 .cmd 必须经过 shell，因此这里显式拼命令行后
 * 以单个字符串交给 shell，避免 Node 的 args + shell 组合告警。
 */
function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = IS_WINDOWS
      ? spawn([quote(command), ...args.map(quote)].join(' '), { cwd, stdio: 'inherit', shell: true })
      : spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} 退出码 ${code}`));
    });
  });
}

async function findRpk(dir, depth = 0) {
  if (depth > 4) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await findRpk(full, depth + 1)));
    else if (entry.name.endsWith('.rpk')) found.push(full);
  }
  return found;
}

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 打包器优先级：
 * 1. 子工程内安装的 @vivo-minigame/cli（npm i -D @vivo-minigame/cli）
 * 2. 与当前 node 同目录的 npx（有些运行时不在 PATH 里暴露 npx）
 * 3. PATH 上的 npx
 */
async function resolvePackager() {
  const localBin = await firstExisting([
    path.join(ROOT, 'node_modules', '.bin', IS_WINDOWS ? 'mgs.cmd' : 'mgs'),
    path.join(ROOT, 'node_modules', '.bin', 'mgs'),
  ]);
  if (localBin) return { command: localBin, args: ['build'], label: `本地打包器 ${path.relative(ROOT, localBin)}` };

  const nodeDir = path.dirname(process.execPath);
  const npx = await firstExisting([
    path.join(nodeDir, IS_WINDOWS ? 'npx.cmd' : 'npx'),
    path.join(nodeDir, 'npx'),
  ]);
  const npxArgs = ['--yes', '-p', '@vivo-minigame/cli', 'mgs', 'build'];
  if (npx) return { command: npx, args: npxArgs, label: `npx（${npx}）` };
  return { command: IS_WINDOWS ? 'npx.cmd' : 'npx', args: npxArgs, label: 'PATH 上的 npx' };
}

export async function packVivo() {
  const packager = await resolvePackager();
  console.log(`· 使用 ${packager.label} 打包 rpk`);
  console.log(`  运行目录：${VIVO}`);
  console.log('');

  try {
    await run(packager.command, packager.args, VIVO);
  } catch (error) {
    console.error('');
    console.error(`✖ 打包失败：${error.message}`);
    console.error('');
    console.error('排查建议：');
    console.error('  1. 推荐先安装官方工具链：npm i -D @vivo-minigame/cli');
    console.error('  2. 或确认 PATH 上存在 npx（脚本会自动使用它临时下载打包器）');
    console.error('  3. 首次打包会下载 vivo 的 rpk 发布环境，需要联网');
    console.error('  4. 命令行始终不可用时，用 vivo 快游戏联盟 IDE 打开 vivo/ 目录同样可以打包');
    return null;
  }

  const candidates = [...(await findRpk(path.join(VIVO, 'dist'))), ...(await findRpk(path.join(VIVO, 'build')))];
  if (candidates.length === 0) {
    console.error('✖ 打包命令执行完成，但没有找到 .rpk 产物。');
    console.error('  请检查 vivo/dist 或 vivo/build 目录，或改用 vivo 快游戏联盟 IDE 打包。');
    return null;
  }

  await mkdir(DIST, { recursive: true });
  const outputs = [];
  for (const source of candidates) {
    const target = path.join(DIST, path.basename(source));
    await copyFile(source, target);
    outputs.push(target);
  }

  console.log('');
  for (const output of outputs) {
    const info = await stat(output);
    console.log(`✔ ${path.relative(ROOT, output)}  ${(info.size / 1024 / 1024).toFixed(2)} MB`);
  }
  console.log('');
  console.log('把 rpk 传到手机，用「快应用调试器」本地安装即可真机验收；');
  console.log('正式提审请在 vivo 开放平台上传 vivo/sign/release 签名后的包。');
  return outputs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await packVivo();
  if (!result) process.exitCode = 1;
}
