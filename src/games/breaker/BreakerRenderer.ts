import { drawText, roundedRect, WIDTH, HEIGHT } from '../../core/Game';
import { breakerStages, breakerUpgrades } from './Stages';
import type { BreakerModel } from './BreakerModel';

export const upgradeRects = breakerUpgrades.map((_, i) => ({ x: 102 + i * 258, y: 212, width: 240, height: 178 }));
const colors = { normal: '#7ecfb8', armour: '#93a9d7', blast: '#eea382', crystal: '#c0a0eb', core: '#eb92b4' };

/** One canvas view; model owns every gameplay decision. */
export function renderBreaker(ctx: CanvasRenderingContext2D, m: BreakerModel, now: number, choice: number): void {
  const stage = breakerStages[m.stage];
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT); sky.addColorStop(0, '#182b46'); sky.addColorStop(1, '#103b42');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 42; i++) {
    ctx.globalAlpha = .2 + (Math.sin(now + i) + 1) * .16;
    ctx.fillStyle = stage.color; ctx.beginPath(); ctx.arc((i * 173 + 37) % WIDTH, 80 + (i * 97) % 380, i % 5 === 0 ? 2 : 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#557b87'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(18, 520); ctx.lineTo(18, 72); ctx.lineTo(942, 72); ctx.lineTo(942, 520); ctx.stroke();
  ctx.fillStyle = '#142b3de8'; roundedRect(ctx, 18, 12, 924, 49, 14); ctx.fill();
  drawText(ctx, `${m.stage + 1}/6 · ${stage.name}`, 38, 36, 19, '#e7f4df', 800, 'left');
  drawText(ctx, '♥ '.repeat(m.lives).trim(), 920, 36, 20, '#f3afa6', 800, 'right');
  drawText(ctx, `剩余 ${m.bricks.filter(b => b.hp > 0).length} 砖`, 480, 36, 17, '#b4ced0', 700);
  for (const brick of m.bricks) {
    if (brick.hp <= 0) continue;
    const color = colors[brick.kind];
    ctx.fillStyle = '#071f30'; roundedRect(ctx, brick.x + 2, brick.y + 4, brick.width, brick.height, 7); ctx.fill();
    ctx.fillStyle = brick.cooldown > 0 ? '#fff4d4' : color; roundedRect(ctx, brick.x, brick.y, brick.width, brick.height, 7); ctx.fill();
    ctx.fillStyle = '#ffffff45'; roundedRect(ctx, brick.x + 4, brick.y + 3, brick.width - 8, 5, 2); ctx.fill();
    if (brick.kind !== 'normal') drawText(ctx, brick.kind === 'armour' ? String(brick.hp) : brick.kind === 'blast' ? '✹' : brick.kind === 'core' ? `核心 ${brick.hp}` : '◆', brick.x + brick.width / 2, brick.y + 14, 14, '#24354b', 900);
  }
  for (const burst of m.bursts) {
    ctx.save(); ctx.globalAlpha = Math.min(1, burst.life * 3);
    ctx.strokeStyle = burst.kind === 'blast' ? '#ffc18a' : burst.kind === 'catch' ? '#a8f4df' : '#f7eed0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(burst.x, burst.y, burst.kind === 'blast' ? (1 - burst.life / .5) * 110 : (1 - burst.life / .3) * 30, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  for (const drop of m.drops) {
    ctx.fillStyle = drop.kind === 'multi' ? '#c6a9ee' : drop.kind === 'shield' ? '#edca83' : '#8cdac0'; roundedRect(ctx, drop.x - 17, drop.y - 13, 34, 26, 8); ctx.fill();
    drawText(ctx, drop.kind === 'multi' ? '❖' : drop.kind === 'shield' ? '◇' : '↔', drop.x, drop.y, 19, '#26364a', 900);
  }
  const balls = m.phase === 'aim' ? [{ x: m.paddle, y: 462, trail: [] }] : m.balls;
  for (const ball of balls) {
    ball.trail.forEach((point, i) => { ctx.fillStyle = `rgba(213,242,224,${i / 30})`; ctx.beginPath(); ctx.arc(point.x, point.y, 2 + i / 3, 0, Math.PI * 2); ctx.fill(); });
    ctx.save(); ctx.shadowColor = '#c9faea'; ctx.shadowBlur = 12; ctx.fillStyle = '#f4ffe3'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  if (m.shields) { ctx.strokeStyle = '#efd58c'; ctx.lineWidth = 4; ctx.setLineDash([12, 6]); ctx.beginPath(); ctx.moveTo(23, 520); ctx.lineTo(937, 520); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = m.wideTime > 0 ? '#a9e8c5' : '#e9d298'; roundedRect(ctx, m.paddle - m.paddleWidth / 2, 476, m.paddleWidth, 15, 7); ctx.fill();
  ctx.fillStyle = '#fff8d666'; roundedRect(ctx, m.paddle - m.paddleWidth / 2 + 8, 478, m.paddleWidth - 16, 4, 2); ctx.fill();
  drawText(ctx, `重击 ${m.power} · 护盾 ${m.shields}` + (m.wideTime > 0 ? ` · 加宽 ${Math.ceil(m.wideTime)}s` : ''), 480, 519, 15, '#c5dad0', 700);
  if (m.messageTime > 0 && m.phase !== 'upgrade') drawText(ctx, m.message, 480, 431, 18, '#f5e3b6', 800);
  if (m.phase === 'aim') drawText(ctx, '移动挡板后 · 点击 / 空格发射', 480, 389, 19, '#e8f2d7', 800);
  if (m.phase === 'upgrade') {
    ctx.fillStyle = '#0c2030ed'; ctx.fillRect(22, 75, 916, 444);
    drawText(ctx, '关卡完成 · 选择一项永久升级', 480, 155, 26, '#f1ebce', 900);
    upgradeRects.forEach((r, i) => {
      const upgrade = breakerUpgrades[i], capped = upgrade.id === 'paddle' ? m.baseWidth >= 216 : upgrade.id === 'power' ? m.power >= 3 : m.lives >= 5;
      ctx.fillStyle = choice === i ? '#2e5b5e' : '#1e3c4c'; roundedRect(ctx, r.x, r.y, r.width, r.height, 16); ctx.fill();
      ctx.strokeStyle = choice === i ? '#edd59b' : '#52717a'; ctx.lineWidth = choice === i ? 3 : 1; ctx.stroke();
      drawText(ctx, upgrade.icon, r.x + r.width / 2, r.y + 45, 33, '#eddaaa', 900);
      drawText(ctx, upgrade.name, r.x + r.width / 2, r.y + 91, 20, '#e3efdc', 800);
      drawText(ctx, capped ? '已达上限 · 可选其他升级' : upgrade.detail, r.x + r.width / 2, r.y + 130, 13, capped ? '#eeae9b' : '#b8cfcb', 700);
    });
    drawText(ctx, '点击选择 · 或 ← → 切换，空格确认', 480, 440, 17, '#c4d8ce', 700);
  }
}
