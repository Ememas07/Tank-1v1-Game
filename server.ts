import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { clampLoadout, DEFAULT_P1_LOADOUT, DEFAULT_P2_LOADOUT } from './src/game/customization';
import { computeBotInput, createEmptyInput, createMatchState, stepSimulation } from './src/game/engine';
import { ARENA_MAPS } from './src/game/maps';
import { cleanPlayerName } from './src/game/sync';
import type {
  ChatMessage,
  ClientMessage,
  GameMode,
  GameSnapshot,
  MapId,
  MapSelection,
  MatchFormat,
  PlayerId,
  PlayerInput,
  RoomPlayerInfo,
  ServerMessage,
  TankLoadout,
  TeamId,
} from './src/game/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PlayerSlot {
  id: PlayerId;
  teamId: TeamId;
  name: string;
  loadout: TankLoadout;
  ws: WebSocket | null;
  input: PlayerInput;
  ready: boolean;
}

interface GameRoom {
  code: string;
  format: MatchFormat;
  mode: GameMode;
  mapSelection: MapSelection;
  fillBots: boolean;
  hostId: PlayerId;
  status: 'waiting' | 'playing';
  players: Partial<Record<PlayerId, PlayerSlot>>;
  botIds: Set<PlayerId>;
  rematchVotes: Set<PlayerId>;
  chatHistory: ChatMessage[];
  nextChatId: number;
  snapshot: GameSnapshot | null;
  tickInterval: NodeJS.Timeout | null;
  tickCount: number;
  lastStepTime: number;
  countdownTimer: NodeJS.Timeout | null;
  countdownSeconds: number | null;
}

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALL_SLOTS: PlayerId[] = [1, 2, 3, 4];
const rooms = new Map<string, GameRoom>();
const clientRoomMap = new Map<WebSocket, { roomCode: string; playerId: PlayerId }>();

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `T${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function sendJson(ws: WebSocket | null | undefined, payload: ServerMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getConnectedSlots(room: GameRoom): PlayerSlot[] {
  const list: PlayerSlot[] = [];
  for (const id of ALL_SLOTS) {
    const slot = room.players[id];
    if (slot) list.push(slot);
  }
  return list;
}

function getRoomPlayersList(room: GameRoom): RoomPlayerInfo[] {
  return getConnectedSlots(room).map((slot) => ({
    id: slot.id,
    teamId: slot.teamId,
    name: slot.name,
    loadout: slot.loadout,
    connected: Boolean(slot.ws && slot.ws.readyState === WebSocket.OPEN),
    isHost: slot.id === room.hostId,
    ready: slot.ready,
  }));
}

function broadcastRoom(room: GameRoom, payload: ServerMessage): void {
  for (const slot of getConnectedSlots(room)) {
    sendJson(slot.ws, payload);
  }
}

function stopRoomLoop(room: GameRoom): void {
  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }
}

function stopCountdown(room: GameRoom, broadcastCancel = true): void {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
  const hadCountdown = room.countdownSeconds !== null;
  room.countdownSeconds = null;
  if (broadcastCancel && hadCountdown) {
    broadcastRoom(room, {
      type: 'room:countdown_cancelled',
    });
  }
}

function isRoomReadyToLaunch(room: GameRoom): boolean {
  if (room.status !== 'waiting') return false;
  const slots = getConnectedSlots(room);
  if (slots.length < 1) return false;

  if (!room.fillBots) {
    if (room.format === '1v1' && slots.length < 2) return false;
    if (room.format === '2v2') {
      const counts = getTeamCounts(room);
      if (counts[1] === 0 || counts[2] === 0) return false;
    }
    if (room.format === 'ffa' && slots.length < 2) return false;
  }

  // All human players in the room must be ready
  return slots.every((s) => s.ready);
}

function checkAndHandleAutoStart(room: GameRoom): void {
  if (room.status !== 'waiting') return;
  const canAutoStart = isRoomReadyToLaunch(room);

  if (canAutoStart) {
    if (room.countdownTimer) return;
    room.countdownSeconds = 3;
    broadcastRoom(room, {
      type: 'room:countdown',
      count: 3,
    });

    room.countdownTimer = setInterval(() => {
      if (room.status !== 'waiting') {
        stopCountdown(room, false);
        return;
      }
      if (!isRoomReadyToLaunch(room)) {
        stopCountdown(room, true);
        return;
      }
      if (room.countdownSeconds === null) {
        stopCountdown(room, false);
        return;
      }

      room.countdownSeconds -= 1;
      if (room.countdownSeconds > 0) {
        broadcastRoom(room, {
          type: 'room:countdown',
          count: room.countdownSeconds,
        });
      } else {
        stopCountdown(room, false);
        startRoomMatch(room);
      }
    }, 1000);
  } else {
    if (room.countdownTimer) {
      stopCountdown(room, true);
    }
  }
}

function sanitizeFormat(raw: unknown): MatchFormat {
  if (raw === '2v2' || raw === 'ffa') return raw;
  return '1v1';
}

function sanitizeMode(raw: unknown, format: MatchFormat): GameMode {
  if (raw === 'koth') return 'koth';
  if (raw === 'ctf' && format !== 'ffa') return 'ctf';
  return 'deathmatch';
}

function sanitizeMapSelection(raw: unknown): MapSelection {
  if (typeof raw === 'string' && raw in ARENA_MAPS) {
    return raw as MapId;
  }
  return 'auto';
}

function getTeamCounts(room: GameRoom): { 1: number; 2: number } {
  let t1 = 0;
  let t2 = 0;
  for (const slot of getConnectedSlots(room)) {
    if (slot.teamId === 1) t1++;
    else if (slot.teamId === 2) t2++;
  }
  return { 1: t1, 2: t2 };
}

function rebalanceTeamsForFormat(room: GameRoom): void {
  const slots = getConnectedSlots(room);
  if (room.format === 'ffa') {
    for (const s of slots) {
      s.teamId = s.id;
    }
    return;
  }
  if (room.format === '1v1') {
    slots.forEach((s, idx) => {
      s.teamId = idx === 0 ? 1 : 2;
    });
    return;
  }
  // 2v2: balance up to 2 per team
  slots.forEach((s, idx) => {
    s.teamId = idx % 2 === 0 ? 1 : 2;
  });
}

const BOT_LOADOUTS: Record<PlayerId, TankLoadout> = {
  1: DEFAULT_P1_LOADOUT,
  2: DEFAULT_P2_LOADOUT,
  3: { paint: 'olive', decal: 'star', armorLevel: 2, speedLevel: 1, powerLevel: 2, bulletType: 'ricochet' },
  4: { paint: 'ochre', decal: 'hazard', armorLevel: 1, speedLevel: 3, powerLevel: 1, bulletType: 'twin' },
};

function startRoomMatch(room: GameRoom): void {
  stopCountdown(room, false);
  stopRoomLoop(room);
  const slots = getConnectedSlots(room);
  const maxPlayers = room.format === '1v1' ? 2 : 4;
  if (!room.fillBots && slots.length < 2) return;
  if (slots.length < 1) return;

  room.rematchVotes.clear();
  room.botIds.clear();

  for (const slot of slots) {
    slot.input = createEmptyInput(slot.teamId === 1 || slot.id === 1 || slot.id === 3 ? 0 : Math.PI);
    slot.ready = slot.id === room.hostId;
  }

  const matchPlayers: Array<{ id: PlayerId; teamId: TeamId; name: string; loadout: TankLoadout }> =
    slots.map((s) => ({
      id: s.id,
      teamId: s.teamId,
      name: cleanPlayerName(s.name) || (s.id === 1 ? 'Commander 1' : `Commander ${s.id}`),
      loadout: s.loadout,
    }));

  if (room.fillBots) {
    let t1Count = matchPlayers.filter((p) => p.teamId === 1).length;
    let t2Count = matchPlayers.filter((p) => p.teamId === 2).length;
    for (const slotId of ALL_SLOTS.slice(0, maxPlayers)) {
      if (room.players[slotId]) continue;
      let botTeam: TeamId;
      if (room.format === 'ffa') {
        botTeam = slotId;
      } else if (room.format === '1v1') {
        botTeam = t1Count === 0 ? 1 : 2;
      } else {
        botTeam = t1Count <= t2Count ? 1 : 2;
      }
      if (botTeam === 1) t1Count++;
      else if (botTeam === 2) t2Count++;

      room.botIds.add(slotId);
      matchPlayers.push({
        id: slotId,
        teamId: botTeam,
        name: maxPlayers === 2 ? 'Sentinel Bot' : `Bot ${slotId}`,
        loadout: BOT_LOADOUTS[slotId],
      });
    }
  }

  room.status = 'playing';
  room.tickCount = 0;
  room.lastStepTime = Date.now();
  room.snapshot = createMatchState({
    format: room.format,
    mode: room.mode,
    mapSelection: room.mapSelection,
    players: matchPlayers,
  });

  broadcastRoom(room, {
    type: 'game:start',
    snapshot: room.snapshot,
  });

  room.tickInterval = setInterval(() => {
    if (!room.snapshot || room.status !== 'playing') return;
    const now = Date.now();
    const rawDt = (now - room.lastStepTime) / 1000;
    room.lastStepTime = now;

    const inputs: Partial<Record<PlayerId, PlayerInput>> = {};
    for (const id of room.snapshot.activePlayerIds) {
      if (room.botIds.has(id)) {
        inputs[id] = computeBotInput(room.snapshot, id, true);
      } else {
        inputs[id] = room.players[id]?.input ?? createEmptyInput(0);
      }
    }

    const events = stepSimulation(room.snapshot, inputs, rawDt);
    room.tickCount += 1;

    if (room.tickCount % 2 === 0 || events.length > 0 || room.snapshot.phase === 'gameover') {
      broadcastRoom(room, {
        type: 'game:state',
        snapshot: room.snapshot,
        events,
        serverTime: now,
      });
    }
  }, 1000 / 60);
}

function handleDisconnect(ws: WebSocket): void {
  const mapping = clientRoomMap.get(ws);
  if (!mapping) return;
  clientRoomMap.delete(ws);

  const room = rooms.get(mapping.roomCode);
  if (!room) return;

  const slot = room.players[mapping.playerId];
  if (slot && slot.ws === ws) {
    delete room.players[mapping.playerId];
  }

  room.rematchVotes.delete(mapping.playerId);

  const remaining = getConnectedSlots(room);
  if (remaining.length === 0) {
    stopCountdown(room, false);
    stopRoomLoop(room);
    rooms.delete(room.code);
    return;
  }

  if (room.status === 'waiting') {
    stopCountdown(room, true);
  }

  // Reassign host if needed
  if (!room.players[room.hostId]) {
    room.hostId = remaining[0].id;
    remaining[0].ready = true;
  }

  // If match was in progress and insufficient participants remain, return to staging room
  const totalWithBots = remaining.length + room.botIds.size;
  const shouldStopMatch =
    room.status === 'playing' &&
    (totalWithBots < 2 ||
      (!room.fillBots &&
        room.format !== 'ffa' &&
        (!remaining.some((s) => s.teamId === 1) || !remaining.some((s) => s.teamId === 2))));

  if (shouldStopMatch) {
    stopRoomLoop(room);
    room.status = 'waiting';
    room.snapshot = null;
    room.botIds.clear();
    room.rematchVotes.clear();
    for (const rem of remaining) {
      rem.ready = rem.id === room.hostId;
      sendJson(rem.ws, {
        type: 'room:opponent_left',
        message: 'A player disconnected. Match paused in staging room.',
      });
    }
  } else if (room.status === 'playing' && room.snapshot) {
    // In 4-player FFA / 2v2 / bot matches when 2+ teams remain, mark disconnected tank dead so match continues smoothly
    const lostTank = room.snapshot.tanks[mapping.playerId];
    if (lostTank) {
      lostTank.alive = false;
      lostTank.hp = 0;
    }
    if (room.snapshot.phase === 'gameover') {
      if (remaining.length >= 1 && remaining.every((s) => room.rematchVotes.has(s.id))) {
        startRoomMatch(room);
        return;
      }
      broadcastRoom(room, {
        type: 'game:rematch_status',
        votedPlayerIds: Array.from(room.rematchVotes),
        totalPlayers: remaining.length,
      });
    }
  }

  broadcastRoom(room, {
    type: 'room:updated',
    roomCode: room.code,
    hostId: room.hostId,
    format: room.format,
    mode: room.mode,
    mapSelection: room.mapSelection,
    fillBots: room.fillBots,
    players: getRoomPlayersList(room),
    status: room.status,
    countdown: room.countdownSeconds,
  });
  checkAndHandleAutoStart(room);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false, message: 'Room not found' });
      return;
    }
    const count = getConnectedSlots(room).length;
    const maxPlayers = room.format === '1v1' ? 2 : 4;
    res.json({
      exists: true,
      code: room.code,
      format: room.format,
      mode: room.mode,
      players: count,
      maxPlayers,
      status: room.status,
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        return;
      }

      if (msg.type === 'room:create') {
        handleDisconnect(ws);
        const code = generateRoomCode();
        const format = sanitizeFormat(msg.format);
        const mode = sanitizeMode(msg.mode, format);
        const mapSelection = sanitizeMapSelection(msg.mapSelection);
        const loadout = clampLoadout(msg.loadout, DEFAULT_P1_LOADOUT);

        const room: GameRoom = {
          code,
          format,
          mode,
          mapSelection,
          fillBots: false,
          hostId: 1,
          status: 'waiting',
          players: {
            1: {
              id: 1,
              teamId: 1,
              name: (msg.playerName || 'Commander 1').trim().slice(0, 18) || 'Commander 1',
              loadout,
              ws,
              input: createEmptyInput(0),
              ready: false,
            },
          },
          botIds: new Set<PlayerId>(),
          rematchVotes: new Set<PlayerId>(),
          chatHistory: [],
          nextChatId: 1,
          snapshot: null,
          tickInterval: null,
          tickCount: 0,
          lastStepTime: Date.now(),
          countdownTimer: null,
          countdownSeconds: null,
        };
        rooms.set(code, room);
        clientRoomMap.set(ws, { roomCode: code, playerId: 1 });
        sendJson(ws, {
          type: 'room:created',
          roomCode: code,
          playerId: 1,
          hostId: room.hostId,
          format: room.format,
          mode: room.mode,
          mapSelection: room.mapSelection,
          fillBots: room.fillBots,
          players: getRoomPlayersList(room),
          chatHistory: room.chatHistory,
        });
        return;
      }

      if (msg.type === 'room:join') {
        handleDisconnect(ws);
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendJson(ws, { type: 'room:error', message: `Room "${code}" not found.` });
          return;
        }
        if (room.status !== 'waiting') {
          sendJson(ws, { type: 'room:error', message: `Match is already in progress in room "${code}".` });
          return;
        }
        const maxPlayers = room.format === '1v1' ? 2 : 4;
        const openSlot = ALL_SLOTS.slice(0, maxPlayers).find((id) => !room.players[id]);
        if (!openSlot) {
          sendJson(ws, {
            type: 'room:error',
            message: `Room "${code}" is already full (${maxPlayers}/${maxPlayers}).`,
          });
          return;
        }

        let assignTeam: TeamId;
        if (room.format === 'ffa') {
          assignTeam = openSlot;
        } else if (room.format === '1v1') {
          assignTeam = openSlot === 1 ? 1 : 2;
        } else {
          const counts = getTeamCounts(room);
          assignTeam = counts[1] <= counts[2] ? 1 : 2;
        }

        const fallback = openSlot === 1 ? DEFAULT_P1_LOADOUT : DEFAULT_P2_LOADOUT;
        const loadout = clampLoadout(msg.loadout, fallback);

        room.players[openSlot] = {
          id: openSlot,
          teamId: assignTeam,
          name:
            (msg.playerName || `Commander ${openSlot}`).trim().slice(0, 18) ||
            `Commander ${openSlot}`,
          loadout,
          ws,
          input: createEmptyInput(assignTeam === 1 ? 0 : Math.PI),
          ready: false,
        };
        clientRoomMap.set(ws, { roomCode: code, playerId: openSlot });

        sendJson(ws, {
          type: 'room:joined',
          roomCode: code,
          playerId: openSlot,
          hostId: room.hostId,
          format: room.format,
          mode: room.mode,
          mapSelection: room.mapSelection,
          fillBots: room.fillBots,
          players: getRoomPlayersList(room),
          chatHistory: room.chatHistory,
        });

        broadcastRoom(room, {
          type: 'room:updated',
          roomCode: code,
          hostId: room.hostId,
          format: room.format,
          mode: room.mode,
          mapSelection: room.mapSelection,
          fillBots: room.fillBots,
          players: getRoomPlayersList(room),
          status: room.status,
          countdown: room.countdownSeconds,
        });
        checkAndHandleAutoStart(room);
        return;
      }

      const mapping = clientRoomMap.get(ws);
      if (!mapping) return;
      const room = rooms.get(mapping.roomCode);
      if (!room) return;
      const slot = room.players[mapping.playerId];
      if (!slot) return;

      if (msg.type === 'room:update_config') {
        if (room.status !== 'waiting') return;
        if (msg.loadout) {
          slot.loadout = clampLoadout(
            msg.loadout,
            mapping.playerId === 1 ? DEFAULT_P1_LOADOUT : DEFAULT_P2_LOADOUT
          );
        }
        if (msg.playerName) {
          slot.name = msg.playerName.trim().slice(0, 18) || slot.name;
        }
        if (typeof msg.ready === 'boolean') {
          slot.ready = msg.ready;
        }
        if (msg.teamId && room.format === '2v2') {
          const targetTeam = msg.teamId === 1 ? 1 : 2;
          const counts = getTeamCounts(room);
          if (slot.teamId !== targetTeam && counts[targetTeam] < 2) {
            slot.teamId = targetTeam;
          }
        }
        if (msg.format && mapping.playerId === room.hostId) {
          const nextFormat = sanitizeFormat(msg.format);
          const count = getConnectedSlots(room).length;
          if (nextFormat === '1v1' && count > 2) {
            sendJson(ws, {
              type: 'room:error',
              message: 'Cannot switch to 1v1 while more than 2 players are in the room.',
            });
          } else if (nextFormat !== room.format) {
            room.format = nextFormat;
            room.mode = sanitizeMode(room.mode, room.format);
            rebalanceTeamsForFormat(room);
          }
        }
        if (msg.mode && mapping.playerId === room.hostId) {
          room.mode = sanitizeMode(msg.mode, room.format);
        }
        if (msg.mapSelection !== undefined && mapping.playerId === room.hostId) {
          room.mapSelection = sanitizeMapSelection(msg.mapSelection);
        }
        if (typeof msg.fillBots === 'boolean' && mapping.playerId === room.hostId) {
          room.fillBots = msg.fillBots;
        }
        broadcastRoom(room, {
          type: 'room:updated',
          roomCode: room.code,
          hostId: room.hostId,
          format: room.format,
          mode: room.mode,
          mapSelection: room.mapSelection,
          fillBots: room.fillBots,
          players: getRoomPlayersList(room),
          status: room.status,
          countdown: room.countdownSeconds,
        });
        checkAndHandleAutoStart(room);
        return;
      }

      if (msg.type === 'room:chat') {
        const cleanText = typeof msg.text === 'string' ? msg.text.trim().slice(0, 180) : '';
        if (!cleanText) return;
        const chatMsg: ChatMessage = {
          id: `chat_${room.code}_${room.nextChatId++}`,
          playerId: slot.id,
          playerName: cleanPlayerName(slot.name) || `Commander ${slot.id}`,
          paint: slot.loadout.paint,
          text: cleanText,
          timestamp: Date.now(),
        };
        room.chatHistory.push(chatMsg);
        if (room.chatHistory.length > 60) {
          room.chatHistory.shift();
        }
        broadcastRoom(room, {
          type: 'room:chat',
          message: chatMsg,
        });
        return;
      }

      if (msg.type === 'room:start_match') {
        if (mapping.playerId !== room.hostId) return;
        const slots = getConnectedSlots(room);
        if (!room.fillBots && slots.length < 2) {
          sendJson(ws, { type: 'room:error', message: 'Waiting for more players to join.' });
          return;
        }
        if (!room.fillBots && room.format === '2v2') {
          const counts = getTeamCounts(room);
          if (counts[1] === 0 || counts[2] === 0) {
            sendJson(ws, {
              type: 'room:error',
              message: 'Need at least 1 player on Team Alpha and 1 on Team Bravo.',
            });
            return;
          }
        }
        const allGuestsReady = slots.every((s) => s.id === room.hostId || s.ready);
        if (!allGuestsReady) {
          sendJson(ws, { type: 'room:error', message: 'Waiting for all players to ready up.' });
          return;
        }
        stopCountdown(room, false);
        slot.ready = true;
        startRoomMatch(room);
        return;
      }

      if (msg.type === 'game:input') {
        if (room.status !== 'playing' || !msg.input) return;
        slot.input = {
          up: Boolean(msg.input.up),
          down: Boolean(msg.input.down),
          left: Boolean(msg.input.left),
          right: Boolean(msg.input.right),
          aimAngle: Number.isFinite(msg.input.aimAngle) ? msg.input.aimAngle : slot.input.aimAngle,
          fire: Boolean(msg.input.fire),
          dash: Boolean(msg.input.dash),
        };
        return;
      }

      if (msg.type === 'game:rematch') {
        if (room.status !== 'playing' || room.snapshot?.phase !== 'gameover') return;
        const slots = getConnectedSlots(room);
        if (slots.length < 1) return;
        room.rematchVotes.add(mapping.playerId);
        if (slots.every((s) => room.rematchVotes.has(s.id))) {
          startRoomMatch(room);
        } else {
          broadcastRoom(room, {
            type: 'game:rematch_status',
            votedPlayerIds: Array.from(room.rematchVotes),
            totalPlayers: slots.length,
          });
        }
        return;
      }

      if (msg.type === 'game:rematch_cancel') {
        if (room.status !== 'playing' || room.snapshot?.phase !== 'gameover') return;
        const slots = getConnectedSlots(room);
        room.rematchVotes.delete(mapping.playerId);
        broadcastRoom(room, {
          type: 'game:rematch_status',
          votedPlayerIds: Array.from(room.rematchVotes),
          totalPlayers: slots.length,
        });
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Ironclad Duel server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
