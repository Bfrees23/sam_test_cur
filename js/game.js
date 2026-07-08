// Lineage II: Reborn — Game Engine
// Static mode: game data from data/*.json, saves in localStorage (GitHub Pages)
// Server mode: optional Node.js API when running npm start locally

import {
  drawTerrain, drawPortal, drawPlayer, drawMonster, drawNpc,
  drawProjectile, drawParticle, drawMoveMarker,
} from './sprites.js';
import { createNetwork, getShareUrl, getRoomFromUrl } from './network.js';
import {
  drawParallax, generateZoneDecorations, drawDecorations,
  initAmbientParticles, updateAmbientParticles, drawAmbientParticles,
  drawRemoteSkillFx,
} from './world-art.js';

const BASE = new URL('./', window.location.href).href;

let GAME_DATA = null;
let useServerApi = false;
let network = null;
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
  renderTime: 0,
  playerMoving: false,
  otherPlayers: {},
  decorations: [],
  ambientParticles: [],
  remoteFx: [],
  chatOpen: false,
  mpMode: null, // null | 'host' | 'join'
  mpRoomCode: null,
};

// ===== DATA LOADING =====
function generateExpTable(maxLevel) {
  const exp = [0];
  const sp = [0];
  for (let lv = 1; lv <= maxLevel; lv++) {
    exp[lv] = Math.floor(100 * Math.pow(lv, 2.2) + lv * 50);
    sp[lv] = Math.floor(10 * Math.pow(lv, 1.8) + lv * 5);
  }
  return { maxLevel, expTable: exp, spTable: sp };
}

async function loadStaticGameData() {
  const files = ['classes', 'skills', 'items', 'monsters', 'zones'];
  const data = {};
  for (const file of files) {
    const res = await fetch(new URL(`data/${file}.json`, BASE));
    if (!res.ok) throw new Error(`Failed to load data/${file}.json`);
    data[file] = await res.json();
  }
  data.experience = generateExpTable(80);
  return data;
}

async function loadGameData() {
  try {
    const res = await fetch(new URL('api/data', BASE));
    if (res.ok) {
      GAME_DATA = await res.json();
      useServerApi = true;
      return;
    }
  } catch {
    // GitHub Pages and other static hosts have no backend API
  }

  GAME_DATA = await loadStaticGameData();
  useServerApi = false;
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
    facing: 1,
    animTime: 0,
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

  state.decorations = generateZoneDecorations(zoneData);
  state.ambientParticles = initAmbientParticles(zoneData);

  if (network?.isConnected()) {
    network.syncZone(zoneId, state.player.x, state.player.y);
  }
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
    facing: 1,
    animTime: 0,
    prevX: x,
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

  network?.sendSkillFx(skillId, p.x, p.y);
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
  const time = state.renderTime;

  state.camera.x = p.x - w / 2;
  state.camera.y = p.y - h / 2;
  state.camera.x = Math.max(0, Math.min(zone.width - w, state.camera.x));
  state.camera.y = Math.max(0, Math.min(zone.height - h, state.camera.y));

  const cx = state.camera.x, cy = state.camera.y;

  ctx.fillStyle = zone.bgColor || '#1a1a2a';
  ctx.fillRect(0, 0, w, h);

  drawParallax(ctx, zone, cx, cy, w, h, time);
  drawTerrain(ctx, zone, cx, cy, w, h);
  drawAmbientParticles(ctx, state.ambientParticles, cx, cy, w, h, time);

  for (const conn of (zone.connections || [])) {
    drawPortal(ctx, conn.x - cx, conn.y - cy, conn.label, time);
  }

  // Y-sorted entities for depth
  const entities = [];

  for (const d of state.decorations) {
    entities.push({ type: 'deco', y: d.y, obj: d });
  }
  for (const npc of state.npcs) {
    entities.push({ type: 'npc', y: npc.y, obj: npc });
  }
  for (const m of state.monsters) {
    if (m.alive) entities.push({ type: 'monster', y: m.y, obj: m });
  }
  for (const op of Object.values(state.otherPlayers)) {
    if (op.zone === p.zone) entities.push({ type: 'other', y: op.y, obj: op });
  }
  entities.push({ type: 'player', y: p.y, obj: p });
  entities.sort((a, b) => a.y - b.y);

  for (const ent of entities) {
    const sx = ent.obj.x - cx;
    const sy = ent.obj.y - cy;

    if (ent.type === 'deco') {
      drawDecorations(ctx, [ent.obj], cx, cy, time);
    } else if (ent.type === 'npc') {
      drawNpc(ctx, sx, sy, ent.obj, time);
    } else if (ent.type === 'monster') {
      drawMonster(ctx, sx, sy, ent.obj, { isTarget: state.target === ent.obj, time });
    } else if (ent.type === 'other') {
      const op = ent.obj;
      drawPlayer(ctx, sx, sy, {
        raceId: op.raceId,
        classId: op.classId,
        facing: op.facing || 1,
        animTime: op.animTime || 0,
        moving: op.moving,
        isTarget: false,
        name: op.name,
        time,
      });
    } else {
      drawPlayer(ctx, sx, sy, {
        raceId: p.raceId,
        classId: p.classId,
        facing: p.facing || 1,
        animTime: p.animTime || 0,
        moving: state.playerMoving,
        isTarget: false,
        name: p.name,
        time,
      });
    }
  }

  state.remoteFx = state.remoteFx.filter(fx => drawRemoteSkillFx(ctx, fx, cx, cy, time));

  for (const proj of state.projectiles) {
    drawProjectile(ctx, proj, cx, cy);
  }

  for (const part of state.particles) {
    drawParticle(ctx, part, cx, cy);
  }

  if (state.moveTarget) {
    drawMoveMarker(ctx, state.moveTarget.x, state.moveTarget.y, cx, cy, time);
  }

  renderMinimap();
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

  // Other players on minimap
  for (const op of Object.values(state.otherPlayers)) {
    minimapCtx.fillStyle = '#44aaff';
    minimapCtx.fillRect(op.x * sx - 1, op.y * sy - 1, 3, 3);
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

  state.playerMoving = dx !== 0 || dy !== 0;
  if (state.playerMoving) {
    if (Math.abs(dx) > 0.1) p.facing = dx < 0 ? -1 : 1;
    p.animTime = (p.animTime || 0) + dt;
  }

  network?.syncPlayer(p, state.playerMoving);
  network?.interpolateOthers(dt);
  updateAmbientParticles(state.ambientParticles, state.zone, dt);

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
      const mspeed = (m.speed || 60) * (m.slowFactor || 1);
      if (d > 45) {
        const mx = ((p.x - m.x) / d) * mspeed * dt;
        const my = ((p.y - m.y) / d) * mspeed * dt;
        m.x += mx;
        m.y += my;
        if (Math.abs(mx) > 0.01) m.facing = mx < 0 ? -1 : 1;
        m.animTime = (m.animTime || 0) + dt;
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
const STORAGE_KEY = 'l2reborn_saves';

function readLocalSaves() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeLocalSave(id, data) {
  const saves = readLocalSaves();
  saves[id] = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
}

function deleteLocalSave(id) {
  const saves = readLocalSaves();
  delete saves[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
}

function mapSaveEntry(id, data) {
  return {
    id,
    name: data.name,
    level: data.level,
    class: data.className,
    race: data.raceName,
    zone: data.zone,
    updatedAt: data.updatedAt,
  };
}

async function saveGame() {
  const p = state.player;
  const data = {
    ...p,
    cooldowns: state.cooldowns,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (useServerApi) {
      const res = await fetch(new URL('api/saves', BASE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.ok) {
        addLog('Игра сохранена!', 'system');
        return;
      }
    }
  } catch {
    // Fall back to browser storage on static hosts
  }

  writeLocalSave(data.saveId, data);
  addLog('Игра сохранена в браузере!', 'system');
}

async function loadSaves() {
  try {
    if (useServerApi) {
      const res = await fetch(new URL('api/saves', BASE));
      if (res.ok) return await res.json();
    }
  } catch {
    // Fall back to browser storage on static hosts
  }

  return Object.entries(readLocalSaves()).map(([id, data]) => mapSaveEntry(id, data));
}

async function loadGame(saveId) {
  let data = null;

  try {
    if (useServerApi) {
      const res = await fetch(new URL(`api/saves/${saveId}`, BASE));
      if (res.ok) data = await res.json();
    }
  } catch {
    // Fall back to browser storage on static hosts
  }

  if (!data) data = readLocalSaves()[saveId];
  if (!data) return;

  state.player = data;
  state.cooldowns = data.cooldowns || {};
  state.buffs = [];
  state.dead = false;
  loadZone(data.zone);
  startGameLoop();
}

async function deleteSave(saveId) {
  try {
    if (useServerApi) {
      await fetch(new URL(`api/saves/${saveId}`, BASE), { method: 'DELETE' });
      return;
    }
  } catch {
    // Fall back to browser storage on static hosts
  }

  deleteLocalSave(saveId);
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
      updateCharPreview();
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
      updateCharPreview();
    };
    classList.appendChild(el);
  }
  const firstClass = getClass(state.selectedClass);
  if (firstClass) document.getElementById('class-desc').textContent = firstClass.desc;
  updateCharPreview();
}

function updateCharPreview() {
  const canvas = document.getElementById('char-preview');
  if (!canvas) return;
  const pctx = canvas.getContext('2d');
  pctx.clearRect(0, 0, canvas.width, canvas.height);
  pctx.fillStyle = '#1a2a1a';
  pctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPlayer(pctx, canvas.width / 2, canvas.height / 2 + 20, {
    raceId: state.selectedRace,
    classId: state.selectedClass,
    facing: 1,
    animTime: performance.now() / 1000,
    moving: false,
    isTarget: false,
    name: '',
    time: performance.now(),
  });
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
      await deleteSave(save.id);
      showLoadScreen();
    };
    list.appendChild(el);
  }
}

// ===== MULTIPLAYER & CHAT =====
function initMultiplayer() {
  if (!state.mpMode) {
    updateMpStatus('solo');
    return;
  }

  network = createNetwork(state, {
    onStatus: (status, count) => updateMpStatus(status, count),
    onRoom: (code) => {
      state.mpRoomCode = code;
      const el = document.getElementById('hud-room');
      if (el) el.textContent = `Комната: ${code}`;
    },
    onPlayersUpdate: updateOnlineList,
    onChat: appendChatMessage,
    onSkillFx: (msg) => {
      state.remoteFx.push({ x: msg.x, y: msg.y, startTime: performance.now() });
    },
  });

  const p = state.player;
  if (state.mpMode === 'host') {
    network.createRoom(p).then((code) => {
      const url = getShareUrl(code);
      appendChatMessage({ type: 'system', text: `Комната ${code} создана!` });
      appendChatMessage({ type: 'system', text: `Ссылка: ${url}` });
    }).catch(() => {
      appendChatMessage({ type: 'system', text: 'Ошибка создания комнаты' });
      updateMpStatus('error');
    });
  } else if (state.mpMode === 'join' && state.mpRoomCode) {
    network.joinRoom(state.mpRoomCode, p).then(() => {
      appendChatMessage({ type: 'system', text: `Подключено к комнате ${state.mpRoomCode}` });
    }).catch(() => {
      appendChatMessage({ type: 'system', text: 'Не удалось подключиться. Проверьте код комнаты.' });
      updateMpStatus('error');
    });
  }
}

function showMultiplayerLobby() {
  showScreen('screen-multiplayer');
  document.getElementById('room-info').classList.add('hidden');
  const urlRoom = getRoomFromUrl();
  if (urlRoom) {
    document.getElementById('room-code-input').value = urlRoom;
  }
}

function startMultiplayerHost() {
  state.mpMode = 'host';
  state.mpRoomCode = null;
  initCharacterCreation();
  showScreen('screen-create');
}

function startMultiplayerJoin() {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (code.length < 4) { alert('Введите код комнаты (минимум 4 символа)'); return; }
  state.mpMode = 'join';
  state.mpRoomCode = code;
  initCharacterCreation();
  showScreen('screen-create');
}

function updateMpStatus(status, count) {
  const el = document.getElementById('mp-status');
  if (!el) return;
  if (status === 'online') {
    el.textContent = state.mpRoomCode
      ? `🟢 Комната ${state.mpRoomCode} · ${count || 1} игр.`
      : `🟢 Online: ${count || 1}`;
    el.className = 'mp-online';
  } else if (status === 'solo') {
    el.textContent = '⚪ Solo';
    el.className = 'mp-solo';
  } else if (status === 'error') {
    el.textContent = '🔴 Ошибка подключения';
    el.className = 'mp-solo';
  } else {
    el.textContent = '🟡 Подключение...';
    el.className = 'mp-connecting';
  }
}

function updateOnlineList() {
  const list = document.getElementById('online-list');
  if (!list) return;
  const others = Object.values(state.otherPlayers);
  if (others.length === 0) {
    list.innerHTML = '<div class="online-empty">Нет других игроков в зоне</div>';
    return;
  }
  list.innerHTML = others.map(p =>
    `<div class="online-player"><span class="online-name">${p.name}</span><span class="online-meta">Lv.${p.level} ${p.className || ''}</span></div>`
  ).join('');
}

function appendChatMessage(msg) {
  const log = document.getElementById('chat-log');
  if (!log) return;
  const el = document.createElement('div');
  el.className = `chat-msg chat-${msg.type || 'player'}`;
  if (msg.type === 'system') {
    el.textContent = msg.text;
  } else if (msg.type === 'self') {
    el.innerHTML = `<span class="chat-name">${msg.name}:</span> ${msg.text}`;
  } else {
    el.innerHTML = `<span class="chat-name">${msg.name}:</span> ${msg.text}`;
  }
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 50) log.removeChild(log.firstChild);
}

function toggleChat() {
  const panel = document.getElementById('chat-panel');
  const input = document.getElementById('chat-input');
  if (!panel) return;
  state.chatOpen = !state.chatOpen;
  panel.classList.toggle('hidden', !state.chatOpen);
  if (state.chatOpen) { input?.focus(); }
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  if (network?.sendChat(text)) {
    appendChatMessage({ type: 'self', name: state.player.name, text });
  } else {
    appendChatMessage({ type: 'system', text: 'Подключитесь к комнате для чата' });
  }
  input.value = '';
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
  initMultiplayer();
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
  state.renderTime = time;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

// ===== INPUT =====
function setupInput() {
  window.addEventListener('keydown', e => {
    state.keys[e.key.toLowerCase()] = true;

    if (document.getElementById('screen-game').classList.contains('active')) {
      if (state.chatOpen && e.key === 'Enter') {
        e.preventDefault();
        sendChatMessage();
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); toggleChat(); return; }
      if (state.chatOpen && e.key === 'Escape') { toggleChat(); return; }
      if (state.chatOpen) return;

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
  document.getElementById('btn-new-game').onclick = () => { state.mpMode = null; state.mpRoomCode = null; initCharacterCreation(); showScreen('screen-create'); };
  document.getElementById('btn-multiplayer').onclick = showMultiplayerLobby;
  document.getElementById('btn-load-game').onclick = showLoadScreen;
  document.getElementById('btn-back-title').onclick = () => { state.mpMode = null; showScreen('screen-title'); };
  document.getElementById('btn-back-load').onclick = () => showScreen('screen-title');
  document.getElementById('btn-mp-back').onclick = () => showScreen('screen-title');
  document.getElementById('btn-create-room').onclick = startMultiplayerHost;
  document.getElementById('btn-join-room').onclick = startMultiplayerJoin;
  document.getElementById('btn-copy-link').onclick = () => {
    const link = document.getElementById('room-link');
    link.select();
    navigator.clipboard?.writeText(link.value);
    alert('Ссылка скопирована!');
  };
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
  document.getElementById('btn-quit').onclick = () => { gameRunning = false; network?.disconnect(); closeAllPanels(); showScreen('screen-title'); };

  document.getElementById('btn-chat-toggle')?.addEventListener('click', toggleChat);
  document.getElementById('chat-close')?.addEventListener('click', toggleChat);
  document.getElementById('chat-send')?.addEventListener('click', sendChatMessage);
  document.getElementById('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); }
  });

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
