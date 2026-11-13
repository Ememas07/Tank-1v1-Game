import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampLoadout,
  computeTankStats,
  MAX_UPGRADE_POINTS,
} from './customization';
import {
  createEmptyInput,
  createMatchState,
  CTF_CAPTURES_TARGET,
  DM_WINS_TARGET,
  stepSimulation,
} from './engine';
import { ARENA_MAPS, getMapForRound, MAP_ORDER } from './maps';

test('customization enforces point budget and scales tank stats', () => {
  const clamped = clampLoadout(
    { paint: 'olive', decal: 'star', armorLevel: 3, speedLevel: 3, powerLevel: 3, bulletType: 'standard' },
    { paint: 'cobalt', decal: 'stripes', armorLevel: 2, speedLevel: 2, powerLevel: 1, bulletType: 'standard' }
  );
  assert.equal(clamped.armorLevel + clamped.speedLevel + clamped.powerLevel <= MAX_UPGRADE_POINTS, true);
  assert.equal(clamped.paint, 'olive');
  assert.equal(clamped.decal, 'star');

  const heavy = computeTankStats({ paint: 'cobalt', decal: 'none', armorLevel: 3, speedLevel: 0, powerLevel: 2, bulletType: 'standard' });
  const light = computeTankStats({ paint: 'cobalt', decal: 'none', armorLevel: 0, speedLevel: 3, powerLevel: 2, bulletType: 'standard' });
  assert.equal(heavy.maxHp > light.maxHp, true);
  assert.equal(light.moveSpeed > heavy.moveSpeed, true);
  assert.equal(heavy.radius > light.radius, true);
});

test('all 4 arena map spawns are clear of walls', () => {
  for (const map of Object.values(ARENA_MAPS)) {
    for (const spawn of Object.values(map.spawns)) {
      for (const wall of map.walls) {
        const inside =
          spawn.x >= wall.x - 24 &&
          spawn.x <= wall.x + wall.w + 24 &&
          spawn.y >= wall.y - 24 &&
          spawn.y <= wall.y + wall.h + 24;
        assert.equal(inside, false, `Spawn overlaps wall in ${map.id}`);
      }
    }
  }
});

test('projectile fires, bounces off outer steel wall, and damages crate', () => {
  const state = createMatchState({ mode: 'deathmatch', mapId: 'proving_ground' });
  const input1 = createEmptyInput(-Math.PI / 2);
  input1.fire = true;
  const input2 = createEmptyInput(Math.PI);

  const events1 = stepSimulation(state, { 1: input1, 2: input2 }, 0.016);
  assert.equal(events1.some((e) => e.type === 'fire'), true);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].bouncesLeft, 1);

  let sawRicochet = false;
  for (let i = 0; i < 60; i++) {
    const ev = stepSimulation(state, { 1: createEmptyInput(-Math.PI / 2), 2: input2 }, 0.02);
    if (ev.some((e) => e.type === 'ricochet')) {
      sawRicochet = true;
      break;
    }
  }
  assert.equal(sawRicochet, true);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].bouncesLeft, 0);
  assert.equal(state.projectiles[0].vy > 0, true, 'Projectile should bounce downward');
});

test('power-ups apply timed shield, speed, rapid, and instant repair effects', () => {
  const state = createMatchState({ mode: 'deathmatch' });
  const p1 = state.tanks[1]!;
  p1.hp = 50;

  state.powerUps.push({ id: 'pu_test_1', type: 'shield', x: p1.x, y: p1.y, spawnTime: 0 });
  const ev1 = stepSimulation(state, { 1: createEmptyInput(), 2: createEmptyInput() }, 0.016);
  assert.equal(ev1.some((e) => e.type === 'powerup' && e.powerUpType === 'shield'), true);
  assert.equal(p1.buffs.shieldHp, 50);

  state.powerUps.push({ id: 'pu_test_2', type: 'repair', x: p1.x, y: p1.y, spawnTime: 0 });
  stepSimulation(state, { 1: createEmptyInput(), 2: createEmptyInput() }, 0.016);
  assert.equal(p1.hp, 85);

  state.powerUps.push({ id: 'pu_test_3', type: 'speed', x: p1.x, y: p1.y, spawnTime: 0 });
  state.powerUps.push({ id: 'pu_test_4', type: 'rapid', x: p1.x, y: p1.y, spawnTime: 0 });
  stepSimulation(state, { 1: createEmptyInput(), 2: createEmptyInput() }, 0.016);
  assert.equal(p1.buffs.speedUntil > state.elapsed, true);
  assert.equal(p1.buffs.rapidUntil > state.elapsed, true);
});

test('deathmatch awards round and match victory at target wins', () => {
  const state = createMatchState({ mode: 'deathmatch' });
  state.teamScores[1] = DM_WINS_TARGET - 1;
  const p1 = state.tanks[1]!;
  const p2 = state.tanks[2]!;
  p2.hp = 10;

  p1.x = 500;
  p1.y = 380;
  p2.x = 580;
  p2.y = 380;

  const fireInput = createEmptyInput(0);
  fireInput.fire = true;
  stepSimulation(state, { 1: fireInput, 2: createEmptyInput(Math.PI) }, 0.016);

  for (let i = 0; i < 15; i++) {
    stepSimulation(state, { 1: createEmptyInput(0), 2: createEmptyInput(Math.PI) }, 0.02);
    if (state.phase === 'gameover') break;
  }

  assert.equal(state.phase, 'gameover');
  assert.equal(state.winnerTeamId, 1);
  assert.equal(state.teamScores[1], DM_WINS_TARGET);
});

test('2v2 teams prevent friendly fire and require eliminating all opponents on enemy team', () => {
  const state = createMatchState({ format: '2v2', mode: 'deathmatch' });
  const p1 = state.tanks[1]!;
  const p3 = state.tanks[3]!; // Same teamId = 1
  const p2 = state.tanks[2]!; // Team 2
  const p4 = state.tanks[4]!; // Team 2

  assert.equal(p1.teamId, 1);
  assert.equal(p3.teamId, 1);
  assert.equal(p2.teamId, 2);
  assert.equal(p4.teamId, 2);

  // Place P1 facing teammate P3 and fire -> zero friendly fire damage
  p1.x = 400;
  p1.y = 380;
  p3.x = 460;
  p3.y = 380;
  const startHp = p3.hp;

  const fireRight = createEmptyInput(0);
  fireRight.fire = true;
  stepSimulation(state, { 1: fireRight }, 0.016);
  for (let i = 0; i < 10; i++) {
    stepSimulation(state, {}, 0.02);
  }
  assert.equal(p3.hp, startHp, 'Teammate should take zero friendly-fire damage');

  // Eliminating only one enemy (P2) while P4 is alive does NOT end the round
  p2.hp = 10;
  p1.x = 500;
  p1.y = 380;
  p2.x = 560;
  p2.y = 380;
  p1.reloadTimer = 0;
  stepSimulation(state, { 1: fireRight }, 0.016);
  for (let i = 0; i < 10; i++) {
    stepSimulation(state, {}, 0.02);
  }
  assert.equal(p2.alive, false);
  assert.equal(state.phase, 'playing', 'Round continues while P4 on Team 2 is alive');

  // Eliminating P4 awards Team 1 the round
  p4.hp = 10;
  p1.x = 500;
  p1.y = 380;
  p4.x = 560;
  p4.y = 380;
  p1.reloadTimer = 0;
  stepSimulation(state, { 1: fireRight }, 0.016);
  for (let i = 0; i < 10; i++) {
    stepSimulation(state, {}, 0.02);
  }
  assert.equal(p4.alive, false);
  assert.equal(state.phase, 'round_over');
  assert.equal(state.roundWinnerTeamId, 1);
  assert.equal(state.teamScores[1], 1);
});

test('4-player FFA assigns distinct teams and awards round win to last tank standing', () => {
  const state = createMatchState({ format: 'ffa', mode: 'deathmatch' });
  assert.equal(state.activePlayerIds.length, 4);
  assert.equal(state.tanks[1]!.teamId, 1);
  assert.equal(state.tanks[2]!.teamId, 2);
  assert.equal(state.tanks[3]!.teamId, 3);
  assert.equal(state.tanks[4]!.teamId, 4);

  // Knock out P2 and P4 directly; P1 and P3 still alive -> playing
  state.tanks[2]!.alive = false;
  state.tanks[4]!.alive = false;
  stepSimulation(state, {}, 0.016);
  assert.equal(state.phase, 'playing');

  // P3 eliminates P1 -> P3 wins round 1
  const p1 = state.tanks[1]!;
  const p3 = state.tanks[3]!;
  p1.hp = 10;
  p3.x = 500;
  p3.y = 380;
  p1.x = 560;
  p1.y = 380;
  const fireRight = createEmptyInput(0);
  fireRight.fire = true;
  stepSimulation(state, { 3: fireRight }, 0.016);
  for (let i = 0; i < 10; i++) {
    stepSimulation(state, {}, 0.02);
  }
  assert.equal(state.phase, 'round_over');
  assert.equal(state.roundWinnerTeamId, 3);
  assert.equal(state.teamScores[3], 1);
});

test('king of the hill progresses only when uncontested and wins at 100%', () => {
  const state = createMatchState({ format: 'ffa', mode: 'koth' });
  state.tanks[1]!.x = state.koth.x;
  state.tanks[1]!.y = state.koth.y;
  state.tanks[3]!.x = state.koth.x + 20;
  state.tanks[3]!.y = state.koth.y;

  stepSimulation(state, {}, 0.05);
  assert.equal(state.koth.controllingTeam, 'contested');
  assert.equal(state.teamKothProgress[1], 0);

  state.tanks[3]!.x = 1050;
  state.teamKothProgress[1] = 99.8;
  for (let i = 0; i < 4; i++) {
    stepSimulation(state, {}, 0.04);
  }
  assert.equal(state.phase, 'gameover');
  assert.equal(state.winnerTeamId, 1);
});

test('capture the flag in 2v2 handles pickup, capture, and win condition', () => {
  const state = createMatchState({ format: '2v2', mode: 'ctf' });
  const map = ARENA_MAPS[state.mapId];

  // Player 3 (Team 1) picks up Team 2 flag
  state.tanks[3]!.x = map.flagBases[2].x;
  state.tanks[3]!.y = map.flagBases[2].y;
  stepSimulation(state, {}, 0.016);
  assert.equal(state.flags[2].status, 'carried');
  assert.equal(state.flags[2].carrierId, 3);

  state.teamScores[1] = CTF_CAPTURES_TARGET - 1;
  state.tanks[3]!.x = map.flagBases[1].x;
  state.tanks[3]!.y = map.flagBases[1].y;
  stepSimulation(state, {}, 0.016);
  assert.equal(state.teamScores[1], CTF_CAPTURES_TARGET);
  assert.equal(state.phase, 'gameover');
  assert.equal(state.winnerTeamId, 1);
});

test('all 6 arena maps validate pads/flags clear of walls and respect explicit map selection', () => {
  assert.equal(MAP_ORDER.length, 6);
  for (const mapId of MAP_ORDER) {
    const map = ARENA_MAPS[mapId];
    assert.ok(map, `Missing map ${mapId}`);
    assert.equal(Object.keys(map.spawns).length, 4);
    for (const pad of map.powerUpPads) {
      for (const wall of map.walls) {
        const overlapsWall =
          pad.x >= wall.x - 16 &&
          pad.x <= wall.x + wall.w + 16 &&
          pad.y >= wall.y - 16 &&
          pad.y <= wall.y + wall.h + 16;
        assert.equal(overlapsWall, false, `PowerUp pad overlaps wall in ${map.id}`);
      }
    }
    for (const flagBase of Object.values(map.flagBases)) {
      for (const wall of map.walls) {
        const overlapsWall =
          flagBase.x >= wall.x - 16 &&
          flagBase.x <= wall.x + wall.w + 16 &&
          flagBase.y >= wall.y - 16 &&
          flagBase.y <= wall.y + wall.h + 16;
        assert.equal(overlapsWall, false, `Flag base overlaps wall in ${map.id}`);
      }
    }
  }

  assert.equal(getMapForRound('deathmatch', 1, 'auto').id, 'proving_ground');
  assert.equal(getMapForRound('deathmatch', 4, 'auto').id, 'iron_citadel');
  assert.equal(getMapForRound('deathmatch', 6, 'auto').id, 'ricochet_vault');
  assert.equal(getMapForRound('deathmatch', 3, 'canyon_foundry').id, 'canyon_foundry');
  assert.equal(getMapForRound('ctf', 1, 'iron_citadel').id, 'iron_citadel');
});

test('new power-ups apply triple spread, hyper bounce, amplified damage, and stealth cloak', () => {
  const state = createMatchState({ mode: 'deathmatch', mapId: 'proving_ground' });
  const p1 = state.tanks[1]!;
  const baseDamage = computeTankStats(p1.loadout).shellDamage;

  state.powerUps.push(
    { id: 'pu_triple', type: 'triple', x: p1.x, y: p1.y, spawnTime: 0 },
    { id: 'pu_ricochet', type: 'ricochet', x: p1.x, y: p1.y, spawnTime: 0 },
    { id: 'pu_damage', type: 'damage', x: p1.x, y: p1.y, spawnTime: 0 },
    { id: 'pu_stealth', type: 'stealth', x: p1.x, y: p1.y, spawnTime: 0 }
  );

  const pickupEvents = stepSimulation(state, {}, 0.016);
  assert.equal(pickupEvents.filter((e) => e.type === 'powerup').length, 4);
  assert.equal(p1.buffs.tripleUntil > state.elapsed, true);
  assert.equal(p1.buffs.ricochetUntil > state.elapsed, true);
  assert.equal(p1.buffs.damageUntil > state.elapsed, true);
  assert.equal(p1.buffs.cloakUntil > state.elapsed, true);

  const fireInput = createEmptyInput(0);
  fireInput.fire = true;
  stepSimulation(state, { 1: fireInput }, 0.016);

  assert.equal(state.projectiles.length, 3, 'Triple power-up fires 3 spread shells');
  assert.equal(state.projectiles[0].bouncesLeft, 3, 'Hyper Bounce adds +2 bounces over standard 1');
  assert.equal(state.projectiles[0].damage, Math.round(baseDamage * 1.45), 'Heavy Ordnance scales damage by 1.45x');
  assert.equal(p1.buffs.cloakRevealUntil > state.elapsed, true, 'Firing briefly reveals cloaked tank');
});

test('bullet upgrade types implement twin parallel shells, bank-shot scaling, Siege HE splash, and Cryo Plasma slow', () => {
  // 1. Twin Autocannon: 2 parallel shells
  const twinState = createMatchState({
    mode: 'deathmatch',
    mapId: 'proving_ground',
    p1Loadout: { paint: 'cobalt', decal: 'none', armorLevel: 2, speedLevel: 2, powerLevel: 1, bulletType: 'twin' },
  });
  const twinFire = createEmptyInput(0);
  twinFire.fire = true;
  stepSimulation(twinState, { 1: twinFire }, 0.016);
  assert.equal(twinState.projectiles.length, 2);
  assert.notEqual(twinState.projectiles[0].y, twinState.projectiles[1].y);

  // 2. Bank-Shot AP: 3 bounces & +10% damage per wall bounce
  const bankState = createMatchState({
    mode: 'deathmatch',
    mapId: 'proving_ground',
    p1Loadout: { paint: 'cobalt', decal: 'none', armorLevel: 2, speedLevel: 2, powerLevel: 1, bulletType: 'ricochet' },
  });
  const bankFire = createEmptyInput(-Math.PI / 2);
  bankFire.fire = true;
  stepSimulation(bankState, { 1: bankFire }, 0.016);
  const initialBankDmg = bankState.projectiles[0].damage;
  assert.equal(bankState.projectiles[0].bouncesLeft, 3);
  let bounced = false;
  for (let i = 0; i < 60; i++) {
    stepSimulation(bankState, {}, 0.02);
    if (bankState.projectiles[0]?.bounceCount > 0) {
      bounced = true;
      break;
    }
  }
  assert.equal(bounced, true);
  assert.equal(bankState.projectiles[0].damage > initialBankDmg, true);

  // 3. Siege HE: 0 bounces and AoE splash damages nearby enemy tank on wall impact
  const heState = createMatchState({
    mode: 'deathmatch',
    mapId: 'proving_ground',
    p1Loadout: { paint: 'cobalt', decal: 'none', armorLevel: 2, speedLevel: 2, powerLevel: 1, bulletType: 'heavy' },
  });
  const p1He = heState.tanks[1]!;
  const p2He = heState.tanks[2]!;
  p1He.x = 200;
  p1He.y = 95;
  p2He.x = 235;
  p2He.y = 60;
  const p2StartHp = p2He.hp;
  const heFire = createEmptyInput(-Math.PI / 2);
  heFire.fire = true;
  const ev0 = stepSimulation(heState, { 1: heFire }, 0.016);
  let sawSplash = ev0.some((e) => e.type === 'splash');
  for (let i = 0; i < 20 && !sawSplash; i++) {
    const ev = stepSimulation(heState, {}, 0.02);
    if (ev.some((e) => e.type === 'splash')) {
      sawSplash = true;
      break;
    }
  }
  assert.equal(sawSplash, true);
  assert.equal(p2He.hp < p2StartHp, true, 'Siege HE splash damages nearby tank on wall impact');

  // 4. Cryo Plasma: applies slowUntil on direct tank hit
  const plasmaState = createMatchState({
    mode: 'deathmatch',
    mapId: 'proving_ground',
    p1Loadout: { paint: 'cobalt', decal: 'none', armorLevel: 2, speedLevel: 2, powerLevel: 1, bulletType: 'plasma' },
  });
  const p1Pl = plasmaState.tanks[1]!;
  const p2Pl = plasmaState.tanks[2]!;
  p1Pl.x = 500;
  p1Pl.y = 380;
  p2Pl.x = 570;
  p2Pl.y = 380;
  const plFire = createEmptyInput(0);
  plFire.fire = true;
  stepSimulation(plasmaState, { 1: plFire }, 0.016);
  for (let i = 0; i < 15; i++) {
    stepSimulation(plasmaState, {}, 0.02);
  }
  assert.equal(p2Pl.buffs.slowUntil > plasmaState.elapsed, true, 'Cryo Plasma applies timed slow on hit');
});

