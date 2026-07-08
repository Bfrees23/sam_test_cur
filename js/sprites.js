// 2D Sprite Renderer — Lineage II: Reborn
// Procedural top-down character & monster models drawn on canvas

export const RACE_PALETTE = {
  human:     { skin: '#e8c4a0', hair: '#4a3020', accent: '#8899aa' },
  elf:       { skin: '#f0dcc8', hair: '#d4a843', accent: '#66aa66' },
  dark_elf:  { skin: '#c8a8b8', hair: '#e8e8f0', accent: '#6644aa' },
  orc:       { skin: '#6a8a4a', hair: '#2a3a1a', accent: '#4a5a30' },
  dwarf:     { skin: '#d4a878', hair: '#886644', accent: '#aa7744' },
};

export const CLASS_STYLE = {
  warrior:   { armor: '#667788', trim: '#c9a84c', weapon: 'sword', shield: true, cape: '#334455' },
  gladiator: { armor: '#884422', trim: '#cc6633', weapon: 'greatsword', shield: false, cape: '#552211' },
  mystic:    { armor: '#443366', trim: '#8866cc', weapon: 'staff', shield: false, cape: '#332255' },
  cleric:    { armor: '#ccccdd', trim: '#ffd700', weapon: 'mace', shield: true, cape: '#aaaacc' },
  rogue:     { armor: '#333344', trim: '#666677', weapon: 'dagger', shield: false, cape: '#222233' },
  archer:    { armor: '#445533', trim: '#88aa55', weapon: 'bow', shield: false, cape: '#334422' },
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function hash(x, y) {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
}

export function drawTerrain(ctx, zone, cx, cy, w, h) {
  const grid = 64;
  const startGX = Math.floor(cx / grid) * grid;
  const startGY = Math.floor(cy / grid) * grid;
  const ground = zone.groundColor || '#2d5a3d';
  const groundDark = shade(ground, -25);
  const groundLight = shade(ground, 18);

  for (let gx = startGX; gx < cx + w + grid; gx += grid) {
    for (let gy = startGY; gy < cy + h + grid; gy += grid) {
      const sx = gx - cx;
      const sy = gy - cy;
      const h1 = hash(gx, gy);

      const tileGrad = ctx.createLinearGradient(sx, sy, sx + grid, sy + grid);
      tileGrad.addColorStop(0, h1 > 0.5 ? groundLight : ground);
      tileGrad.addColorStop(1, groundDark);
      ctx.fillStyle = tileGrad;
      ctx.fillRect(sx, sy, grid, grid);

      if (h1 > 0.65) {
        ctx.strokeStyle = shade(ground, 30);
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const tx = sx + 12 + i * 18 + h1 * 10;
          const ty = sy + grid - 8;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.quadraticCurveTo(tx - 3, ty - 10 - h1 * 8, tx + 2, ty - 14);
          ctx.stroke();
        }
      }

      if (h1 > 0.82 && h1 < 0.88) {
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.arc(sx + 30, sy + 40, 4 + h1 * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (h1 > 0.9) {
        ctx.fillStyle = h1 > 0.95 ? '#ccaa44' : '#cc6666';
        ctx.beginPath();
        ctx.arc(sx + 45, sy + 25, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const lightGrad = ctx.createRadialGradient(w / 2, h / 3, 50, w / 2, h / 2, Math.max(w, h) * 0.7);
  lightGrad.addColorStop(0, 'rgba(255,240,200,0.04)');
  lightGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(0, 0, w, h);
}

export function drawPortal(ctx, x, y, label, time) {
  ctx.save();
  const pulse = 0.5 + Math.sin(time / 400) * 0.3;
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#66aaff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 28 + Math.sin(time / 300) * 4, 0, Math.PI * 2);
  ctx.stroke();

  const g = ctx.createRadialGradient(x, y, 2, x, y, 30);
  g.addColorStop(0, 'rgba(100,180,255,0.8)');
  g.addColorStop(0.5, 'rgba(50,100,200,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const a = time / 800 + i * (Math.PI * 2 / 6);
    ctx.fillStyle = '#aaccff';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 22, y + Math.sin(a) * 22, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#cceeff';
  ctx.font = 'bold 11px Roboto';
  ctx.textAlign = 'center';
  ctx.fillText(label || '→', x, y + 48);
  ctx.restore();
}

function drawShadow(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.35, w * 0.45, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawNameplate(ctx, x, y, name, level, isTarget, offsetY) {
  const top = y - offsetY;
  ctx.font = 'bold 11px Roboto';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(name, x + 1, top + 1);
  ctx.fillStyle = isTarget ? '#ff6666' : '#e8dcc0';
  ctx.fillText(name, x, top);
  if (level) {
    ctx.font = '9px Roboto';
    ctx.fillStyle = '#88cc88';
    ctx.fillText(`Lv.${level}`, x, top - 12);
  }
}

function drawHpBar(ctx, x, y, pct, bw = 44) {
  const bx = x - bw / 2;
  ctx.fillStyle = '#222';
  ctx.fillRect(bx, y, bw, 5);
  ctx.fillStyle = pct > 0.3 ? '#cc2222' : '#ff4400';
  ctx.fillRect(bx, y, bw * Math.max(0, pct), 5);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, y, bw, 5);
}

function drawTargetRing(ctx, x, y, r, time) {
  ctx.save();
  ctx.strokeStyle = '#ff3333';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.lineDashOffset = -time / 50;
  ctx.beginPath();
  ctx.arc(x, y, r + 8 + Math.sin(time / 200) * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawPlayer(ctx, x, y, opts) {
  const { raceId, classId, facing, animTime, moving, isTarget, name, time } = opts;
  const race = RACE_PALETTE[raceId] || RACE_PALETTE.human;
  const cls = CLASS_STYLE[classId] || CLASS_STYLE.warrior;
  const flip = facing < 0 ? -1 : 1;
  const bob = moving ? Math.sin(animTime * 14) * 2 : Math.sin(time / 400) * 1;
  const legSwing = moving ? Math.sin(animTime * 14) * 6 : 0;
  const s = 1.1;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(flip * s, s);

  if (isTarget) drawTargetRing(ctx, 0, 0, 22, time);
  drawShadow(ctx, 0, 0, 28, 36);

  if (cls.cape) {
    ctx.fillStyle = cls.cape;
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.quadraticCurveTo(-14, 8 + legSwing * 0.3, -10, 18);
    ctx.lineTo(10, 18);
    ctx.quadraticCurveTo(14, 8, 8, -6);
    ctx.fill();
  }

  ctx.fillStyle = shade(cls.armor, -30);
  ctx.fillRect(-7, 10 + legSwing, 5, 12);
  ctx.fillRect(2, 10 - legSwing, 5, 12);
  ctx.fillStyle = '#332211';
  ctx.fillRect(-8, 20 + legSwing, 7, 4);
  ctx.fillRect(1, 20 - legSwing, 7, 4);

  const bodyGrad = ctx.createLinearGradient(-10, -8, 10, 14);
  bodyGrad.addColorStop(0, shade(cls.armor, 20));
  bodyGrad.addColorStop(1, cls.armor);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-11, -8);
  ctx.lineTo(11, -8);
  ctx.lineTo(9, 12);
  ctx.lineTo(-9, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = cls.trim;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = shade(cls.armor, 10);
  ctx.beginPath();
  ctx.ellipse(-12, -4, 5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(12, -4, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  drawWeapon(ctx, cls.weapon, cls.shield, legSwing);
  drawHead(ctx, race, cls);

  ctx.restore();
  if (name) drawNameplate(ctx, x, y, name, null, isTarget, 38);
}

function drawHead(ctx, race, cls) {
  ctx.fillStyle = race.skin;
  ctx.fillRect(-3, -12, 6, 5);
  ctx.fillStyle = race.skin;
  ctx.beginPath();
  ctx.arc(0, -18, 9, 0, Math.PI * 2);
  ctx.fill();

  if (cls.weapon === 'staff' || cls.weapon === 'mace') {
    ctx.fillStyle = cls.trim;
    ctx.beginPath();
    ctx.arc(0, -20, 9, Math.PI, 0);
    ctx.fill();
  } else {
    ctx.fillStyle = race.hair;
    ctx.beginPath();
    ctx.arc(0, -20, 9, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();
  }

  ctx.fillStyle = '#222';
  ctx.fillRect(-4, -19, 2, 2);
  ctx.fillRect(2, -19, 2, 2);
}

function drawWeapon(ctx, type, hasShield, swing) {
  ctx.save();
  switch (type) {
    case 'sword':
      ctx.fillStyle = '#aaaacc';
      ctx.fillRect(10, -2 + swing * 0.2, 3, 16);
      ctx.fillStyle = '#886644';
      ctx.fillRect(8, 12, 7, 3);
      if (hasShield) {
        ctx.fillStyle = '#667788';
        ctx.beginPath();
        ctx.ellipse(-14, 2, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c9a84c';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      break;
    case 'greatsword':
      ctx.fillStyle = '#bbbddd';
      ctx.fillRect(8, -10, 4, 24);
      ctx.fillStyle = '#664422';
      ctx.fillRect(6, 12, 8, 3);
      break;
    case 'staff':
      ctx.strokeStyle = '#886644';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(12, 14);
      ctx.lineTo(14, -16);
      ctx.stroke();
      ctx.fillStyle = '#aa66ff';
      ctx.shadowColor = '#aa66ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(14, -18, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    case 'mace':
      ctx.strokeStyle = '#886644';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 12);
      ctx.lineTo(12, -8);
      ctx.stroke();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(12, -10, 5, 0, Math.PI * 2);
      ctx.fill();
      if (hasShield) {
        ctx.fillStyle = '#ccccdd';
        ctx.beginPath();
        ctx.ellipse(-14, 2, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'dagger':
      ctx.fillStyle = '#ccc';
      ctx.fillRect(10, 0, 2, 10);
      ctx.fillRect(8, -6, 2, 8);
      break;
    case 'bow':
      ctx.strokeStyle = '#886644';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(12, 0, 12, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(12, -12);
      ctx.lineTo(12, 12);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

const MONSTER_SPRITE = {
  gremlin: drawGremlin,
  keltir: drawKeltir,
  wolf: drawWolf,
  orc_archer: drawOrc,
  orc_fighter: drawOrc,
  orc_shaman: drawOrcShaman,
  skeleton: drawSkeleton,
  zombie: drawZombie,
  spider: drawSpider,
  troll: drawTroll,
  harpy: drawHarpy,
  wyrm: drawWyrm,
};

export function drawMonster(ctx, x, y, monster, opts) {
  const { isTarget, time } = opts;
  const scale = (monster.size || 28) / 28;
  const moving = monster.aggro && monster.alive;
  const animTime = monster.animTime || 0;
  const facing = monster.facing || 1;
  const bob = moving ? Math.sin(animTime * 12) * 1.5 : 0;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);
  if (facing < 0) ctx.scale(-1, 1);

  if (isTarget) drawTargetRing(ctx, 0, 0, (monster.size || 28) / 2 + 4, time);
  drawShadow(ctx, 0, 0, 24, 30);

  const drawer = MONSTER_SPRITE[monster.id] || drawGenericMonster;
  drawer(ctx, monster, animTime, moving);

  ctx.restore();

  const barY = y - (monster.size || 28) / 2 - 14 + bob;
  drawHpBar(ctx, x, barY, monster.hp / monster.maxHp);
  drawNameplate(ctx, x, y, monster.name, monster.level, isTarget, (monster.size || 28) / 2 + 22);
}

function drawGremlin(ctx, m, anim, moving) {
  const swing = moving ? Math.sin(anim * 14) * 4 : 0;
  const c = m.color || '#4a7c59';
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 4, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(-16, -14);
  ctx.lineTo(-6, -4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, -6);
  ctx.lineTo(16, -14);
  ctx.lineTo(6, -4);
  ctx.fill();
  ctx.fillStyle = shade(c, 30);
  ctx.beginPath();
  ctx.arc(0, -8, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(-4, -10, 3, 3);
  ctx.fillRect(1, -10, 3, 3);
  ctx.fillStyle = shade(c, -20);
  ctx.fillRect(-6, 12 + swing, 4, 8);
  ctx.fillRect(2, 12 - swing, 4, 8);
}

function drawKeltir(ctx, m, anim, moving) {
  const swing = moving ? Math.sin(anim * 16) * 5 : 0;
  const c = m.color || '#8b6914';
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, -4, 7, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(16, -6, 2, 2);
  ctx.fillStyle = shade(c, -25);
  ctx.fillRect(-10, 6 + swing, 3, 10);
  ctx.fillRect(-4, 6 - swing, 3, 10);
  ctx.fillRect(4, 6 + swing, 3, 10);
  ctx.fillRect(10, 6 - swing, 3, 10);
  ctx.strokeStyle = shade(c, -15);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(-22, -8, -18, 4);
  ctx.stroke();
}

function drawWolf(ctx, m, anim, moving) {
  const swing = moving ? Math.sin(anim * 18) * 6 : 0;
  const c = m.color || '#666';
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 2, 16, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(14, -2, 8, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(c, 20);
  ctx.beginPath();
  ctx.ellipse(20, 0, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(22, -1, 2, 2);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(10, -8);
  ctx.lineTo(8, -16);
  ctx.lineTo(14, -8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, -8);
  ctx.lineTo(18, -15);
  ctx.lineTo(20, -7);
  ctx.fill();
  ctx.fillStyle = shade(c, -30);
  ctx.fillRect(-12, 8 + swing, 4, 12);
  ctx.fillRect(-4, 8 - swing, 4, 12);
  ctx.fillRect(4, 8 + swing, 4, 12);
  ctx.fillRect(12, 8 - swing, 4, 12);
}

function drawOrc(ctx, m, anim, moving) {
  const swing = moving ? Math.sin(anim * 12) * 5 : 0;
  const c = m.color || '#2d5016';
  ctx.fillStyle = shade(c, 10);
  ctx.fillRect(-8, -6, 16, 18);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(0, -14, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(-4, -6);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-2, -4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -6);
  ctx.lineTo(6, 0);
  ctx.lineTo(2, -4);
  ctx.fill();
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(-5, -16, 3, 3);
  ctx.fillRect(2, -16, 3, 3);
  ctx.fillStyle = shade(c, -20);
  ctx.fillRect(-7, 10 + swing, 5, 12);
  ctx.fillRect(2, 10 - swing, 5, 12);
  if (m.ranged) {
    ctx.strokeStyle = '#886644';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(12, 0, 10, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#aaa';
    ctx.fillRect(10, -4, 3, 16);
  }
}

function drawOrcShaman(ctx, m, anim, moving) {
  drawOrc(ctx, m, anim, moving);
  ctx.fillStyle = '#aa44ff';
  ctx.beginPath();
  ctx.arc(0, -24, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#886644';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(0, -8);
  ctx.stroke();
}

function drawSkeleton(ctx, m, anim, moving) {
  const swing = moving ? Math.sin(anim * 10) * 4 : 0;
  ctx.strokeStyle = m.color || '#ccc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.arc(0, -14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(-4, -16, 3, 4);
  ctx.fillRect(1, -16, 3, 4);
  ctx.strokeStyle = '#bbb';
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-14, 4 + swing);
  ctx.moveTo(8, -4);
  ctx.lineTo(14, 4 - swing);
  ctx.moveTo(-4, 10);
  ctx.lineTo(-6, 22 + swing);
  ctx.moveTo(4, 10);
  ctx.lineTo(6, 22 - swing);
  ctx.stroke();
}

function drawZombie(ctx, m, anim, moving) {
  const swing = moving ? Math.sin(anim * 8) * 3 : 0;
  const c = m.color || '#3d5c3a';
  ctx.fillStyle = c;
  ctx.fillRect(-9, -4, 18, 20);
  ctx.fillStyle = shade(c, 25);
  ctx.beginPath();
  ctx.arc(0, -12, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(-4, -14, 3, 3);
  ctx.fillRect(2, -13, 3, 3);
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(-10, 4, 20, 8);
  ctx.fillStyle = shade(c, -25);
  ctx.fillRect(-7, 14 + swing, 5, 10);
  ctx.fillRect(2, 14 - swing, 5, 10);
  ctx.fillStyle = c;
  ctx.fillRect(-16, 0 + swing, 8, 4);
  ctx.fillRect(8, 0 - swing, 8, 4);
}

function drawSpider(ctx, m, anim, moving) {
  const c = m.color || '#4a0e4e';
  const legAnim = moving ? Math.sin(anim * 20) * 3 : 0;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(c, 40);
  ctx.beginPath();
  ctx.arc(0, -2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff0000';
  for (let i = -1; i <= 1; i++) ctx.fillRect(i * 4 - 1, -4, 2, 2);
  ctx.strokeStyle = shade(c, -20);
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const idx = i % 2;
    const lx = side * (8 + idx * 4);
    const ly = -2 + idx * 4;
    ctx.beginPath();
    ctx.moveTo(lx * 0.4, ly);
    ctx.lineTo(lx, ly + 8 + legAnim * side);
    ctx.lineTo(lx + side * 6, ly + 14);
    ctx.stroke();
  }
}

function drawTroll(ctx, m, anim, moving) {
  const swing = moving ? Math.sin(anim * 10) * 4 : 0;
  const c = m.color || '#5c4033';
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 2, 16, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(c, 20);
  ctx.beginPath();
  ctx.arc(0, -16, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(c, -15);
  ctx.beginPath();
  ctx.arc(0, -10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff6666';
  ctx.fillRect(-5, -20, 3, 3);
  ctx.fillRect(2, -20, 3, 3);
  ctx.fillStyle = shade(c, -30);
  ctx.fillRect(-10, 16 + swing, 7, 14);
  ctx.fillRect(3, 16 - swing, 7, 14);
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(14, -8, 5, 24);
  ctx.fillStyle = '#5a4030';
  ctx.beginPath();
  ctx.arc(16, -12, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawHarpy(ctx, m, anim, moving) {
  const wingFlap = Math.sin(anim * 10) * 8;
  const c = m.color || '#8b7355';
  ctx.fillStyle = shade(c, -10);
  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.quadraticCurveTo(-28, -16 + wingFlap, -20, 8);
  ctx.lineTo(-4, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -4);
  ctx.quadraticCurveTo(28, -16 + wingFlap, 20, 8);
  ctx.lineTo(4, 4);
  ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 4, 7, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(c, 20);
  ctx.beginPath();
  ctx.arc(0, -10, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffcc44';
  ctx.fillRect(-3, -12, 2, 2);
  ctx.fillRect(1, -12, 2, 2);
  ctx.fillStyle = '#ccc';
  ctx.fillRect(-10, 8, 6, 3);
  ctx.fillRect(4, 8, 6, 3);
}

function drawWyrm(ctx, m, anim, moving) {
  const c = m.color || '#8b0000';
  const sway = Math.sin(anim * 6) * 3;
  ctx.strokeStyle = shade(c, -20);
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-20, 10);
  ctx.quadraticCurveTo(-30, 20, -24, 30 + sway);
  ctx.stroke();
  const bodyGrad = ctx.createLinearGradient(-20, -10, 20, 20);
  bodyGrad.addColorStop(0, shade(c, 30));
  bodyGrad.addColorStop(1, c);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(18, -6, 12, 10, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(14, -14);
  ctx.lineTo(10, -24);
  ctx.lineTo(18, -14);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22, -14);
  ctx.lineTo(26, -24);
  ctx.lineTo(24, -12);
  ctx.fill();
  ctx.fillStyle = '#ff4400';
  ctx.shadowColor = '#ff4400';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(22, -8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = shade(c, -30);
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.quadraticCurveTo(-30, -30 + sway, -10, 10);
  ctx.lineTo(-2, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -8);
  ctx.quadraticCurveTo(20, -28 - sway, 8, 6);
  ctx.lineTo(2, 0);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGenericMonster(ctx, m) {
  ctx.fillStyle = m.color || '#aa4444';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
}

export function drawNpc(ctx, x, y, npc, time) {
  const bob = Math.sin(time / 500 + x) * 1;
  ctx.save();
  ctx.translate(x, y + bob);
  drawShadow(ctx, 0, 0, 22, 30);

  const robeGrad = ctx.createLinearGradient(0, -10, 0, 20);
  robeGrad.addColorStop(0, '#5566aa');
  robeGrad.addColorStop(1, '#334488');
  ctx.fillStyle = robeGrad;
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(10, -6);
  ctx.lineTo(12, 20);
  ctx.lineTo(-12, 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#e8c4a0';
  ctx.beginPath();
  ctx.arc(0, -14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#445588';
  ctx.beginPath();
  ctx.arc(0, -16, 9, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(-5, -24);
  ctx.lineTo(5, -24);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  drawNameplate(ctx, x, y, npc.name, null, false, 36);
}

export function drawProjectile(ctx, proj, cx, cy) {
  const px = proj.x - cx;
  const py = proj.y - cy;
  ctx.save();
  ctx.shadowColor = proj.color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = proj.color;
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, py, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawParticle(ctx, part, cx, cy) {
  ctx.globalAlpha = part.life;
  ctx.fillStyle = part.color;
  const s = 3 + (1 - part.life) * 2;
  ctx.fillRect(part.x - cx - s / 2, part.y - cy - s / 2, s, s);
  ctx.globalAlpha = 1;
}

export function drawMoveMarker(ctx, x, y, cx, cy, time) {
  const px = x - cx;
  const py = y - cy;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,0,${0.5 + Math.sin(time / 200) * 0.3})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 10 + Math.sin(time / 150) * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,0,0.3)';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
