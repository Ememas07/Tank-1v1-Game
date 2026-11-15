export type MatchFormat = '1v1' | '2v2' | 'ffa';

export type GameMode = 'deathmatch' | 'koth' | 'ctf';

export type PlayerId = 1 | 2 | 3 | 4;
export type TeamId = 1 | 2 | 3 | 4;

export type PaintId =
  | 'cobalt'
  | 'crimson'
  | 'olive'
  | 'ochre'
  | 'graphite'
  | 'sandstorm'
  | 'lily_pink';

export type DecalId = 'none' | 'stripes' | 'chevron' | 'star' | 'hazard';

export type BulletType = 'standard' | 'ricochet' | 'twin' | 'heavy' | 'plasma';

export interface TankLoadout {
  paint: PaintId;
  decal: DecalId;
  armorLevel: number; // 0..3
  speedLevel: number; // 0..3
  powerLevel: number; // 0..3
  bulletType: BulletType;
}

export interface TankComputedStats {
  maxHp: number;
  moveSpeed: number;
  dashCooldown: number;
  reloadTime: number;
  shellDamage: number;
  shellSpeed: number;
  radius: number;
  baseBounces: number;
  splashRadius: number;
  slowDuration: number;
  projectilesPerShot: number;
}

export type PowerUpType =
  | 'shield'
  | 'speed'
  | 'rapid'
  | 'repair'
  | 'triple'
  | 'ricochet'
  | 'damage'
  | 'stealth';

export interface Vec2 {
  x: number;
  y: number;
}

export interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
  style?: 'concrete' | 'steel';
}

export interface CrateState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
}

export interface PowerUpItem {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  spawnTime: number;
}

export interface ActiveBuffs {
  shieldHp: number;
  shieldUntil: number;
  speedUntil: number;
  rapidUntil: number;
  tripleUntil: number;
  ricochetUntil: number;
  damageUntil: number;
  cloakUntil: number;
  cloakRevealUntil: number;
  slowUntil: number;
}

export interface TankState {
  id: PlayerId;
  teamId: TeamId;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hullAngle: number;
  turretAngle: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  spawnShieldUntil: number;
  reloadTimer: number;
  dashCooldownTimer: number;
  dashActiveTimer: number;
  dashDirX: number;
  dashDirY: number;
  recoil: number; // 0..1 visual barrel kick
  hitFlashTimer: number;
  loadout: TankLoadout;
  buffs: ActiveBuffs;
  kills: number;
  shotsFired: number;
  shotsHit: number;
}

export interface ProjectileState {
  id: string;
  ownerId: PlayerId;
  teamId: TeamId;
  bulletType: BulletType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  bouncesLeft: number;
  bounceCount: number;
  splashRadius: number;
  slowDuration: number;
  age: number;
  maxAge: number;
  powerLevel: number;
}

export interface FlagState {
  teamId: 1 | 2;
  status: 'at_base' | 'carried' | 'dropped';
  x: number;
  y: number;
  carrierId: PlayerId | null;
  dropTimer: number;
}

export interface KothZoneState {
  x: number;
  y: number;
  radius: number;
  controllingTeam: TeamId | 'contested' | null;
}

export type MapId =
  | 'proving_ground'
  | 'crossfire_depot'
  | 'twin_fortress'
  | 'iron_citadel'
  | 'canyon_foundry'
  | 'ricochet_vault';

export type MapSelection = 'auto' | MapId;

export interface ArenaMap {
  id: MapId;
  name: string;
  width: number;
  height: number;
  spawns: Record<PlayerId, Vec2>;
  walls: WallRect[];
  initialCrates: Array<{ x: number; y: number; w: number; h: number }>;
  powerUpPads: Vec2[];
  kothCenter: Vec2;
  flagBases: { 1: Vec2; 2: Vec2 };
}

export type MatchPhase = 'playing' | 'round_over' | 'gameover';

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  aimAngle: number;
  fire: boolean;
  dash: boolean;
}

export interface GameSnapshot {
  format: MatchFormat;
  mode: GameMode;
  mapId: MapId;
  mapSelection?: MapSelection;
  round: number;
  maxRounds: number;
  phase: MatchPhase;
  phaseTimer: number;
  elapsed: number;
  activePlayerIds: PlayerId[];
  winnerTeamId: TeamId | null;
  roundWinnerTeamId: TeamId | null;
  teamScores: Record<number, number>; // Round wins (DM), captures (CTF), rounded % (KOTH)
  teamKothProgress: Record<number, number>; // 0..100 float for KOTH
  tanks: Partial<Record<PlayerId, TankState>>;
  projectiles: ProjectileState[];
  crates: CrateState[];
  powerUps: PowerUpItem[];
  powerUpSpawnTimer: number;
  flags: { 1: FlagState; 2: FlagState };
  koth: KothZoneState;
  nextEntityId: number;
}

export type GameEventType =
  | 'fire'
  | 'ricochet'
  | 'hit'
  | 'shield_hit'
  | 'splash'
  | 'crate_break'
  | 'powerup'
  | 'explosion'
  | 'dash'
  | 'flag_pickup'
  | 'flag_return'
  | 'flag_capture'
  | 'round_win'
  | 'match_win';

export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  playerId?: PlayerId;
  teamId?: TeamId;
  powerUpType?: PowerUpType;
  bulletType?: BulletType;
  damage?: number;
  splashRadius?: number;
}

export interface RoomPlayerInfo {
  id: PlayerId;
  teamId: TeamId;
  name: string;
  loadout: TankLoadout;
  connected: boolean;
  isHost: boolean;
  ready: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: PlayerId;
  playerName: string;
  paint: PaintId;
  text: string;
  timestamp: number;
}

export type ServerMessage =
  | {
      type: 'room:created';
      roomCode: string;
      playerId: PlayerId;
      hostId: PlayerId;
      format: MatchFormat;
      mode: GameMode;
      mapSelection: MapSelection;
      fillBots: boolean;
      players: RoomPlayerInfo[];
      chatHistory: ChatMessage[];
    }
  | {
      type: 'room:joined';
      roomCode: string;
      playerId: PlayerId;
      hostId: PlayerId;
      format: MatchFormat;
      mode: GameMode;
      mapSelection: MapSelection;
      fillBots: boolean;
      players: RoomPlayerInfo[];
      chatHistory: ChatMessage[];
    }
  | {
      type: 'room:updated';
      roomCode: string;
      hostId: PlayerId;
      format: MatchFormat;
      mode: GameMode;
      mapSelection: MapSelection;
      fillBots: boolean;
      players: RoomPlayerInfo[];
      status: 'waiting' | 'playing';
      countdown?: number | null;
    }
  | {
      type: 'room:countdown';
      count: number;
    }
  | {
      type: 'room:countdown_cancelled';
    }
  | {
      type: 'room:chat';
      message: ChatMessage;
    }
  | {
      type: 'room:error';
      message: string;
    }
  | {
      type: 'game:start';
      snapshot: GameSnapshot;
    }
  | {
      type: 'game:state';
      snapshot: GameSnapshot;
      events: GameEvent[];
      serverTime: number;
    }
  | {
      type: 'game:rematch_status';
      votedPlayerIds: PlayerId[];
      totalPlayers: number;
    }
  | {
      type: 'room:opponent_left';
      message: string;
    };

export type ClientMessage =
  | {
      type: 'room:create';
      playerName: string;
      loadout: TankLoadout;
      format: MatchFormat;
      mode: GameMode;
      mapSelection: MapSelection;
    }
  | {
      type: 'room:join';
      roomCode: string;
      playerName: string;
      loadout: TankLoadout;
    }
  | {
      type: 'room:update_config';
      loadout?: TankLoadout;
      format?: MatchFormat;
      mode?: GameMode;
      mapSelection?: MapSelection;
      fillBots?: boolean;
      teamId?: 1 | 2;
      playerName?: string;
      ready?: boolean;
    }
  | {
      type: 'room:chat';
      text: string;
    }
  | {
      type: 'room:start_match';
    }
  | {
      type: 'game:input';
      input: PlayerInput;
    }
  | {
      type: 'game:rematch';
    }
  | {
      type: 'game:rematch_cancel';
    };
