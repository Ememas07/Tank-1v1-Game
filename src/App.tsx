import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameOverModal } from './components/GameOverModal';
import { PauseMenuModal } from './components/PauseMenuModal';
import { TankGarageModal } from './components/TankGarageModal';
import {
  InviteJoinModal,
  type InviteRoomPreview,
  TitleOverlay,
  WaitingLobby,
} from './components/TitleAndLobby';
import {
  BULLET_UPGRADES,
  clampLoadout,
  DEFAULT_P1_LOADOUT,
  DEFAULT_P2_LOADOUT,
  PAINT_PALETTES,
} from './game/customization';
import {
  computeBotInput,
  createEmptyInput,
  createMatchState,
  stepSimulation,
} from './game/engine';
import { ARENA_HEIGHT, ARENA_MAPS, ARENA_WIDTH } from './game/maps';
import { ArenaVfx, renderArena } from './game/renderer';
import { soundEngine } from './game/sound';
import {
  cleanPlayerName,
  encodeSyncPlayerName,
  parseHostFillBots,
  parsePlayerReady,
} from './game/sync';
import type {
  BulletType,
  ChatMessage,
  ClientMessage,
  GameMode,
  GameSnapshot,
  MapId,
  MapSelection,
  MatchFormat,
  PaintId,
  PlayerId,
  PlayerInput,
  RoomPlayerInfo,
  ServerMessage,
  TankLoadout,
  TankState,
} from './game/types';

type ScreenState = 'title' | 'waiting' | 'playing' | 'gameover';

const STORAGE_LOADOUT_KEY = 'ironclad_loadout_v1';
const STORAGE_NAME_KEY = 'ironclad_callsign_v1';

function loadSavedLoadout(): TankLoadout {
  try {
    const raw = localStorage.getItem(STORAGE_LOADOUT_KEY);
    if (raw) {
      return clampLoadout(JSON.parse(raw), DEFAULT_P1_LOADOUT);
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_P1_LOADOUT;
}

function loadSavedName(): string {
  try {
    const raw = localStorage.getItem(STORAGE_NAME_KEY);
    const cleaned = cleanPlayerName(raw);
    if (cleaned) return cleaned.slice(0, 18);
  } catch {
    // ignore
  }
  return 'Commander';
}

function cloneSnapshotForHud(snap: GameSnapshot): GameSnapshot {
  const clonedTanks: Partial<Record<PlayerId, TankState>> = {};
  for (const id of snap.activePlayerIds) {
    const t = snap.tanks[id];
    if (t) {
      clonedTanks[id] = { ...t, buffs: { ...t.buffs } };
    }
  }
  return {
    ...snap,
    teamScores: { ...snap.teamScores },
    teamKothProgress: { ...snap.teamKothProgress },
    tanks: clonedTanks,
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vfxRef = useRef<ArenaVfx>(new ArenaVfx());

  const [screen, setScreen] = useState<ScreenState>('title');
  const [playerName, setPlayerName] = useState<string>(loadSavedName);
  const [loadout, setLoadout] = useState<TankLoadout>(loadSavedLoadout);
  const [selectedFormat, setSelectedFormat] = useState<MatchFormat>('1v1');
  const [selectedMode, setSelectedMode] = useState<GameMode>('deathmatch');
  const [selectedMap, setSelectedMap] = useState<MapSelection>('auto');
  const [fillBots, setFillBots] = useState<boolean>(false);
  const [joinCode, setJoinCode] = useState<string>('');
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [inviteRoomInfo, setInviteRoomInfo] = useState<InviteRoomPreview | null>(null);
  const [garageOpen, setGarageOpen] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multiplayer room state
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<PlayerId>(1);
  const [hostId, setHostId] = useState<PlayerId>(1);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayerInfo[]>([]);
  const [rematchVotes, setRematchVotes] = useState<PlayerId[]>([]);
  const [rematchTotal, setRematchTotal] = useState<number>(2);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSoloMode, setIsSoloMode] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  const [hudSnapshot, setHudSnapshot] = useState<GameSnapshot>(() =>
    createMatchState({ format: '1v1', mode: 'deathmatch' })
  );

  const simSnapshotRef = useRef<GameSnapshot>(createMatchState({ format: '1v1', mode: 'deathmatch' }));
  const screenRef = useRef<ScreenState>(screen);
  screenRef.current = screen;
  const garageOpenRef = useRef<boolean>(garageOpen);
  garageOpenRef.current = garageOpen;
  const pausedRef = useRef<boolean>(paused);
  pausedRef.current = paused;
  const isSoloRef = useRef<boolean>(isSoloMode);
  isSoloRef.current = isSoloMode;
  const localPlayerIdRef = useRef<PlayerId>(localPlayerId);
  localPlayerIdRef.current = localPlayerId;
  const hostIdRef = useRef<PlayerId>(hostId);
  hostIdRef.current = hostId;
  const fillBotsRef = useRef<boolean>(fillBots);
  fillBotsRef.current = fillBots;
  const localReadyRef = useRef<boolean>(false);
  const roomPlayersRef = useRef<RoomPlayerInfo[]>(roomPlayers);
  roomPlayersRef.current = roomPlayers;
  const latestMatchConfigRef = useRef<{
    format: MatchFormat;
    mode: GameMode;
    map: MapSelection;
    loadout: TankLoadout;
  }>({ format: selectedFormat, mode: selectedMode, map: selectedMap, loadout });
  latestMatchConfigRef.current = {
    format: selectedFormat,
    mode: selectedMode,
    map: selectedMap,
    loadout,
  };
  const wsRef = useRef<WebSocket | null>(null);
  const lastHudKeyRef = useRef<string>('');

  const keysPressedRef = useRef<Set<string>>(new Set());
  const mouseDownRef = useRef<boolean>(false);
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const canvasMetricsRef = useRef<{ width: number; height: number; dpr: number }>({
    width: 1280,
    height: 720,
    dpr: 1,
  });

  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  const handleSelectFormat = useCallback(
    (fmt: MatchFormat) => {
      setSelectedFormat(fmt);
      if (fmt === 'ffa' && selectedMode === 'ctf') {
        setSelectedMode('deathmatch');
      }
    },
    [selectedMode]
  );

  const handleLoadoutChange = useCallback((next: TankLoadout) => {
    setLoadout(next);
    try {
      localStorage.setItem(STORAGE_LOADOUT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && screenRef.current === 'waiting') {
      const msg: ClientMessage = { type: 'room:update_config', loadout: next };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleNameChange = useCallback((name: string) => {
    const clean = cleanPlayerName(name);
    setPlayerName(clean);
    try {
      localStorage.setItem(STORAGE_NAME_KEY, clean);
    } catch {
      // ignore
    }
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      screenRef.current === 'waiting' &&
      clean.length > 0
    ) {
      const isHost = localPlayerIdRef.current === hostIdRef.current;
      const syncName = encodeSyncPlayerName(
        clean,
        localReadyRef.current,
        isHost ? fillBotsRef.current : false
      );
      const msg: ClientMessage = { type: 'room:update_config', playerName: syncName };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const clearInputs = useCallback(() => {
    keysPressedRef.current.clear();
    mouseDownRef.current = false;
  }, []);

  const startSoloSkirmish = useCallback(
    (
      formatOverride?: MatchFormat,
      modeOverride?: GameMode,
      fromGesture = true,
      mapOverride?: MapSelection,
      loadoutOverride?: TankLoadout
    ) => {
      if (fromGesture) {
        soundEngine.unlock();
      }
      clearInputs();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      const format = formatOverride ?? selectedFormat;
      const mode =
        format === 'ffa' && (modeOverride ?? selectedMode) === 'ctf'
          ? 'deathmatch'
          : modeOverride ?? selectedMode;
      const mapSel = mapOverride ?? selectedMap;
      const activeLoadout = loadoutOverride ?? loadout;

      const fresh = createMatchState({
        format,
        mode,
        mapSelection: mapSel,
        p1Name: playerName.trim() || 'Commander',
        p2Name: 'Sentinel Bot',
        p1Loadout: activeLoadout,
        p2Loadout: {
          ...DEFAULT_P2_LOADOUT,
          paint: activeLoadout.paint === 'crimson' ? 'cobalt' : 'crimson',
        },
      });
      vfxRef.current.reset();
      lastHudKeyRef.current = '';
      simSnapshotRef.current = fresh;
      setRoomCode(null);
      setLocalPlayerId(1);
      setIsSoloMode(true);
      setPaused(false);
      setRematchVotes([]);
      setChatMessages([]);
      setHudSnapshot(cloneSnapshotForHud(fresh));
      setErrorMsg(null);
      setScreen('playing');
    },
    [clearInputs, loadout, playerName, selectedFormat, selectedMap, selectedMode]
  );

  const connectAndSend = useCallback(
    (initialMsg: ClientMessage) => {
      setConnecting(true);
      setErrorMsg(null);

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnecting(false);
        ws.send(JSON.stringify(initialMsg));
      };

      ws.onerror = () => {
        setConnecting(false);
        setErrorMsg('Unable to connect to game server.');
      };

      ws.onclose = () => {
        setConnecting(false);
        if (screenRef.current === 'waiting' || (screenRef.current === 'playing' && !isSoloRef.current)) {
          setErrorMsg('Connection to server lost.');
        }
      };

      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }

        if (msg.type === 'room:created' || msg.type === 'room:joined') {
          setIsSoloMode(false);
          setPaused(false);
          setPendingInviteCode(null);
          setRoomCode(msg.roomCode);
          setLocalPlayerId(msg.playerId);
          localPlayerIdRef.current = msg.playerId;
          setHostId(msg.hostId);
          hostIdRef.current = msg.hostId;
          setSelectedFormat(msg.format);
          setSelectedMode(msg.mode);
          setSelectedMap(msg.mapSelection);

          const hostSlot = msg.players.find((p) => p.id === msg.hostId);
          const isCurrentHost = msg.playerId === msg.hostId;
          const remoteFillBots = hostSlot
            ? parseHostFillBots(hostSlot.name, msg.fillBots)
            : fillBotsRef.current;
          const activeFillBots = isCurrentHost ? fillBotsRef.current : remoteFillBots;
          setFillBots(activeFillBots);
          fillBotsRef.current = activeFillBots;

          setRoomPlayers(
            msg.players.map((mp) => {
              const isLocal = mp.id === msg.playerId;
              const ready = isLocal
                ? localReadyRef.current || parsePlayerReady(mp.name, mp.ready)
                : parsePlayerReady(mp.name, mp.ready);
              return {
                ...mp,
                name: cleanPlayerName(mp.name),
                ready,
              };
            })
          );
          setRematchVotes([]);
          setChatMessages(msg.chatHistory ?? []);
          setCountdownSeconds(null);
          setErrorMsg(null);
          setScreen('waiting');
        } else if (msg.type === 'room:updated') {
          setHostId(msg.hostId);
          hostIdRef.current = msg.hostId;
          setSelectedFormat(msg.format);
          setSelectedMode(msg.mode);
          setSelectedMap(msg.mapSelection);

          const hostSlot = msg.players.find((p) => p.id === msg.hostId);
          const isCurrentHost = localPlayerIdRef.current === msg.hostId;
          const remoteFillBots = hostSlot
            ? parseHostFillBots(hostSlot.name, msg.fillBots)
            : fillBotsRef.current;
          const activeFillBots = isCurrentHost ? fillBotsRef.current : remoteFillBots;
          setFillBots(activeFillBots);
          fillBotsRef.current = activeFillBots;

          setRoomPlayers(
            msg.players.map((mp) => {
              const isLocal = mp.id === localPlayerIdRef.current;
              const ready = isLocal
                ? localReadyRef.current || parsePlayerReady(mp.name, mp.ready)
                : parsePlayerReady(mp.name, mp.ready);
              return {
                ...mp,
                name: cleanPlayerName(mp.name),
                ready,
              };
            })
          );
          if (msg.countdown !== undefined) {
            setCountdownSeconds(msg.countdown);
          }
        } else if (msg.type === 'room:countdown') {
          setCountdownSeconds(msg.count);
          soundEngine.playCountdownBeep(msg.count === 1);
        } else if (msg.type === 'room:countdown_cancelled') {
          setCountdownSeconds(null);
        } else if (msg.type === 'room:chat') {
          setChatMessages((prev) =>
            prev.some((m) => m.id === msg.message.id) ? prev : [...prev.slice(-59), msg.message]
          );
        } else if (msg.type === 'room:error') {
          if (fillBotsRef.current && msg.message === 'Waiting for more players to join.') {
            const cfg = latestMatchConfigRef.current;
            startSoloSkirmish(cfg.format, cfg.mode, false, cfg.map, cfg.loadout);
            return;
          }
          setErrorMsg(msg.message);
        } else if (msg.type === 'room:opponent_left') {
          clearInputs();
          setPaused(false);
          setRematchVotes([]);
          setCountdownSeconds(null);
          setErrorMsg(msg.message);
          setScreen('waiting');
        } else if (msg.type === 'game:start') {
          clearInputs();
          setPaused(false);
          setRematchVotes([]);
          setCountdownSeconds(null);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          vfxRef.current.reset();
          lastHudKeyRef.current = '';
          simSnapshotRef.current = msg.snapshot;
          setHudSnapshot(cloneSnapshotForHud(msg.snapshot));
          setErrorMsg(null);
          setScreen('playing');
        } else if (msg.type === 'game:rematch_status') {
          setRematchVotes(msg.votedPlayerIds);
          setRematchTotal(msg.totalPlayers);
        } else if (msg.type === 'game:state') {
          simSnapshotRef.current = msg.snapshot;
          if (msg.events.length > 0) {
            vfxRef.current.ingestEvents(msg.events);
            soundEngine.handleEvents(msg.events);
          }
          if (msg.snapshot.phase === 'gameover' && screenRef.current !== 'gameover') {
            setPaused(false);
            setRematchVotes([]);
            setRematchTotal(Math.max(1, roomPlayersRef.current.length));
            setHudSnapshot(cloneSnapshotForHud(msg.snapshot));
            setScreen('gameover');
          }
        }
      };
    },
    [clearInputs]
  );

  const handleHostRoom = useCallback(() => {
    soundEngine.unlock();
    localReadyRef.current = false;
    const clean = cleanPlayerName(playerName) || 'Commander 1';
    const syncName = encodeSyncPlayerName(clean, false, fillBots);
    connectAndSend({
      type: 'room:create',
      playerName: syncName,
      loadout,
      format: selectedFormat,
      mode: selectedMode,
      mapSelection: selectedMap,
    });
  }, [connectAndSend, fillBots, loadout, playerName, selectedFormat, selectedMap, selectedMode]);

  const handleJoinRoom = useCallback(
    (explicitCode?: string, fromGesture = true) => {
      const code = (explicitCode ?? joinCode).trim().toUpperCase();
      if (code.length < 4) {
        setErrorMsg('Please enter a valid room code.');
        return;
      }
      if (fromGesture) {
        soundEngine.unlock();
      }
      localReadyRef.current = false;
      const clean = cleanPlayerName(playerName) || 'Commander';
      const syncName = encodeSyncPlayerName(clean, false, false);
      connectAndSend({
        type: 'room:join',
        roomCode: code,
        playerName: syncName,
        loadout,
      });
    },
    [connectAndSend, joinCode, loadout, playerName]
  );

  const handleLeaveToMenu = useCallback(() => {
    clearInputs();
    setPaused(false);
    setRematchVotes([]);
    setChatMessages([]);
    setCountdownSeconds(null);
    localReadyRef.current = false;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRoomCode(null);
    setIsSoloMode(false);
    setErrorMsg(null);
    const demo = createMatchState({ format: '1v1', mode: 'deathmatch' });
    simSnapshotRef.current = demo;
    vfxRef.current.reset();
    setScreen('title');
  }, [clearInputs]);

  const handleSendChat = useCallback((text: string) => {
    const clean = text.trim().slice(0, 180);
    if (!clean) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg: ClientMessage = { type: 'room:chat', text: clean };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.muted = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const autostartParam = params.get('autostart');
    const formatParam = params.get('format');
    const mapParam = params.get('map');
    const bulletParam = params.get('bullet');
    const paintParam = params.get('paint');

    const mapOverride: MapSelection | undefined =
      mapParam && mapParam in ARENA_MAPS ? (mapParam as MapId) : undefined;
    if (mapOverride) setSelectedMap(mapOverride);

    let nextLoadout = loadout;
    if (bulletParam && bulletParam in BULLET_UPGRADES) {
      nextLoadout = { ...nextLoadout, bulletType: bulletParam as BulletType };
      setLoadout(nextLoadout);
    }
    if (paintParam && (paintParam in PAINT_PALETTES || paintParam === 'pink')) {
      const pId = paintParam === 'pink' ? 'lily_pink' : (paintParam as PaintId);
      nextLoadout = { ...nextLoadout, paint: pId };
      setLoadout(nextLoadout);
    }

    if (roomParam && roomParam.trim().length >= 4) {
      const clean = roomParam.trim().toUpperCase();
      setJoinCode(clean);
      setPendingInviteCode(clean);
      fetch(`/api/rooms/${encodeURIComponent(clean)}`)
        .then((res) => res.json())
        .then((data) => setInviteRoomInfo(data as InviteRoomPreview))
        .catch(() => setInviteRoomInfo(null));
    } else if (autostartParam === '1') {
      const fmt: MatchFormat =
        formatParam === '2v2' || formatParam === 'ffa' ? formatParam : '1v1';
      startSoloSkirmish(fmt, 'deathmatch', false, mapOverride, nextLoadout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen !== 'waiting') return;
    const alphaCount = roomPlayers.filter((p) => p.teamId === 1).length;
    const bravoCount = roomPlayers.filter((p) => p.teamId === 2).length;
    const enoughPlayers = fillBots
      ? roomPlayers.length >= 1
      : selectedFormat === '2v2'
        ? alphaCount >= 1 && bravoCount >= 1
        : roomPlayers.length >= 2;

    const allPlayersReady = roomPlayers.length > 0 && roomPlayers.every((p) => p.ready);
    const shouldAutoStart = enoughPlayers && allPlayersReady;

    if (!shouldAutoStart) {
      if (countdownSeconds !== null) {
        setCountdownSeconds(null);
      }
      return;
    }

    if (countdownSeconds === null) {
      setCountdownSeconds(3);
      soundEngine.playCountdownBeep(false);
    }
  }, [screen, roomPlayers, fillBots, selectedFormat, countdownSeconds]);

  useEffect(() => {
    if (countdownSeconds === null || screen !== 'waiting') return;
    if (countdownSeconds > 1) {
      const timer = setTimeout(() => {
        setCountdownSeconds((prev) => {
          if (prev === null || prev <= 1) return prev;
          const next = prev - 1;
          soundEngine.playCountdownBeep(next === 1);
          return next;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (countdownSeconds === 1) {
      const timer = setTimeout(() => {
        setCountdownSeconds(null);
        if (localPlayerId === hostId) {
          if (fillBots && roomPlayers.length === 1) {
            startSoloSkirmish(selectedFormat, selectedMode, false, selectedMap, loadout);
          } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'room:start_match' }));
          }
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdownSeconds, screen, localPlayerId, hostId, fillBots, roomPlayers.length, selectedFormat, selectedMode, selectedMap, loadout, startSoloSkirmish]);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / ARENA_WIDTH, rect.height / ARENA_HEIGHT);
    const offsetX = (rect.width - ARENA_WIDTH * scale) / 2;
    const offsetY = (rect.height - ARENA_HEIGHT * scale) / 2;
    return {
      x: (clientX - rect.left - offsetX) / (scale || 1),
      y: (clientY - rect.top - offsetY) / (scale || 1),
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (e.key === 'm' || e.key === 'M') {
        if (!isTyping) handleToggleMute();
      }

      if (e.key === 'Escape') {
        if (garageOpen) {
          setGarageOpen(false);
          return;
        }
        if (pendingInviteCode && screenRef.current === 'title') {
          setPendingInviteCode(null);
          return;
        }
        if (screenRef.current === 'playing') {
          if (isTyping && target instanceof HTMLElement) {
            target.blur();
          }
          clearInputs();
          setPaused((prev) => {
            const next = !prev;
            if (next && !isSoloRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const myTank = simSnapshotRef.current.tanks[localPlayerIdRef.current];
              const msg: ClientMessage = {
                type: 'game:input',
                input: createEmptyInput(myTank?.turretAngle ?? 0),
              };
              wsRef.current.send(JSON.stringify(msg));
            }
            return next;
          });
          return;
        }
      }

      if (screenRef.current === 'title' && !garageOpen && !pendingInviteCode && !isTyping) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleHostRoom();
          return;
        }
      }

      if (!isTyping && !pausedRef.current) {
        keysPressedRef.current.add(e.code);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
    };

    const onBlur = () => clearInputs();
    const onVisibility = () => {
      if (document.hidden) clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [clearInputs, garageOpen, handleHostRoom, handleToggleMute, pendingInviteCode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvasMetricsRef.current = { width: w, height: h, dpr };
    };

    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(document.documentElement);

    let raf = 0;
    let lastTime = performance.now();
    let lastHudSync = 0;
    let lastNetInputSend = 0;
    let lastTitleDraw = 0;

    const buildLocalInput = (): PlayerInput => {
      const keys = keysPressedRef.current;
      const snap = simSnapshotRef.current;
      const myTank = snap.tanks[localPlayerIdRef.current];
      const ptr = pointerWorldRef.current;
      const aimAngle =
        ptr && myTank
          ? Math.atan2(ptr.y - myTank.y, ptr.x - myTank.x)
          : myTank?.turretAngle ?? 0;

      return {
        up: keys.has('KeyW') || keys.has('ArrowUp'),
        down: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
        aimAngle,
        fire: mouseDownRef.current || keys.has('Space'),
        dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const curScreen = screenRef.current;
      const snap = simSnapshotRef.current;

      if (garageOpenRef.current || curScreen === 'waiting' || curScreen === 'gameover') {
        raf = requestAnimationFrame(tick);
        return;
      }

      if (curScreen === 'title') {
        if (now - lastTitleDraw < 42) {
          raf = requestAnimationFrame(tick);
          return;
        }
        lastTitleDraw = now;
        const inputs: Partial<Record<PlayerId, PlayerInput>> = {};
        for (const id of snap.activePlayerIds) {
          inputs[id] = computeBotInput(snap, id, true);
        }
        const events = stepSimulation(snap, inputs, 0.042);
        vfxRef.current.ingestEvents(events);
        vfxRef.current.step(snap, 0.042);
        if (snap.phase === 'gameover') {
          simSnapshotRef.current = createMatchState({ format: '1v1', mode: 'deathmatch' });
          vfxRef.current.reset();
        }
      } else if (curScreen === 'playing') {
        const localInput = pausedRef.current
          ? createEmptyInput(snap.tanks[localPlayerIdRef.current]?.turretAngle ?? 0)
          : buildLocalInput();
        if (isSoloRef.current) {
          if (!pausedRef.current) {
            const inputs: Partial<Record<PlayerId, PlayerInput>> = {
              [localPlayerIdRef.current]: localInput,
            };
            for (const id of snap.activePlayerIds) {
              if (id !== localPlayerIdRef.current) {
                inputs[id] = computeBotInput(snap, id, true);
              }
            }
            const events = stepSimulation(snap, inputs, dt);
            if (events.length > 0) {
              vfxRef.current.ingestEvents(events);
              soundEngine.handleEvents(events);
            }
            vfxRef.current.step(snap, dt);
            if (snap.phase === 'gameover') {
              setHudSnapshot(cloneSnapshotForHud(snap));
              setScreen('gameover');
            }
          }
        } else {
          if (
            !pausedRef.current &&
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            now - lastNetInputSend >= 22
          ) {
            lastNetInputSend = now;
            const msg: ClientMessage = { type: 'game:input', input: localInput };
            wsRef.current.send(JSON.stringify(msg));
          }
          vfxRef.current.step(snap, dt);
        }

        if (now - lastHudSync >= 80) {
          lastHudSync = now;
          const parts: string[] = [
            String(snap.round),
            snap.phase,
            String(snap.teamScores[1] ?? 0),
            String(snap.teamScores[2] ?? 0),
            String(snap.teamScores[3] ?? 0),
            String(snap.teamScores[4] ?? 0),
            String(Math.round(snap.teamKothProgress[1] ?? 0)),
            String(Math.round(snap.teamKothProgress[2] ?? 0)),
          ];
          for (const id of snap.activePlayerIds) {
            const t = snap.tanks[id];
            if (t) {
              const activeBuffMask =
                (snap.elapsed < t.buffs.speedUntil ? 1 : 0) |
                (snap.elapsed < t.buffs.rapidUntil ? 2 : 0) |
                (snap.elapsed < t.buffs.tripleUntil ? 4 : 0) |
                (snap.elapsed < t.buffs.ricochetUntil ? 8 : 0) |
                (snap.elapsed < t.buffs.damageUntil ? 16 : 0) |
                (snap.elapsed < t.buffs.cloakUntil ? 32 : 0) |
                (snap.elapsed < t.buffs.slowUntil ? 64 : 0);
              parts.push(
                `${id}:${Math.round(t.hp)}:${t.alive}:${t.reloadTimer.toFixed(1)}:${t.dashCooldownTimer.toFixed(1)}:${Math.round(t.buffs.shieldHp)}:${activeBuffMask}`
              );
            }
          }
          const nextKey = `${snap.mapId}|${parts.join('|')}`;
          if (nextKey !== lastHudKeyRef.current) {
            lastHudKeyRef.current = nextKey;
            setHudSnapshot(cloneSnapshotForHud(snap));
          }
        }
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const { width, height, dpr } = canvasMetricsRef.current;
        ctx.save();
        ctx.scale(dpr, dpr);
        renderArena(
          ctx,
          width,
          height,
          simSnapshotRef.current,
          vfxRef.current,
          curScreen === 'playing' ? localPlayerIdRef.current : null,
          curScreen === 'playing' ? pointerWorldRef.current : null,
          dpr
        );
        ctx.restore();
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const hasVotedRematch = rematchVotes.includes(localPlayerId);
  const handleRematch = () => {
    if (isSoloMode) {
      startSoloSkirmish(hudSnapshot.format, hudSnapshot.mode);
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg: ClientMessage = {
        type: hasVotedRematch ? 'game:rematch_cancel' : 'game:rematch',
      };
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const localStatsTank =
    hudSnapshot.tanks[localPlayerId] ?? hudSnapshot.tanks[hudSnapshot.activePlayerIds[0]];

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        data-testid="arena-canvas"
        onMouseMove={(e) => {
          pointerWorldRef.current = screenToWorld(e.clientX, e.clientY);
        }}
        onMouseDown={(e) => {
          if (e.button === 0 && screen === 'playing') {
            soundEngine.unlock();
            pointerWorldRef.current = screenToWorld(e.clientX, e.clientY);
            mouseDownRef.current = true;
          }
        }}
        onMouseUp={() => {
          mouseDownRef.current = false;
        }}
        onContextMenu={(e) => e.preventDefault()}
        className="block h-full w-full cursor-crosshair"
      />

      {screen === 'title' && (
        <TitleOverlay
          playerName={playerName}
          onPlayerNameChange={handleNameChange}
          loadout={loadout}
          selectedFormat={selectedFormat}
          onSelectFormat={handleSelectFormat}
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          selectedMap={selectedMap}
          onSelectMap={setSelectedMap}
          joinCode={joinCode}
          onJoinCodeChange={setJoinCode}
          errorMsg={errorMsg}
          connecting={connecting}
          onHostRoom={handleHostRoom}
          onJoinRoom={() => handleJoinRoom()}
          onSoloSkirmish={() => startSoloSkirmish()}
          onOpenGarage={() => setGarageOpen(true)}
        />
      )}

      {screen === 'title' && pendingInviteCode && (
        <InviteJoinModal
          roomCode={pendingInviteCode}
          roomInfo={inviteRoomInfo}
          playerName={playerName}
          onPlayerNameChange={handleNameChange}
          loadout={loadout}
          connecting={connecting}
          errorMsg={errorMsg}
          onOpenGarage={() => setGarageOpen(true)}
          onConfirmJoin={() => handleJoinRoom(pendingInviteCode)}
          onCancel={() => {
            setPendingInviteCode(null);
            setErrorMsg(null);
            if (window.location.search.includes('room=')) {
              const url = new URL(window.location.href);
              url.searchParams.delete('room');
              window.history.replaceState({}, '', url.pathname + url.search);
            }
          }}
        />
      )}

      {screen === 'waiting' && roomCode && (
        <WaitingLobby
          roomCode={roomCode}
          playerId={localPlayerId}
          hostId={hostId}
          format={selectedFormat}
          mode={selectedMode}
          mapSelection={selectedMap}
          fillBots={fillBots}
          players={roomPlayers}
          playerName={playerName}
          countdown={countdownSeconds}
          chatMessages={chatMessages}
          onUpdatePlayerName={handleNameChange}
          onSendChat={handleSendChat}
          errorMsg={errorMsg}
          onChangeFormat={(fmt) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const msg: ClientMessage = { type: 'room:update_config', format: fmt };
              wsRef.current.send(JSON.stringify(msg));
            }
          }}
          onChangeMode={(m) => {
            setSelectedMode(m);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const msg: ClientMessage = { type: 'room:update_config', mode: m };
              wsRef.current.send(JSON.stringify(msg));
            }
          }}
          onChangeMap={(mapSel) => {
            setSelectedMap(mapSel);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const msg: ClientMessage = { type: 'room:update_config', mapSelection: mapSel };
              wsRef.current.send(JSON.stringify(msg));
            }
          }}
          onToggleFillBots={(fill) => {
            setFillBots(fill);
            fillBotsRef.current = fill;
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const localP = roomPlayers.find((p) => p.id === localPlayerId);
              const clean = cleanPlayerName(localP?.name || playerName);
              const syncName = encodeSyncPlayerName(clean, localReadyRef.current, fill);
              const msg: ClientMessage = {
                type: 'room:update_config',
                fillBots: fill,
                playerName: syncName,
              };
              wsRef.current.send(JSON.stringify(msg));
            }
          }}
          onSwitchTeam={(teamId) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const msg: ClientMessage = { type: 'room:update_config', teamId };
              wsRef.current.send(JSON.stringify(msg));
            }
          }}
          onToggleReady={(ready) => {
            soundEngine.unlock();
            soundEngine.playReadyToggle(ready);
            localReadyRef.current = ready;
            setRoomPlayers((prev) =>
              prev.map((p) => (p.id === localPlayerId ? { ...p, ready } : p))
            );
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const isHost = localPlayerId === hostId;
              const localP = roomPlayers.find((p) => p.id === localPlayerId);
              const clean = cleanPlayerName(localP?.name || playerName);
              const syncName = encodeSyncPlayerName(clean, ready, isHost ? fillBots : false);
              const msg: ClientMessage = {
                type: 'room:update_config',
                ready,
                playerName: syncName,
                ...(isHost ? { fillBots } : {}),
              };
              wsRef.current.send(JSON.stringify(msg));
            }
          }}
          onOpenGarage={() => setGarageOpen(true)}
          onStartMatch={() => {
            soundEngine.unlock();
            setCountdownSeconds(null);
            if (fillBots && roomPlayers.length === 1) {
              startSoloSkirmish(selectedFormat, selectedMode, false, selectedMap, loadout);
              return;
            }
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const msg: ClientMessage = { type: 'room:start_match' };
              wsRef.current.send(JSON.stringify(msg));
            }
          }}
          onLeaveRoom={handleLeaveToMenu}
        />
      )}

      {screen === 'playing' && (
        <GameHud
          snapshot={hudSnapshot}
          localPlayerId={localPlayerId}
          roomCode={roomCode}
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenPause={() => {
            clearInputs();
            setPaused(true);
          }}
        />
      )}

      {screen === 'playing' && paused && (
        <PauseMenuModal
          isSoloMode={isSoloMode}
          roomCode={roomCode}
          muted={muted}
          localPlayerId={localPlayerId}
          chatMessages={chatMessages}
          onResume={() => setPaused(false)}
          onToggleMute={handleToggleMute}
          onRestartSolo={() => startSoloSkirmish(hudSnapshot.format, hudSnapshot.mode)}
          onLeaveMatch={handleLeaveToMenu}
          onSendChat={handleSendChat}
        />
      )}

      {screen === 'gameover' && localStatsTank && (
        <GameOverModal
          snapshot={hudSnapshot}
          localPlayerId={localPlayerId}
          localStatsTank={localStatsTank}
          isSoloMode={isSoloMode}
          roomPlayers={roomPlayers}
          rematchVotes={rematchVotes}
          rematchTotal={rematchTotal}
          hasVotedRematch={hasVotedRematch}
          onRematch={handleRematch}
          onLeaveToMenu={handleLeaveToMenu}
        />
      )}

      {garageOpen && (
        <TankGarageModal
          loadout={loadout}
          defaultLoadout={DEFAULT_P1_LOADOUT}
          onChange={handleLoadoutChange}
          onClose={() => setGarageOpen(false)}
        />
      )}
    </div>
  );
}
