// Lineage II: Reborn — Game Engine
// All game data loaded from repository via /api/data
// Saves stored in repository via /api/saves

let GAME_DATA = null;
let canvas, ctx, minimapCanvas, minimapCtx;
let gameRunning = false;
let lastTime = 0;

// ===== GAME STATE =====
const state = {
  player: null,
  zone: null,
  monsters: [],
  npcs: [],
  particles: [],
  projectiles: [],
  target: null,
  camera: { x: 0, y: 0 },
  keys: {},
  mouse: { x: 0, y: 0, down: false, worldX: 0, worldY: 0 },
  moveTarget: null,
  cooldowns: {},
  buffs: [],
  combatLog: [],
  panels: { inventory: false, stats: false, shop: false, dialog: false, menu: false },
  selectedRace: 'human',
  selectedClass: 'warrior',
  activeShop: null,
  dead: false,
  respawnTimer: 0,
};

// ===== DATA LOADING =====
async function loadGameData() {
  const res = await fetch('/api/data');
  GAME_DATA = await res.json();
}

function getItem(id) { return GAME_DATA.items.items.find(i => i.id === id); }
function getSkill(id) { return GAME_DATA.skills.skills.find(s => s.id === id); }
function getMonster(id) { return GAME_DATA.monsters.monsters.find(m => m.id === id); }
function getZone(id) { return GAME_DATA.zones.zones.find(z => z.id === id); }
function getClass(id) { return GAME_DATA.classes.classes.find(c => c.id === id); }
function getRace(id) { return GAME_DATA.classes.races.find(r => r.id === id); }
function getNpc(id) { return GAME_DATA.zones.npcs.find(n => n.id === id); }

// ===== CHARACTER CREATION =====
function createPlayer(name, raceId, classId) {
  const race = getRace(raceId);
  const cls = getClass(classId);
  const stats = { ...cls.baseStats };
  if (race.statBonus) {
    for (const [k, v] of Object.entries(race.statBonus)) stats[k] = (stats[k] || 0) + v;
  }

  const level = 1;
  const hp = calcMaxHp(stats, cls, level);
  const mp = calcMaxMp(stats, cls, level);
  const cp = Math.floor(hp * 0.6);

  const equipment = {};
  const inventory = [];
  for (const itemId of cls.starterItems) {
    const item = getItem(itemId);
    if (item && item.slot && item.slot !== 'consumable') {
      equipment[item.slot] = { id: itemId, ...item };
    } else {
      inventory.push({ id: itemId, count: 1 });
    }
  }
  inventory.push({ id: 'hp_potion', count: 20 });
  inventory.push({ id: 'mp_potion', count: 10 });

  return {
    name, raceId, raceName: race.name, classId, className: cls.name,
    level, exp: 0, sp: 0,
    stats, hp, maxHp: hp, mp, maxMp: mp, cp, maxCp: cp,
    x: 200, y: 200,
    speed: 150,
    equipment, inventory,
    adena: 1000,
    zone: 'talking_island',
    skills: [...cls.skills],
    killCount: 0,
    saveId: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
  };
}

function calcMaxHp(stats, cls, level) {
  return Math.floor((stats.con * cls.hpPerCon + stats.str * 2) * (1 + level * 0.05));
}
function calcMaxMp(stats, cls, level) {
  return Math.floor((stats.men * cls.mpPerMen + stats.int * 2) * (1 + level * 0.05));
}

function getPlayerPatk() {
  const p = state.player;
  let atk = p.stats.str * 1.5 + p.level * 2;
  const weapon = p.equipment.weapon;
  if (weapon) atk += weapon.patk || 0;
  for (const b of state.buffs) if (b.patk) atk *= b.patk;
  return Math.floor(atk);
}

function getPlayerMatk() {
  const p = state.player;
  let atk = p.stats.int * 1.8 + p.level * 1.5;
  const weapon = p.equipment.weapon;
  if (weapon) atk += weapon.matk || 0;
  return Math.floor(atk);
}

function getPlayerPdef() {
  const p = state.player;
  let def = p.stats.con * 0.8 + p.level;
  for (const slot of ['chest', 'shield', 'boots']) {
    const item = p.equipment[slot];
    if (item) def += item.pdef || 0;
  }
  for (const b of state.buffs) if (b.pdef) def *= b.pdef;
  return Math.floor(def);
}

function getPlayerMdef() {
  const p = state.player;
  let def = p.stats.men * 0.6 + p.stats.wit * 0.4 + p.level * 0.5;
  for (const slot of ['chest', 'shield', 'boots']) {
    const item = p.equipment[slot];
    if (item) def += item.mdef || 0;
  }
  for (const b of state.buffs) if (b.mdef) def *= b.mdef;
  return Math.floor(def);
}

function expForLevel(lv) { return GAME_DATA.experience.expTable[lv] || 999999; }
function spForLevel(lv) { return GAME_DATA.experience.spTable[lv] || 0; }

// ===== ZONE MANAGEMENT =====
function loadZone(zoneId) {
  const zoneData = getZone(zoneId);
  state.zone = zoneData;
  state.player.zone = zoneId;
  state.monsters = [];
  state.npcs = [];
  state.target = null;
  state.particles = [];
  state.projectiles = [];

  // Spawn monsters
  const zoneMonsters = zoneData.monsters || [];
  for (const sp of zoneData.spawnPoints) {
    const mId = zoneMonsters[Math.floor(Math.random() * zoneMonsters.length)];
    const mData = getMonster(mId);
    if (mData) {
      state.monsters.push(createMonster(mData, sp.x + (Math.random() - 0.5) * 100, sp.y + (Math.random() - 0.5) * 100));
    }
  }

  // Place NPCs
  for (const npcId of (zoneData.npcs || [])) {
    const npcData = getNpc(npcId);
    if (npcData) {
      state.npcs.push({ ...npcData, x: npcData.x, y: npcData.y, radius: 30 });
    }
  }

  document.getElementById('hud-zone').textContent = zoneData.name;
  addLog(`Вы вошли в ${zoneData.name}`, 'system');
}

function createMonster(data, x, y) {
  return {
    ...data,
    x, y,
    hp: data.hp,
    maxHp: data.hp,
    alive: true,
    aggro: false,
    attackTimer: 0,
    respawnTimer: 0,
    spawnX: x, spawnY: y,
    stunTimer: 0,
    slowFactor: 1,
    dotTimer: 0,
    dotDamage: 0,
  };
}

// ===== COMBAT =====
function selectTarget(monster) {
  state.target = monster;
  const frame = document.getElementById('target-frame');
  if (monster && monster.alive) {
    frame.classList.remove('hidden');
    document.getElementById('target-name').textContent = monster.name;
    document.getElementById('target-level').textContent = `Lv.${monster.level}`;
    updateTargetHp();
  } else {
    frame.classList.add('hidden');
    state.target = null;
  }
}

function cycleTarget() {
  const alive = state.monsters.filter(m => m.alive);
  if (alive.length === 0) { selectTarget(null); return; }
  if (!state.target || !state.target.alive) { selectTarget(alive[0]); return; }
  const idx = alive.indexOf(state.target);
  selectTarget(alive[(idx + 1) % alive.length]);
}

function updateTargetHp() {
  if (!state.target) return;
  const pct = Math.max(0, state.target.hp / state.target.maxHp * 100);
  document.getElementById('target-hp').style.width = pct + '%';
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function useSkill(slotIndex) {
  const p = state.player;
  if (state.dead) return;
  const skillId = p.skills[slotIndex];
  if (!skillId) return;
  const skill = getSkill(skillId);
  if (!skill) return;

  if (state.cooldowns[skillId] > 0) return;
  if (p.mp < skill.mp) { addLog('Недостаточно MP!', 'system'); return; }

  p.mp -= skill.mp;
  state.cooldowns[skillId] = skill.cooldown;

  if (skill.type === 'heal') {
    const heal = Math.floor(p.maxHp * skill.healPercent);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    addLog(`+${heal} HP`, 'heal');
    spawnParticles(p.x, p.y, '#44ff44', 8);
    updateHud();
    return;
  }

  if (skill.type === 'buff') {
    state.buffs.push({ ...skill.buff, timer: skill.buff.duration });
    addLog(`${skill.name} активирован!`, 'system');
    spawnParticles(p.x, p.y, '#ffff44', 6);
    return;
  }

  // Attack skills
  const range = skill.range || 80;
  const targets = [];

  if (skill.aoe) {
    targets.push(...state.monsters.filter(m => m.alive && dist(p, m) < skill.aoe));
  } else if (state.target && state.target.alive && dist(p, state.target) < range) {
    targets.push(state.target);
  } else {
    // Find nearest
    let nearest = null, nearDist = range;
    for (const m of state.monsters) {
      if (!m.alive) continue;
      const d = dist(p, m);
      if (d < nearDist) { nearest = m; nearDist = d; }
    }
    if (nearest) { targets.push(nearest); selectTarget(nearest); }
  }

  if (targets.length === 0) { addLog('Нет цели в радиусе', 'system'); return; }

  const hits = skill.hits || 1;
  for (const target of targets) {
    for (let h = 0; h < hits; h++) {
      dealDamage(target, skill);
    }
    if (skill.stun) target.stunTimer = skill.stun;
    if (skill.slow) target.slowFactor = skill.slow;
    if (skill.dot) { target.dotTimer = skill.dot.duration; target.dotDamage = skill.dot.damage; }
  }

  // Ranged visual
  if (range > 100 && targets.length > 0) {
    state.projectiles.push({ x: p.x, y: p.y, tx: targets[0].x, ty: targets[0].y, life: 0.3, color: skill.element === 'fire' ? '#ff4400' : skill.element === 'water' ? '#4488ff' : '#ffffff' });
  }
}

function basicAttack() {
  if (state.dead || !state.target || !state.target.alive) return;
  const p = state.player;
  const range = 80;
  if (dist(p, state.target) > range) {
    state.moveTarget = { x: state.target.x, y: state.target.y };
    return;
  }
  dealDamage(state.target, { type: 'physical', damage: 1.0 });
  spawnParticles(state.target.x, state.target.y, '#ffaa00', 3);
}

function dealDamage(target, skill) {
  const p = state.player;
  let baseDmg;
  if (skill.type === 'magic') {
    baseDmg = getPlayerMatk() * (skill.damage || 1);
  } else {
    baseDmg = getPlayerPatk() * (skill.damage || 1);
  }

  const isPhysical = skill.type !== 'magic';
  const defense = isPhysical ? (target.pdef || 0) : (target.mdef || 0);
  const dmg = Math.max(1, Math.floor(baseDmg - defense * 0.5));

  target.hp -= dmg;
  addLog(`${skill.name || 'Атака'}: ${dmg} урона → ${target.name}`, 'damage');
  updateTargetHp();

  if (target.hp <= 0) {
    killMonster(target);
  }
}

function killMonster(monster) {
  monster.alive = false;
  monster.respawnTimer = 30;
  const p = state.player;
  p.exp += monster.exp;
  p.sp += monster.sp;
  const adena = monster.adena.min + Math.floor(Math.random() * (monster.adena.max - monster.adena.min));
  p.adena += adena;
  p.killCount++;

  addLog(`+${monster.exp} EXP, +${monster.sp} SP, +${adena} Adena`, 'exp');
  spawnParticles(monster.x, monster.y, '#ffdd44', 12);

  // Drops
  for (const drop of (monster.drops || [])) {
    if (Math.random() < drop.chance) {
      addItemToInventory(drop.item, 1);
      const item = getItem(drop.item);
      addLog(`Дроп: ${item?.name || drop.item}`, 'loot');
    }
  }

  if (state.target === monster) selectTarget(null);
  checkLevelUp();
  updateHud();
}

function checkLevelUp() {
  const p = state.player;
  while (p.level < 80 && p.exp >= expForLevel(p.level)) {
    p.exp -= expForLevel(p.level);
    p.level++;
    p.sp += spForLevel(p.level);
    const cls = getClass(p.classId);
    for (const [stat, growth] of Object.entries(cls.growth)) {
      p.stats[stat] = Math.floor(p.stats[stat] + growth);
    }
    p.maxHp = calcMaxHp(p.stats, cls, p.level);
    p.maxMp = calcMaxMp(p.stats, cls, p.level);
    p.maxCp = Math.floor(p.maxHp * 0.6);
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    p.cp = p.maxCp;
    showLevelUp(p.level);
  }
}

function showLevelUp(level) {
  const popup = document.getElementById('levelup-popup');
  document.getElementById('levelup-text').textContent = `Уровень ${level}!`;
  popup.classList.remove('hidden');
  setTimeout(() => popup.classList.add('hidden'), 2500);
  addLog(`LEVEL UP! Уровень ${level}`, 'exp');
}

function monsterAttack(monster) {
  const p = state.player;
  if (state.dead) return;
  const range = monster.ranged ? 250 : 50;
  if (dist(monster, p) > range) return;

  let dmg = (monster.patk || monster.matk || 10) - getPlayerPdef() * 0.3;
  dmg = Math.max(1, Math.floor(dmg));

  // Shield buff
  for (const b of state.buffs) {
    if (b.shield) { dmg = Math.floor(dmg * (1 - b.shield)); break; }
  }

  p.hp -= dmg;
  addLog(`${monster.name}: ${dmg} урона`, 'damage');
  spawnParticles(p.x, p.y, '#ff2222', 4);

  if (p.hp <= 0) {
    p.hp = 0;
    playerDeath();
  }
  updateHud();
}

function playerDeath() {
  state.dead = true;
  state.respawnTimer = 5;
  document.getElementById('death-screen').classList.remove('hidden');
  addLog('Вы погибли!', 'system');
}

function respawnPlayer() {
  const p = state.player;
  const zone = getZone(p.zone);
  p.x = zone.playerSpawn.x;
  p.y = zone.playerSpawn.y;
  p.hp = Math.floor(p.maxHp * 0.5);
  p.mp = Math.floor(p.maxMp * 0.5);
  p.cp = Math.floor(p.maxCp * 0.5);
  state.dead = false;
  state.respawnTimer = 0;
  document.getElementById('death-screen').classList.add('hidden');
  addLog('Вы возродились', 'system');
  updateHud();
}

// ===== INVENTORY =====
function addItemToInventory(itemId, count) {
  const item = getItem(itemId);
  if (!item) return;
  const existing = state.player.inventory.find(i => i.id === itemId);
  if (existing && item.stackable !== false) {
    existing.count += count;
  } else {
    state.player.inventory.push({ id: itemId, count });
  }
}

function useItem(itemId) {
  const item = getItem(itemId);
  if (!item || item.type !== 'consumable') {
    // Try equip
    if (item && item.slot && item.slot !== 'consumable' && item.slot !== 'none') {
      equipItem(itemId);
    }
    return;
  }
  const p = state.player;
  if (item.heal) { p.hp = Math.min(p.maxHp, p.hp + item.heal); addLog(`+${item.heal} HP`, 'heal'); }
  if (item.mana) { p.mp = Math.min(p.maxMp, p.mp + item.mana); addLog(`+${item.mana} MP`, 'heal'); }

  const inv = p.inventory.find(i => i.id === itemId);
  if (inv) { inv.count--; if (inv.count <= 0) p.inventory = p.inventory.filter(i => i.count > 0); }
  updateHud();
  renderInventory();
}

function equipItem(itemId) {
  const item = getItem(itemId);
  if (!item || !item.slot || item.slot === 'consumable') return;
  if (item.level && state.player.level < item.level) { addLog(`Требуется уровень ${item.level}`, 'system'); return; }

  const p = state.player;
  const old = p.equipment[item.slot];
  if (old) addItemToInventory(old.id, 1);

  p.equipment[item.slot] = { id: itemId, ...item };
  p.inventory = p.inventory.filter(i => {
    if (i.id === itemId) { i.count--; return i.count > 0; }
    return true;
  });
  addLog(`Экипировано: ${item.name}`, 'system');
  renderInventory();
  updateHud();
}

function buyItem(itemId) {
  const item = getItem(itemId);
  if (!item) return;
  const p = state.player;
  if (p.adena < item.price) { addLog('Недостаточно Adena!', 'system'); return; }
  p.adena -= item.price;
  addItemToInventory(itemId, 1);
  addLog(`Куплено: ${item.name}`, 'loot');
  updateHud();
}

// ===== NPC INTERACTION =====
function interactNpc() {
  const p = state.player;
  for (const npc of state.npcs) {
    if (dist(p, npc) < 60) {
      if (npc.type === 'shop') {
        openShop(npc);
      } else if (npc.type === 'teleport') {
        openTeleport(npc);
      } else if (npc.type === 'guide') {
        openDialog(npc);
      }
      return;
    }
  }
  addLog('Рядом нет NPC (подойдите ближе, нажмите E)', 'system');
}

function openShop(npc) {
  state.activeShop = npc;
  document.getElementById('shop-title').textContent = npc.name;
  const grid = document.getElementById('shop-items');
  grid.innerHTML = '';
  for (const itemId of npc.items) {
    const item = getItem(itemId);
    if (!item) continue;
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.innerHTML = `<div class="shop-item-info"><span>${item.icon}</span><span>${item.name}${item.level ? ` (Lv.${item.level})` : ''}</span></div><span class="shop-item-price">💰 ${item.price}</span>`;
    el.onclick = () => buyItem(itemId);
    grid.appendChild(el);
  }
  showPanel('shop');
}

function openTeleport(npc) {
  document.getElementById('dialog-npc').textContent = npc.name;
  document.getElementById('dialog-text').textContent = 'Куда вы хотите телепортироваться?';
  const actions = document.getElementById('dialog-actions');
  actions.innerHTML = '';
  for (const dest of npc.destinations) {
    const zone = getZone(dest);
    if (!zone) continue;
    const btn = document.createElement('button');
    btn.className = 'btn-l2';
    btn.textContent = zone.name;
    btn.style.margin = '0.25rem';
    btn.onclick = () => {
      pTeleport(dest);
      closeAllPanels();
    };
    actions.appendChild(btn);
  }
  showPanel('dialog');
}

function openDialog(npc) {
  document.getElementById('dialog-npc').textContent = npc.name;
  document.getElementById('dialog-text').textContent = npc.dialog.join('\n');
  document.getElementById('dialog-actions').innerHTML = '';
  showPanel('dialog');
}

function pTeleport(zoneId) {
  const zone = getZone(zoneId);
  state.player.x = zone.playerSpawn.x;
  state.player.y = zone.playerSpawn.y;
  loadZone(zoneId);
}

// ===== ZONE TRANSITIONS =====
function checkZoneTransition() {
  const p = state.player;
  const zone = state.zone;
  for (const conn of (zone.connections || [])) {
    if (dist(p, conn) < 80) {
      loadZone(conn.to);
      p.x = getZone(conn.to).playerSpawn.x + 100;
      p.y = getZone(conn.to).playerSpawn.y;
      return;
    }
  }
}

// ===== RENDERING =====
function render() {
  const p = state.player;
  const zone = state.zone;
  if (!p || !zone) return;

  const w = canvas.width, h = canvas.height;

  // Camera
  state.camera.x = p.x - w / 2;
  state.camera.y = p.y - h / 2;
  state.camera.x = Math.max(0, Math.min(zone.width - w, state.camera.x));
  state.camera.y = Math.max(0, Math.min(zone.height - h, state.camera.y));

  const cx = state.camera.x, cy = state.camera.y;

  // Background
  ctx.fillStyle = zone.bgColor || '#1a1a2a';
  ctx.fillRect(0, 0, w, h);

  // Ground grid
  ctx.fillStyle = zone.groundColor || '#2a3a2a';
  const gridSize = 80;
  const startGX = Math.floor(cx / gridSize) * gridSize;
  const startGY = Math.floor(cy / gridSize) * gridSize;
  for (let gx = startGX; gx < cx + w; gx += gridSize) {
    for (let gy = startGY; gy < cy + h; gy += gridSize) {
      if ((gx / gridSize + gy / gridSize) % 2 === 0) {
        ctx.globalAlpha = 0.3;
        ctx.fillRect(gx - cx, gy - cy, gridSize, gridSize);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Zone connections (portals)
  for (const conn of (zone.connections || [])) {
    const px = conn.x - cx, py = conn.y - cy;
    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 500) * 0.2;
    const grad = ctx.createRadialGradient(px, py, 5, px, py, 40);
    grad.addColorStop(0, '#4488ff');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(px - 40, py - 40, 80, 80);
    ctx.fillStyle = '#88bbff';
    ctx.font = '11px Roboto';
    ctx.textAlign = 'center';
    ctx.fillText(conn.label || '→', px, py + 50);
    ctx.restore();
  }

  // NPCs
  for (const npc of state.npcs) {
    drawEntity(npc.x - cx, npc.y - cy, 30, '#4488ff', npc.name, '💬', false);
  }

  // Monsters
  for (const m of state.monsters) {
    if (!m.alive) continue;
    const isTarget = state.target === m;
    drawEntity(m.x - cx, m.y - cy, m.size || 28, m.color || '#aa4444', m.name, '', isTarget, m.level);
    // HP bar
    const bx = m.x - cx - 20, by = m.y - cy - (m.size || 28) / 2 - 10;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, 40, 4);
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(bx, by, 40 * (m.hp / m.maxHp), 4);
  }

  // Projectiles
  for (const proj of state.projectiles) {
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x - cx, proj.y - cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles
  for (const part of state.particles) {
    ctx.globalAlpha = part.life;
    ctx.fillStyle = part.color;
    ctx.fillRect(part.x - cx - 2, part.y - cy - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  // Player
  drawEntity(p.x - cx, p.y - cy, 32, '#c9a84c', p.name, '⚔️', false);

  // Move target indicator
  if (state.moveTarget) {
    ctx.strokeStyle = '#ffff0044';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.moveTarget.x - cx, state.moveTarget.y - cy, 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Minimap
  renderMinimap();
}

function drawEntity(x, y, size, color, name, icon, isTarget, level) {
  ctx.save();
  if (isTarget) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, size / 2 + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + size / 3, size / 2.5, size / 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const grad = ctx.createRadialGradient(x, y - 5, 2, x, y, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, shadeColor(color, -40));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Icon
  if (icon) {
    ctx.font = `${size * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y);
  }

  // Name
  ctx.font = '11px Roboto';
  ctx.fillStyle = isTarget ? '#ff6666' : '#d4c8a8';
  ctx.textAlign = 'center';
  ctx.fillText(name, x, y - size / 2 - 8);
  if (level) {
    ctx.font = '9px Roboto';
    ctx.fillStyle = '#88cc88';
    ctx.fillText(`Lv.${level}`, x, y - size / 2 - 20);
  }
  ctx.restore();
}

function shadeColor(color, amount) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

function renderMinimap() {
  if (!minimapCtx || !state.zone) return;
  const mw = 160, mh = 120;
  const zone = state.zone;
  minimapCtx.fillStyle = zone.groundColor || '#2a3a2a';
  minimapCtx.fillRect(0, 0, mw, mh);

  const sx = mw / zone.width, sy = mh / zone.height;

  for (const m of state.monsters) {
    if (!m.alive) continue;
    minimapCtx.fillStyle = m.boss ? '#ff0000' : '#aa4444';
    minimapCtx.fillRect(m.x * sx - 1, m.y * sy - 1, 3, 3);
  }

  for (const npc of state.npcs) {
    minimapCtx.fillStyle = '#4488ff';
    minimapCtx.fillRect(npc.x * sx - 1, npc.y * sy - 1, 3, 3);
  }

  // Player
  minimapCtx.fillStyle = '#ffd700';
  minimapCtx.beginPath();
  minimapCtx.arc(state.player.x * sx, state.player.y * sy, 3, 0, Math.PI * 2);
  minimapCtx.fill();
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 100,
      vy: (Math.random() - 0.5) * 100 - 50,
      color, life: 1,
    });
  }
}

// ===== UPDATE =====
function update(dt) {
  if (!state.player || !state.zone) return;
  const p = state.player;

  if (state.dead) {
    state.respawnTimer -= dt;
    document.getElementById('respawn-timer').textContent = Math.ceil(state.respawnTimer);
    if (state.respawnTimer <= 0) respawnPlayer();
    return;
  }

  // Cooldowns
  for (const k in state.cooldowns) {
    state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dt);
  }
  updateCooldownUI();

  // Buffs
  state.buffs = state.buffs.filter(b => { b.timer -= dt; return b.timer > 0; });

  // Movement
  let dx = 0, dy = 0;
  if (state.keys['w'] || state.keys['arrowup']) dy -= 1;
  if (state.keys['s'] || state.keys['arrowdown']) dy += 1;
  if (state.keys['a'] || state.keys['arrowleft']) dx -= 1;
  if (state.keys['d'] || state.keys['arrowright']) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    state.moveTarget = null;
  }

  if (state.moveTarget) {
    const d = dist(p, state.moveTarget);
    if (d > 10) {
      dx = (state.moveTarget.x - p.x) / d;
      dy = (state.moveTarget.y - p.y) / d;
    } else {
      state.moveTarget = null;
    }
  }

  let speed = p.speed;
  for (const b of state.buffs) if (b.slowFactor) speed *= b.slowFactor;

  p.x += dx * speed * dt;
  p.y += dy * speed * dt;
  p.x = Math.max(20, Math.min(state.zone.width - 20, p.x));
  p.y = Math.max(20, Math.min(state.zone.height - 20, p.y));

  // Regen
  if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.01 * dt);
  if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.02 * dt);
  if (p.cp < p.maxCp) p.cp = Math.min(p.maxCp, p.cp + p.maxCp * 0.015 * dt);

  // Monster AI
  for (const m of state.monsters) {
    if (!m.alive) {
      m.respawnTimer -= dt;
      if (m.respawnTimer <= 0) {
        m.alive = true;
        m.hp = m.maxHp;
        m.x = m.spawnX + (Math.random() - 0.5) * 50;
        m.y = m.spawnY + (Math.random() - 0.5) * 50;
      }
      continue;
    }

    if (m.stunTimer > 0) { m.stunTimer -= dt; continue; }
    if (m.dotTimer > 0) {
      m.dotTimer -= dt;
      m.hp -= m.dotDamage * getPlayerPatk() * dt;
      if (m.hp <= 0) killMonster(m);
    }

    const d = dist(m, p);
    const aggroRange = m.boss ? 400 : 200;

    if (d < aggroRange) {
      m.aggro = true;
      const speed = (m.speed || 60) * (m.slowFactor || 1);
      if (d > 45) {
        m.x += ((p.x - m.x) / d) * speed * dt;
        m.y += ((p.y - m.y) / d) * speed * dt;
      }
      m.attackTimer -= dt;
      if (m.attackTimer <= 0) {
        m.attackTimer = 2;
        monsterAttack(m);
      }
    } else {
      m.aggro = false;
    }
  }

  // Projectiles
  state.projectiles = state.projectiles.filter(proj => {
    proj.life -= dt;
    const t = 1 - proj.life / 0.3;
    proj.x = proj.x + (proj.tx - proj.x) * t * 0.3;
    proj.y = proj.y + (proj.ty - proj.y) * t * 0.3;
    return proj.life > 0;
  });

  // Particles
  state.particles = state.particles.filter(part => {
    part.life -= dt * 2;
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vy += 100 * dt;
    return part.life > 0;
  });

  checkZoneTransition();
  updateHud();
}

function updateCooldownUI() {
  const p = state.player;
  for (let i = 0; i < 3; i++) {
    const skillId = p.skills[i];
    const cdEl = document.getElementById(`cd-${i}`);
    if (!skillId || !cdEl) continue;
    const cd = state.cooldowns[skillId] || 0;
    if (cd > 0) {
      cdEl.classList.add('active');
      cdEl.textContent = Math.ceil(cd);
    } else {
      cdEl.classList.remove('active');
    }
  }
}

// ===== UI =====
function updateHud() {
  const p = state.player;
  if (!p) return;
  document.getElementById('hud-name').textContent = p.name;
  document.getElementById('hud-level').textContent = `Lv.${p.level}`;
  document.getElementById('hud-class').textContent = p.className;
  document.getElementById('bar-hp').style.width = (p.hp / p.maxHp * 100) + '%';
  document.getElementById('text-hp').textContent = `${Math.floor(p.hp)}/${p.maxHp}`;
  document.getElementById('bar-mp').style.width = (p.mp / p.maxMp * 100) + '%';
  document.getElementById('text-mp').textContent = `${Math.floor(p.mp)}/${p.maxMp}`;
  document.getElementById('bar-cp').style.width = (p.cp / p.maxCp * 100) + '%';
  document.getElementById('text-cp').textContent = `${Math.floor(p.cp)}/${p.maxCp}`;
  const expPct = (p.exp / expForLevel(p.level) * 100);
  document.getElementById('bar-xp').style.width = expPct + '%';
  document.getElementById('text-xp').textContent = `${expPct.toFixed(1)}%`;
  document.getElementById('hud-adena').textContent = `💰 ${p.adena.toLocaleString()}`;

  // Skills
  for (let i = 0; i < 3; i++) {
    const skillId = p.skills[i];
    const el = document.getElementById(`skill-${i}`);
    if (skillId && el) {
      const skill = getSkill(skillId);
      if (skill) el.textContent = skill.icon;
    }
  }
}

function addLog(msg, type) {
  state.combatLog.unshift({ msg, type });
  if (state.combatLog.length > 20) state.combatLog.pop();
  const log = document.getElementById('combat-log');
  log.innerHTML = state.combatLog.slice(0, 8).map(e => `<div class="log-entry log-${e.type}">${e.msg}</div>`).join('');
}

function renderInventory() {
  const p = state.player;
  for (const slot of ['weapon', 'chest', 'shield', 'boots']) {
    const el = document.getElementById(`eq-${slot}`);
    const item = p.equipment[slot];
    el.textContent = item ? `${item.icon} ${item.name}` : '—';
  }

  const grid = document.getElementById('inv-grid');
  grid.innerHTML = '';
  for (const inv of p.inventory) {
    const item = getItem(inv.id);
    if (!item) continue;
    const el = document.createElement('div');
    el.className = 'inv-slot';
    el.innerHTML = `<span>${item.icon}</span>${inv.count > 1 ? `<span class="item-count">${inv.count}</span>` : ''}<span class="item-name">${item.name}</span>`;
    el.onclick = () => useItem(inv.id);
    grid.appendChild(el);
  }
}

function renderStats() {
  const p = state.player;
  const el = document.getElementById('stats-content');
  el.innerHTML = `
    <div class="stat-section">Основные</div>
    <div class="stat-row"><span class="stat-label">Имя</span><span class="stat-value">${p.name}</span></div>
    <div class="stat-row"><span class="stat-label">Раса</span><span class="stat-value">${p.raceName}</span></div>
    <div class="stat-row"><span class="stat-label">Класс</span><span class="stat-value">${p.className}</span></div>
    <div class="stat-row"><span class="stat-label">Уровень</span><span class="stat-value">${p.level}</span></div>
    <div class="stat-row"><span class="stat-label">Убийств</span><span class="stat-value">${p.killCount}</span></div>
    <div class="stat-section">Характеристики</div>
    <div class="stat-row"><span class="stat-label">STR</span><span class="stat-value">${p.stats.str}</span></div>
    <div class="stat-row"><span class="stat-label">CON</span><span class="stat-value">${p.stats.con}</span></div>
    <div class="stat-row"><span class="stat-label">DEX</span><span class="stat-value">${p.stats.dex}</span></div>
    <div class="stat-row"><span class="stat-label">INT</span><span class="stat-value">${p.stats.int}</span></div>
    <div class="stat-row"><span class="stat-label">WIT</span><span class="stat-value">${p.stats.wit}</span></div>
    <div class="stat-row"><span class="stat-label">MEN</span><span class="stat-value">${p.stats.men}</span></div>
    <div class="stat-section">Бой</div>
    <div class="stat-row"><span class="stat-label">P.Atk</span><span class="stat-value">${getPlayerPatk()}</span></div>
    <div class="stat-row"><span class="stat-label">M.Atk</span><span class="stat-value">${getPlayerMatk()}</span></div>
    <div class="stat-row"><span class="stat-label">P.Def</span><span class="stat-value">${getPlayerPdef()}</span></div>
    <div class="stat-row"><span class="stat-label">M.Def</span><span class="stat-value">${getPlayerMdef()}</span></div>
    <div class="stat-section">SP: ${p.sp}</div>
  `;
}

function showPanel(name) {
  closeAllPanels();
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.classList.remove('hidden');
  state.panels[name] = true;
}

function closeAllPanels() {
  for (const name of Object.keys(state.panels)) {
    const panel = document.getElementById(`panel-${name}`);
    if (panel) panel.classList.add('hidden');
    state.panels[name] = false;
  }
}

function togglePanel(name) {
  if (state.panels[name]) closeAllPanels();
  else {
    if (name === 'inventory') renderInventory();
    if (name === 'stats') renderStats();
    showPanel(name);
  }
}

// ===== SAVE / LOAD =====
async function saveGame() {
  const p = state.player;
  const data = {
    ...p,
    cooldowns: state.cooldowns,
    updatedAt: new Date().toISOString(),
  };
  try {
    const res = await fetch('/api/saves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await res.json();
    if (result.ok) addLog('Игра сохранена!', 'system');
  } catch (e) {
    addLog('Ошибка сохранения', 'system');
  }
}

async function loadSaves() {
  const res = await fetch('/api/saves');
  return await res.json();
}

async function loadGame(saveId) {
  const res = await fetch(`/api/saves/${saveId}`);
  const data = await res.json();
  state.player = data;
  state.cooldowns = data.cooldowns || {};
  state.buffs = [];
  state.dead = false;
  loadZone(data.zone);
  startGameLoop();
}

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function initCharacterCreation() {
  const raceList = document.getElementById('race-list');
  raceList.innerHTML = '';
  for (const race of GAME_DATA.classes.races) {
    const el = document.createElement('div');
    el.className = 'option-item' + (race.id === state.selectedRace ? ' selected' : '');
    el.textContent = race.name;
    el.onclick = () => {
      state.selectedRace = race.id;
      document.querySelectorAll('#race-list .option-item').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
    };
    raceList.appendChild(el);
  }

  const classList = document.getElementById('class-list');
  classList.innerHTML = '';
  for (const cls of GAME_DATA.classes.classes) {
    const el = document.createElement('div');
    el.className = 'option-item' + (cls.id === state.selectedClass ? ' selected' : '');
    el.textContent = cls.name;
    el.onclick = () => {
      state.selectedClass = cls.id;
      document.querySelectorAll('#class-list .option-item').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('class-desc').textContent = cls.desc;
    };
    classList.appendChild(el);
  }
  const firstClass = getClass(state.selectedClass);
  if (firstClass) document.getElementById('class-desc').textContent = firstClass.desc;
}

async function showLoadScreen() {
  showScreen('screen-load');
  const saves = await loadSaves();
  const list = document.getElementById('save-list');
  if (saves.length === 0) {
    list.innerHTML = '<div class="empty-saves">Нет сохранений</div>';
    return;
  }
  list.innerHTML = '';
  for (const save of saves) {
    const el = document.createElement('div');
    el.className = 'save-item';
    el.innerHTML = `<div class="save-info"><span class="save-name">${save.name}</span><span class="save-meta">Lv.${save.level} ${save.class} — ${save.zone}</span></div><button class="save-delete" data-id="${save.id}">✕</button>`;
    el.querySelector('.save-info').onclick = () => { loadGame(save.id); showScreen('screen-game'); };
    el.querySelector('.save-delete').onclick = async (e) => {
      e.stopPropagation();
      await fetch(`/api/saves/${save.id}`, { method: 'DELETE' });
      showLoadScreen();
    };
    list.appendChild(el);
  }
}

// ===== GAME LOOP =====
function startGameLoop() {
  showScreen('screen-game');
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  minimapCanvas = document.getElementById('minimap-canvas');
  minimapCtx = minimapCanvas.getContext('2d');

  resizeCanvas();
  gameRunning = true;
  lastTime = performance.now();
  updateHud();
  requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function gameLoop(time) {
  if (!gameRunning) return;
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

// ===== INPUT =====
function setupInput() {
  window.addEventListener('keydown', e => {
    state.keys[e.key.toLowerCase()] = true;

    if (document.getElementById('screen-game').classList.contains('active')) {
      if (e.key === 'Tab') { e.preventDefault(); cycleTarget(); }
      if (e.key === '1') useSkill(0);
      if (e.key === '2') useSkill(1);
      if (e.key === '3') useSkill(2);
      if (e.key === ' ') { e.preventDefault(); basicAttack(); }
      if (e.key === 'e' || e.key === 'E') interactNpc();
      if (e.key === 'i' || e.key === 'I') togglePanel('inventory');
      if (e.key === 'c' || e.key === 'C') togglePanel('stats');
      if (e.key === 'F5') { e.preventDefault(); saveGame(); }
      if (e.key === 'Escape') togglePanel('menu');
    }
  });

  window.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });

  canvas?.addEventListener('click', e => {
    if (!state.player) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left + state.camera.x;
    const my = e.clientY - rect.top + state.camera.y;

    // Check monster click
    for (const m of state.monsters) {
      if (!m.alive) continue;
      if (dist({ x: mx, y: my }, m) < (m.size || 28)) {
        selectTarget(m);
        return;
      }
    }

    // Check NPC click
    for (const npc of state.npcs) {
      if (dist({ x: mx, y: my }, npc) < 30) {
        if (npc.type === 'shop') openShop(npc);
        else if (npc.type === 'teleport') openTeleport(npc);
        else openDialog(npc);
        return;
      }
    }

    state.moveTarget = { x: mx, y: my };
  });

  window.addEventListener('resize', () => { if (canvas) resizeCanvas(); });

  // UI buttons
  document.getElementById('btn-new-game').onclick = () => { initCharacterCreation(); showScreen('screen-create'); };
  document.getElementById('btn-load-game').onclick = showLoadScreen;
  document.getElementById('btn-back-title').onclick = () => showScreen('screen-title');
  document.getElementById('btn-back-load').onclick = () => showScreen('screen-title');
  document.getElementById('btn-start-game').onclick = () => {
    const name = document.getElementById('char-name').value.trim();
    if (!name) { alert('Введите имя персонажа!'); return; }
    state.player = createPlayer(name, state.selectedRace, state.selectedClass);
    state.cooldowns = {};
    state.buffs = [];
    loadZone('talking_island');
    startGameLoop();
  };

  document.getElementById('btn-inventory').onclick = () => togglePanel('inventory');
  document.getElementById('btn-stats').onclick = () => togglePanel('stats');
  document.getElementById('btn-save').onclick = saveGame;
  document.getElementById('btn-menu').onclick = () => togglePanel('menu');
  document.getElementById('btn-save-menu').onclick = () => { saveGame(); closeAllPanels(); };
  document.getElementById('btn-quit').onclick = () => { gameRunning = false; closeAllPanels(); showScreen('screen-title'); };

  document.querySelectorAll('.panel-close').forEach(btn => {
    btn.onclick = () => closeAllPanels();
  });
}

// ===== INIT =====
async function init() {
  await loadGameData();
  setupInput();
  showScreen('screen-title');
}

init();
