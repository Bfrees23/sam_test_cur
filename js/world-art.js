// HD world rendering — parallax, decorations, ambient effects

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

const ZONE_ATMO = {
  talking_island: { sky: ['#1a2840', '#2a4060', '#4a7090'], fog: 'rgba(120,180,220,0.04)', particles: 'firefly' },
  gludio_ruins:   { sky: ['#0a0818', '#1a1428', '#2a2438'], fog: 'rgba(80,60,120,0.06)', particles: 'dust' },
  orc_barracks:   { sky: ['#180808', '#281010', '#402018'], fog: 'rgba(180,80,40,0.05)', particles: 'ember' },
  windy_plains:   { sky: ['#202018', '#383028', '#585040'], fog: 'rgba(200,180,120,0.04)', particles: 'wind' },
  dragon_valley:  { sky: ['#100004', '#200008', '#400010'], fog: 'rgba(255,60,20,0.07)', particles: 'ember' },
};

// ===== PARALLAX SKY =====
export function drawParallax(ctx, zone, cx, cy, w, h, time) {
  const atmo = ZONE_ATMO[zone.id] || ZONE_ATMO.talking_island;
  const [c1, c2, c3] = atmo.sky;

  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  grad.addColorStop(0, c1);
  grad.addColorStop(0.5, c2);
  grad.addColorStop(1, c3);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 0.55);

  // Stars (night / dark zones)
  if (zone.id !== 'talking_island' && zone.id !== 'windy_plains') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const sx = (hash(i * 3, i * 7) * w + time * 0.008 * (i % 3 + 1)) % w;
      const sy = hash(i * 11, i * 5) * h * 0.42;
      const tw = 0.4 + Math.sin(time / 900 + i) * 0.35;
      ctx.globalAlpha = tw;
      const sz = hash(i, i * 2) > 0.85 ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // Distant mountains
  ctx.fillStyle = shade(c2, -20);
  for (let i = 0; i < 6; i++) {
    const mx = ((i * 400 - cx * 0.15) % (w + 400)) - 200;
    const mh = 80 + hash(i, zone.id.charCodeAt(0)) * 60;
    ctx.beginPath();
    ctx.moveTo(mx, h * 0.45);
    ctx.lineTo(mx + 120, h * 0.45 - mh);
    ctx.lineTo(mx + 280, h * 0.45);
    ctx.fill();
  }

  // Clouds / mist layers
  ctx.fillStyle = atmo.fog;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    const cx2 = ((i * 300 + time * 0.02 * (i + 1) - cx * 0.08) % (w + 200)) - 100;
    const cy2 = 40 + i * 35 + Math.sin(time / 2000 + i) * 10;
    ctx.fillStyle = `rgba(255,255,255,${0.02 + i * 0.01})`;
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, 80 + i * 20, 20 + i * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== DECORATIONS =====
const DECO_SPRITES = {
  tree: drawTree,
  pine: drawPine,
  rock: drawRock,
  ruin: drawRuin,
  crystal: drawCrystal,
  bones: drawBones,
  torch: drawTorch,
  banner: drawBanner,
};

export function generateZoneDecorations(zone) {
  const types = {
    talking_island: ['tree', 'tree', 'rock', 'pine', 'torch'],
    gludio_ruins:   ['ruin', 'rock', 'bones', 'ruin', 'torch'],
    orc_barracks:   ['banner', 'rock', 'torch', 'banner', 'rock'],
    windy_plains:   ['rock', 'rock', 'bones', 'banner'],
    dragon_valley:  ['crystal', 'rock', 'bones', 'crystal', 'ruin'],
  }[zone.id] || ['tree', 'rock'];

  const decs = [];
  const count = Math.floor(zone.width * zone.height / 80000);
  for (let i = 0; i < count; i++) {
    const h = hash(i * 7, i * 13 + zone.id.length);
    const h2 = hash(i * 11, i * 17);
    decs.push({
      type: types[Math.floor(h * types.length)],
      x: 80 + h2 * (zone.width - 160),
      y: 80 + h * (zone.height - 160),
      scale: 0.8 + h * 0.6,
      seed: i,
    });
  }
  return decs;
}

export function drawDecorations(ctx, decorations, cx, cy, time) {
  const sorted = decorations
    .filter(d => d.x > cx - 100 && d.x < cx + ctx.canvas.width + 100 && d.y > cy - 100 && d.y < ctx.canvas.height + 100)
    .sort((a, b) => a.y - b.y);

  for (const d of sorted) {
    const fn = DECO_SPRITES[d.type];
    if (fn) fn(ctx, d.x - cx, d.y - cy, d.scale, d.seed, time);
  }
}

function drawTree(ctx, x, y, s, seed, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Trunk
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(-4, -8, 8, 20);
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(-3, -6, 6, 16);
  // Foliage layers
  const sway = Math.sin(time / 800 + seed) * 2;
  ctx.fillStyle = '#2a6a3a';
  ctx.beginPath();
  ctx.moveTo(-20 + sway, -8);
  ctx.lineTo(0 + sway, -38);
  ctx.lineTo(20 + sway, -8);
  ctx.fill();
  ctx.fillStyle = '#3a8a4a';
  ctx.beginPath();
  ctx.moveTo(-16 + sway * 0.7, -14);
  ctx.lineTo(0 + sway * 0.7, -32);
  ctx.lineTo(16 + sway * 0.7, -14);
  ctx.fill();
  ctx.fillStyle = '#4aaa5a';
  ctx.beginPath();
  ctx.arc(0 + sway * 0.5, -28, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPine(ctx, x, y, s, seed, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(-3, -4, 6, 16);
  const sway = Math.sin(time / 900 + seed) * 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#1a4a2a', '#2a6a3a', '#3a8a4a'][i];
    const w = 22 - i * 4;
    const top = -10 - i * 12;
    ctx.beginPath();
    ctx.moveTo(-w + sway, top + 14);
    ctx.lineTo(sway, top);
    ctx.lineTo(w + sway, top + 14);
    ctx.fill();
  }
  ctx.restore();
}

function drawRock(ctx, x, y, s, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 6, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const r = 10 + (seed % 5);
  ctx.fillStyle = '#666677';
  ctx.beginPath();
  ctx.moveTo(-r, 4);
  ctx.lineTo(-r * 0.6, -r * 0.8);
  ctx.lineTo(r * 0.3, -r);
  ctx.lineTo(r, -r * 0.3);
  ctx.lineTo(r * 0.8, 4);
  ctx.fill();
  ctx.fillStyle = '#888899';
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.5);
  ctx.lineTo(0, -r * 0.9);
  ctx.lineTo(r * 0.4, -r * 0.4);
  ctx.fill();
  ctx.restore();
}

function drawRuin(ctx, x, y, s, seed, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-16, 6, 32, 6);
  ctx.fillStyle = '#555566';
  ctx.fillRect(-14, -20, 8, 28);
  ctx.fillRect(6, -14, 8, 22);
  ctx.fillRect(-6, -8, 20, 6);
  ctx.fillStyle = '#666677';
  ctx.fillRect(-12, -22, 6, 4);
  ctx.fillStyle = '#777788';
  ctx.globalAlpha = 0.3 + Math.sin(time / 1000 + seed) * 0.1;
  ctx.fillRect(-2, -18, 4, 4);
  ctx.globalAlpha = 1;
  // Moss
  ctx.fillStyle = '#3a5a3a';
  ctx.fillRect(-14, 2, 10, 4);
  ctx.fillRect(6, 4, 8, 3);
  ctx.restore();
}

function drawCrystal(ctx, x, y, s, seed, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const pulse = 0.6 + Math.sin(time / 400 + seed) * 0.4;
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur = 12 * pulse;
  ctx.fillStyle = `rgba(255,60,40,${0.7 * pulse})`;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(-10, 8);
  ctx.lineTo(10, 8);
  ctx.fill();
  ctx.fillStyle = `rgba(255,150,100,${0.5 * pulse})`;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(-6, 4);
  ctx.lineTo(6, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBones(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, 4);
  ctx.lineTo(10, -4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-12, 4, 4, 0, Math.PI * 2);
  ctx.arc(12, -4, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ddd';
  ctx.fill();
  ctx.restore();
}

function drawTorch(ctx, x, y, s, seed, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#664422';
  ctx.fillRect(-2, -8, 4, 20);
  const flicker = Math.sin(time / 80 + seed * 3) * 3;
  ctx.shadowColor = '#ff8800';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.ellipse(0, -12 + flicker * 0.2, 6 + flicker * 0.3, 10 + flicker * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.ellipse(0, -14 + flicker * 0.2, 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBanner(ctx, x, y, s, seed, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#553311';
  ctx.fillRect(-2, -24, 4, 32);
  const wave = Math.sin(time / 500 + seed) * 3;
  ctx.fillStyle = '#aa2222';
  ctx.beginPath();
  ctx.moveTo(2, -22);
  ctx.lineTo(18 + wave, -16);
  ctx.lineTo(2, -8);
  ctx.fill();
  ctx.fillStyle = '#cc4444';
  ctx.beginPath();
  ctx.moveTo(2, -20);
  ctx.lineTo(14 + wave, -16);
  ctx.lineTo(2, -10);
  ctx.fill();
  ctx.restore();
}

// ===== AMBIENT PARTICLES =====
export function initAmbientParticles(zone) {
  const atmo = ZONE_ATMO[zone.id] || ZONE_ATMO.talking_island;
  const particles = [];
  const count = 30;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * zone.width,
      y: Math.random() * zone.height,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      life: Math.random(),
      type: atmo.particles,
      size: 1 + Math.random() * 2,
    });
  }
  return particles;
}

export function updateAmbientParticles(particles, zone, dt) {
  for (const p of particles) {
    p.life += dt * 0.3;
    if (p.type === 'firefly') {
      p.x += Math.sin(p.life * 2) * 30 * dt;
      p.y += Math.cos(p.life * 1.5) * 20 * dt;
    } else if (p.type === 'ember' || p.type === 'dust') {
      p.x += p.vx * dt;
      p.y += p.vy * dt - (p.type === 'ember' ? 15 * dt : 0);
    } else if (p.type === 'wind') {
      p.x += 40 * dt;
      p.y += Math.sin(p.life) * 10 * dt;
    }
    if (p.x < 0) p.x = zone.width;
    if (p.x > zone.width) p.x = 0;
    if (p.y < 0) p.y = zone.height;
    if (p.y > zone.height) p.y = 0;
  }
}

export function drawAmbientParticles(ctx, particles, cx, cy, w, h, time) {
  for (const p of particles) {
    const sx = p.x - cx;
    const sy = p.y - cy;
    if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;

    const alpha = 0.3 + Math.sin(p.life * 3) * 0.3;
    if (p.type === 'firefly') {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.size * 3);
      g.addColorStop(0, `rgba(220,255,140,${alpha})`);
      g.addColorStop(1, 'rgba(100,200,50,0)');
      ctx.fillStyle = g;
    } else if (p.type === 'ember') {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.size * 4);
      g.addColorStop(0, `rgba(255,180,80,${alpha})`);
      g.addColorStop(0.5, `rgba(255,80,30,${alpha * 0.5})`);
      g.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = g;
    } else if (p.type === 'dust') {
      ctx.fillStyle = `rgba(180,160,200,${alpha * 0.5})`;
    } else {
      ctx.fillStyle = `rgba(200,180,140,${alpha * 0.4})`;
    }
    if (p.type === 'firefly' || p.type === 'ember') {
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(sx, sy, p.size, p.size);
    }
  }
}

// Skill FX for other players
export function drawRemoteSkillFx(ctx, fx, cx, cy, time) {
  const x = fx.x - cx;
  const y = fx.y - cy;
  const age = (time - fx.startTime) / 1000;
  if (age > 1) return false;

  ctx.save();
  ctx.globalAlpha = 1 - age;
  const r = 10 + age * 35;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(255,220,120,0.9)');
  g.addColorStop(0.4, 'rgba(255,140,40,0.4)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffcc66';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  return true;
}
