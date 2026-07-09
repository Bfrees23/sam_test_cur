// Entity renderer — unified draw pipeline with sprite cache & feet anchor

import { sharedSpriteCache, getAnimFrame } from './sprite-cache.js';
import {
  getPlayerSprite, getMonsterSprite, getNpcSprite, OUTLINE,
} from './pixel-data.js';
import { drawDecorations } from './world-art.js';

const NPC_GLOW = {
  guide: ['#66aaff', '#4488cc'],
  shop: ['#ffcc44', '#ff9922'],
  teleport: ['#aa66ff', '#6644cc'],
  blacksmith: ['#ff8844', '#cc5522'],
  default: ['#66aaff', '#4488cc'],
};

const NPC_ICONS = {
  guide: '📖', shop: '💰', teleport: '✨', blacksmith: '🔨', default: '❓',
};

function drawNameplate(ctx, x, y, name, level, isTarget, offsetY) {
  const top = y - offsetY;
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
  if (pct > 0.5) { grad.addColorStop(0, '#cc2222'); grad.addColorStop(1, '#ff4444'); }
  else if (pct > 0.25) { grad.addColorStop(0, '#cc4400'); grad.addColorStop(1, '#ff6600'); }
  else { grad.addColorStop(0, '#880000'); grad.addColorStop(1, '#ff0000'); }
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

function drawAura(ctx, x, y, color, radius, alpha = 0.3) {
  const g = ctx.createRadialGradient(x, y, 4, x, y, radius);
  g.addColorStop(0, color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
  g.addColorStop(0.5, color + '18');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export class EntityRenderer {
  constructor(cache = sharedSpriteCache) {
    this.cache = cache;
  }

  preload() {
    const races = ['human', 'elf', 'dark_elf', 'orc', 'dwarf'];
    const classes = ['warrior', 'gladiator', 'mystic', 'cleric', 'rogue', 'archer'];
    const entries = [];

    for (const race of races) {
      for (const cls of classes) {
        const sprite = getPlayerSprite(race, cls);
        entries.push({ id: `player:${race}:${cls}`, sprite, frames: sprite.frames.length });
      }
    }

    const monsters = [
      'gremlin', 'keltir', 'wolf', 'orc', 'orc_archer', 'orc_shaman',
      'skeleton', 'zombie', 'spider', 'troll', 'harpy', 'wyrm',
    ];
    for (const id of monsters) {
      const sprite = getMonsterSprite(id);
      entries.push({ id: `monster:${id}`, sprite, frames: sprite.frames.length });
    }

    const npcTypes = ['guide', 'shop', 'teleport', 'blacksmith', 'default'];
    for (const type of npcTypes) {
      const sprite = getNpcSprite({ type, id: type === 'blacksmith' ? 'blacksmith' : type });
      entries.push({ id: `npc:${type}`, sprite, frames: sprite.frames.length });
    }

    this.cache.preloadEntries(entries);
  }

  drawSpriteEntity(ctx, cacheId, sprite, x, y, opts = {}) {
    const {
      facing = 1, animTime = 0, moving = false, bob = 0, scale = sprite.scale || 3,
    } = opts;

    const frameIdx = getAnimFrame(animTime, moving, sprite.frames.length);
    const flipX = facing < 0;
    const baked = this.cache.bake(cacheId, sprite, frameIdx, scale, flipX);

    this.cache.drawShadow(ctx, x, y, baked, { bob });
    this.cache.draw(ctx, baked, x, y, { bob });
    return baked;
  }

  drawPlayer(ctx, x, y, opts) {
    const { raceId, classId, facing, animTime, moving, isTarget, name, time } = opts;
    const sprite = getPlayerSprite(raceId, classId);
    const bob = moving ? Math.sin(animTime * 14) * 1.5 : Math.sin(time / 450) * 0.8;
    const glow = sprite.glow || '#88bbff';

    drawAura(ctx, x, y + bob, glow, 42, 0.2);
    if (isTarget) drawTargetRing(ctx, x, y + bob, 28, time);

    this.drawSpriteEntity(ctx, `player:${raceId}:${classId}`, sprite, x, y, {
      facing, animTime, moving, bob, scale: sprite.scale,
    });

    if (name) drawNameplate(ctx, x, y, name, null, isTarget, 52);
  }

  drawMonster(ctx, x, y, monster, opts) {
    const { isTarget, time } = opts;
    const spriteKey = monster.id === 'orc_shaman' ? 'orc_shaman' : monster.id;
    const sprite = getMonsterSprite(spriteKey);
    const sizeScale = (monster.size || 28) / 28;
    const scale = (sprite.scale || 2.5) * sizeScale;
    const moving = monster.aggro && monster.alive;
    const bob = moving ? Math.sin((monster.animTime || 0) * 12) * 1.2 : 0;
    const facing = monster.facing || 1;

    if (monster.boss) {
      const a = 0.25 + Math.sin(time / 400) * 0.08;
      const g = ctx.createRadialGradient(x, y, 5, x, y, 55 * sizeScale);
      g.addColorStop(0, `rgba(255,60,0,${a})`);
      g.addColorStop(0.5, `rgba(255,120,0,${a * 0.35})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 55 * sizeScale, 0, Math.PI * 2);
      ctx.fill();
    } else if (monster.alive) {
      drawAura(ctx, x, y + bob, monster.color || '#aa4444', 28 * sizeScale, 0.13);
    }

    if (isTarget) drawTargetRing(ctx, x, y + bob, 18 * sizeScale, time);

    this.drawSpriteEntity(ctx, `monster:${spriteKey}`, sprite, x, y, {
      facing, animTime: monster.animTime || 0, moving, bob, scale,
    });

    const barY = y - 20 * sizeScale + bob;
    drawHpBar(ctx, x, barY, monster.hp / monster.maxHp, 48 * sizeScale);
    drawNameplate(ctx, x, y, monster.name, monster.level, isTarget, 28 * sizeScale + 18);
  }

  drawNpc(ctx, x, y, npc, time) {
    const sprite = getNpcSprite(npc);
    const bob = Math.sin(time / 500 + x * 0.01) * 1.2;
    let glowKey = npc.type || 'default';
    if (npc.id === 'blacksmith') glowKey = 'blacksmith';
    const [c1, c2] = NPC_GLOW[glowKey] || NPC_GLOW.default;

    drawAura(ctx, x, y - 20 + bob, c1, 28, 0.33);
    this.drawSpriteEntity(ctx, `npc:${glowKey}`, sprite, x, y, {
      bob, animTime: time / 1000, moving: false, scale: sprite.scale,
    });

    const icon = NPC_ICONS[glowKey] || NPC_ICONS.default;
    const floatY = y - 52 + bob + Math.sin(time / 350) * 3;
    drawAura(ctx, x, floatY, c1, 14, 0.67);
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.fillText(icon, x, floatY + 5);

    drawNameplate(ctx, x, y, npc.name, null, false, 48);
  }

  /** Y-sorted entity batch from game state */
  renderEntities(ctx, entities, camera, state) {
    const { cx, cy, time, viewW, viewH } = camera;
    const vw = viewW ?? ctx.canvas.width;
    const vh = viewH ?? ctx.canvas.height;
    const { target, playerMoving, player } = state;

    for (const ent of entities) {
      const sx = ent.obj.x - cx;
      const sy = ent.obj.y - cy;

      // Cull off-screen entities
      if (sx < -120 || sx > vw + 120 || sy < -120 || sy > vh + 120) {
        continue;
      }

      switch (ent.type) {
        case 'deco':
          drawDecorations(ctx, [ent.obj], cx, cy, time);
          break;
        case 'npc':
          this.drawNpc(ctx, sx, sy, ent.obj, time);
          break;
        case 'monster':
          this.drawMonster(ctx, sx, sy, ent.obj, { isTarget: target === ent.obj, time });
          break;
        case 'other': {
          const op = ent.obj;
          this.drawPlayer(ctx, sx, sy, {
            raceId: op.raceId,
            classId: op.classId,
            facing: op.facing || 1,
            animTime: op.animTime || 0,
            moving: op.moving,
            isTarget: false,
            name: op.name,
            time,
          });
          break;
        }
        case 'player':
          this.drawPlayer(ctx, sx, sy, {
            raceId: player.raceId,
            classId: player.classId,
            facing: player.facing || 1,
            animTime: player.animTime || 0,
            moving: playerMoving,
            isTarget: false,
            name: player.name,
            time,
          });
          break;
      }
    }
  }
}

let _renderer = null;

export function getEntityRenderer() {
  if (!_renderer) {
    _renderer = new EntityRenderer();
    _renderer.preload();
  }
  return _renderer;
}
