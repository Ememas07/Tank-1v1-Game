import type {
  BulletType,
  DecalId,
  PaintId,
  PowerUpType,
  TankComputedStats,
  TankLoadout,
} from './types';

export interface PaintPalette {
  id: PaintId;
  name: string;
  primary: string;
  secondary: string;
  trim: string;
  barrel: string;
}

export const PAINT_PALETTES: Record<PaintId, PaintPalette> = {
  cobalt: {
    id: 'cobalt',
    name: 'Cobalt Steel',
    primary: '#2563eb',
    secondary: '#1d4ed8',
    trim: '#93c5fd',
    barrel: '#475569',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Forge',
    primary: '#dc2626',
    secondary: '#991b1b',
    trim: '#fca5a5',
    barrel: '#3f3f46',
  },
  olive: {
    id: 'olive',
    name: 'Olive Drab',
    primary: '#4d7c0f',
    secondary: '#365314',
    trim: '#bef264',
    barrel: '#374151',
  },
  ochre: {
    id: 'ochre',
    name: 'Desert Ochre',
    primary: '#d97706',
    secondary: '#92400e',
    trim: '#fde68a',
    barrel: '#44403c',
  },
  graphite: {
    id: 'graphite',
    name: 'Graphite Spec',
    primary: '#3f3f46',
    secondary: '#27272a',
    trim: '#e4e4e7',
    barrel: '#18181b',
  },
  sandstorm: {
    id: 'sandstorm',
    name: 'Dune Tan',
    primary: '#a16207',
    secondary: '#713f12',
    trim: '#fef08a',
    barrel: '#52525b',
  },
};

export interface DecalMeta {
  id: DecalId;
  name: string;
}

export const DECAL_OPTIONS: DecalMeta[] = [
  { id: 'stripes', name: 'Twin Stripes' },
  { id: 'chevron', name: 'Vanguard Chevron' },
  { id: 'star', name: 'Armored Star' },
  { id: 'hazard', name: 'Hazard Bands' },
  { id: 'none', name: 'Clean Hull' },
];

export interface BulletUpgradeMeta {
  id: BulletType;
  name: string;
  shortCode: string;
  summary: string;
  color: string;
  damageMult: number;
  speedMult: number;
  reloadMult: number;
  bounces: number;
  splashRadius: number;
  slowDuration: number;
  projectilesPerShot: number;
}

export const BULLET_UPGRADES: Record<BulletType, BulletUpgradeMeta> = {
  standard: {
    id: 'standard',
    name: 'AP Standard',
    shortCode: 'STD',
    summary: 'Balanced shell · 1 bounce',
    color: '#fde047',
    damageMult: 1.0,
    speedMult: 1.0,
    reloadMult: 1.0,
    bounces: 1,
    splashRadius: 0,
    slowDuration: 0,
    projectilesPerShot: 1,
  },
  ricochet: {
    id: 'ricochet',
    name: 'Bank-Shot AP',
    shortCode: 'BNK',
    summary: '3 bounces · +10% dmg/bounce',
    color: '#22d3ee',
    damageMult: 0.95,
    speedMult: 1.1,
    reloadMult: 1.02,
    bounces: 3,
    splashRadius: 0,
    slowDuration: 0,
    projectilesPerShot: 1,
  },
  twin: {
    id: 'twin',
    name: 'Twin Autocannon',
    shortCode: 'TWN',
    summary: 'Dual parallel shells · fast burst',
    color: '#fbbf24',
    damageMult: 0.58,
    speedMult: 1.04,
    reloadMult: 0.95,
    bounces: 1,
    splashRadius: 0,
    slowDuration: 0,
    projectilesPerShot: 2,
  },
  heavy: {
    id: 'heavy',
    name: 'Siege HE',
    shortCode: 'HE',
    summary: 'Heavy splash blast · no bounce',
    color: '#f97316',
    damageMult: 1.38,
    speedMult: 0.78,
    reloadMult: 1.28,
    bounces: 0,
    splashRadius: 58,
    slowDuration: 0,
    projectilesPerShot: 1,
  },
  plasma: {
    id: 'plasma',
    name: 'Cryo Plasma',
    shortCode: 'PLS',
    summary: 'High velocity · slows hit targets',
    color: '#a855f7',
    damageMult: 0.88,
    speedMult: 1.28,
    reloadMult: 0.98,
    bounces: 1,
    splashRadius: 0,
    slowDuration: 1.8,
    projectilesPerShot: 1,
  },
};

export const BULLET_ORDER: BulletType[] = [
  'standard',
  'ricochet',
  'twin',
  'heavy',
  'plasma',
];

export const MAX_UPGRADE_POINTS = 5;
export const MAX_COMPONENT_TIER = 3;

export const DEFAULT_P1_LOADOUT: TankLoadout = {
  paint: 'cobalt',
  decal: 'stripes',
  armorLevel: 2,
  speedLevel: 2,
  powerLevel: 1,
  bulletType: 'standard',
};

export const DEFAULT_P2_LOADOUT: TankLoadout = {
  paint: 'crimson',
  decal: 'chevron',
  armorLevel: 1,
  speedLevel: 2,
  powerLevel: 2,
  bulletType: 'standard',
};

export function clampLoadout(input: Partial<TankLoadout> | undefined, fallback: TankLoadout): TankLoadout {
  const paint = input?.paint && input.paint in PAINT_PALETTES ? input.paint : fallback.paint;
  const decalValid = DECAL_OPTIONS.some((d) => d.id === input?.decal);
  const decal: DecalId = decalValid && input?.decal ? input.decal : fallback.decal;
  const bulletType: BulletType =
    input?.bulletType && input.bulletType in BULLET_UPGRADES
      ? input.bulletType
      : fallback.bulletType ?? 'standard';

  let armor = Math.max(0, Math.min(MAX_COMPONENT_TIER, Math.round(input?.armorLevel ?? fallback.armorLevel)));
  let speed = Math.max(0, Math.min(MAX_COMPONENT_TIER, Math.round(input?.speedLevel ?? fallback.speedLevel)));
  let power = Math.max(0, Math.min(MAX_COMPONENT_TIER, Math.round(input?.powerLevel ?? fallback.powerLevel)));

  // Enforce point budget deterministically so nobody can send an over-budget payload
  let total = armor + speed + power;
  while (total > MAX_UPGRADE_POINTS) {
    if (power >= armor && power >= speed && power > 0) {
      power--;
    } else if (speed >= armor && speed > 0) {
      speed--;
    } else if (armor > 0) {
      armor--;
    }
    total = armor + speed + power;
  }

  return {
    paint,
    decal,
    armorLevel: armor,
    speedLevel: speed,
    powerLevel: power,
    bulletType,
  };
}

export function computeTankStats(loadout: TankLoadout): TankComputedStats {
  const armorTier = Math.max(0, Math.min(MAX_COMPONENT_TIER, loadout.armorLevel));
  const speedTier = Math.max(0, Math.min(MAX_COMPONENT_TIER, loadout.speedLevel));
  const powerTier = Math.max(0, Math.min(MAX_COMPONENT_TIER, loadout.powerLevel));
  const bullet = BULLET_UPGRADES[loadout.bulletType] ?? BULLET_UPGRADES.standard;

  const baseReload = 0.56 + powerTier * 0.04;
  const baseDamage = 24 + powerTier * 6;
  const baseSpeed = 540 + powerTier * 45;

  return {
    maxHp: 90 + armorTier * 22, // 90, 112, 134, 156
    moveSpeed: 195 + speedTier * 22, // 195, 217, 239, 261 px/s
    dashCooldown: 3.4 - speedTier * 0.35, // 3.4s down to 2.35s
    reloadTime: Number((baseReload * bullet.reloadMult).toFixed(3)),
    shellDamage: Math.round(baseDamage * bullet.damageMult),
    shellSpeed: Math.round(baseSpeed * bullet.speedMult),
    radius: 19 + armorTier * 1.2, // Heavier armor is subtly wider
    baseBounces: bullet.bounces,
    splashRadius: bullet.splashRadius,
    slowDuration: bullet.slowDuration,
    projectilesPerShot: bullet.projectilesPerShot,
  };
}

export interface PowerUpMeta {
  type: PowerUpType;
  name: string;
  shortLabel: string;
  description: string;
  color: string;
  durationSec: number;
}

export const POWERUP_CATALOG: Record<PowerUpType, PowerUpMeta> = {
  shield: {
    type: 'shield',
    name: 'Aegis Shield',
    shortLabel: 'SHIELD',
    description: 'Absorbs up to 50 incoming damage for 10s',
    color: '#38bdf8',
    durationSec: 10,
  },
  speed: {
    type: 'speed',
    name: 'Overdrive',
    shortLabel: 'SPEED',
    description: '+35% movement speed & faster dash for 9s',
    color: '#f59e0b',
    durationSec: 9,
  },
  rapid: {
    type: 'rapid',
    name: 'Autoloader',
    shortLabel: 'RAPID',
    description: '2x cannon fire rate for 8s',
    color: '#f43f5e',
    durationSec: 8,
  },
  repair: {
    type: 'repair',
    name: 'Field Repair',
    shortLabel: 'REPAIR',
    description: 'Restores 35 armor integrity immediately',
    color: '#10b981',
    durationSec: 0,
  },
  triple: {
    type: 'triple',
    name: 'Scatter Burst',
    shortLabel: 'TRIPLE',
    description: 'Fires a 3-way spread salvo for 8s',
    color: '#a855f7',
    durationSec: 8,
  },
  ricochet: {
    type: 'ricochet',
    name: 'Hyper Bounce',
    shortLabel: 'BOUNCE',
    description: '+2 wall bounces & +18% shell speed for 10s',
    color: '#06b6d4',
    durationSec: 10,
  },
  damage: {
    type: 'damage',
    name: 'Heavy Ordnance',
    shortLabel: 'AMP DMG',
    description: '+45% shell damage & instant crate break for 8s',
    color: '#f97316',
    durationSec: 8,
  },
  stealth: {
    type: 'stealth',
    name: 'Stealth Cloak',
    shortLabel: 'CLOAK',
    description: 'Near-invisible hull & +15% speed for 8s',
    color: '#84cc16',
    durationSec: 8,
  },
};
