// 2D Pixel Art Sprite Renderer — Lineage II: Reborn

import { getPlayerSprite, getMonsterSprite, OUTLINE } from './pixel-data.js';

export { RACE_PALETTE, CLASS_PALETTE } from './pixel-data.js';

function hash(x, y) {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ===== PIXEL SPRITE ENGINE =====
function drawPixelFrame(ctx, rows, palette, x, y, scale, flipX) {
  ctx.imageSmoothingEnabled = false;
  const h = rows.length;
  const w = rows[0].length;
  const ox = x - (w * scale) / 2;
  const oy = y - (h * scale) / 2;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const ci = flipX ? w - 1 - col : col;
      const ch = rows[row][ci];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(ox + col * scale), Math.round(oy + row * scale), Math.ceil(scale), Math.ceil(scale));
    }
  }
}

function drawSpriteShadow(ctx, x, y, spriteW, spriteH, scale) {
  const sw = spriteW * scale * 0.55;
  const sh = spriteH * scale * 0.12;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + spriteH * scale * 0.38, sw, sh, 0, 0, Math.PI * 2);
  ctx.fill();
}

function getAnimFrame(animTime, moving, frameCount) {
  if (!moving || frameCount <= 1) return 0;
  return Math.floor(animTime * 8) % frameCount;
}

function drawPixelSprite(ctx, sprite, x, y, opts = {}) {
  const { flipX = false, animTime = 0, moving = false, bob = 0 } = opts;
  const scale = sprite.scale || 2.5;
  const frameIdx = getAnimFrame(animTime, moving, sprite.frames.length);
  const rows = sprite.frames[frameIdx];
  const h = rows.length;
  const w = sprite.w || rows[0].length;

  drawSpriteShadow(ctx, x, y + bob, w, h, scale);
  drawPixelFrame(ctx, rows, sprite.palette, x, y + bob, scale, flipX);
}

// ===== TERRAIN =====
export function drawTerrain(ctx, zone, cx, cy, w, h) {
  const grid = 48;
  const startGX = Math.floor(cx / grid) * grid;
  const startGY = Math.floor(cy / grid) * grid;
  const ground = zone.groundColor || '#2d5a3d';
  const g1 = shade(ground, 22);
  const g2 = ground;
  const g3 = shade(ground, -18);
  const g4 = shade(ground, -35);

  ctx.imageSmoothingEnabled = false;

  for (let gx = startGX; gx < cx + w + grid; gx += grid) {
    for (let gy = startGY; gy < cy + h + grid; gy += grid) {
      const sx = gx - cx;
      const sy = gy - cy;
      const h1 = hash(gx, gy);
      const variant = Math.floor(h1 * 4);

      const colors = [g1, g2, g3, g4];
      ctx.fillStyle = colors[variant];
      ctx.fillRect(sx, sy, grid, grid);

      // Pixel grass dots
      ctx.fillStyle = shade(ground, 35);
      for (let i = 0; i < 5; i++) {
        const px = sx + 6 + (h1 * 37 + i * 11) % (grid - 8);
        const py = sy + 6 + (h1 * 53 + i * 17) % (grid - 8);
        ctx.fillRect(px, py, 2, 2);
        ctx.fillRect(px + 1, py - 2, 1, 2);
      }

      // Flowers / stones
      if (h1 > 0.88) {
        const fx = sx + (h1 * 30) % grid;
        const fy = sy + (h1 * 20) % grid;
        if (h1 > 0.94) {
          ctx.fillStyle = h1 > 0.97 ? '#ddcc55' : '#cc5555';
          ctx.fillRect(fx, fy, 3, 3);
          ctx.fillStyle = '#44aa44';
          ctx.fillRect(fx + 1, fy + 3, 1, 3);
        } else {
          ctx.fillStyle = '#777777';
          ctx.fillRect(fx, fy, 5, 4);
          ctx.fillStyle = '#999999';
          ctx.fillRect(fx + 1, fy, 3, 2);
        }
      }

      // Tile border
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(sx, sy + grid - 1, grid, 1);
      ctx.fillRect(sx + grid - 1, sy, 1, grid);
    }
  }

  const lightGrad = ctx.createRadialGradient(w / 2, h / 3, 30, w / 2, h / 2, Math.max(w, h) * 0.65);
  lightGrad.addColorStop(0, 'rgba(255,248,220,0.06)');
  lightGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(0, 0, w, h);
}

// ===== PORTAL =====
export function drawPortal(ctx, x, y, label, time) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;

  const pulse = 0.6 + Math.sin(time / 350) * 0.25;
  const r = 26 + Math.sin(time / 280) * 5;

  // Ground glow
  const g = ctx.createRadialGradient(x, y, 0, x, y, r + 14);
  g.addColorStop(0, `rgba(120,200,255,${0.5 * pulse})`);
  g.addColorStop(0.5, `rgba(60,120,255,${0.2 * pulse})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r + 14, 0, Math.PI * 2);
  ctx.fill();

  // Ring segments (pixel style)
  ctx.strokeStyle = '#88ccff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#4488ff';
  ctx.shadowBlur = 12;
  for (let i = 0; i < 8; i++) {
    const a1 = time / 600 + i * (Math.PI / 4);
    const a2 = a1 + Math.PI / 5;
    ctx.beginPath();
    ctx.arc(x, y, r, a1, a2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Orbiting particles
  for (let i = 0; i < 8; i++) {
    const a = time / 700 + i * (Math.PI * 2 / 8);
    const px = x + Math.cos(a) * (r + 6);
    const py = y + Math.sin(a) * (r + 6);
    ctx.fillStyle = i % 2 ? '#ffffff' : '#aaccff';
    ctx.fillRect(px - 2, py - 2, 4, 4);
  }

  // Center crystal
  ctx.fillStyle = `rgba(200,240,255,${pulse})`;
  ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 2, y - 2, 4, 4);

  ctx.fillStyle = '#ddeeFF';
  ctx.font = 'bold 11px Roboto';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.fillText(label || '→', x, y + r + 22);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ===== UI HELPERS =====
function drawNameplate(ctx, x, y, name, level, isTarget, offsetY) {
  const top = y - offsetY;

  // Background pill
  ctx.font = 'bold 11px Roboto';
  const tw = ctx.measureText(name).width + 12;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - tw / 2, top - 12, tw, 16);

  ctx.textAlign = 'center';
  ctx.fillStyle = isTarget ? '#ff8888' : '#f0e8d0';
  ctx.fillText(name, x, top);

  if (level) {
    ctx.font = 'bold 9px Roboto';
    ctx.fillStyle = '#88dd88';
    ctx.fillText(`Lv.${level}`, x, top - 14);
  }
}

function drawHpBar(ctx, x, y, pct, bw = 48) {
  const bx = x - bw / 2;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(bx - 1, y - 1, bw + 2, 7);
  ctx.fillStyle = '#333';
  ctx.fillRect(bx, y, bw, 5);

  const grad = ctx.createLinearGradient(bx, y, bx + bw, y);
  if (pct > 0.5) {
    grad.addColorStop(0, '#cc2222');
    grad.addColorStop(1, '#ff4444');
  } else if (pct > 0.25) {
    grad.addColorStop(0, '#cc4400');
    grad.addColorStop(1, '#ff6600');
  } else {
    grad.addColorStop(0, '#880000');
    grad.addColorStop(1, '#ff0000');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(bx, y, bw * Math.max(0, pct), 5);

  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, y, bw, 5);
}

function drawTargetRing(ctx, x, y, r, time) {
  ctx.save();
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 8;
  ctx.setLineDash([5, 4]);
  ctx.lineDashOffset = -time / 40;
  ctx.beginPath();
  ctx.arc(x, y, r + 6 + Math.sin(time / 180) * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ===== ENTITIES =====
export function drawPlayer(ctx, x, y, opts) {
  const { raceId, classId, facing, animTime, moving, isTarget, name, time } = opts;
  const sprite = getPlayerSprite(raceId, classId);
  const bob = moving ? Math.sin(animTime * 14) * 1.5 : Math.sin(time / 450) * 0.8;

  if (isTarget) drawTargetRing(ctx, x, y + bob, 24, time);

  drawPixelSprite(ctx, sprite, x, y, {
    flipX: facing < 0,
    animTime,
    moving,
    bob,
  });

  if (name) drawNameplate(ctx, x, y, name, null, isTarget, 42);
}

export function drawMonster(ctx, x, y, monster, opts) {
  const { isTarget, time } = opts;
  const spriteKey = monster.id === 'orc_shaman' ? 'orc_shaman' : monster.id;
  let sprite = getMonsterSprite(spriteKey);
  const baseScale = sprite.scale || 2.5;
  const sizeScale = (monster.size || 28) / 28;
  const scale = baseScale * sizeScale;

  const moving = monster.aggro && monster.alive;
  const bob = moving ? Math.sin((monster.animTime || 0) * 12) * 1.2 : 0;
  const facing = monster.facing || 1;

  // Boss aura
  if (monster.boss) {
    const aura = ctx.createRadialGradient(x, y, 5, x, y, 50 * sizeScale);
    aura.addColorStop(0, `rgba(255,60,0,${0.15 + Math.sin(time / 400) * 0.08})`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, 50 * sizeScale, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isTarget) drawTargetRing(ctx, x, y + bob, 18 * sizeScale, time);

  drawPixelSprite(ctx, { ...sprite, scale }, x, y, {
    flipX: facing < 0,
    animTime: monster.animTime || 0,
    moving,
    bob,
  });

  const barY = y - 20 * sizeScale + bob;
  drawHpBar(ctx, x, barY, monster.hp / monster.maxHp, 48 * sizeScale);
  drawNameplate(ctx, x, y, monster.name, monster.level, isTarget, 28 * sizeScale + 18);
}

export function drawNpc(ctx, x, y, npc, time) {
  const sprite = getMonsterSprite('npc');
  const bob = Math.sin(time / 500 + x * 0.01) * 1;

  drawPixelSprite(ctx, sprite, x, y, { bob, animTime: time / 1000, moving: false });

  // Quest glow
  ctx.fillStyle = 'rgba(255,204,0,0.3)';
  ctx.beginPath();
  ctx.arc(x, y - 38, 8 + Math.sin(time / 300) * 2, 0, Math.PI * 2);
  ctx.fill();

  drawNameplate(ctx, x, y, npc.name, null, false, 40);
}

// ===== EFFECTS =====
export function drawProjectile(ctx, proj, cx, cy) {
  const px = proj.x - cx;
  const py = proj.y - cy;
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.shadowColor = proj.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = proj.color;
  ctx.fillRect(px - 4, py - 4, 8, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px - 2, py - 2, 4, 4);

  // Trail
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = proj.color;
  ctx.fillRect(px - 8, py - 2, 6, 4);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawParticle(ctx, part, cx, cy) {
  ctx.save();
  ctx.globalAlpha = part.life;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = part.color;
  const s = Math.ceil(2 + (1 - part.life) * 4);
  ctx.fillRect(part.x - cx - s / 2, part.y - cy - s / 2, s, s);
  ctx.restore();
}

export function drawMoveMarker(ctx, x, y, cx, cy, time) {
  const px = x - cx;
  const py = y - cy;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const pulse = 0.5 + Math.sin(time / 180) * 0.3;
  ctx.strokeStyle = `rgba(255,220,50,${pulse})`;
  ctx.lineWidth = 2;
  const r = 8 + Math.sin(time / 140) * 3;
  ctx.strokeRect(px - r, py - r, r * 2, r * 2);
  ctx.fillStyle = `rgba(255,220,50,${pulse * 0.4})`;
  ctx.fillRect(px - 3, py - 3, 6, 6);
  ctx.restore();
}

// Legacy exports for compatibility
export const CLASS_STYLE = {};
