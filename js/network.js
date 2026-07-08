// Client multiplayer module — WebSocket sync with other players

export function createNetwork(state, callbacks = {}) {
  let ws = null;
  let myId = null;
  let connected = false;
  let reconnectTimer = null;
  let lastSync = 0;

  function getWsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  function connect(player) {
    if (ws && ws.readyState <= 1) return;
    try {
      ws = new WebSocket(getWsUrl());
    } catch {
      callbacks.onStatus?.('offline');
      return;
    }

    ws.onopen = () => {
      connected = true;
      callbacks.onStatus?.('online');
      ws.send(JSON.stringify({
        type: 'join',
        player: {
          name: player.name,
          raceId: player.raceId,
          classId: player.classId,
          className: player.className,
          level: player.level,
          zone: player.zone,
          x: player.x,
          y: player.y,
        },
      }));
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      handleMessage(msg);
    };

    ws.onclose = () => {
      connected = false;
      myId = null;
      state.otherPlayers = {};
      callbacks.onStatus?.('offline');
      callbacks.onPlayersUpdate?.();
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (state.player) connect(state.player);
      }, 3000);
    };

    ws.onerror = () => ws.close();
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        myId = msg.id;
        state.otherPlayers = {};
        for (const p of (msg.players || [])) {
          addOtherPlayer(p);
        }
        callbacks.onStatus?.('online', msg.online);
        callbacks.onPlayersUpdate?.();
        break;

      case 'zone_players':
        state.otherPlayers = {};
        for (const p of (msg.players || [])) addOtherPlayer(p);
        callbacks.onPlayersUpdate?.();
        break;

      case 'player_join':
        if (msg.player && msg.player.id !== myId) {
          addOtherPlayer(msg.player);
          callbacks.onPlayersUpdate?.();
          callbacks.onChat?.({ type: 'system', text: `${msg.player.name} вошёл в зону` });
        }
        break;

      case 'player_leave':
        delete state.otherPlayers[msg.id];
        callbacks.onPlayersUpdate?.();
        break;

      case 'player_move': {
        const op = state.otherPlayers[msg.id];
        if (op) {
          op.targetX = msg.x;
          op.targetY = msg.y;
          op.facing = msg.facing;
          op.moving = msg.moving;
          op.animTime = msg.animTime;
        }
        break;
      }

      case 'chat':
        if (msg.id !== myId) {
          callbacks.onChat?.({ type: 'player', name: msg.name, text: msg.text });
        }
        break;

      case 'skill_fx':
        callbacks.onSkillFx?.(msg);
        break;
    }
  }

  function addOtherPlayer(p) {
    state.otherPlayers[p.id] = {
      ...p,
      targetX: p.x,
      targetY: p.y,
    };
  }

  function syncPlayer(player, moving, force = false) {
    if (!connected || !ws || ws.readyState !== 1) return;
    const now = performance.now();
    if (!force && now - lastSync < 50) return;
    lastSync = now;
    ws.send(JSON.stringify({
      type: 'move',
      x: Math.round(player.x),
      y: Math.round(player.y),
      facing: player.facing || 1,
      moving,
      animTime: player.animTime || 0,
    }));
  }

  function syncZone(zoneId, x, y) {
    if (!connected || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'zone', zone: zoneId, x, y }));
  }

  function sendChat(text) {
    if (!connected || !ws || ws.readyState !== 1) return false;
    ws.send(JSON.stringify({ type: 'chat', text }));
    return true;
  }

  function sendSkillFx(skillId, x, y) {
    if (!connected || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'skill', skillId, x, y }));
  }

  function disconnect() {
    clearTimeout(reconnectTimer);
    if (ws) { ws.close(); ws = null; }
    connected = false;
    myId = null;
    state.otherPlayers = {};
  }

  function interpolateOthers(dt) {
    for (const op of Object.values(state.otherPlayers)) {
      const t = Math.min(1, dt * 12);
      op.x += ((op.targetX ?? op.x) - op.x) * t;
      op.y += ((op.targetY ?? op.y) - op.y) * t;
    }
  }

  function isConnected() { return connected; }
  function getMyId() { return myId; }

  return {
    connect, disconnect, syncPlayer, syncZone,
    sendChat, sendSkillFx, interpolateOthers,
    isConnected, getMyId,
  };
}
