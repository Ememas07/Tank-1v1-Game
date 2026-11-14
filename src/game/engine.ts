import {
  clampLoadout,
  computeTankStats,
  DEFAULT_P1_LOADOUT,
  DEFAULT_P2_LOADOUT,
  POWERUP_CATALOG,
} from './customization';
import { ARENA_MAPS, getMapForRound } from './maps';
import type {
  ArenaMap,
  CrateState,
  FlagState,
  GameEvent,
  GameMode,
  GameSnapshot,
  MapId,
  MapSelection,
  MatchFormat,
  PlayerId,
  PlayerInput,
  PowerUpItem,
  PowerUpType,
  ProjectileState,
  TankLoadout,
  TankState,
  TeamId,
} from './types';

export const DM_WINS_TARGET = 3;
export const CTF_CAPTURES_TARGET = 3;
export const KOTH_ZONE_RADIUS = 108;
export const KOTH_CAPTURE_RATE = 6.25; // % per second (~16s uncontested to win)
export const RESPAWN_DELAY = 2.5;
export const POWERUP_SPAWN_INTERVAL = 7.0;

const POWERUP_TYPES: PowerUpType[] = [
  'shield',
  'speed',
  'rapid',
  'repair',
  'triple',
  'ricochet',
  'damage',
  'stealth',
];

const DEFAULT_FALLBACK_LOADOUTS: Record<PlayerId, TankLoadout> = {
  1: DEFAULT_P1_LOADOUT,
  2: DEFAULT_P2_LOADOUT,
  3: { paint: 'olive', decal: 'star', armorLevel: 2, speedLevel: 1, powerLevel: 2, bulletType: 'ricochet' },
  4: { paint: 'ochre', decal: 'hazard', armorLevel: 1, speedLevel: 3, powerLevel: 1, bulletType: 'twin' },
};

export function createEmptyInput(aimAngle = 0): PlayerInput {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    aimAngle,
    fire: false,
    dash: false,
  };
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function lerpAngle(current: number, target: number, t: number): number {
  const diff = normalizeAngle(target - current);
  return normalizeAngle(current + diff * Math.min(1, t));
}

function createEmptyBuffs() {
  return {
    shieldHp: 0,
    shieldUntil: 0,
    speedUntil: 0,
    rapidUntil: 0,
    tripleUntil: 0,
    ricochetUntil: 0,
    damageUntil: 0,
    cloakUntil: 0,
    cloakRevealUntil: 0,
    slowUntil: 0,
  };
}

function getSpawnForTank(
  format: MatchFormat,
  id: PlayerId,
  teamId: TeamId,
  teamIndex: number,
  map: ArenaMap
) {
  if (format === '2v2') {
    // Team 1 (Alpha) spawns on West slots (1, 3); Team 2 (Bravo) spawns on East slots (2, 4)
    if (teamId === 1) {
      const slot: PlayerId = teamIndex === 0 ? 1 : 3;
      return { pos: map.spawns[slot], facing: 0 };
    }
    const slot: PlayerId = teamIndex === 0 ? 2 : 4;
    return { pos: map.spawns[slot], facing: Math.PI };
  }
  const pos = map.spawns[id];
  const facing = pos.x < map.width / 2 ? 0 : Math.PI;
  return { pos, facing };
}

function createTank(
  id: PlayerId,
  teamId: TeamId,
  name: string,
  pos: { x: number; y: number },
  facing: number,
  rawLoadout: Partial<TankLoadout> | undefined,
  kills: number,
  shotsFired: number,
  shotsHit: number
): TankState {
  const loadout = clampLoadout(rawLoadout, DEFAULT_FALLBACK_LOADOUTS[id]);
  const stats = computeTankStats(loadout);

  return {
    id,
    teamId,
    name,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    hullAngle: facing,
    turretAngle: facing,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    alive: true,
    respawnTimer: 0,
    spawnShieldUntil: 0,
    reloadTimer: 0,
    dashCooldownTimer: 0,
    dashActiveTimer: 0,
    dashDirX: Math.cos(facing),
    dashDirY: Math.sin(facing),
    recoil: 0,
    hitFlashTimer: 0,
    loadout,
    buffs: createEmptyBuffs(),
    kills,
    shotsFired,
    shotsHit,
  };
}

function createCrates(map: ArenaMap, startId: number): { crates: CrateState[]; nextId: number } {
  let idCounter = startId;
  const crates: CrateState[] = map.initialCrates.map((c) => ({
    id: `crate_${idCounter++}`,
    x: c.x,
    y: c.y,
    w: c.w,
    h: c.h,
    hp: 40,
    maxHp: 40,
  }));
  return { crates, nextId: idCounter };
}

function createFlags(map: ArenaMap): { 1: FlagState; 2: FlagState } {
  return {
    1: {
      teamId: 1,
      status: 'at_base',
      x: map.flagBases[1].x,
      y: map.flagBases[1].y,
      carrierId: null,
      dropTimer: 0,
    },
    2: {
      teamId: 2,
      status: 'at_base',
      x: map.flagBases[2].x,
      y: map.flagBases[2].y,
      carrierId: null,
      dropTimer: 0,
    },
  };
}

export interface PlayerSetup {
  id: PlayerId;
  teamId?: TeamId;
  name?: string;
  loadout?: Partial<TankLoadout>;
}

export interface CreateMatchOptions {
  format?: MatchFormat;
  mode: GameMode;
  players?: PlayerSetup[];
  p1Name?: string;
  p2Name?: string;
  p1Loadout?: Partial<TankLoadout>;
  p2Loadout?: Partial<TankLoadout>;
  mapId?: MapId;
  mapSelection?: MapSelection;
}

export function createMatchState(opts: CreateMatchOptions): GameSnapshot {
  const format: MatchFormat = opts.format ?? '1v1';
  // CTF is only valid in 2-team formats (1v1 / 2v2)
  const mode: GameMode = format === 'ffa' && opts.mode === 'ctf' ? 'deathmatch' : opts.mode;
  const mapSelection: MapSelection = opts.mapId ?? opts.mapSelection ?? 'auto';
  const map = opts.mapId ? ARENA_MAPS[opts.mapId] : getMapForRound(mode, 1, mapSelection);
  const { crates, nextId } = createCrates(map, 1);

  let setups: PlayerSetup[];
  if (opts.players && opts.players.length >= 2) {
    setups = opts.players;
  } else if (format === '2v2') {
    setups = [
      { id: 1, teamId: 1, name: opts.p1Name || 'Commander 1', loadout: opts.p1Loadout },
      { id: 3, teamId: 1, name: 'Vanguard Ally', loadout: DEFAULT_FALLBACK_LOADOUTS[3] },
      { id: 2, teamId: 2, name: opts.p2Name || 'Bravo Lead', loadout: opts.p2Loadout },
      { id: 4, teamId: 2, name: 'Bravo Wing', loadout: DEFAULT_FALLBACK_LOADOUTS[4] },
    ];
  } else if (format === 'ffa') {
    setups = [
      { id: 1, teamId: 1, name: opts.p1Name || 'Commander 1', loadout: opts.p1Loadout },
      { id: 2, teamId: 2, name: opts.p2Name || 'Sentinel 2', loadout: opts.p2Loadout },
      { id: 3, teamId: 3, name: 'Sentinel 3', loadout: DEFAULT_FALLBACK_LOADOUTS[3] },
      { id: 4, teamId: 4, name: 'Sentinel 4', loadout: DEFAULT_FALLBACK_LOADOUTS[4] },
    ];
  } else {
    setups = [
      { id: 1, teamId: 1, name: opts.p1Name || 'Commander 1', loadout: opts.p1Loadout },
      { id: 2, teamId: 2, name: opts.p2Name || 'Commander 2', loadout: opts.p2Loadout },
    ];
  }

  const tanks: Partial<Record<PlayerId, TankState>> = {};
  const activePlayerIds: PlayerId[] = [];
  const teamScores: Record<number, number> = {};
  const teamKothProgress: Record<number, number> = {};
  const teamSlotCount: Record<number, number> = {};

  for (const setup of setups) {
    const teamId: TeamId =
      format === 'ffa'
        ? setup.id
        : setup.teamId === 1 || setup.teamId === 2
        ? setup.teamId
        : setup.id === 1 || setup.id === 3
        ? 1
        : 2;

    const teamIdx = teamSlotCount[teamId] ?? 0;
    teamSlotCount[teamId] = teamIdx + 1;

    const { pos, facing } = getSpawnForTank(format, setup.id, teamId, teamIdx, map);
    const cleanName = (setup.name || '').replace(/[\u200B\u200C]/g, '').trim() || `Commander ${setup.id}`;
    tanks[setup.id] = createTank(
      setup.id,
      teamId,
      cleanName,
      pos,
      facing,
      setup.loadout,
      0,
      0,
      0
    );
    activePlayerIds.push(setup.id);
    teamScores[teamId] = 0;
    teamKothProgress[teamId] = 0;
  }

  return {
    format,
    mode,
    mapId: map.id,
    mapSelection,
    round: 1,
    maxRounds: mode === 'deathmatch' ? DM_WINS_TARGET * 2 - 1 : 1,
    phase: 'playing',
    phaseTimer: 0,
    elapsed: 0,
    activePlayerIds,
    winnerTeamId: null,
    roundWinnerTeamId: null,
    teamScores,
    teamKothProgress,
    tanks,
    projectiles: [],
    crates,
    powerUps: [],
    powerUpSpawnTimer: 3.0,
    flags: createFlags(map),
    koth: {
      x: map.kothCenter.x,
      y: map.kothCenter.y,
      radius: KOTH_ZONE_RADIUS,
      controllingTeam: null,
    },
    nextEntityId: nextId,
  };
}

export function resolveCircleRect(
  cx: number,
  cy: number,
  radius: number,
  rect: { x: number; y: number; w: number; h: number }
): { x: number; y: number; hit: boolean; nx: number; ny: number } {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= radius * radius) {
    return { x: cx, y: cy, hit: false, nx: 0, ny: 0 };
  }

  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = radius - dist;
    return {
      x: cx + nx * overlap,
      y: cy + ny * overlap,
      hit: true,
      nx,
      ny,
    };
  }

  const leftPen = cx - rect.x;
  const rightPen = rect.x + rect.w - cx;
  const topPen = cy - rect.y;
  const bottomPen = rect.y + rect.h - cy;
  const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);

  if (minPen === leftPen) return { x: rect.x - radius, y: cy, hit: true, nx: -1, ny: 0 };
  if (minPen === rightPen) return { x: rect.x + rect.w + radius, y: cy, hit: true, nx: 1, ny: 0 };
  if (minPen === topPen) return { x: cx, y: rect.y - radius, hit: true, nx: 0, ny: -1 };
  return { x: cx, y: rect.y + rect.h + radius, hit: true, nx: 0, ny: 1 };
}

export function pointInsideRect(x: number, y: number, rect: { x: number; y: number; w: number; h: number }): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function advanceDeathmatchRound(state: GameSnapshot): void {
  state.round += 1;
  const map = getMapForRound(state.mode, state.round, state.mapSelection ?? 'auto');
  state.mapId = map.id;
  state.phase = 'playing';
  state.phaseTimer = 0;
  state.roundWinnerTeamId = null;
  state.projectiles = [];
  state.powerUps = [];
  state.powerUpSpawnTimer = 3.0;

  const { crates, nextId } = createCrates(map, state.nextEntityId);
  state.crates = crates;
  state.nextEntityId = nextId;

  const teamSlotCount: Record<number, number> = {};
  for (const id of state.activePlayerIds) {
    const prev = state.tanks[id];
    if (!prev) continue;
    const teamIdx = teamSlotCount[prev.teamId] ?? 0;
    teamSlotCount[prev.teamId] = teamIdx + 1;
    const { pos, facing } = getSpawnForTank(state.format, prev.id, prev.teamId, teamIdx, map);
    state.tanks[id] = createTank(
      prev.id,
      prev.teamId,
      prev.name,
      pos,
      facing,
      prev.loadout,
      prev.kills,
      prev.shotsFired,
      prev.shotsHit
    );
  }
}

function checkDeathmatchRoundEnd(state: GameSnapshot, events: GameEvent[]): void {
  if (state.mode !== 'deathmatch' || state.phase !== 'playing') return;

  const aliveTeams = new Set<TeamId>();
  for (const id of state.activePlayerIds) {
    const t = state.tanks[id];
    if (t && t.alive) {
      aliveTeams.add(t.teamId);
    }
  }

  if (aliveTeams.size > 1) return;

  if (aliveTeams.size === 1) {
    const winningTeam = Array.from(aliveTeams)[0];
    state.teamScores[winningTeam] = (state.teamScores[winningTeam] ?? 0) + 1;
    state.roundWinnerTeamId = winningTeam;

    if (state.teamScores[winningTeam] >= DM_WINS_TARGET) {
      state.phase = 'gameover';
      state.winnerTeamId = winningTeam;
      events.push({ type: 'match_win', x: ARENA_MAPS[state.mapId].width / 2, y: ARENA_MAPS[state.mapId].height / 2, teamId: winningTeam });
    } else {
      state.phase = 'round_over';
      state.phaseTimer = 1.9;
      events.push({ type: 'round_win', x: ARENA_MAPS[state.mapId].width / 2, y: ARENA_MAPS[state.mapId].height / 2, teamId: winningTeam });
    }
  } else {
    // Mutual simultaneous elimination -> round draw
    state.roundWinnerTeamId = null;
    state.phase = 'round_over';
    state.phaseTimer = 1.9;
  }
}

function applyDamageToTank(
  state: GameSnapshot,
  target: TankState,
  attacker: TankState,
  rawDamage: number,
  events: GameEvent[]
): void {
  if (!target.alive) return;
  if (state.elapsed < target.spawnShieldUntil) {
    events.push({ type: 'shield_hit', x: target.x, y: target.y, playerId: target.id, damage: 0 });
    return;
  }

  let remaining = rawDamage;

  if (target.buffs.shieldHp > 0 && state.elapsed < target.buffs.shieldUntil) {
    const absorbed = Math.min(target.buffs.shieldHp, remaining);
    target.buffs.shieldHp -= absorbed;
    remaining -= absorbed;
    if (target.buffs.shieldHp <= 0) {
      target.buffs.shieldUntil = 0;
    }
    events.push({
      type: 'shield_hit',
      x: target.x,
      y: target.y,
      playerId: target.id,
      damage: absorbed,
    });
  }

  if (remaining > 0) {
    target.hp = Math.max(0, target.hp - remaining);
    target.hitFlashTimer = 0.09;
    events.push({
      type: 'hit',
      x: target.x,
      y: target.y,
      playerId: target.id,
      damage: remaining,
    });
  }

  if (target.hp <= 0) {
    target.alive = false;
    target.vx = 0;
    target.vy = 0;
    if (attacker.id !== target.id) {
      attacker.kills += 1;
    }
    events.push({
      type: 'explosion',
      x: target.x,
      y: target.y,
      playerId: target.id,
    });

    if (state.mode === 'ctf') {
      const carriedFlag = Object.values(state.flags).find((f) => f.carrierId === target.id);
      if (carriedFlag) {
        carriedFlag.status = 'dropped';
        carriedFlag.carrierId = null;
        carriedFlag.x = target.x;
        carriedFlag.y = target.y;
        carriedFlag.dropTimer = 10.0;
      }
    }

    if (state.mode === 'deathmatch') {
      checkDeathmatchRoundEnd(state, events);
    } else {
      target.respawnTimer = RESPAWN_DELAY;
    }
  }
}

function applySplashExplosion(
  state: GameSnapshot,
  proj: ProjectileState,
  directHitTankId: PlayerId | null,
  events: GameEvent[]
): void {
  if (proj.splashRadius <= 0) return;

  events.push({
    type: 'splash',
    x: proj.x,
    y: proj.y,
    splashRadius: proj.splashRadius,
    bulletType: proj.bulletType,
  });

  const attacker = state.tanks[proj.ownerId];
  for (const targetId of state.activePlayerIds) {
    if (targetId === directHitTankId) continue;
    const target = state.tanks[targetId];
    if (!target || !target.alive) continue;
    if (target.teamId === proj.teamId) continue;
    const targetRadius = computeTankStats(target.loadout).radius;
    const dist = Math.hypot(proj.x - target.x, proj.y - target.y);
    if (dist <= proj.splashRadius + targetRadius) {
      const falloff = Math.max(0.4, 1 - dist / (proj.splashRadius + targetRadius));
      const splashDmg = Math.round(proj.damage * 0.65 * falloff);
      applyDamageToTank(state, target, attacker ?? target, splashDmg, events);
    }
  }

  for (let ci = state.crates.length - 1; ci >= 0; ci--) {
    const crate = state.crates[ci];
    const cx = crate.x + crate.w / 2;
    const cy = crate.y + crate.h / 2;
    const dist = Math.hypot(proj.x - cx, proj.y - cy);
    if (dist <= proj.splashRadius + crate.w * 0.5) {
      crate.hp -= Math.round(proj.damage * 0.6);
      if (crate.hp <= 0) {
        events.push({ type: 'crate_break', x: cx, y: cy });
        state.crates.splice(ci, 1);
      }
    }
  }
}

function respawnTank(state: GameSnapshot, tank: TankState, map: ArenaMap): void {
  const stats = computeTankStats(tank.loadout);
  const teammates = state.activePlayerIds
    .map((id) => state.tanks[id])
    .filter((t): t is TankState => Boolean(t && t.teamId === tank.teamId));
  const teamIdx = Math.max(0, teammates.findIndex((t) => t.id === tank.id));
  const { pos, facing } = getSpawnForTank(state.format, tank.id, tank.teamId, teamIdx, map);

  tank.x = pos.x;
  tank.y = pos.y;
  tank.vx = 0;
  tank.vy = 0;
  tank.hullAngle = facing;
  tank.turretAngle = facing;
  tank.hp = stats.maxHp;
  tank.maxHp = stats.maxHp;
  tank.alive = true;
  tank.respawnTimer = 0;
  tank.spawnShieldUntil = state.elapsed + 1.6;
  tank.reloadTimer = 0;
  tank.dashActiveTimer = 0;
  tank.buffs = createEmptyBuffs();
}

function applyPowerUp(
  state: GameSnapshot,
  tank: TankState,
  item: PowerUpItem,
  events: GameEvent[]
): void {
  const meta = POWERUP_CATALOG[item.type];
  const until = state.elapsed + meta.durationSec;

  if (item.type === 'shield') {
    tank.buffs.shieldHp = 50;
    tank.buffs.shieldUntil = until;
  } else if (item.type === 'speed') {
    tank.buffs.speedUntil = until;
  } else if (item.type === 'rapid') {
    tank.buffs.rapidUntil = until;
  } else if (item.type === 'repair') {
    tank.hp = Math.min(tank.maxHp, tank.hp + 35);
  } else if (item.type === 'triple') {
    tank.buffs.tripleUntil = until;
  } else if (item.type === 'ricochet') {
    tank.buffs.ricochetUntil = until;
  } else if (item.type === 'damage') {
    tank.buffs.damageUntil = until;
  } else if (item.type === 'stealth') {
    tank.buffs.cloakUntil = until;
  }

  events.push({
    type: 'powerup',
    x: item.x,
    y: item.y,
    playerId: tank.id,
    powerUpType: item.type,
  });
}

export function stepSimulation(
  state: GameSnapshot,
  inputs: Partial<Record<PlayerId, PlayerInput>>,
  rawDt: number,
  randomFn: () => number = Math.random
): GameEvent[] {
  const dt = Math.max(0, Math.min(rawDt, 0.05));
  const events: GameEvent[] = [];
  if (dt <= 0) return events;

  const map = ARENA_MAPS[state.mapId];
  state.elapsed += dt;

  if (state.phase === 'gameover') {
    return events;
  }

  if (state.phase === 'round_over') {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      advanceDeathmatchRound(state);
    }
    return events;
  }

  // Expire timed buffs
  for (const id of state.activePlayerIds) {
    const t = state.tanks[id];
    if (!t) continue;
    if (t.buffs.shieldUntil > 0 && state.elapsed >= t.buffs.shieldUntil) {
      t.buffs.shieldHp = 0;
      t.buffs.shieldUntil = 0;
    }
    if (t.buffs.speedUntil > 0 && state.elapsed >= t.buffs.speedUntil) t.buffs.speedUntil = 0;
    if (t.buffs.rapidUntil > 0 && state.elapsed >= t.buffs.rapidUntil) t.buffs.rapidUntil = 0;
    if (t.buffs.tripleUntil > 0 && state.elapsed >= t.buffs.tripleUntil) t.buffs.tripleUntil = 0;
    if (t.buffs.ricochetUntil > 0 && state.elapsed >= t.buffs.ricochetUntil) t.buffs.ricochetUntil = 0;
    if (t.buffs.damageUntil > 0 && state.elapsed >= t.buffs.damageUntil) t.buffs.damageUntil = 0;
    if (t.buffs.cloakUntil > 0 && state.elapsed >= t.buffs.cloakUntil) t.buffs.cloakUntil = 0;
    if (t.buffs.cloakRevealUntil > 0 && state.elapsed >= t.buffs.cloakRevealUntil) t.buffs.cloakRevealUntil = 0;
    if (t.buffs.slowUntil > 0 && state.elapsed >= t.buffs.slowUntil) t.buffs.slowUntil = 0;
  }

  // 1. Update tanks
  for (const id of state.activePlayerIds) {
    const tank = state.tanks[id];
    if (!tank) continue;
    const input = inputs[id] ?? createEmptyInput(tank.turretAngle);
    const stats = computeTankStats(tank.loadout);

    tank.recoil = Math.max(0, tank.recoil - dt * 5.5);
    tank.hitFlashTimer = Math.max(0, tank.hitFlashTimer - dt);
    tank.reloadTimer = Math.max(0, tank.reloadTimer - dt);
    tank.dashCooldownTimer = Math.max(0, tank.dashCooldownTimer - dt);

    if (!tank.alive) {
      if (state.mode !== 'deathmatch') {
        tank.respawnTimer -= dt;
        if (tank.respawnTimer <= 0) {
          respawnTank(state, tank, map);
        }
      }
      continue;
    }

    tank.turretAngle = input.aimAngle;

    const overdriveMult = state.elapsed < tank.buffs.speedUntil ? 1.35 : 1.0;
    const cloakSpeedMult = state.elapsed < tank.buffs.cloakUntil ? 1.15 : 1.0;
    const cryoSlowMult = state.elapsed < tank.buffs.slowUntil ? 0.7 : 1.0;
    const dashCdMult = state.elapsed < tank.buffs.speedUntil ? 0.55 : 1.0;
    const effectiveSpeed = stats.moveSpeed * overdriveMult * cloakSpeedMult * cryoSlowMult;

    let moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const moveLen = Math.hypot(moveX, moveY);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveY /= moveLen;
    }

    if (input.dash && tank.dashCooldownTimer <= 0 && tank.dashActiveTimer <= 0) {
      const dirX = moveLen > 0 ? moveX : Math.cos(tank.turretAngle);
      const dirY = moveLen > 0 ? moveY : Math.sin(tank.turretAngle);
      tank.dashDirX = dirX;
      tank.dashDirY = dirY;
      tank.dashActiveTimer = 0.16;
      tank.dashCooldownTimer = stats.dashCooldown * dashCdMult;
      events.push({ type: 'dash', x: tank.x, y: tank.y, playerId: tank.id });
    }

    if (tank.dashActiveTimer > 0) {
      tank.dashActiveTimer = Math.max(0, tank.dashActiveTimer - dt);
      const dashSpeed = effectiveSpeed * 2.75;
      tank.vx = tank.dashDirX * dashSpeed;
      tank.vy = tank.dashDirY * dashSpeed;
    } else {
      const targetVx = moveX * effectiveSpeed;
      const targetVy = moveY * effectiveSpeed;
      const accel = moveLen > 0 ? 15 : 12;
      const blend = Math.min(1, accel * dt);
      tank.vx += (targetVx - tank.vx) * blend;
      tank.vy += (targetVy - tank.vy) * blend;
    }

    if (Math.hypot(tank.vx, tank.vy) > 12) {
      const targetHull = Math.atan2(tank.vy, tank.vx);
      tank.hullAngle = lerpAngle(tank.hullAngle, targetHull, dt * 11);
    }

    tank.x += tank.vx * dt;
    tank.y += tank.vy * dt;

    for (const wall of map.walls) {
      const res = resolveCircleRect(tank.x, tank.y, stats.radius, wall);
      if (res.hit) {
        tank.x = res.x;
        tank.y = res.y;
      }
    }
    for (const crate of state.crates) {
      const res = resolveCircleRect(tank.x, tank.y, stats.radius, crate);
      if (res.hit) {
        tank.x = res.x;
        tank.y = res.y;
      }
    }

    const activeOwnProjectiles = state.projectiles.filter((p) => p.ownerId === tank.id).length;
    const hasTriple = state.elapsed < tank.buffs.tripleUntil;
    const maxActiveOwn = hasTriple || stats.projectilesPerShot > 1 ? 10 : 5;

    if (input.fire && tank.reloadTimer <= 0 && activeOwnProjectiles < maxActiveOwn) {
      const rapidMult = state.elapsed < tank.buffs.rapidUntil ? 0.5 : 1.0;
      const rapidSpeedMult = state.elapsed < tank.buffs.rapidUntil ? 1.12 : 1.0;
      const ricochetSpeedMult = state.elapsed < tank.buffs.ricochetUntil ? 1.18 : 1.0;
      const extraBounces = state.elapsed < tank.buffs.ricochetUntil ? 2 : 0;
      const damageMult = state.elapsed < tank.buffs.damageUntil ? 1.45 : 1.0;

      tank.reloadTimer = stats.reloadTime * rapidMult;
      tank.recoil = 1;
      tank.shotsFired += 1;

      if (state.elapsed < tank.buffs.cloakUntil) {
        tank.buffs.cloakRevealUntil = state.elapsed + 0.38;
      }

      const spreadAngles = hasTriple ? [-0.19, 0, 0.19] : [0];
      const lateralOffsets = stats.projectilesPerShot === 2 ? [-6.5, 6.5] : [0];
      const barrelLen = stats.radius + 11;
      const bulletType = tank.loadout.bulletType ?? 'standard';
      const baseRadius =
        bulletType === 'heavy'
          ? 6.8 + tank.loadout.powerLevel * 0.55
          : bulletType === 'twin'
          ? 4.0 + tank.loadout.powerLevel * 0.35
          : 4.8 + tank.loadout.powerLevel * 0.45;
      const shellMaxAge =
        bulletType === 'ricochet' || extraBounces > 0
          ? 3.6
          : bulletType === 'heavy'
          ? 2.1
          : 2.8;

      let muzzleX = tank.x + Math.cos(tank.turretAngle) * barrelLen;
      let muzzleY = tank.y + Math.sin(tank.turretAngle) * barrelLen;

      for (const angOff of spreadAngles) {
        const fireAngle = tank.turretAngle + angOff;
        const dirX = Math.cos(fireAngle);
        const dirY = Math.sin(fireAngle);
        const perpX = -dirY;
        const perpY = dirX;

        for (const lat of lateralOffsets) {
          let spawnX = tank.x + dirX * barrelLen + perpX * lat;
          let spawnY = tank.y + dirY * barrelLen + perpY * lat;
          const muzzleBlocked = map.walls.some((w) => pointInsideRect(spawnX, spawnY, w));
          if (muzzleBlocked) {
            spawnX = tank.x + dirX * (stats.radius * 0.5) + perpX * lat * 0.5;
            spawnY = tank.y + dirY * (stats.radius * 0.5) + perpY * lat * 0.5;
          }
          muzzleX = spawnX;
          muzzleY = spawnY;

          const speed = stats.shellSpeed * rapidSpeedMult * ricochetSpeedMult;
          state.projectiles.push({
            id: `proj_${state.nextEntityId++}`,
            ownerId: tank.id,
            teamId: tank.teamId,
            bulletType,
            x: spawnX,
            y: spawnY,
            vx: dirX * speed,
            vy: dirY * speed,
            radius: baseRadius,
            damage: Math.round(stats.shellDamage * damageMult),
            bouncesLeft: stats.baseBounces + extraBounces,
            bounceCount: 0,
            splashRadius: stats.splashRadius,
            slowDuration: stats.slowDuration,
            age: 0,
            maxAge: shellMaxAge,
            powerLevel: tank.loadout.powerLevel,
          });
        }
      }

      events.push({
        type: 'fire',
        x: muzzleX,
        y: muzzleY,
        playerId: tank.id,
        bulletType,
      });
    }
  }

  // Pairwise Tank-to-Tank separation
  for (let i = 0; i < state.activePlayerIds.length; i++) {
    for (let j = i + 1; j < state.activePlayerIds.length; j++) {
      const t1 = state.tanks[state.activePlayerIds[i]];
      const t2 = state.tanks[state.activePlayerIds[j]];
      if (!t1 || !t2 || !t1.alive || !t2.alive) continue;
      const r1 = computeTankStats(t1.loadout).radius;
      const r2 = computeTankStats(t2.loadout).radius;
      const dx = t2.x - t1.x;
      const dy = t2.y - t1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = r1 + r2;
      if (dist < minDist) {
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        const overlap = (minDist - dist) * 0.5;
        t1.x -= nx * overlap;
        t1.y -= ny * overlap;
        t2.x += nx * overlap;
        t2.y += ny * overlap;
      }
    }
  }

  // 2. Step projectiles
  const survivingProjectiles: ProjectileState[] = [];
  for (const proj of state.projectiles) {
    proj.age += dt;
    if (proj.age >= proj.maxAge) continue;

    const subSteps = 3;
    const subDt = dt / subSteps;
    let aliveProj = true;

    for (let s = 0; s < subSteps && aliveProj; s++) {
      proj.x += proj.vx * subDt;
      proj.y += proj.vy * subDt;

      for (const wall of map.walls) {
        const res = resolveCircleRect(proj.x, proj.y, proj.radius, wall);
        if (res.hit) {
          if (proj.bouncesLeft > 0) {
            proj.x = res.x;
            proj.y = res.y;
            if (Math.abs(res.nx) > Math.abs(res.ny)) {
              proj.vx = -proj.vx;
            } else {
              proj.vy = -proj.vy;
            }
            proj.bouncesLeft -= 1;
            proj.bounceCount += 1;
            if (proj.bulletType === 'ricochet') {
              proj.damage = Math.round(proj.damage * 1.1);
            }
            events.push({ type: 'ricochet', x: proj.x, y: proj.y });
          } else {
            aliveProj = false;
            events.push({ type: 'ricochet', x: proj.x, y: proj.y });
            applySplashExplosion(state, proj, null, events);
          }
          break;
        }
      }

      if (!aliveProj) break;

      for (let ci = state.crates.length - 1; ci >= 0; ci--) {
        const crate = state.crates[ci];
        const res = resolveCircleRect(proj.x, proj.y, proj.radius, crate);
        if (res.hit) {
          crate.hp -= proj.damage;
          aliveProj = false;
          if (crate.hp <= 0) {
            events.push({
              type: 'crate_break',
              x: crate.x + crate.w / 2,
              y: crate.y + crate.h / 2,
            });
            state.crates.splice(ci, 1);
          } else {
            events.push({ type: 'ricochet', x: proj.x, y: proj.y });
          }
          applySplashExplosion(state, proj, null, events);
          break;
        }
      }

      if (!aliveProj) break;

      // Check opposing tanks (friendly-fire safe in 2v2!)
      const attacker = state.tanks[proj.ownerId];
      for (const targetId of state.activePlayerIds) {
        const target = state.tanks[targetId];
        if (!target || !target.alive) continue;
        if (target.teamId === proj.teamId) continue;
        const targetRadius = computeTankStats(target.loadout).radius;
        const dist = Math.hypot(proj.x - target.x, proj.y - target.y);
        if (dist <= targetRadius + proj.radius) {
          if (attacker) attacker.shotsHit += 1;
          if (proj.slowDuration > 0) {
            target.buffs.slowUntil = Math.max(target.buffs.slowUntil, state.elapsed + proj.slowDuration);
          }
          applyDamageToTank(state, target, attacker ?? target, proj.damage, events);
          applySplashExplosion(state, proj, target.id, events);
          aliveProj = false;
          break;
        }
      }
    }

    if (aliveProj) {
      survivingProjectiles.push(proj);
    }
  }
  state.projectiles = survivingProjectiles;

  // 3. Power-up spawning & pickup
  const maxActivePowerUps = state.activePlayerIds.length > 2 ? 4 : 3;
  state.powerUpSpawnTimer -= dt;
  if (state.powerUpSpawnTimer <= 0) {
    state.powerUpSpawnTimer = POWERUP_SPAWN_INTERVAL;
    if (state.powerUps.length < maxActivePowerUps && map.powerUpPads.length > 0) {
      const freePads = map.powerUpPads.filter(
        (pad) =>
          !state.powerUps.some((p) => Math.hypot(p.x - pad.x, p.y - pad.y) < 30) &&
          !state.crates.some((c) => pointInsideRect(pad.x, pad.y, c))
      );
      if (freePads.length > 0) {
        const pad = freePads[Math.floor(randomFn() * freePads.length) % freePads.length];
        const pType = POWERUP_TYPES[Math.floor(randomFn() * POWERUP_TYPES.length) % POWERUP_TYPES.length];
        state.powerUps.push({
          id: `pu_${state.nextEntityId++}`,
          type: pType,
          x: pad.x,
          y: pad.y,
          spawnTime: state.elapsed,
        });
      }
    }
  }

  for (let pi = state.powerUps.length - 1; pi >= 0; pi--) {
    const item = state.powerUps[pi];
    for (const id of state.activePlayerIds) {
      const tank = state.tanks[id];
      if (!tank || !tank.alive) continue;
      const r = computeTankStats(tank.loadout).radius;
      if (Math.hypot(tank.x - item.x, tank.y - item.y) <= r + 16) {
        applyPowerUp(state, tank, item, events);
        state.powerUps.splice(pi, 1);
        break;
      }
    }
  }

  // 4. Mode-specific mechanics: KOTH & CTF
  if (state.mode === 'koth' && state.phase === 'playing') {
    const teamsInside = new Set<TeamId>();
    for (const id of state.activePlayerIds) {
      const t = state.tanks[id];
      if (!t || !t.alive) continue;
      if (Math.hypot(t.x - state.koth.x, t.y - state.koth.y) <= state.koth.radius) {
        teamsInside.add(t.teamId);
      }
    }

    if (teamsInside.size > 1) {
      state.koth.controllingTeam = 'contested';
    } else if (teamsInside.size === 1) {
      const holdingTeam = Array.from(teamsInside)[0];
      state.koth.controllingTeam = holdingTeam;
      const nextProg = Math.min(100, (state.teamKothProgress[holdingTeam] ?? 0) + KOTH_CAPTURE_RATE * dt);
      state.teamKothProgress[holdingTeam] = nextProg;
      state.teamScores[holdingTeam] = Math.round(nextProg);
      if (nextProg >= 100) {
        state.phase = 'gameover';
        state.winnerTeamId = holdingTeam;
        events.push({ type: 'match_win', x: state.koth.x, y: state.koth.y, teamId: holdingTeam });
      }
    } else {
      state.koth.controllingTeam = null;
    }
  }

  if (state.mode === 'ctf' && state.phase === 'playing') {
    for (const flagTeam of [1, 2] as const) {
      const flag = state.flags[flagTeam];
      const base = map.flagBases[flagTeam];

      if (flag.status === 'carried' && flag.carrierId) {
        const carrier = state.tanks[flag.carrierId];
        if (carrier && carrier.alive) {
          flag.x = carrier.x;
          flag.y = carrier.y;
        }
      } else if (flag.status === 'dropped') {
        flag.dropTimer -= dt;
        let returnedByTeammate = false;
        for (const id of state.activePlayerIds) {
          const t = state.tanks[id];
          if (t && t.alive && t.teamId === flagTeam && Math.hypot(t.x - flag.x, t.y - flag.y) < 32) {
            returnedByTeammate = true;
            break;
          }
        }

        if (flag.dropTimer <= 0 || returnedByTeammate) {
          flag.status = 'at_base';
          flag.x = base.x;
          flag.y = base.y;
          flag.carrierId = null;
          events.push({ type: 'flag_return', x: base.x, y: base.y, teamId: flagTeam });
        }
      }

      // Enemy pickup
      if (flag.status === 'at_base' || flag.status === 'dropped') {
        for (const id of state.activePlayerIds) {
          const t = state.tanks[id];
          if (t && t.alive && t.teamId !== flagTeam && Math.hypot(t.x - flag.x, t.y - flag.y) < 32) {
            flag.status = 'carried';
            flag.carrierId = t.id;
            events.push({ type: 'flag_pickup', x: flag.x, y: flag.y, playerId: t.id, teamId: t.teamId });
            break;
          }
        }
      }
    }

    // Check flag captures by carriers reaching home base
    for (const scorerTeam of [1, 2] as const) {
      const enemyTeam: 1 | 2 = scorerTeam === 1 ? 2 : 1;
      const ownFlag = state.flags[scorerTeam];
      const enemyFlag = state.flags[enemyTeam];
      const ownBase = map.flagBases[scorerTeam];

      if (
        enemyFlag.status === 'carried' &&
        enemyFlag.carrierId &&
        ownFlag.status === 'at_base'
      ) {
        const carrier = state.tanks[enemyFlag.carrierId];
        if (
          carrier &&
          carrier.alive &&
          carrier.teamId === scorerTeam &&
          Math.hypot(carrier.x - ownBase.x, carrier.y - ownBase.y) < 34
        ) {
          state.teamScores[scorerTeam] = (state.teamScores[scorerTeam] ?? 0) + 1;
          ownFlag.status = 'at_base';
          ownFlag.x = map.flagBases[scorerTeam].x;
          ownFlag.y = map.flagBases[scorerTeam].y;
          ownFlag.carrierId = null;
          enemyFlag.status = 'at_base';
          enemyFlag.x = map.flagBases[enemyTeam].x;
          enemyFlag.y = map.flagBases[enemyTeam].y;
          enemyFlag.carrierId = null;

          events.push({ type: 'flag_capture', x: ownBase.x, y: ownBase.y, playerId: carrier.id, teamId: scorerTeam });

          if (state.teamScores[scorerTeam] >= CTF_CAPTURES_TARGET) {
            state.phase = 'gameover';
            state.winnerTeamId = scorerTeam;
            events.push({ type: 'match_win', x: ownBase.x, y: ownBase.y, teamId: scorerTeam });
          }
        }
      }
    }
  }

  return events;
}

function hasLineOfSight(map: ArenaMap, x1: number, y1: number, x2: number, y2: number): boolean {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(4, Math.ceil(dist / 24));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (map.walls.some((w) => pointInsideRect(px, py, w))) {
      return false;
    }
  }
  return true;
}

function hasCircleClearPath(
  map: ArenaMap,
  crates: CrateState[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number
): boolean {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.ceil(dist / 16));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (
      map.walls.some((w) => resolveCircleRect(px, py, radius, w).hit) ||
      crates.some((c) => resolveCircleRect(px, py, radius, c).hit)
    ) {
      return false;
    }
  }
  return true;
}

const NAV_CELL = 20;
const NAV_COLS = 60; // 1200 / 20
const NAV_ROWS = 38; // 760 / 20
const NAV_TOTAL = NAV_COLS * NAV_ROWS;

const staticWallGridCache = new Map<MapId, Uint8Array>();

function getStaticWallGrid(map: ArenaMap): Uint8Array {
  const cached = staticWallGridCache.get(map.id);
  if (cached) return cached;
  const grid = new Uint8Array(NAV_TOTAL);
  for (let r = 0; r < NAV_ROWS; r++) {
    const cy = r * NAV_CELL + NAV_CELL * 0.5;
    for (let c = 0; c < NAV_COLS; c++) {
      const cx = c * NAV_CELL + NAV_CELL * 0.5;
      if (map.walls.some((w) => resolveCircleRect(cx, cy, 19.5, w).hit)) {
        grid[r * NAV_COLS + c] = 1;
      }
    }
  }
  staticWallGridCache.set(map.id, grid);
  return grid;
}

function nearestWalkableCell(wallGrid: Uint8Array, startCol: number, startRow: number): number {
  const clampedC = Math.max(0, Math.min(NAV_COLS - 1, startCol));
  const clampedR = Math.max(0, Math.min(NAV_ROWS - 1, startRow));
  const startIdx = clampedR * NAV_COLS + clampedC;
  if (!wallGrid[startIdx]) return startIdx;

  let bestIdx = -1;
  let bestDist = Infinity;
  for (let dr = -4; dr <= 4; dr++) {
    for (let dc = -4; dc <= 4; dc++) {
      const c = clampedC + dc;
      const r = clampedR + dr;
      if (c < 0 || c >= NAV_COLS || r < 0 || r >= NAV_ROWS) continue;
      const idx = r * NAV_COLS + c;
      if (!wallGrid[idx]) {
        const d = dc * dc + dr * dr;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      }
    }
  }
  return bestIdx >= 0 ? bestIdx : startIdx;
}

const NAV_DIRS: Array<{ dc: number; dr: number; cost: number }> = [
  { dc: 1, dr: 0, cost: 10 },
  { dc: -1, dr: 0, cost: 10 },
  { dc: 0, dr: 1, cost: 10 },
  { dc: 0, dr: -1, cost: 10 },
  { dc: 1, dr: 1, cost: 14 },
  { dc: 1, dr: -1, cost: 14 },
  { dc: -1, dr: 1, cost: 14 },
  { dc: -1, dr: -1, cost: 14 },
];

function findGridPath(
  map: ArenaMap,
  crates: CrateState[],
  startX: number,
  startY: number,
  goalX: number,
  goalY: number
): Array<{ x: number; y: number }> {
  const wallGrid = getStaticWallGrid(map);
  const startIdx = nearestWalkableCell(
    wallGrid,
    Math.floor(startX / NAV_CELL),
    Math.floor(startY / NAV_CELL)
  );
  const goalIdx = nearestWalkableCell(
    wallGrid,
    Math.floor(goalX / NAV_CELL),
    Math.floor(goalY / NAV_CELL)
  );

  if (startIdx === goalIdx) {
    return [{ x: goalX, y: goalY }];
  }

  // Mark cells overlapped by crates with elevated traversal cost so bots route around crates when possible
  const crateMask = new Uint8Array(NAV_TOTAL);
  for (const crate of crates) {
    const minC = Math.max(0, Math.floor((crate.x - 18) / NAV_CELL));
    const maxC = Math.min(NAV_COLS - 1, Math.floor((crate.x + crate.w + 18) / NAV_CELL));
    const minR = Math.max(0, Math.floor((crate.y - 18) / NAV_CELL));
    const maxR = Math.min(NAV_ROWS - 1, Math.floor((crate.y + crate.h + 18) / NAV_CELL));
    for (let r = minR; r <= maxR; r++) {
      const cy = r * NAV_CELL + NAV_CELL * 0.5;
      for (let c = minC; c <= maxC; c++) {
        const cx = c * NAV_CELL + NAV_CELL * 0.5;
        if (resolveCircleRect(cx, cy, 18, crate).hit) {
          crateMask[r * NAV_COLS + c] = 1;
        }
      }
    }
  }

  const gScore = new Int32Array(NAV_TOTAL).fill(1_000_000_000);
  const fScore = new Int32Array(NAV_TOTAL).fill(1_000_000_000);
  const cameFrom = new Int32Array(NAV_TOTAL).fill(-1);
  const closed = new Uint8Array(NAV_TOTAL);
  const inOpen = new Uint8Array(NAV_TOTAL);

  const goalC = goalIdx % NAV_COLS;
  const goalR = Math.floor(goalIdx / NAV_COLS);
  const heuristic = (idx: number) => {
    const dc = Math.abs((idx % NAV_COLS) - goalC);
    const dr = Math.abs(Math.floor(idx / NAV_COLS) - goalR);
    return 10 * Math.max(dc, dr) + 4 * Math.min(dc, dr);
  };

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(startIdx);
  const open: number[] = [startIdx];
  inOpen[startIdx] = 1;

  let found = false;
  while (open.length > 0) {
    let bestPos = 0;
    let bestF = fScore[open[0]];
    for (let i = 1; i < open.length; i++) {
      const f = fScore[open[i]];
      if (f < bestF) {
        bestF = f;
        bestPos = i;
      }
    }
    const current = open[bestPos];
    open[bestPos] = open[open.length - 1];
    open.pop();
    inOpen[current] = 0;

    if (current === goalIdx) {
      found = true;
      break;
    }
    closed[current] = 1;

    const cc = current % NAV_COLS;
    const cr = Math.floor(current / NAV_COLS);

    for (const dir of NAV_DIRS) {
      const nc = cc + dir.dc;
      const nr = cr + dir.dr;
      if (nc < 0 || nc >= NAV_COLS || nr < 0 || nr >= NAV_ROWS) continue;
      const nIdx = nr * NAV_COLS + nc;
      if (closed[nIdx] || wallGrid[nIdx]) continue;
      // Prevent corner-cutting through diagonal walls
      if (dir.dc !== 0 && dir.dr !== 0) {
        if (wallGrid[cr * NAV_COLS + nc] || wallGrid[nr * NAV_COLS + cc]) continue;
      }

      const stepCost = dir.cost + (crateMask[nIdx] ? 60 : 0);
      const tentativeG = gScore[current] + stepCost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic(nIdx);
        if (!inOpen[nIdx]) {
          open.push(nIdx);
          inOpen[nIdx] = 1;
        }
      }
    }
  }

  if (!found) {
    return [{ x: goalX, y: goalY }];
  }

  const rawPath: Array<{ x: number; y: number }> = [];
  let cur = goalIdx;
  while (cur !== -1 && cur !== startIdx) {
    const c = cur % NAV_COLS;
    const r = Math.floor(cur / NAV_COLS);
    rawPath.push({ x: c * NAV_CELL + NAV_CELL * 0.5, y: r * NAV_CELL + NAV_CELL * 0.5 });
    cur = cameFrom[cur];
  }
  rawPath.reverse();
  if (rawPath.length > 0) {
    rawPath[rawPath.length - 1] = { x: goalX, y: goalY };
  } else {
    rawPath.push({ x: goalX, y: goalY });
  }
  return rawPath;
}

interface BotNavState {
  mapId: MapId;
  lastPathTime: number;
  waypoints: Array<{ x: number; y: number }>;
  anchorX: number;
  anchorY: number;
  anchorTime: number;
  escapeX: number;
  escapeY: number;
  escapeUntil: number;
  strafeSign: 1 | -1;
  strafeUntil: number;
}

const botNavMemory = new WeakMap<GameSnapshot, Map<PlayerId, BotNavState>>();

function getBotNavState(state: GameSnapshot, botId: PlayerId, x: number, y: number): BotNavState {
  let byBot = botNavMemory.get(state);
  if (!byBot) {
    byBot = new Map();
    botNavMemory.set(state, byBot);
  }
  let nav = byBot.get(botId);
  if (!nav || nav.mapId !== state.mapId) {
    nav = {
      mapId: state.mapId,
      lastPathTime: -1,
      waypoints: [],
      anchorX: x,
      anchorY: y,
      anchorTime: state.elapsed,
      escapeX: 0,
      escapeY: 0,
      escapeUntil: -1,
      strafeSign: botId % 2 === 0 ? 1 : -1,
      strafeUntil: state.elapsed + 1.5,
    };
    byBot.set(botId, nav);
  }
  return nav;
}

export function computeBotInput(
  state: GameSnapshot,
  botId: PlayerId,
  aggressive = true
): PlayerInput {
  const bot = state.tanks[botId];
  if (!bot) return createEmptyInput(0);
  const map = ARENA_MAPS[state.mapId];

  if (!bot.alive) return createEmptyInput(bot.turretAngle);

  // Find nearest alive enemy tank
  let nearestEnemy: TankState | null = null;
  let nearestDist = Infinity;
  for (const id of state.activePlayerIds) {
    const candidate = state.tanks[id];
    if (!candidate || !candidate.alive || candidate.teamId === bot.teamId) continue;
    const d = Math.hypot(candidate.x - bot.x, candidate.y - bot.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearestEnemy = candidate;
    }
  }

  if (!nearestEnemy) return createEmptyInput(bot.turretAngle);

  let goalX = nearestEnemy.x;
  let goalY = nearestEnemy.y;

  if (state.mode === 'koth') {
    const distToHill = Math.hypot(bot.x - state.koth.x, bot.y - state.koth.y);
    if (distToHill > 55) {
      goalX = state.koth.x;
      goalY = state.koth.y;
    }
  } else if (state.mode === 'ctf' && (bot.teamId === 1 || bot.teamId === 2)) {
    const enemyTeam: 1 | 2 = bot.teamId === 1 ? 2 : 1;
    const enemyFlag = state.flags[enemyTeam];
    if (enemyFlag.carrierId === botId) {
      goalX = map.flagBases[bot.teamId].x;
      goalY = map.flagBases[bot.teamId].y;
    } else {
      goalX = enemyFlag.x;
      goalY = enemyFlag.y;
    }
  } else if (
    state.powerUps.length > 0 &&
    Math.hypot(bot.x - state.powerUps[0].x, bot.y - state.powerUps[0].y) < 260
  ) {
    goalX = state.powerUps[0].x;
    goalY = state.powerUps[0].y;
  }

  const nav = getBotNavState(state, botId, bot.x, bot.y);

  // Recompute grid A* path periodically (not every tick) to avoid frame-to-frame path flipping
  const driftedFromPath =
    nav.waypoints.length > 0 &&
    Math.hypot(nav.waypoints[0].x - bot.x, nav.waypoints[0].y - bot.y) > 150;
  if (
    nav.lastPathTime < 0 ||
    state.elapsed - nav.lastPathTime >= 0.18 ||
    nav.waypoints.length === 0 ||
    driftedFromPath
  ) {
    nav.waypoints = findGridPath(map, state.crates, bot.x, bot.y, goalX, goalY);
    nav.lastPathTime = state.elapsed;
  }

  // Advance reached waypoints and string-pull to the furthest clearly reachable waypoint
  while (
    nav.waypoints.length > 1 &&
    Math.hypot(nav.waypoints[0].x - bot.x, nav.waypoints[0].y - bot.y) < 24
  ) {
    nav.waypoints.shift();
  }

  let targetWp = nav.waypoints[0] ?? { x: goalX, y: goalY };
  const lookLimit = Math.min(nav.waypoints.length - 1, 8);
  for (let i = lookLimit; i >= 1; i--) {
    const wp = nav.waypoints[i];
    if (hasCircleClearPath(map, state.crates, bot.x, bot.y, wp.x, wp.y, 19)) {
      targetWp = wp;
      break;
    }
  }

  const wpDx = targetWp.x - bot.x;
  const wpDy = targetWp.y - bot.y;
  const wpDist = Math.hypot(wpDx, wpDy);

  let desiredX = wpDx / (wpDist || 1);
  let desiredY = wpDy / (wpDist || 1);

  const enemyDx = nearestEnemy.x - bot.x;
  const enemyDy = nearestEnemy.y - bot.y;
  const enemyDist = Math.hypot(enemyDx, enemyDy);
  const los = hasLineOfSight(map, bot.x, bot.y, nearestEnemy.x, nearestEnemy.y);

  // Committed close-range strafe in Deathmatch only when clear of walls
  if (state.mode === 'deathmatch' && enemyDist < 205 && los) {
    const perpX = -enemyDy / (enemyDist || 1);
    const perpY = enemyDx / (enemyDist || 1);
    const testX = bot.x + perpX * nav.strafeSign * 40;
    const testY = bot.y + perpY * nav.strafeSign * 40;
    const strafeBlocked =
      map.walls.some((w) => resolveCircleRect(testX, testY, 21, w).hit) ||
      state.crates.some((c) => resolveCircleRect(testX, testY, 21, c).hit);

    if (strafeBlocked || state.elapsed >= nav.strafeUntil) {
      const altSign: 1 | -1 = nav.strafeSign === 1 ? -1 : 1;
      const altX = bot.x + perpX * altSign * 40;
      const altY = bot.y + perpY * altSign * 40;
      const altBlocked =
        map.walls.some((w) => resolveCircleRect(altX, altY, 21, w).hit) ||
        state.crates.some((c) => resolveCircleRect(altX, altY, 21, c).hit);
      if (!altBlocked) {
        nav.strafeSign = altSign;
        nav.strafeUntil = state.elapsed + 1.4;
      }
    }

    const activeStrafeX = bot.x + perpX * nav.strafeSign * 40;
    const activeStrafeY = bot.y + perpY * nav.strafeSign * 40;
    const activeBlocked =
      map.walls.some((w) => resolveCircleRect(activeStrafeX, activeStrafeY, 21, w).hit) ||
      state.crates.some((c) => resolveCircleRect(activeStrafeX, activeStrafeY, 21, c).hit);

    if (!activeBlocked) {
      desiredX = perpX * nav.strafeSign;
      desiredY = perpY * nav.strafeSign;
    }
  }

  // Stuck / anti-wiggle detector: if bot moves < 14px over 0.55s while trying to travel, commit to clearest open heading for 0.48s
  const wantsToMove = wpDist > 24 || (state.mode === 'deathmatch' && enemyDist < 205);
  if (state.elapsed < nav.escapeUntil) {
    desiredX = nav.escapeX;
    desiredY = nav.escapeY;
  } else if (wantsToMove && state.elapsed - nav.anchorTime >= 0.55) {
    const progress = Math.hypot(bot.x - nav.anchorX, bot.y - nav.anchorY);
    nav.anchorX = bot.x;
    nav.anchorY = bot.y;
    nav.anchorTime = state.elapsed;

    if (progress < 14) {
      let bestDirX = -desiredY;
      let bestDirY = desiredX;
      let bestScore = -Infinity;
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const px = bot.x + dx * 44;
        const py = bot.y + dy * 44;
        const hitWall = map.walls.some((w) => resolveCircleRect(px, py, 21, w).hit);
        const hitCrate = state.crates.some((c) => resolveCircleRect(px, py, 21, c).hit);
        if (!hitWall && !hitCrate) {
          const alignmentWithGoal = dx * desiredX + dy * desiredY;
          const score = 10 + alignmentWithGoal;
          if (score > bestScore) {
            bestScore = score;
            bestDirX = dx;
            bestDirY = dy;
          }
        }
      }
      nav.escapeX = bestDirX;
      nav.escapeY = bestDirY;
      nav.escapeUntil = state.elapsed + 0.48;
      nav.lastPathTime = -1; // Force fresh path once unstuck
      desiredX = bestDirX;
      desiredY = bestDirY;
    }
  } else if (state.elapsed < nav.anchorTime) {
    nav.anchorTime = state.elapsed;
  }

  // If a destructible crate sits right in front of our movement heading, blast it instead of stalling
  const blockingCrate = state.crates.find((c) => {
    const cx = c.x + c.w * 0.5;
    const cy = c.y + c.h * 0.5;
    const d = Math.hypot(cx - bot.x, cy - bot.y);
    if (d > 72) return false;
    const dot = ((cx - bot.x) / (d || 1)) * desiredX + ((cy - bot.y) / (d || 1)) * desiredY;
    return dot > 0.55;
  });

  const aimAngle =
    !los && blockingCrate
      ? Math.atan2(blockingCrate.y + blockingCrate.h * 0.5 - bot.y, blockingCrate.x + blockingCrate.w * 0.5 - bot.x)
      : Math.atan2(enemyDy, enemyDx) + Math.sin(state.elapsed * 2.3 + botId) * 0.08;

  const incomingThreat = state.projectiles.some((p) => {
    if (p.teamId === bot.teamId) return false;
    return Math.hypot(p.x - bot.x, p.y - bot.y) < 120;
  });

  const openingReady = state.elapsed > 1.2;
  const burstWindow = Math.sin(state.elapsed * 3.1 + botId) > -0.15;
  const shouldFire = aggressive && openingReady && ((los && burstWindow) || Boolean(blockingCrate));

  return {
    up: desiredY < -0.25,
    down: desiredY > 0.25,
    left: desiredX < -0.25,
    right: desiredX > 0.25,
    aimAngle,
    fire: shouldFire,
    dash: incomingThreat && bot.dashCooldownTimer <= 0,
  };
}
