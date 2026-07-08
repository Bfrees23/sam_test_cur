// WebSocket multiplayer hub — zone-based player sync + chat
const { WebSocketServer } = require('ws');

let wss = null;
const clients = new Map(); // ws -> player state
let nextId = 1;

function serializePlayer(id, p) {
  return {
    id, name: p.name, zone: p.zone,
    x: p.x, y: p.y, facing: p.facing,
    raceId: p.raceId, classId: p.classId,
    level: p.level, className: p.className,
    moving: p.moving, animTime: p.animTime,
  };
}

function playersInZone(zoneId, excludeId = null) {
  const list = [];
  for (const [ws, p] of clients) {
    if (p.zone === zoneId && p.id !== excludeId && ws.readyState === 1) {
      list.push(serializePlayer(p.id, p));
    }
  }
  return list;
}

function broadcast(zoneId, msg, excludeWs = null) {
  const data = JSON.stringify(msg);
  for (const [ws, p] of clients) {
    if (p.zone === zoneId && ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

function broadcastAll(msg) {
  const data = JSON.stringify(msg);
  for (const [ws] of clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function handleMessage(ws, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  const p = clients.get(ws);
  if (!p) return;

  switch (msg.type) {
    case 'move':
      p.x = msg.x; p.y = msg.y;
      p.facing = msg.facing ?? p.facing;
      p.moving = !!msg.moving;
      p.animTime = msg.animTime ?? p.animTime;
      broadcast(p.zone, { type: 'player_move', id: p.id, x: p.x, y: p.y, facing: p.facing, moving: p.moving, animTime: p.animTime }, ws);
      break;

    case 'zone':
      if (msg.zone && msg.zone !== p.zone) {
        const oldZone = p.zone;
        broadcast(oldZone, { type: 'player_leave', id: p.id });
        p.zone = msg.zone;
        p.x = msg.x ?? p.x;
        p.y = msg.y ?? p.y;
        ws.send(JSON.stringify({ type: 'zone_players', players: playersInZone(p.zone) }));
        broadcast(p.zone, { type: 'player_join', player: serializePlayer(p.id, p) }, ws);
      }
      break;

    case 'chat':
      if (!msg.text || msg.text.length > 200) return;
      const chatMsg = { type: 'chat', id: p.id, name: p.name, text: msg.text.slice(0, 200), time: Date.now() };
      broadcast(p.zone, chatMsg);
      break;

    case 'skill':
      broadcast(p.zone, { type: 'skill_fx', id: p.id, skillId: msg.skillId, x: msg.x, y: msg.y, facing: p.facing }, ws);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
      break;
  }
}

function attachMultiplayer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'join') {
        const pl = msg.player || {};
        const id = nextId++;
        const state = {
          id,
          name: (pl.name || 'Hero').slice(0, 16),
          zone: pl.zone || 'talking_island',
          x: pl.x ?? 200, y: pl.y ?? 200,
          facing: 1, moving: false, animTime: 0,
          raceId: pl.raceId || 'human',
          classId: pl.classId || 'warrior',
          level: pl.level || 1,
          className: pl.className || 'Warrior',
        };
        clients.set(ws, state);

        ws.send(JSON.stringify({
          type: 'welcome',
          id,
          online: clients.size,
          players: playersInZone(state.zone, id),
        }));

        broadcast(state.zone, { type: 'player_join', player: serializePlayer(id, state) }, ws);
        return;
      }

      handleMessage(ws, raw);
    });

    ws.on('close', () => {
      const p = clients.get(ws);
      if (p) {
        broadcast(p.zone, { type: 'player_leave', id: p.id });
        clients.delete(ws);
      }
    });

    ws.on('error', () => ws.close());
  });

  // Heartbeat — drop stale connections
  setInterval(() => {
    for (const [ws] of clients) {
      if (ws.readyState !== 1) continue;
      ws.ping();
    }
  }, 30000);

  return wss;
}

function getOnlineCount() {
  return clients.size;
}

module.exports = { attachMultiplayer, getOnlineCount };
