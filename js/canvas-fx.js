// Canvas rendering pipeline — HiDPI, tile cache, lighting, post-FX

const TILE = 48;
const VARIANTS = 12;

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

const ZONE_AMBIENT = {
  talking_island: { r: 200, g: 210, b: 230, a: 0.12 },
  gludio_ruins:   { r: 100, g: 90,  b: 140, a: 0.32 },
  orc_barracks:   { r: 160, g: 120, b: 90,  a: 0.28 },
  windy_plains:   { r: 190, g: 180, b: 150, a: 0.18 },
  dragon_valley:  { r: 180, g: 80,  b: 60,  a: 0.34 },
};

const ZONE_TINT = {
  talking_island: 'rgba(120,180,255,0.04)',
  gludio_ruins:   'rgba(100,80,160,0.08)',
  orc_barracks:   'rgba(255,120,60,0.06)',
  windy_plains:   'rgba(220,200,140,0.05)',
  dragon_valley:  'rgba(255,60,30,0.09)',
};

// ===== HiDPI CANVAS =====
export function setupHiDpiCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return { w, h, dpr, ctx };
  }

  return { resize, dpr };
}

// ===== TERRAIN TILE CACHE (offscreen canvas) =====
export class TerrainTileCache {
  constructor(zone) {
    this.zone = zone;
    this.tiles = [];
    const scratch = document.createElement('canvas');
    scratch.width = TILE;
    scratch.height = TILE;
    this.sctx = scratch.getContext('2d');

    for (let v = 0; v < VARIANTS; v++) {
      this.renderTile(v);
      const tile = document.createElement('canvas');
      tile.width = TILE;
      tile.height = TILE;
      tile.getContext('2d').drawImage(scratch, 0, 0);
      this.tiles.push(tile);
    }
  }

  renderTile(variant) {
    const ctx = this.sctx;
    const zone = this.zone;
    const ground = zone.groundColor || '#2d5a3d';
    const g1 = shade(ground, 28);
    const g2 = shade(ground, 8);
    const g3 = ground;
    const g4 = shade(ground, -22);
    const g5 = shade(ground, -38);
    const colors = [g1, g2, g3, g4, g5];

    ctx.clearRect(0, 0, TILE, TILE);
    ctx.imageSmoothingEnabled = false;

    // Dithered base
    for (let y = 0; y < TILE; y += 4) {
      for (let x = 0; x < TILE; x += 4) {
        const h = hash(x + variant * 17, y + variant * 31);
        ctx.fillStyle = colors[Math.floor(h * colors.length)];
        ctx.fillRect(x, y, 4, 4);
      }
    }

    // Grass blades
    ctx.strokeStyle = shade(ground, 42);
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const h = hash(i * 3 + variant, i * 7 + variant * 2);
      const px = 4 + (h * 37 + i * 9) % (TILE - 8);
      const py = 4 + (h * 53 + i * 13) % (TILE - 8);
      ctx.beginPath();
      ctx.moveTo(px, py + 4);
      ctx.lineTo(px + (h > 0.5 ? 1 : -1), py - (2 + h * 3));
      ctx.stroke();
    }

    // Pebbles / flowers
    const h0 = hash(variant, zone.id.length);
    if (h0 > 0.72) {
      const fx = 8 + (h0 * 28) % (TILE - 16);
      const fy = 10 + (h0 * 22) % (TILE - 16);
      if (h0 > 0.9) {
        ctx.fillStyle = h0 > 0.95 ? '#eedd55' : '#dd5555';
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(ground, 35);
        ctx.fillRect(fx, fy + 2, 1, 4);
      } else {
        ctx.fillStyle = '#777788';
        ctx.beginPath();
        ctx.ellipse(fx, fy, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9999aa';
        ctx.fillRect(fx - 2, fy - 2, 4, 2);
      }
    }

    // Zone-specific details
    if (zone.id === 'gludio_ruins' && variant % 3 === 0) {
      ctx.fillStyle = '#3a5a4a';
      ctx.fillRect(6, TILE - 10, 18, 4);
      ctx.fillRect(TILE - 20, 8, 12, 3);
    }
    if (zone.id === 'dragon_valley' && variant % 4 === 0) {
      ctx.strokeStyle = 'rgba(255,80,40,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, TILE / 2);
      ctx.lineTo(20, 12);
      ctx.lineTo(32, TILE - 8);
      ctx.stroke();
    }
    if (zone.id === 'orc_barracks' && variant % 5 === 0) {
      ctx.fillStyle = 'rgba(80,50,30,0.25)';
      ctx.fillRect(0, TILE - 6, TILE, 6);
    }

    // Path wear
    if (h0 > 0.38 && h0 < 0.48) {
      ctx.fillStyle = shade(ground, -14);
      ctx.fillRect(TILE / 2 - 5, 0, 10, TILE);
    }

    // Puddles
    if (zone.id !== 'talking_island' && h0 > 0.58 && h0 < 0.64) {
      ctx.fillStyle = 'rgba(60,90,130,0.3)';
      ctx.beginPath();
      ctx.ellipse(24, 28, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,210,255,0.15)';
      ctx.beginPath();
      ctx.ellipse(20, 26, 4, 2, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tile edge shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, TILE - 1, TILE, 1);
    ctx.fillRect(TILE - 1, 0, 1, TILE);
  }

  draw(ctx, cx, cy, w, h) {
    const startGX = Math.floor(cx / TILE) * TILE;
    const startGY = Math.floor(cy / TILE) * TILE;

    ctx.imageSmoothingEnabled = false;
    for (let gx = startGX; gx < cx + w + TILE; gx += TILE) {
      for (let gy = startGY; gy < cy + h + TILE; gy += TILE) {
        const sx = gx - cx;
        const sy = gy - cy;
        const variant = Math.floor(hash(gx, gy) * VARIANTS);
        ctx.drawImage(this.tiles[variant], sx, sy);
      }
    }

    const ground = this.zone.groundColor || '#2d5a3d';
    const lightGrad = ctx.createRadialGradient(w / 2, h / 3, 20, w / 2, h / 2, Math.max(w, h) * 0.7);
    lightGrad.addColorStop(0, 'rgba(255,248,220,0.08)');
    lightGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

// ===== DYNAMIC LIGHTING =====
export function gatherLights(state, time) {
  const lights = [];
  const zone = state.zone;
  if (!zone || !state.player) return lights;

  for (const d of state.decorations || []) {
    if (d.type === 'torch') {
      lights.push({
        x: d.x, y: d.y - 14 * d.scale,
        r: 150 * d.scale,
        color: 'rgba(255,180,80,0.95)',
        colorMid: 'rgba(255,100,30,0.15)',
        intensity: 0.55,
        flicker: true,
        phase: d.seed,
      });
    } else if (d.type === 'crystal') {
      const pulse = 0.7 + Math.sin(time / 400 + d.seed) * 0.3;
      lights.push({
        x: d.x, y: d.y - 8 * d.scale,
        r: 120 * d.scale * pulse,
        color: 'rgba(255,90,50,0.9)',
        colorMid: 'rgba(255,40,20,0.12)',
        intensity: 0.5 * pulse,
        flicker: true,
        phase: d.seed + 1,
      });
    }
  }

  for (const conn of zone.connections || []) {
    lights.push({
      x: conn.x, y: conn.y,
      r: 130,
      color: 'rgba(120,200,255,0.85)',
      colorMid: 'rgba(60,120,255,0.12)',
      intensity: 0.45,
      flicker: false,
    });
  }

  for (const npc of state.npcs || []) {
    if (npc.type === 'shop' || npc.type === 'teleport') {
      lights.push({
        x: npc.x, y: npc.y - 20,
        r: 90,
        color: 'rgba(255,220,120,0.7)',
        colorMid: 'rgba(255,180,60,0.08)',
        intensity: 0.35,
        flicker: false,
      });
    }
  }

  // Soft player lantern
  lights.push({
    x: state.player.x, y: state.player.y - 10,
    r: 100,
    color: 'rgba(255,230,200,0.35)',
    colorMid: 'rgba(255,200,150,0.05)',
    intensity: 0.3,
    flicker: false,
  });

  return lights;
}

export function applyLighting(ctx, lights, cx, cy, w, h, zoneId, time) {
  const ambient = ZONE_AMBIENT[zoneId] || ZONE_AMBIENT.talking_island;

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${ambient.r},${ambient.g},${ambient.b},${ambient.a})`;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'screen';
  for (const light of lights) {
    const sx = light.x - cx;
    const sy = light.y - cy;
    if (sx < -light.r || sx > w + light.r || sy < -light.r || sy > h + light.r) continue;

    const flicker = light.flicker
      ? 0.82 + Math.sin(time / 70 + (light.phase || 0) * 2.1) * 0.18
      : 1;

    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, light.r);
    g.addColorStop(0, light.color);
    g.addColorStop(0.45, light.colorMid || 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.globalAlpha = (light.intensity || 0.5) * flicker;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, light.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ===== POST-PROCESSING =====
export function applyPostFX(ctx, w, h, zoneId, time) {
  const tint = ZONE_TINT[zoneId];
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
  }

  // Vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.65, 'rgba(0,0,0,0.08)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Subtle scanline shimmer
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#ffffff';
  for (let y = (time / 40) % 4; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.restore();
}

// ===== ENHANCED MINIMAP (canvas) =====
export function renderEnhancedMinimap(mctx, state) {
  const mw = 160, mh = 120;
  const zone = state.zone;
  if (!zone) return;

  const sx = mw / zone.width;
  const sy = mh / zone.height;

  // Background with zone gradient
  const bg = mctx.createLinearGradient(0, 0, 0, mh);
  const ground = zone.groundColor || '#2a3a2a';
  bg.addColorStop(0, shade(ground, 30));
  bg.addColorStop(1, shade(ground, -30));
  mctx.fillStyle = bg;
  mctx.fillRect(0, 0, mw, mh);

  // Grid
  mctx.strokeStyle = 'rgba(255,255,255,0.06)';
  mctx.lineWidth = 1;
  for (let x = 0; x < mw; x += 20) {
    mctx.beginPath();
    mctx.moveTo(x, 0);
    mctx.lineTo(x, mh);
    mctx.stroke();
  }
  for (let y = 0; y < mh; y += 20) {
    mctx.beginPath();
    mctx.moveTo(0, y);
    mctx.lineTo(mw, y);
    mctx.stroke();
  }

  // Portals
  for (const conn of zone.connections || []) {
    mctx.fillStyle = 'rgba(100,180,255,0.8)';
    mctx.beginPath();
    mctx.arc(conn.x * sx, conn.y * sy, 3, 0, Math.PI * 2);
    mctx.fill();
  }

  // Monsters
  for (const m of state.monsters) {
    if (!m.alive) continue;
    mctx.fillStyle = m.boss ? '#ff3333' : '#cc5555';
    mctx.fillRect(m.x * sx - 1.5, m.y * sy - 1.5, 3, 3);
  }

  // NPCs
  for (const npc of state.npcs) {
    mctx.fillStyle = '#5599ff';
    mctx.fillRect(npc.x * sx - 1.5, npc.y * sy - 1.5, 3, 3);
  }

  // Other players
  for (const op of Object.values(state.otherPlayers)) {
    if (op.zone !== state.player.zone) continue;
    mctx.fillStyle = '#44ccff';
    mctx.shadowColor = '#44ccff';
    mctx.shadowBlur = 4;
    mctx.beginPath();
    mctx.arc(op.x * sx, op.y * sy, 2.5, 0, Math.PI * 2);
    mctx.fill();
    mctx.shadowBlur = 0;
  }

  // Player with glow
  const px = state.player.x * sx;
  const py = state.player.y * sy;
  const pg = mctx.createRadialGradient(px, py, 0, px, py, 8);
  pg.addColorStop(0, 'rgba(255,220,80,0.6)');
  pg.addColorStop(1, 'rgba(255,220,80,0)');
  mctx.fillStyle = pg;
  mctx.beginPath();
  mctx.arc(px, py, 8, 0, Math.PI * 2);
  mctx.fill();
  mctx.fillStyle = '#ffd700';
  mctx.beginPath();
  mctx.arc(px, py, 3, 0, Math.PI * 2);
  mctx.fill();

  // Border frame
  mctx.strokeStyle = 'rgba(201,168,76,0.5)';
  mctx.lineWidth = 1;
  mctx.strokeRect(0.5, 0.5, mw - 1, mh - 1);
}
