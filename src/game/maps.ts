import type { ArenaMap, MapId, MapSelection } from './types';

export const ARENA_WIDTH = 1200;
export const ARENA_HEIGHT = 760;
export const WALL_THICKNESS = 28;

function outerBorderWalls() {
  const t = WALL_THICKNESS;
  return [
    { x: 0, y: 0, w: ARENA_WIDTH, h: t, style: 'steel' as const },
    { x: 0, y: ARENA_HEIGHT - t, w: ARENA_WIDTH, h: t, style: 'steel' as const },
    { x: 0, y: t, w: t, h: ARENA_HEIGHT - t * 2, style: 'steel' as const },
    { x: ARENA_WIDTH - t, y: t, w: t, h: ARENA_HEIGHT - t * 2, style: 'steel' as const },
  ];
}

export const ARENA_MAPS: Record<MapId, ArenaMap> = {
  proving_ground: {
    id: 'proving_ground',
    name: 'Proving Ground',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    spawns: {
      1: { x: 145, y: 175 },
      2: { x: 1055, y: 585 },
      3: { x: 145, y: 585 },
      4: { x: 1055, y: 175 },
    },
    walls: [
      ...outerBorderWalls(),
      // West & East spawn shield bunkers
      { x: 260, y: 205, w: 34, h: 135, style: 'concrete' },
      { x: 260, y: 420, w: 34, h: 135, style: 'concrete' },
      { x: 906, y: 205, w: 34, h: 135, style: 'concrete' },
      { x: 906, y: 420, w: 34, h: 135, style: 'concrete' },
      // Midfield horizontal steel barriers
      { x: 455, y: 120, w: 105, h: 32, style: 'steel' },
      { x: 640, y: 120, w: 105, h: 32, style: 'steel' },
      { x: 455, y: 608, w: 105, h: 32, style: 'steel' },
      { x: 640, y: 608, w: 105, h: 32, style: 'steel' },
      // Inner tactical corners around center
      { x: 440, y: 270, w: 36, h: 64, style: 'concrete' },
      { x: 724, y: 270, w: 36, h: 64, style: 'concrete' },
      { x: 440, y: 426, w: 36, h: 64, style: 'concrete' },
      { x: 724, y: 426, w: 36, h: 64, style: 'concrete' },
    ],
    initialCrates: [
      { x: 355, y: 145, w: 42, h: 42 },
      { x: 355, y: 573, w: 42, h: 42 },
      { x: 803, y: 145, w: 42, h: 42 },
      { x: 803, y: 573, w: 42, h: 42 },
      { x: 579, y: 215, w: 42, h: 42 },
      { x: 579, y: 503, w: 42, h: 42 },
      { x: 190, y: 359, w: 42, h: 42 },
      { x: 968, y: 359, w: 42, h: 42 },
    ],
    powerUpPads: [
      { x: 600, y: 380 },
      { x: 600, y: 105 },
      { x: 600, y: 655 },
      { x: 375, y: 380 },
      { x: 825, y: 380 },
    ],
    kothCenter: { x: 600, y: 380 },
    flagBases: {
      1: { x: 115, y: 380 },
      2: { x: 1085, y: 380 },
    },
  },
  crossfire_depot: {
    id: 'crossfire_depot',
    name: 'Crossfire Depot',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    spawns: {
      1: { x: 135, y: 155 },
      2: { x: 1065, y: 605 },
      3: { x: 135, y: 605 },
      4: { x: 1065, y: 155 },
    },
    walls: [
      ...outerBorderWalls(),
      // Central steel bunker islands
      { x: 515, y: 235, w: 170, h: 32, style: 'steel' },
      { x: 515, y: 493, w: 170, h: 32, style: 'steel' },
      // Symmetrical L-corridors for ricochet bank shots
      { x: 245, y: 280, w: 145, h: 32, style: 'concrete' },
      { x: 245, y: 280, w: 32, h: 175, style: 'concrete' },
      { x: 810, y: 448, w: 145, h: 32, style: 'concrete' },
      { x: 923, y: 305, w: 32, h: 175, style: 'concrete' },
      // Corner reflectors
      { x: 380, y: 540, w: 36, h: 110, style: 'steel' },
      { x: 784, y: 110, w: 36, h: 110, style: 'steel' },
    ],
    initialCrates: [
      { x: 420, y: 359, w: 42, h: 42 },
      { x: 738, y: 359, w: 42, h: 42 },
      { x: 285, y: 520, w: 42, h: 42 },
      { x: 873, y: 198, w: 42, h: 42 },
      { x: 579, y: 120, w: 42, h: 42 },
      { x: 579, y: 598, w: 42, h: 42 },
    ],
    powerUpPads: [
      { x: 600, y: 380 },
      { x: 350, y: 165 },
      { x: 850, y: 595 },
      { x: 350, y: 600 },
      { x: 850, y: 160 },
    ],
    kothCenter: { x: 600, y: 380 },
    flagBases: {
      1: { x: 130, y: 380 },
      2: { x: 1070, y: 380 },
    },
  },
  twin_fortress: {
    id: 'twin_fortress',
    name: 'Twin Fortress',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    spawns: {
      1: { x: 145, y: 215 },
      2: { x: 1055, y: 545 },
      3: { x: 145, y: 545 },
      4: { x: 1055, y: 215 },
    },
    walls: [
      ...outerBorderWalls(),
      // Base fortress gate walls
      { x: 245, y: 140, w: 32, h: 145, style: 'steel' },
      { x: 245, y: 475, w: 32, h: 145, style: 'steel' },
      { x: 923, y: 140, w: 32, h: 145, style: 'steel' },
      { x: 923, y: 475, w: 32, h: 145, style: 'steel' },
      // Midfield choke dividers
      { x: 480, y: 195, w: 240, h: 30, style: 'concrete' },
      { x: 480, y: 535, w: 240, h: 30, style: 'concrete' },
      { x: 584, y: 330, w: 32, h: 100, style: 'steel' },
    ],
    initialCrates: [
      { x: 380, y: 275, w: 42, h: 42 },
      { x: 380, y: 443, w: 42, h: 42 },
      { x: 778, y: 275, w: 42, h: 42 },
      { x: 778, y: 443, w: 42, h: 42 },
      { x: 579, y: 100, w: 42, h: 42 },
      { x: 579, y: 618, w: 42, h: 42 },
    ],
    powerUpPads: [
      { x: 440, y: 380 },
      { x: 760, y: 380 },
      { x: 600, y: 145 },
      { x: 600, y: 615 },
    ],
    kothCenter: { x: 600, y: 380 },
    flagBases: {
      1: { x: 115, y: 380 },
      2: { x: 1085, y: 380 },
    },
  },
  iron_citadel: {
    id: 'iron_citadel',
    name: 'Iron Citadel',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    spawns: {
      1: { x: 140, y: 150 },
      2: { x: 1060, y: 610 },
      3: { x: 140, y: 610 },
      4: { x: 1060, y: 150 },
    },
    walls: [
      ...outerBorderWalls(),
      // Central citadel ring corners (4 open entryways)
      { x: 430, y: 215, w: 120, h: 30, style: 'steel' },
      { x: 430, y: 215, w: 30, h: 105, style: 'steel' },
      { x: 650, y: 215, w: 120, h: 30, style: 'steel' },
      { x: 740, y: 215, w: 30, h: 105, style: 'steel' },
      { x: 430, y: 515, w: 120, h: 30, style: 'steel' },
      { x: 430, y: 440, w: 30, h: 105, style: 'steel' },
      { x: 650, y: 515, w: 120, h: 30, style: 'steel' },
      { x: 740, y: 440, w: 30, h: 105, style: 'steel' },
      // Outer flank concrete blocks
      { x: 245, y: 325, w: 32, h: 110, style: 'concrete' },
      { x: 923, y: 325, w: 32, h: 110, style: 'concrete' },
    ],
    initialCrates: [
      { x: 325, y: 165, w: 42, h: 42 },
      { x: 833, y: 165, w: 42, h: 42 },
      { x: 325, y: 553, w: 42, h: 42 },
      { x: 833, y: 553, w: 42, h: 42 },
      { x: 579, y: 115, w: 42, h: 42 },
      { x: 579, y: 603, w: 42, h: 42 },
    ],
    powerUpPads: [
      { x: 600, y: 380 },
      { x: 345, y: 380 },
      { x: 855, y: 380 },
      { x: 600, y: 175 },
      { x: 600, y: 585 },
    ],
    kothCenter: { x: 600, y: 380 },
    flagBases: {
      1: { x: 115, y: 380 },
      2: { x: 1085, y: 380 },
    },
  },
  canyon_foundry: {
    id: 'canyon_foundry',
    name: 'Canyon Foundry',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    spawns: {
      1: { x: 145, y: 165 },
      2: { x: 1055, y: 595 },
      3: { x: 145, y: 595 },
      4: { x: 1055, y: 165 },
    },
    walls: [
      ...outerBorderWalls(),
      // Staggered industrial blast walls creating 3 lanes
      { x: 310, y: 115, w: 34, h: 185, style: 'concrete' },
      { x: 310, y: 460, w: 34, h: 185, style: 'concrete' },
      { x: 856, y: 115, w: 34, h: 185, style: 'concrete' },
      { x: 856, y: 460, w: 34, h: 185, style: 'concrete' },
      // Central foundry crucibles
      { x: 475, y: 300, w: 80, h: 32, style: 'steel' },
      { x: 645, y: 300, w: 80, h: 32, style: 'steel' },
      { x: 475, y: 428, w: 80, h: 32, style: 'steel' },
      { x: 645, y: 428, w: 80, h: 32, style: 'steel' },
      // Top & bottom midline deflectors
      { x: 584, y: 105, w: 32, h: 95, style: 'concrete' },
      { x: 584, y: 560, w: 32, h: 95, style: 'concrete' },
    ],
    initialCrates: [
      { x: 425, y: 165, w: 42, h: 42 },
      { x: 733, y: 165, w: 42, h: 42 },
      { x: 425, y: 553, w: 42, h: 42 },
      { x: 733, y: 553, w: 42, h: 42 },
      { x: 215, y: 359, w: 42, h: 42 },
      { x: 943, y: 359, w: 42, h: 42 },
    ],
    powerUpPads: [
      { x: 600, y: 380 },
      { x: 405, y: 380 },
      { x: 795, y: 380 },
      { x: 600, y: 245 },
      { x: 600, y: 515 },
    ],
    kothCenter: { x: 600, y: 380 },
    flagBases: {
      1: { x: 115, y: 380 },
      2: { x: 1085, y: 380 },
    },
  },
  ricochet_vault: {
    id: 'ricochet_vault',
    name: 'Ricochet Vault',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    spawns: {
      1: { x: 150, y: 160 },
      2: { x: 1050, y: 600 },
      3: { x: 150, y: 600 },
      4: { x: 1050, y: 160 },
    },
    walls: [
      ...outerBorderWalls(),
      // Thick steel bank-shot pillars in symmetric grid
      { x: 355, y: 210, w: 68, h: 68, style: 'steel' },
      { x: 777, y: 210, w: 68, h: 68, style: 'steel' },
      { x: 355, y: 482, w: 68, h: 68, style: 'steel' },
      { x: 777, y: 482, w: 68, h: 68, style: 'steel' },
      // Mid-lane concrete baffles
      { x: 565, y: 165, w: 70, h: 34, style: 'concrete' },
      { x: 565, y: 561, w: 70, h: 34, style: 'concrete' },
      { x: 230, y: 345, w: 32, h: 70, style: 'steel' },
      { x: 938, y: 345, w: 32, h: 70, style: 'steel' },
    ],
    initialCrates: [
      { x: 495, y: 295, w: 42, h: 42 },
      { x: 663, y: 295, w: 42, h: 42 },
      { x: 495, y: 423, w: 42, h: 42 },
      { x: 663, y: 423, w: 42, h: 42 },
      { x: 265, y: 145, w: 42, h: 42 },
      { x: 893, y: 573, w: 42, h: 42 },
      { x: 265, y: 573, w: 42, h: 42 },
      { x: 893, y: 145, w: 42, h: 42 },
    ],
    powerUpPads: [
      { x: 600, y: 380 },
      { x: 389, y: 380 },
      { x: 811, y: 380 },
      { x: 600, y: 100 },
      { x: 600, y: 660 },
    ],
    kothCenter: { x: 600, y: 380 },
    flagBases: {
      1: { x: 115, y: 380 },
      2: { x: 1085, y: 380 },
    },
  },
};

export const MAP_ORDER: MapId[] = [
  'proving_ground',
  'crossfire_depot',
  'twin_fortress',
  'iron_citadel',
  'canyon_foundry',
  'ricochet_vault',
];

export const MAP_THEME_TINTS: Record<MapId, { floor: string; grid: string; label: string }> = {
  proving_ground: { floor: '#292e39', grid: 'rgba(255, 255, 255, 0.065)', label: 'Balanced Cover' },
  crossfire_depot: { floor: '#272c36', grid: 'rgba(148, 163, 184, 0.07)', label: 'Bank-Shot Lanes' },
  twin_fortress: { floor: '#242b35', grid: 'rgba(96, 165, 250, 0.065)', label: 'Base Bastions' },
  iron_citadel: { floor: '#282934', grid: 'rgba(245, 158, 11, 0.065)', label: 'Central Keep' },
  canyon_foundry: { floor: '#2d2827', grid: 'rgba(251, 146, 60, 0.07)', label: '3-Lane Foundry' },
  ricochet_vault: { floor: '#232c33', grid: 'rgba(34, 211, 238, 0.07)', label: 'Pillar Chamber' },
};

export function getMapForRound(
  mode: string,
  round: number,
  selection: MapSelection = 'auto'
): ArenaMap {
  if (selection !== 'auto' && selection in ARENA_MAPS) {
    return ARENA_MAPS[selection];
  }
  if (mode === 'ctf') {
    return ARENA_MAPS.twin_fortress;
  }
  const idx = (Math.max(1, round) - 1) % MAP_ORDER.length;
  return ARENA_MAPS[MAP_ORDER[idx]];
}
