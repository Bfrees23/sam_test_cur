// Global world multiplayer via WebRTC (PeerJS) — one shared world for all players

const GLOBAL_HOST_ID = 'l2reborn-world-global';
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const RECONNECT_MS = 4000;

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
  let myId = null;
  let connected = false;
  let lastSync = 0;
  let localPlayer = null;
  let reconnectTimer = null;
  let hostConn = null; // client's connection to world host
  const connections = new Map();

  function waitForPeer() {
    return new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') reject(new Error('PeerJS not loaded'));
      else resolve();
    });
  }

  function cleanup() {
    clearTimeout(reconnectTimer);
    for (const [, c] of connections) { try { c.close(); } catch {} }
    connections.clear();
    hostConn = null;
    if (peer) { try { peer.destroy(); } catch {} peer = null; }
    connected = false;
    myId = null;
    isHost = false;
  }

  function updateOnlineCount() {
    const count = isHost ? connections.size + 1 : (connected ? connections.size + 2 : 1);
    callbacks.onStatus?.('online', Math.max(1, count));
  }

  function addOther(p) {
    state.otherPlayers[p.id] = { ...p, targetX: p.x, targetY: p.y };
  }

  function broadcast(msg) {
    for (const [, c] of connections) {
      if (c.open) c.send(msg);
    }
  }

  function sendToHost(msg) {
    if (hostConn?.open) hostConn.send(msg);
  }

  function setupConn(conn, isHostLink = false) {
    if (isHostLink) hostConn = conn;
    else connections.set(conn.peer, conn);

    conn.on('open', () => {
      connected = true;
      callbacks.onStatus?.('connecting');
      if (localPlayer) {
        conn.send({ type: 'join', player: serializePlayer(myId, { ...localPlayer, moving: false }) });
      }
      updateOnlineCount();
    });

    conn.on('data', (msg) => handleMsg(msg, conn));
    conn.on('close', () => {
      if (isHostLink) {
        hostConn = null;
        connected = false;
        state.otherPlayers = {};
        callbacks.onPlayersUpdate?.();
        callbacks.onStatus?.('reconnecting');
        scheduleReconnect();
      } else {
        connections.delete(conn.peer);
        delete state.otherPlayers[conn.peer];
        callbacks.onPlayersUpdate?.();
        updateOnlineCount();
      }
    });
  }

  function handleMsg(msg, fromConn) {
    if (!msg?.type) return;

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
            const existing = Object.values(state.otherPlayers).filter(p => p.id !== msg.player.id);
            fromConn.send({ type: 'snapshot', players: existing });
            callbacks.onChat?.({ type: 'system', text: `${msg.player.name} вошёл в мир` });
          }
        }
        break;
      case 'snapshot':
        for (const p of (msg.players || [])) addOther(p);
        callbacks.onPlayersUpdate?.();
        callbacks.onStatus?.('online');
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
      case 'zone': {
        const op = state.otherPlayers[msg.id];
        if (op && msg.id !== myId) {
          op.zone = msg.zone; op.targetX = msg.x; op.targetY = msg.y;
          op.x = msg.x; op.y = msg.y;
        }
        break;
      }
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
      case 'online_count':
        callbacks.onStatus?.('online', msg.count);
        break;
    }
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (localPlayer) connectWorld(localPlayer);
    }, RECONNECT_MS);
  }

  async function tryBecomeHost() {
    return new Promise((resolve, reject) => {
      const hostPeer = new Peer(GLOBAL_HOST_ID, { config: ICE });
      let settled = false;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        try { hostPeer.destroy(); } catch {}
        reject(err);
      };

      hostPeer.on('open', (id) => {
        if (settled) return;
        settled = true;
        peer = hostPeer;
        isHost = true;
        myId = id;
        connected = true;
        peer.on('connection', (conn) => setupConn(conn, false));
        peer.on('error', (err) => {
          if (err.type !== 'disconnected') scheduleReconnect();
        });
        callbacks.onStatus?.('online', 1);
        callbacks.onChat?.({ type: 'system', text: 'Подключено к общему миру. Другие игроки появятся рядом, когда войдут в игру.' });
        resolve('host');
      });

      hostPeer.on('error', (err) => {
        if (err.type === 'unavailable-id') fail(err);
        else if (!settled) fail(err);
      });

      setTimeout(() => fail(new Error('host timeout')), 5000);
    });
  }

  async function joinAsClient() {
    return new Promise((resolve, reject) => {
      peer = new Peer({ config: ICE });

      peer.on('open', (id) => {
        myId = id;
        isHost = false;
        const conn = peer.connect(GLOBAL_HOST_ID, { reliable: true });
        setupConn(conn, true);

        conn.on('open', () => {
          connected = true;
          conn.send({ type: 'join', player: serializePlayer(myId, { ...localPlayer, moving: false }) });
          callbacks.onStatus?.('online');
          resolve('client');
        });

        conn.on('error', () => reject(new Error('host unreachable')));

        setTimeout(() => {
          if (!connected) reject(new Error('connect timeout'));
        }, 8000);
      });

      peer.on('error', (err) => reject(err));
    });
  }

  async function connectWorld(player) {
    await waitForPeer();
    cleanup();
    localPlayer = player;
    state.otherPlayers = {};
    callbacks.onStatus?.('connecting');

    try {
      await tryBecomeHost();
    } catch {
      try {
        await joinAsClient();
      } catch {
        callbacks.onStatus?.('reconnecting');
        scheduleReconnect();
      }
    }
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

    if (isHost) {
      broadcast(msg);
      if (connections.size > 0) {
        callbacks.onStatus?.('online', connections.size + 1);
      }
    } else {
      sendToHost(msg);
    }
  }

  function syncZone(zoneId, x, y) {
    if (!connected || !myId) return;
    const msg = { type: 'zone', id: myId, zone: zoneId, x, y };
    if (isHost) broadcast(msg);
    else sendToHost(msg);
  }

  function sendChat(text) {
    if (!connected || !myId || !localPlayer) return false;
    const msg = { type: 'chat', id: myId, name: localPlayer.name, text };
    if (isHost) broadcast(msg);
    else sendToHost(msg);
    return true;
  }

  function sendSkillFx(skillId, x, y) {
    if (!connected || !myId) return;
    const msg = { type: 'skill_fx', id: myId, skillId, x, y };
    if (isHost) broadcast(msg);
    else sendToHost(msg);
  }

  function disconnect() {
    if (myId) {
      const msg = { type: 'leave', id: myId };
      if (isHost) broadcast(msg);
      else sendToHost(msg);
    }
    cleanup();
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

  return {
    connectWorld, disconnect,
    syncPlayer, syncZone, sendChat, sendSkillFx,
    interpolateOthers, isConnected,
  };
}
