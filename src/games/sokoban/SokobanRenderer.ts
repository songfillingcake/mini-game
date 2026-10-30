import { drawText, roundedRect, WIDTH, HEIGHT } from '../../core/Game';
import { boxIslands } from './Islands';
import type { SokobanModel } from './SokobanModel';
export const boxTile = 50;
export const boxOrigin = (m: SokobanModel): { x: number; y: number } => ({ x: (WIDTH - m.width * boxTile) / 2, y: 83 });
export const boxButtons = [{ x: 205, y: 466, width: 170, height: 45 }, { x: 395, y: 466, width: 170, height: 45 }, { x: 585, y: 466, width: 170, height: 45 }];

export function renderSokoban(ctx: CanvasRenderingContext2D, m: SokobanModel, now: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT); bg.addColorStop(0, '#a9dce0'); bg.addColorStop(1, '#5eafa8'); ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 13; i++) { ctx.strokeStyle = '#d4f3e64d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse((i * 173 + now * 12) % 1000 - 20, 80 + i * 37, 30, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
  drawText(ctx, `${m.stage + 1}/${boxIslands.length} · ${boxIslands[m.stage].name}`, 480, 35, 24, '#254e50', 900);
  drawText(ctx, `目标 ${m.covered}/${m.goals.size} · 移动 ${m.moves} 步 · 推箱 ${m.pushes} 次`, 480, 63, 16, '#386b66', 700);
  const origin = boxOrigin(m);
  ctx.fillStyle = '#497d76'; roundedRect(ctx, origin.x - 9, origin.y - 5, m.width * boxTile + 18, m.height * boxTile + 17, 20); ctx.fill();
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    const px = origin.x + x * boxTile, py = origin.y + y * boxTile;
    ctx.fillStyle = m.isWall(x, y) ? '#658b7b' : '#f0ebcd'; roundedRect(ctx, px + 2, py + 2, 46, 46, 8); ctx.fill();
    if (m.isWall(x, y)) { ctx.fillStyle = '#90ae8c'; roundedRect(ctx, px + 4, py + 3, 42, 10, 4); ctx.fill(); }
    if (m.isGoal({ x, y })) { ctx.strokeStyle = '#c59b47'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px + 25, py + 25, 14, 0, Math.PI * 2); ctx.stroke(); drawText(ctx, '✦', px + 25, py + 25, 19, '#c59b47', 900); }
  }
  m.crates.forEach(c => {
    const x = origin.x + c.x * boxTile, y = origin.y + c.y * boxTile;
    ctx.fillStyle = m.isGoal(c) ? '#7cb7a0' : m.isCorner(c) ? '#d9967e' : '#c9a16d'; roundedRect(ctx, x + 6, y + 6, 38, 38, 7); ctx.fill();
    ctx.strokeStyle = m.isGoal(c) ? '#dff2ca' : '#f1d5a3'; ctx.lineWidth = 3; ctx.strokeRect(x + 11, y + 11, 28, 28); ctx.beginPath(); ctx.moveTo(x + 11, y + 11); ctx.lineTo(x + 39, y + 39); ctx.moveTo(x + 39, y + 11); ctx.lineTo(x + 11, y + 39); ctx.stroke();
    if (m.isGoal(c)) drawText(ctx, '✓', x + 25, y + 25, 25, '#f4ffe6', 900);
  });
  const px = origin.x + m.player.x * boxTile + 25, py = origin.y + m.player.y * boxTile + 25;
  ctx.fillStyle = '#527e8c'; ctx.beginPath(); ctx.arc(px, py, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1d9ac'; ctx.beginPath(); ctx.arc(px, py - 3, 12, 0, Math.PI * 2); ctx.fill();
  drawText(ctx, '• •', px, py - 4, 13, '#365361', 900);
  drawText(ctx, m.message, 480, 447, 17, '#234e4d', 800);
  boxButtons.forEach((r, i) => {
    const enabled = i === 0 ? m.history.length > 0 && m.phase === 'playing' : i === 1 ? m.phase === 'playing' : m.phase === 'cleared';
    ctx.globalAlpha = enabled ? 1 : .45; ctx.fillStyle = i === 2 ? '#366c64' : '#edf1d7'; roundedRect(ctx, r.x, r.y, r.width, r.height, 13); ctx.fill();
    drawText(ctx, ['↶ 撤回一步', '↻ 重置小岛', '下一岛 →'][i], r.x + r.width / 2, r.y + 23, 17, i === 2 ? '#f2f6d9' : '#335b53', 800);
  }); ctx.globalAlpha = 1;
  drawText(ctx, '方向键 / WASD 移动 · 点击相邻格移动 · 空格撤回 / 下一岛', 480, 529, 13, '#285853', 700);
}
