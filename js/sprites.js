// 2D Pixel Art Sprite Renderer — Lineage II: Reborn

import { sharedSpriteCache, getAnimFrame } from './sprite-cache.js';
import { getEntityRenderer } from './entity-renderer.js';

export { RACE_PALETTE, CLASS_PALETTE } from './pixel-data.js';
export { getEntityRenderer } from './entity-renderer.js';

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

function drawPixelSprite(ctx, sprite, x, y, opts = {}) {
  const { flipX = false, animTime = 0, moving = false, bob = 0, cacheId = 'sprite' } = opts;
  const scale = sprite.scale || 2.5;
  const frameIdx = getAnimFrame(animTime, moving, sprite.frames.length);
  const baked = sharedSpriteCache.bake(cacheId, sprite, frameIdx, scale, flipX);
  sharedSpriteCache.drawShadow(ctx, x, y, baked, { bob });
  sharedSpriteCache.draw(ctx, baked, x, y, { bob });
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

      // Tile border + path cracks
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(sx, sy + grid - 1, grid, 1);
      ctx.fillRect(sx + grid - 1, sy, 1, grid);

      // Worn path between tiles
      if (h1 > 0.4 && h1 < 0.48) {
        ctx.fillStyle = shade(ground, -12);
        ctx.fillRect(sx + grid / 2 - 4, sy, 8, grid);
      }

      // Small puddles in ruins/dark zones
      if (zone.id !== 'talking_island' && h1 > 0.75 && h1 < 0.8) {
        ctx.fillStyle = 'rgba(60,80,120,0.25)';
        ctx.beginPath();
        ctx.ellipse(sx + 24, sy + 28, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
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

// ===== ENTITIES (via EntityRenderer + bitmap cache) =====
export function drawPlayer(ctx, x, y, opts) {
  getEntityRenderer().drawPlayer(ctx, x, y, opts);
}

export function drawMonster(ctx, x, y, monster, opts) {
  getEntityRenderer().drawMonster(ctx, x, y, monster, opts);
}

export function drawNpc(ctx, x, y, npc, time) {
  getEntityRenderer().drawNpc(ctx, x, y, npc, time);
}

// ===== EFFECTS =====
export function drawProjectile(ctx, proj, cx, cy) {
  const px = proj.x - cx;
  const py = proj.y - cy;
  ctx.save();
  ctx.imageSmoothingEnabled = true;

  // Glow core
  const g = ctx.createRadialGradient(px, py, 0, px, py, 12);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, proj.color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = proj.color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = proj.color;
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();

  // Motion trail
  const tx = proj.tx ?? proj.x;
  const ty = proj.ty ?? proj.y;
  const angle = Math.atan2(ty - proj.y, tx - proj.x);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = proj.color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - Math.cos(angle) * 14, py - Math.sin(angle) * 14);
  ctx.stroke();
  ctx.restore();
}

export function drawParticle(ctx, part, cx, cy) {
  ctx.save();
  ctx.globalAlpha = part.life;
  ctx.imageSmoothingEnabled = true;
  const px = part.x - cx;
  const py = part.y - cy;
  const s = 2 + (1 - part.life) * 5;
  const g = ctx.createRadialGradient(px, py, 0, px, py, s);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.4, part.color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, s, 0, Math.PI * 2);
  ctx.fill();
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
