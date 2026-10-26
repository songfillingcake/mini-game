import { MAP, relics, walls, type Vec } from './Content';
import type { ExtractionModel } from './ExtractionModel';

const circle = (ctx: CanvasRenderingContext2D, p: Vec, r: number, color: string | CanvasGradient): void => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
};
const label = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void => {
  ctx.fillStyle = color; ctx.font = `700 ${size}px "Microsoft YaHei", sans-serif`; ctx.textAlign = 'center'; ctx.fillText(text, x, y);
};

/** Draws a run in CSS pixels; no simulation, input listeners or persistence. */
export function renderExtraction(ctx: CanvasRenderingContext2D, m: ExtractionModel, width: number, height: number): void {
  const scale = width < 600 ? .85 : 1;
  const vw = width / scale, vh = height / scale;
  const cx = Math.max(0, Math.min(MAP.width - vw, m.player.x - vw / 2));
  const cy = Math.max(0, Math.min(MAP.height - vh, m.player.y - vh / 2));
  ctx.fillStyle = '#102d32'; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
  ctx.strokeStyle = '#1b393c'; ctx.lineWidth = 1;
  for (let x = 0; x < MAP.width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP.height); ctx.stroke(); }
  for (let y = 0; y < MAP.height; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP.width, y); ctx.stroke(); }
  // Deterministic floor details keep the world legible without asset downloads.
  for (let i = 0; i < 110; i++) {
    const x = (i * 173 + 65) % MAP.width, y = (i * 317 + 43) % MAP.height;
    ctx.fillStyle = i % 3 ? '#254441' : '#35594b'; ctx.fillRect(x, y, 3 + i % 5, 3);
  }
  ctx.strokeStyle = '#698775'; ctx.lineWidth = 7; ctx.strokeRect(3, 3, MAP.width - 6, MAP.height - 6);
  circle(ctx, MAP.exit, MAP.exit.radius, '#2b6c5f55');
  ctx.strokeStyle = '#91ebbd'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(MAP.exit.x, MAP.exit.y, MAP.exit.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  label(ctx, '撤离区', MAP.exit.x, MAP.exit.y - 12, 22, '#b6f9d3');
  label(ctx, m.bag.length ? '站稳 4 秒' : '带上宝物再回来', MAP.exit.x, MAP.exit.y + 17, 15, '#9ccdbb');
  if (m.extraction > 0) { ctx.strokeStyle = '#fff2bd'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(MAP.exit.x, MAP.exit.y, 69, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * m.extraction / 4); ctx.stroke(); }
  for (const f of m.effects) if (f.kind === 'ice') circle(ctx, f, 39, '#9cecff30');
  for (const w of walls) {
    ctx.fillStyle = '#071e26aa'; ctx.fillRect(w.x + 9, w.y + 14, w.w, w.h);
    ctx.fillStyle = '#354d50'; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#58716b'; ctx.fillRect(w.x, w.y, w.w, 7);
    ctx.fillStyle = '#466354'; ctx.fillRect(w.x + 7, w.y + 9, w.w * .45, 10);
    ctx.strokeStyle = '#6b817366'; ctx.strokeRect(w.x + 4, w.y + 4, w.w - 8, w.h - 8);
  }
  for (const item of m.loot) {
    const def = relics[item.type], pulse = Math.sin(m.elapsed * 3 + item.id) * 3;
    const glow = ctx.createRadialGradient(item.x, item.y, 2, item.x, item.y, 44);
    glow.addColorStop(0, def.color + '50'); glow.addColorStop(1, def.color + '00'); circle(ctx, item, 44, glow);
    circle(ctx, item, 22 + pulse, '#102d32');
    ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(item.x, item.y, 23 + pulse, 0, Math.PI * 2); ctx.stroke();
    label(ctx, def.glyph, item.x, item.y + 8, 25, def.color);
    if (m.nearestLoot?.id === item.id) label(ctx, def.name, item.x, item.y - 36, 17, '#fff2cf');
  }
  for (const e of m.enemies) {
    if (e.windup > 0) {
      ctx.strokeStyle = '#ff8068'; ctx.lineWidth = 2; ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.aim.x, e.aim.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#ff8068'; ctx.beginPath(); ctx.arc(e.aim.x, e.aim.y, 43, 0, Math.PI * 2); ctx.stroke();
    }
    circle(ctx, { x: e.x + 3, y: e.y + 8 }, 20, '#061a2280');
    const color = e.type === 'brute' ? '#d4946e' : e.type === 'sentry' ? '#b9a4d5' : '#e48176';
    circle(ctx, e, e.type === 'brute' ? 24 : 17, color);
    label(ctx, e.type === 'brute' ? '▰' : e.type === 'sentry' ? '⌖' : '×', e.x, e.y + 6, 19, '#382b36');
    if (e.hp < e.maxHp) { ctx.fillStyle = '#152c32'; ctx.fillRect(e.x - 21, e.y - 34, 42, 5); ctx.fillStyle = color; ctx.fillRect(e.x - 21, e.y - 34, 42 * e.hp / e.maxHp, 5); }
  }
  const p = m.player;
  circle(ctx, { x: p.x + 4, y: p.y + 10 }, m.radius, '#061a22aa');
  if (p.dashTime > 0) circle(ctx, p, m.radius + 12, '#abefd955');
  circle(ctx, p, m.radius + 3, '#d8f6de');
  circle(ctx, p, m.radius, p.invincible > 0 ? '#fff3d3' : '#62c9b8');
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.facing.y, p.facing.x));
  ctx.fillStyle = '#142c34'; ctx.fillRect(5, -9, 9, 18); ctx.fillStyle = '#edd7a1'; ctx.fillRect(10, 8, 23, 6); ctx.restore();
  if (m.has('crown')) label(ctx, '♛', p.x, p.y - 26, 23, '#ffe789');
  if (m.has('bag')) { circle(ctx, { x: p.x - 18, y: p.y + 9 }, 11, '#ad93da'); }
  for (const f of m.effects) {
    if (f.kind === 'ice') continue;
    ctx.save(); ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
    if (f.kind === 'shot' && f.to) { ctx.strokeStyle = '#fbe9a5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.to.x, f.to.y); ctx.stroke(); }
    else { ctx.strokeStyle = f.kind === 'hit' ? '#ff8e7e' : '#d7edbe'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 15 + (1 - f.life / f.max) * 100, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
  // Exit direction stays visible even while exploring far away.
  const exitX = (MAP.exit.x - cx) * scale, exitY = (MAP.exit.y - cy) * scale;
  if (exitX < 30 || exitX > width - 30 || exitY < 30 || exitY > height - 30) {
    const x = Math.max(50, Math.min(width - 50, exitX)), y = Math.max(40, Math.min(height - 45, exitY));
    circle(ctx, { x, y }, 26, '#173f3aee'); label(ctx, '撤离', x, y + 6, 16, '#b7f4d1');
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(exitY - y, exitX - x)); ctx.fillStyle = '#b7f4d1'; ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(24, -5); ctx.lineTo(24, 5); ctx.fill(); ctx.restore();
  }
  const miniW = Math.min(135, width * .25), miniH = miniW * MAP.height / MAP.width, mx = width - miniW - 14, my = 14;
  ctx.fillStyle = '#071e26df'; ctx.fillRect(mx, my, miniW, miniH);
  const point = (v: Vec): Vec => ({ x: mx + v.x / MAP.width * miniW, y: my + v.y / MAP.height * miniH });
  walls.forEach(w => { ctx.fillStyle = '#546c66'; const pos = point(w); ctx.fillRect(pos.x, pos.y, w.w / MAP.width * miniW, w.h / MAP.height * miniH); });
  m.loot.forEach(l => circle(ctx, point(l), 2, relics[l.type].color));
  circle(ctx, point(MAP.exit), 5, '#83edb5'); circle(ctx, point(p), 4, '#ffffff');
  if (m.elapsed > 240) label(ctx, '封锁将至', width / 2, 32, 20, '#ffb49b');
}
