// P2P multiplayer via WebRTC (PeerJS) — works on GitHub Pages, no backend needed

const PEER_PREFIX = 'l2reborn-';
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function genRoomCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function serializePlayer(id, p) {
  return {
    id, name: p.name, zone: p.zone,
    x: p.x, y: p.y, facing: p.facing || 1,
    raceId: p.raceId, classId: p.classId,
    level: p.level, className: p.className,
    moving: !!p.moving, animTime: p.animTime || 0,
  };
}

export function createNetwork(state, callbacks = {}) {
  let peer = null;
  let isHost = false;
  let roomCode = null;
  let myId = null;
  let connected = false;
  let lastSync = 0;
  const connections = new Map(); // peerId -> DataConnection
  let localPlayer = null;

  function waitForPeer() {
    return new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') {
        reject(new Error('PeerJS not loaded'));
        return;
      }
      resolve();
    });
  }

  function setupConn(conn) {
    connections.set(conn.peer, conn);

    conn.on('open', () => {
      connected = true;
      if (localPlayer) {
        conn.send({ type: 'join', player: serializePlayer(myId, { ...localPlayer, moving: false }) });
      }
      updateOnlineCount();
    });

    conn.on('data', (msg) => handleMsg(msg, conn));
    conn.on('close', () => {
      connections.delete(conn.peer);
      delete state.otherPlayers[conn.peer];
      callbacks.onPlayersUpdate?.();
      updateOnlineCount();
    });
  }

  function handleMsg(msg, fromConn) {
    if (!msg?.type) return;

    // Host relays to everyone else
    if (isHost && fromConn) {
      for (const [pid, c] of connections) {
        if (pid !== fromConn.peer && c.open) c.send(msg);
      }
    }

    switch (msg.type) {
      case 'join':
        if (msg.player && msg.player.id !== myId) {
          addOther(msg.player);
          callbacks.onPlayersUpdate?.();
          if (isHost && fromConn) {
            // Send snapshot of existing players to newcomer
            const existing = Object.values(state.otherPlayers).filter(p => p.id !== msg.player.id);
            fromConn.send({ type: 'snapshot', players: existing });
            callbacks.onChat?.({ type: 'system', text: `${msg.player.name} присоединился` });
          }
        }
        break;

      case 'snapshot':
        for (const p of (msg.players || [])) addOther(p);
        callbacks.onPlayersUpdate?.();
        break;

      case 'move': {
        const op = state.otherPlayers[msg.id];
        if (op) {
          op.targetX = msg.x; op.targetY = msg.y;
          op.facing = msg.facing; op.moving = msg.moving;
          op.animTime = msg.animTime; op.zone = msg.zone;
        }
        break;
      }

      case 'zone':
        if (msg.id !== myId) {
          const op = state.otherPlayers[msg.id];
          if (op) { op.zone = msg.zone; op.targetX = msg.x; op.targetY = msg.y; op.x = msg.x; op.y = msg.y; }
        }
        break;

      case 'chat':
        if (msg.id !== myId) callbacks.onChat?.({ type: 'player', name: msg.name, text: msg.text });
        break;

      case 'skill_fx':
        if (msg.id !== myId) callbacks.onSkillFx?.(msg);
        break;

      case 'leave':
        delete state.otherPlayers[msg.id];
        callbacks.onPlayersUpdate?.();
        break;
    }
  }

  function addOther(p) {
    state.otherPlayers[p.id] = { ...p, targetX: p.x, targetY: p.y };
  }

  function updateOnlineCount() {
    const count = connections.size + 1;
    callbacks.onStatus?.('online', count);
    if (roomCode) callbacks.onRoom?.(roomCode);
  }

  function broadcast(msg) {
    for (const [, c] of connections) {
      if (c.open) c.send(msg);
    }
  }

  async function createRoom(player) {
    await waitForPeer();
    localPlayer = player;
    roomCode = genRoomCode();
    isHost = true;
    state.otherPlayers = {};

    return new Promise((resolve, reject) => {
      peer = new Peer(`${PEER_PREFIX}${roomCode}`, { config: ICE });

      peer.on('open', (id) => {
        myId = id;
        connected = true;
        callbacks.onStatus?.('online', 1);
        callbacks.onRoom?.(roomCode);
        resolve(roomCode);
      });

      peer.on('connection', setupConn);

      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          roomCode = genRoomCode();
          peer.destroy();
          createRoom(player).then(resolve).catch(reject);
        } else {
          callbacks.onStatus?.('error');
          reject(err);
        }
      });
    });
  }

  async function joinRoom(code, player) {
    await waitForPeer();
    localPlayer = player;
    roomCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    isHost = false;
    state.otherPlayers = {};

    return new Promise((resolve, reject) => {
      peer = new Peer({ config: ICE });

      peer.on('open', (id) => {
        myId = id;
        const hostId = `${PEER_PREFIX}${roomCode}`;
        const conn = peer.connect(hostId, { reliable: true });
        setupConn(conn);

        conn.on('open', () => {
          connected = true;
          conn.send({ type: 'join', player: serializePlayer(myId, { ...player, moving: false }) });
          callbacks.onStatus?.('online', 2);
          callbacks.onRoom?.(roomCode);
          resolve(roomCode);
        });

        conn.on('error', () => {
          callbacks.onStatus?.('error');
          reject(new Error('Cannot connect to room'));
        });

        setTimeout(() => {
          if (!connected) {
            callbacks.onStatus?.('error');
            reject(new Error('Room not found'));
          }
        }, 8000);
      });

      peer.on('error', (err) => {
        callbacks.onStatus?.('error');
        reject(err);
      });
    });
  }

  function syncPlayer(player, moving, force = false) {
    if (!connected || !myId) return;
    localPlayer = player;
    const now = performance.now();
    if (!force && now - lastSync < 50) return;
    lastSync = now;

    const msg = {
      type: 'move', id: myId,
      x: Math.round(player.x), y: Math.round(player.y),
      zone: player.zone,
      facing: player.facing || 1,
      moving, animTime: player.animTime || 0,
    };

    if (isHost) broadcast(msg);
    else {
      const conn = connections.values().next().value;
      if (conn?.open) conn.send(msg);
    }
  }

  function syncZone(zoneId, x, y) {
    if (!connected || !myId) return;
    const msg = { type: 'zone', id: myId, zone: zoneId, x, y };
    if (isHost) broadcast(msg);
    else {
      const conn = connections.values().next().value;
      if (conn?.open) conn.send(msg);
    }
  }

  function sendChat(text) {
    if (!connected || !myId || !localPlayer) return false;
    const msg = { type: 'chat', id: myId, name: localPlayer.name, text };
    if (isHost) broadcast(msg);
    else {
      const conn = connections.values().next().value;
      if (conn?.open) conn.send(msg);
    }
    return true;
  }

  function sendSkillFx(skillId, x, y) {
    if (!connected || !myId) return;
    const msg = { type: 'skill_fx', id: myId, skillId, x, y };
    if (isHost) broadcast(msg);
    else {
      const conn = connections.values().next().value;
      if (conn?.open) conn.send(msg);
    }
  }

  function disconnect() {
    if (myId) {
      const msg = { type: 'leave', id: myId };
      if (isHost) broadcast(msg);
    }
    for (const [, c] of connections) c.close();
    connections.clear();
    if (peer) { peer.destroy(); peer = null; }
    connected = false;
    myId = null;
    roomCode = null;
    state.otherPlayers = {};
  }

  function interpolateOthers(dt) {
    for (const op of Object.values(state.otherPlayers)) {
      if (op.zone && state.player && op.zone !== state.player.zone) continue;
      const t = Math.min(1, dt * 12);
      op.x += ((op.targetX ?? op.x) - op.x) * t;
      op.y += ((op.targetY ?? op.y) - op.y) * t;
    }
  }

  function isConnected() { return connected; }
  function getRoomCode() { return roomCode; }
  function getIsHost() { return isHost; }

  return {
    createRoom, joinRoom, disconnect,
    syncPlayer, syncZone, sendChat, sendSkillFx,
    interpolateOthers, isConnected, getRoomCode, getIsHost,
  };
}

export function getShareUrl(code) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', code);
  return url.toString();
}

export function getRoomFromUrl() {
  return new URLSearchParams(window.location.search).get('room')?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || null;
}
