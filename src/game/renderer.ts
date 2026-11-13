import {
  BULLET_UPGRADES,
  computeTankStats,
  PAINT_PALETTES,
  POWERUP_CATALOG,
} from './customization';
import { ARENA_HEIGHT, ARENA_MAPS, ARENA_WIDTH, MAP_THEME_TINTS } from './maps';
import type {
  CrateState,
  DecalId,
  GameEvent,
  GameSnapshot,
  PlayerId,
  PowerUpItem,
  TankLoadout,
  TankState,
  WallRect,
} from './types';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

interface TreadMark {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
}

interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

const PARTICLE_POOL_SIZE = 280;
const TREAD_POOL_SIZE = 220;
const SHOCKWAVE_POOL_SIZE = 24;

export class ArenaVfx {
  private particles: Particle[] = [];
  private particleCursor = 0;
  private treads: TreadMark[] = [];
  private treadCursor = 0;
  private shockwaves: ShockwaveRing[] = [];
  private shockwaveCursor = 0;
  public trauma = 0;
  private lastTreadPos: Record<number, { x: number; y: number }> = {
    1: { x: -999, y: -999 },
    2: { x: -999, y: -999 },
    3: { x: -999, y: -999 },
    4: { x: -999, y: -999 },
  };

  constructor() {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 3,
        color: '#f59e0b',
        alpha: 1,
      });
    }
    for (let i = 0; i < TREAD_POOL_SIZE; i++) {
      this.treads.push({
        active: false,
        x: 0,
        y: 0,
        angle: 0,
        life: 0,
        maxLife: 5,
      });
    }
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      this.shockwaves.push({
        active: false,
        x: 0,
        y: 0,
        maxRadius: 50,
        life: 0,
        maxLife: 0.3,
        color: '#f97316',
      });
    }
  }

  public reset(): void {
    for (const p of this.particles) p.active = false;
    for (const t of this.treads) t.active = false;
    for (const sw of this.shockwaves) sw.active = false;
    this.trauma = 0;
    this.lastTreadPos = {
      1: { x: -999, y: -999 },
      2: { x: -999, y: -999 },
      3: { x: -999, y: -999 },
      4: { x: -999, y: -999 },
    };
  }

  public spawnShockwave(x: number, y: number, maxRadius: number, color: string): void {
    const sw = this.shockwaves[this.shockwaveCursor];
    this.shockwaveCursor = (this.shockwaveCursor + 1) % SHOCKWAVE_POOL_SIZE;
    sw.active = true;
    sw.x = x;
    sw.y = y;
    sw.maxRadius = maxRadius;
    sw.maxLife = 0.28;
    sw.life = sw.maxLife;
    sw.color = color;
  }

  public spawnBurst(
    x: number,
    y: number,
    count: number,
    speedMin: number,
    speedMax: number,
    sizeMin: number,
    sizeMax: number,
    lifeMin: number,
    lifeMax: number,
    colors: string[]
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = lifeMin + Math.random() * (lifeMax - lifeMin);
      p.life = p.maxLife;
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.color = colors[i % colors.length];
      p.alpha = 1;
    }
  }

  public ingestEvents(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'fire':
          this.spawnBurst(ev.x, ev.y, 7, 40, 140, 2.5, 5, 0.14, 0.28, ['#fef08a', '#f59e0b', '#9ca3af']);
          this.trauma = Math.min(1, this.trauma + 0.14);
          break;
        case 'ricochet':
          this.spawnBurst(ev.x, ev.y, 8, 60, 190, 2, 3.8, 0.12, 0.25, ['#fde68a', '#fb923c', '#ffffff']);
          break;
        case 'hit':
          this.spawnBurst(ev.x, ev.y, 14, 70, 230, 2.5, 5.5, 0.2, 0.4, ['#fb923c', '#ef4444', '#fde047']);
          this.trauma = Math.min(1, this.trauma + 0.3);
          break;
        case 'shield_hit':
          this.spawnBurst(ev.x, ev.y, 12, 60, 180, 2.5, 5, 0.18, 0.35, ['#38bdf8', '#bae6fd', '#ffffff']);
          this.trauma = Math.min(1, this.trauma + 0.18);
          break;
        case 'crate_break':
          this.spawnBurst(ev.x, ev.y, 16, 55, 200, 3.5, 7, 0.25, 0.55, ['#92400e', '#b45309', '#d97706', '#78350f']);
          this.trauma = Math.min(1, this.trauma + 0.18);
          break;
        case 'powerup': {
          const color = ev.powerUpType ? POWERUP_CATALOG[ev.powerUpType].color : '#10b981';
          this.spawnBurst(ev.x, ev.y, 16, 50, 160, 3, 6, 0.28, 0.55, [color, '#ffffff']);
          break;
        }
        case 'dash':
          this.spawnBurst(ev.x, ev.y, 10, 30, 110, 3.5, 6.5, 0.2, 0.4, ['#94a3b8', '#cbd5e1', '#f59e0b']);
          break;
        case 'splash': {
          const rad = ev.splashRadius ?? 58;
          this.spawnShockwave(ev.x, ev.y, rad, '#f97316');
          this.spawnBurst(ev.x, ev.y, 18, 60, 210, 3, 6.5, 0.2, 0.45, ['#f97316', '#fde047', '#ef4444']);
          this.trauma = Math.min(1, this.trauma + 0.28);
          break;
        }
        case 'explosion':
          this.spawnShockwave(ev.x, ev.y, 48, '#ef4444');
          this.spawnBurst(ev.x, ev.y, 34, 60, 310, 4, 11, 0.35, 0.85, ['#ef4444', '#f97316', '#fde047', '#3f3f46']);
          this.trauma = Math.min(1, this.trauma + 0.72);
          break;
        case 'flag_capture':
          this.spawnBurst(ev.x, ev.y, 26, 70, 240, 3.5, 7, 0.35, 0.75, ['#facc15', '#38bdf8', '#ffffff']);
          break;
      }
    }
  }

  public step(snapshot: GameSnapshot, dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 2.1);

    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(0.9, dt * 4.5);
      p.vy *= 1 - Math.min(0.9, dt * 4.5);
      p.alpha = p.life / p.maxLife;
    }

    for (const t of this.treads) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) t.active = false;
    }

    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      sw.life -= dt;
      if (sw.life <= 0) sw.active = false;
    }

    // Leave tank tread marks & speed buff trail
    for (const id of snapshot.activePlayerIds) {
      const tank = snapshot.tanks[id];
      if (!tank || !tank.alive) continue;
      const last = this.lastTreadPos[id] ?? { x: -999, y: -999 };
      const dist = Math.hypot(tank.x - last.x, tank.y - last.y);
      if (dist >= 14) {
        this.lastTreadPos[id] = { x: tank.x, y: tank.y };
        const tm = this.treads[this.treadCursor];
        this.treadCursor = (this.treadCursor + 1) % TREAD_POOL_SIZE;
        tm.active = true;
        tm.x = tank.x;
        tm.y = tank.y;
        tm.angle = tank.hullAngle;
        tm.maxLife = 5.5;
        tm.life = 5.5;

        if (snapshot.elapsed < tank.buffs.speedUntil || tank.dashActiveTimer > 0) {
          this.spawnBurst(tank.x, tank.y, 2, 15, 45, 2.5, 4.5, 0.16, 0.28, ['#f59e0b', '#fde68a']);
        }
      }
    }
  }

  public drawTreads(ctx: CanvasRenderingContext2D): void {
    for (const t of this.treads) {
      if (!t.active) continue;
      const alpha = (t.life / t.maxLife) * 0.24;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = `rgba(15, 17, 21, ${alpha.toFixed(3)})`;
      ctx.fillRect(-5, -14, 7, 5);
      ctx.fillRect(-5, 9, 7, 5);
      ctx.restore();
    }
  }

  public drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      const t = 1 - sw.life / sw.maxLife;
      const r = sw.maxRadius * (0.25 + 0.75 * t);
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - t) * 0.7);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3 * (1 - t * 0.5);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawDecal(ctx: CanvasRenderingContext2D, decal: DecalId, trimColor: string): void {
  if (decal === 'none') return;
  ctx.save();
  ctx.fillStyle = trimColor;
  ctx.strokeStyle = trimColor;

  if (decal === 'stripes') {
    ctx.fillRect(-10, -7, 20, 2.5);
    ctx.fillRect(-10, 4.5, 20, 2.5);
  } else if (decal === 'chevron') {
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-4, -7);
    ctx.lineTo(4, 0);
    ctx.lineTo(-4, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -7);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-10, 7);
    ctx.stroke();
  } else if (decal === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outer = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const inner = outer + Math.PI / 5;
      const ox = Math.cos(outer) * 6.5;
      const oy = Math.sin(outer) * 6.5;
      const ix = Math.cos(inner) * 2.8;
      const iy = Math.sin(inner) * 2.8;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.fill();
  } else if (decal === 'hazard') {
    ctx.lineWidth = 2.4;
    for (let x = -11; x <= 6; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, -9);
      ctx.lineTo(x + 4, -4);
      ctx.moveTo(x, 9);
      ctx.lineTo(x + 4, 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawTankModel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hullAngle: number,
  turretAngle: number,
  loadout: TankLoadout,
  options: {
    recoil?: number;
    hitFlash?: boolean;
    shieldRatio?: number;
    spawnShield?: boolean;
    speedBuff?: boolean;
    rapidBuff?: boolean;
    tripleBuff?: boolean;
    ricochetBuff?: boolean;
    damageBuff?: boolean;
    cloakAlpha?: number;
    slowed?: boolean;
    time?: number;
    carryingFlagColor?: string | null;
  } = {}
): void {
  const palette = PAINT_PALETTES[loadout.paint];
  const stats = computeTankStats(loadout);
  const scale = stats.radius / 20;
  const time = options.time ?? 0;

  ctx.save();
  if (options.cloakAlpha !== undefined && options.cloakAlpha < 1) {
    ctx.globalAlpha = options.cloakAlpha;
  }
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Soft ground shadow
  ctx.save();
  ctx.translate(3, 5);
  ctx.rotate(hullAngle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  ctx.beginPath();
  ctx.roundRect(-21, -17, 42, 34, 5);
  ctx.fill();
  ctx.restore();

  // Hull + Treads + Component Upgrades
  ctx.save();
  ctx.rotate(hullAngle);

  // Speed Upgrade visual: twin exhausts & thruster nozzles at rear
  if (loadout.speedLevel >= 1) {
    ctx.fillStyle = '#27272a';
    ctx.fillRect(-23, -10, 5, 5);
    ctx.fillRect(-23, 5, 5, 5);
  }
  if (loadout.speedLevel >= 2) {
    // Aerodynamic rear stabilizer fins
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(-22, -16, 8, 3);
    ctx.fillRect(-22, 13, 8, 3);
  }
  if (loadout.speedLevel >= 3) {
    // Glowing high-output thruster vents
    ctx.fillStyle = options.speedBuff ? '#fde047' : '#f59e0b';
    ctx.fillRect(-24, -9, 3, 3);
    ctx.fillRect(-24, 6, 3, 3);
  }

  // Tracks (left & right)
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.roundRect(-20, -17, 40, 7, 2);
  ctx.roundRect(-20, 10, 40, 7, 2);
  ctx.fill();

  // Track cleats
  ctx.fillStyle = '#3f3f46';
  for (let tx = -17; tx <= 15; tx += 6) {
    ctx.fillRect(tx, -16.5, 2.5, 6);
    ctx.fillRect(tx, 10.5, 2.5, 6);
  }

  // Armor Upgrade visual: bolted side-skirts & front wedge
  if (loadout.armorLevel >= 1) {
    ctx.fillStyle = '#52525b';
    ctx.fillRect(-17, -18, 34, 3);
    ctx.fillRect(-17, 15, 34, 3);
  }
  if (loadout.armorLevel >= 2) {
    // Front sloped ERA wedge
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.moveTo(16, -12);
    ctx.lineTo(23, -8);
    ctx.lineTo(23, 8);
    ctx.lineTo(16, 12);
    ctx.closePath();
    ctx.fill();
  }
  if (loadout.armorLevel >= 3) {
    // Heavy shoulder armor plates
    ctx.fillStyle = palette.trim;
    ctx.fillRect(-13, -15, 26, 2.2);
    ctx.fillRect(-13, 12.8, 26, 2.2);
  }

  // Main Hull Body
  ctx.fillStyle = options.hitFlash ? '#ffffff' : palette.primary;
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-17, -12.5, 34, 25, 4);
  ctx.fill();
  ctx.stroke();

  // Hull inner bevel plate
  ctx.fillStyle = options.hitFlash ? '#ffffff' : palette.secondary;
  ctx.beginPath();
  ctx.roundRect(-13, -9, 24, 18, 2.5);
  ctx.fill();

  // Hull Decal
  if (!options.hitFlash) {
    drawDecal(ctx, loadout.decal, palette.trim);
  }

  // Front headlights indicator
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(15.5, -9, 2, 3.5);
  ctx.fillRect(15.5, 5.5, 2, 3.5);

  ctx.restore(); // end hull

  // Carried CTF flag on rear rack
  if (options.carryingFlagColor) {
    ctx.save();
    ctx.translate(-8, -8);
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -18);
    ctx.stroke();
    ctx.fillStyle = options.carryingFlagColor;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(15, -13 + Math.sin(time * 12) * 2);
    ctx.lineTo(0, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Independent Rotating Turret + Weapon Power & Bullet Upgrade Visuals
  ctx.save();
  ctx.rotate(turretAngle);
  const recoilPx = (options.recoil ?? 0) * 5;
  ctx.translate(-recoilPx, 0);

  const bulletType = loadout.bulletType ?? 'standard';
  const barrelWidth =
    bulletType === 'heavy'
      ? 8.5 + loadout.powerLevel * 1.4
      : bulletType === 'twin'
      ? 3.8 + loadout.powerLevel * 0.7
      : 5 + loadout.powerLevel * 1.4;
  const barrelLen =
    bulletType === 'heavy'
      ? 19 + loadout.powerLevel * 2.5
      : bulletType === 'ricochet'
      ? 25 + loadout.powerLevel * 3.5
      : 22 + loadout.powerLevel * 3.5;

  // Cannon Barrel(s) by Bullet Type
  ctx.fillStyle = options.hitFlash ? '#ffffff' : palette.barrel;
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 1.6;

  if (bulletType === 'twin') {
    // Dual parallel autocannon barrels
    ctx.beginPath();
    ctx.roundRect(6, -5.2 - barrelWidth / 2, barrelLen, barrelWidth, 1.3);
    ctx.roundRect(6, 5.2 - barrelWidth / 2, barrelLen, barrelWidth, 1.3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(6 + barrelLen - 3, -5.2 - barrelWidth / 2, 3, barrelWidth);
    ctx.fillRect(6 + barrelLen - 3, 5.2 - barrelWidth / 2, 3, barrelWidth);
  } else {
    ctx.beginPath();
    ctx.roundRect(6, -barrelWidth / 2, barrelLen, barrelWidth, 1.5);
    ctx.fill();
    ctx.stroke();

    if (bulletType === 'heavy') {
      // Wide siege muzzle collar
      ctx.fillStyle = '#f97316';
      ctx.fillRect(6 + barrelLen - 6, -barrelWidth / 2 - 2, 6, barrelWidth + 4);
      ctx.strokeRect(6 + barrelLen - 6, -barrelWidth / 2 - 2, 6, barrelWidth + 4);
    } else if (bulletType === 'ricochet') {
      // Bank-shot cyan accelerator rails
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(8, -barrelWidth / 2 - 1.5, barrelLen - 2, 1.8);
      ctx.fillRect(8, barrelWidth / 2 - 0.3, barrelLen - 2, 1.8);
    } else if (bulletType === 'plasma') {
      // Cryo plasma energy coils
      ctx.fillStyle = '#a855f7';
      for (let cx = 11; cx < 6 + barrelLen - 3; cx += 6) {
        ctx.fillRect(cx, -barrelWidth / 2 - 1.6, 3, barrelWidth + 3.2);
      }
    }
  }

  // Weapon Power >= 2: Slotted Muzzle Brake (non-twin)
  if (loadout.powerLevel >= 2 && bulletType !== 'twin' && bulletType !== 'heavy') {
    ctx.fillStyle = '#27272a';
    ctx.fillRect(6 + barrelLen - 5, -barrelWidth / 2 - 1.5, 6, barrelWidth + 3);
  }
  // Weapon Power === 3: Reinforced Rail Shroud
  if (loadout.powerLevel >= 3) {
    ctx.fillStyle = palette.trim;
    ctx.fillRect(8, -8, 6, 2.2);
    ctx.fillRect(8, 5.8, 6, 2.2);
  }

  // Turret Dome
  ctx.fillStyle = options.hitFlash ? '#ffffff' : palette.primary;
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-10, -9, 20, 18, 5);
  ctx.fill();
  ctx.stroke();

  // Commander Hatch
  ctx.fillStyle = options.hitFlash ? '#ffffff' : palette.secondary;
  ctx.beginPath();
  ctx.arc(-2, 0, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = options.damageBuff ? '#f97316' : palette.trim;
  ctx.lineWidth = options.damageBuff ? 2 : 1.2;
  ctx.stroke();

  // Power-up indicator glow on breech
  if (options.rapidBuff || options.tripleBuff || options.damageBuff) {
    ctx.fillStyle = options.damageBuff ? '#f97316' : options.tripleBuff ? '#a855f7' : '#f43f5e';
    ctx.beginPath();
    ctx.arc(4, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // end turret

  // Cryo slow frost aura
  if (options.slowed) {
    ctx.save();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Ricochet / Damage active power-up subtle ring
  if (options.ricochetBuff || options.damageBuff) {
    ctx.save();
    ctx.strokeStyle = options.damageBuff ? '#f97316' : '#06b6d4';
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Energy Shield Bubble (Aegis Shield or Spawn Shield)
  if ((options.shieldRatio && options.shieldRatio > 0) || options.spawnShield) {
    const color = options.spawnShield ? '#e4e4e7' : '#38bdf8';
    ctx.save();
    ctx.rotate(time * 2.2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = options.spawnShield ? 0.55 : 0.78;
    for (let a = 0; a < 3; a++) {
      const start = (a * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, 27, start, start + 1.45);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

export function drawTankPreview(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  loadout: TankLoadout,
  time: number
): void {
  ctx.clearRect(0, 0, width, height);

  // Subtle blueprint hangar floor grid
  ctx.fillStyle = '#181b22';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < width; gx += 24) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  for (let gy = 0; gy < height; gy += 24) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }

  // Turntable ring
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1.85, 1.85);
  const hullAngle = -0.35;
  const turretAngle = Math.sin(time * 0.9) * 0.45 - 0.15;
  drawTankModel(ctx, 0, 0, hullAngle, turretAngle, loadout, { time });
  ctx.restore();
}

function drawWalls(ctx: CanvasRenderingContext2D, walls: WallRect[]): void {
  for (const w of walls) {
    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(w.x + 4, w.y + 5, w.w, w.h);

    if (w.style === 'steel') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#475569';
      ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, w.h - 6);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    } else {
      ctx.fillStyle = '#52525b';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#64646f';
      ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, w.h - 6);
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    }
  }
}

function drawCrates(ctx: CanvasRenderingContext2D, crates: CrateState[]): void {
  for (const c of crates) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(c.x + 3, c.y + 4, c.w, c.h);

    ctx.fillStyle = '#92400e';
    ctx.fillRect(c.x, c.y, c.w, c.h);

    ctx.fillStyle = '#b45309';
    ctx.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);

    // Cross brace
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x + 4, c.y + 4);
    ctx.lineTo(c.x + c.w - 4, c.y + c.h - 4);
    ctx.moveTo(c.x + c.w - 4, c.y + 4);
    ctx.lineTo(c.x + 4, c.y + c.h - 4);
    ctx.stroke();

    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);

    // Damage cracks if chipped
    if (c.hp < c.maxHp) {
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x + c.w * 0.3, c.y + 4);
      ctx.lineTo(c.x + c.w * 0.55, c.y + c.h * 0.5);
      ctx.lineTo(c.x + c.w * 0.4, c.y + c.h - 4);
      ctx.stroke();
    }
  }
}

function drawPowerUps(ctx: CanvasRenderingContext2D, items: PowerUpItem[], time: number): void {
  for (const item of items) {
    const meta = POWERUP_CATALOG[item.type];
    const pulse = 1 + Math.sin(time * 5 + item.x) * 0.08;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.scale(pulse, pulse);

    // Pad glow ring
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Hex crate
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-13, -13, 26, 26, 5);
    ctx.fill();
    ctx.stroke();

    // Crisp symbol
    ctx.fillStyle = meta.color;
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2;
    if (item.type === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -4);
      ctx.lineTo(5, 3);
      ctx.lineTo(0, 8);
      ctx.lineTo(-5, 3);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.stroke();
    } else if (item.type === 'speed') {
      ctx.beginPath();
      ctx.moveTo(2, -8);
      ctx.lineTo(-5, 1);
      ctx.lineTo(0, 1);
      ctx.lineTo(-2, 8);
      ctx.lineTo(5, -1);
      ctx.lineTo(0, -1);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'rapid') {
      ctx.fillRect(-6, -5, 4, 10);
      ctx.fillRect(-1, -5, 4, 10);
      ctx.fillRect(4, -5, 4, 10);
    } else if (item.type === 'repair') {
      ctx.fillRect(-2.5, -7, 5, 14);
      ctx.fillRect(-7, -2.5, 14, 5);
    } else if (item.type === 'triple') {
      ctx.beginPath();
      ctx.arc(-5, 4, 2.3, 0, Math.PI * 2);
      ctx.arc(0, -5, 2.3, 0, Math.PI * 2);
      ctx.arc(5, 4, 2.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'ricochet') {
      ctx.beginPath();
      ctx.moveTo(-6, 5);
      ctx.lineTo(0, -5);
      ctx.lineTo(6, 5);
      ctx.stroke();
    } else if (item.type === 'damage') {
      ctx.beginPath();
      ctx.moveTo(0, -7.5);
      ctx.lineTo(6, 2);
      ctx.lineTo(2.5, 2);
      ctx.lineTo(2.5, 7);
      ctx.lineTo(-2.5, 7);
      ctx.lineTo(-2.5, 2);
      ctx.lineTo(-6, 2);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'stealth') {
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawOnTankBar(
  ctx: CanvasRenderingContext2D,
  tank: TankState,
  isLocal: boolean,
  showTeamTag: boolean
): void {
  if (!tank.alive) return;
  const barW = 42;
  const barH = 5;
  const bx = tank.x - barW / 2;
  const by = tank.y - 34;

  // Name tag (with optional team prefix in 2v2)
  const label = showTeamTag
    ? `${tank.teamId === 1 ? '[A]' : '[B]'} ${tank.name}`
    : tank.name;
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(label, tank.x + 1, by - 5);
  ctx.fillStyle = isLocal
    ? '#fde68a'
    : showTeamTag
    ? tank.teamId === 1
      ? '#93c5fd'
      : '#fca5a5'
    : '#e4e4e7';
  ctx.fillText(label, tank.x, by - 6);

  // Health bar background
  ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

  const hpRatio = Math.max(0, Math.min(1, tank.hp / tank.maxHp));
  ctx.fillStyle = hpRatio > 0.35 ? PAINT_PALETTES[tank.loadout.paint].primary : '#ef4444';
  ctx.fillRect(bx, by, barW * hpRatio, barH);

  // Shield overlay bar
  if (tank.buffs.shieldHp > 0) {
    const shRatio = Math.max(0, Math.min(1, tank.buffs.shieldHp / 50));
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(bx, by - 3.5, barW * shRatio, 2.5);
  }
}

let cachedStaticKey = '';
let cachedStaticCanvas: HTMLCanvasElement | null = null;

function getStaticMapLayer(
  mapId: GameSnapshot['mapId'],
  canvasWidth: number,
  canvasHeight: number,
  dpr: number,
  scale: number,
  offsetX: number,
  offsetY: number
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const pw = Math.max(1, Math.floor(canvasWidth * dpr));
  const ph = Math.max(1, Math.floor(canvasHeight * dpr));
  const key = `${mapId}:${pw}:${ph}`;
  if (cachedStaticCanvas && cachedStaticKey === key) {
    return cachedStaticCanvas;
  }

  const map = ARENA_MAPS[mapId];
  const theme = MAP_THEME_TINTS[mapId] ?? MAP_THEME_TINTS.proving_ground;
  const off = document.createElement('canvas');
  off.width = pw;
  off.height = ph;
  const octx = off.getContext('2d');
  if (!octx) return null;

  octx.fillStyle = '#111318';
  octx.fillRect(0, 0, pw, ph);

  octx.save();
  octx.scale(dpr, dpr);
  octx.translate(offsetX, offsetY);
  octx.scale(scale, scale);

  // Tactical concrete proving ground floor
  octx.fillStyle = theme.floor;
  octx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Concrete slab grid
  octx.strokeStyle = theme.grid;
  octx.lineWidth = 1;
  const tile = 60;
  for (let gx = 0; gx <= ARENA_WIDTH; gx += tile) {
    octx.beginPath();
    octx.moveTo(gx, 0);
    octx.lineTo(gx, ARENA_HEIGHT);
    octx.stroke();
  }
  for (let gy = 0; gy <= ARENA_HEIGHT; gy += tile) {
    octx.beginPath();
    octx.moveTo(0, gy);
    octx.lineTo(ARENA_WIDTH, gy);
    octx.stroke();
  }

  // Center tactical circle & midline markings
  octx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  octx.lineWidth = 2;
  octx.beginPath();
  octx.moveTo(ARENA_WIDTH / 2, 28);
  octx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT - 28);
  octx.stroke();
  octx.beginPath();
  octx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 95, 0, Math.PI * 2);
  octx.stroke();

  // Power-up spawn pad decals
  for (const pad of map.powerUpPads) {
    octx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
    octx.lineWidth = 1.5;
    octx.beginPath();
    octx.arc(pad.x, pad.y, 18, 0, Math.PI * 2);
    octx.stroke();
  }

  // Static walls
  drawWalls(octx, map.walls);
  octx.restore();

  cachedStaticKey = key;
  cachedStaticCanvas = off;
  return off;
}

export function renderArena(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  snapshot: GameSnapshot,
  vfx: ArenaVfx,
  localPlayerId: PlayerId | null,
  pointerWorld: { x: number; y: number } | null,
  dpr = 1
): void {
  const map = ARENA_MAPS[snapshot.mapId];

  // Fit 1200x760 arena cleanly inside viewport with subtle padding
  const scale = Math.min(canvasWidth / ARENA_WIDTH, canvasHeight / ARENA_HEIGHT);
  const offsetX = (canvasWidth - ARENA_WIDTH * scale) / 2;
  const offsetY = (canvasHeight - ARENA_HEIGHT * scale) / 2;

  const shakeMag = vfx.trauma * vfx.trauma * 10;
  const shakeX = shakeMag > 0.05 ? (Math.random() * 2 - 1) * shakeMag : 0;
  const shakeY = shakeMag > 0.05 ? (Math.random() * 2 - 1) * shakeMag : 0;

  // 1. Blit pre-scaled static arena layer at 1:1 pixels
  const staticLayer = getStaticMapLayer(
    snapshot.mapId,
    canvasWidth,
    canvasHeight,
    dpr,
    scale,
    offsetX,
    offsetY
  );
  if (staticLayer) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, Math.round(shakeX * dpr), Math.round(shakeY * dpr));
    if (shakeMag > 0.05) {
      ctx.fillStyle = '#111318';
      ctx.fillRect(0, 0, staticLayer.width, staticLayer.height);
    }
    ctx.drawImage(staticLayer, 0, 0);
    ctx.restore();
  } else {
    ctx.fillStyle = '#111318';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.save();
  ctx.translate(offsetX + shakeX, offsetY + shakeY);
  ctx.scale(scale, scale);

  // Mode-specific floor zones: KOTH & CTF
  if (snapshot.mode === 'koth') {
    const k = snapshot.koth;
    let zoneColor = 'rgba(245, 158, 11, 0.12)';
    let strokeColor = '#f59e0b';
    if (k.controllingTeam === 1) {
      zoneColor = 'rgba(37, 99, 235, 0.18)';
      strokeColor = '#60a5fa';
    } else if (k.controllingTeam === 2) {
      zoneColor = 'rgba(220, 38, 38, 0.18)';
      strokeColor = '#f87171';
    } else if (k.controllingTeam === 'contested') {
      zoneColor = 'rgba(250, 204, 21, 0.22)';
      strokeColor = '#facc15';
    }

    ctx.fillStyle = zoneColor;
    ctx.beginPath();
    ctx.arc(k.x, k.y, k.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(k.x, k.y, k.radius, snapshot.elapsed * 0.4, snapshot.elapsed * 0.4 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    const label =
      k.controllingTeam === 'contested'
        ? 'CONTESTED'
        : k.controllingTeam
        ? snapshot.format === '2v2'
          ? `${k.controllingTeam === 1 ? 'ALPHA' : 'BRAVO'} HOLDING`
          : `P${k.controllingTeam} HOLDING`
        : 'CAPTURE ZONE';
    ctx.fillText(label, k.x, k.y - k.radius - 10);
  }

  if (snapshot.mode === 'ctf') {
    for (const teamId of [1, 2] as const) {
      const base = map.flagBases[teamId];
      const teamColor = teamId === 1 ? '#2563eb' : '#dc2626';
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.arc(base.x, base.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = teamColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(base.x, base.y, 26, 0, Math.PI * 2);
      ctx.stroke();

      const flag = snapshot.flags[teamId];
      if (flag.status !== 'carried') {
        ctx.save();
        ctx.translate(flag.x, flag.y);
        ctx.strokeStyle = '#f4f4f5';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(0, -18);
        ctx.stroke();
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(18, -12 + Math.sin(snapshot.elapsed * 9) * 2);
        ctx.lineTo(0, -6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // 2. Tread marks
  vfx.drawTreads(ctx);

  // 3. Destructible Crates
  drawCrates(ctx, snapshot.crates);

  // 4. Power-Ups
  drawPowerUps(ctx, snapshot.powerUps, snapshot.elapsed);

  // 5. Aim sight line for local player (subtle dotted tracer)
  if (localPlayerId && pointerWorld) {
    const localTank = snapshot.tanks[localPlayerId];
    if (localTank && localTank.alive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(localTank.x, localTank.y);
      ctx.lineTo(pointerWorld.x, pointerWorld.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // 6. Tanks
  const is2v2 = snapshot.format === '2v2';
  const localTeamId = localPlayerId ? snapshot.tanks[localPlayerId]?.teamId : null;
  for (const id of snapshot.activePlayerIds) {
    const t = snapshot.tanks[id];
    if (!t || !t.alive) continue;
    const enemyTeam: 1 | 2 | null = t.teamId === 1 ? 2 : t.teamId === 2 ? 1 : null;
    const enemyFlagColor =
      snapshot.mode === 'ctf' && enemyTeam && snapshot.flags[enemyTeam].carrierId === id
        ? enemyTeam === 1
          ? '#2563eb'
          : '#dc2626'
        : null;

    const isCloaked =
      snapshot.elapsed < t.buffs.cloakUntil && snapshot.elapsed >= t.buffs.cloakRevealUntil;
    const isFriendly = id === localPlayerId || (localTeamId !== null && t.teamId === localTeamId);
    const cloakAlpha = isCloaked ? (isFriendly ? 0.35 : 0.09) : 1;

    // Subtle team ring underneath in 2v2 so allies vs foes are unmistakable
    if (is2v2 && (!isCloaked || isFriendly)) {
      ctx.save();
      ctx.strokeStyle = t.teamId === 1 ? 'rgba(96, 165, 250, 0.45)' : 'rgba(248, 113, 113, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawTankModel(ctx, t.x, t.y, t.hullAngle, t.turretAngle, t.loadout, {
      recoil: t.recoil,
      hitFlash: t.hitFlashTimer > 0,
      shieldRatio: t.buffs.shieldHp > 0 ? t.buffs.shieldHp / 50 : 0,
      spawnShield: snapshot.elapsed < t.spawnShieldUntil,
      speedBuff: snapshot.elapsed < t.buffs.speedUntil,
      rapidBuff: snapshot.elapsed < t.buffs.rapidUntil,
      tripleBuff: snapshot.elapsed < t.buffs.tripleUntil,
      ricochetBuff: snapshot.elapsed < t.buffs.ricochetUntil,
      damageBuff: snapshot.elapsed < t.buffs.damageUntil,
      cloakAlpha,
      slowed: snapshot.elapsed < t.buffs.slowUntil,
      time: snapshot.elapsed,
      carryingFlagColor: enemyFlagColor,
    });
    if (!isCloaked || isFriendly) {
      drawOnTankBar(ctx, t, id === localPlayerId, is2v2);
    }
  }

  // 7. Projectiles
  for (const p of snapshot.projectiles) {
    const bulletMeta = BULLET_UPGRADES[p.bulletType] ?? BULLET_UPGRADES.standard;
    const angle = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    // Tracer tail
    ctx.fillStyle = bulletMeta.color;
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.ellipse(-9, 0, p.bulletType === 'plasma' ? 14 : 10, p.radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shell core
    ctx.globalAlpha = 1;
    ctx.fillStyle = bulletMeta.color;
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (p.bulletType === 'plasma') {
      ctx.ellipse(0, 0, p.radius * 1.45, p.radius * 0.85, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    if (p.bulletType === 'heavy') {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(1.5, 0, p.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 8. Pooled Particles
  vfx.drawParticles(ctx);

  // 9. Crosshair reticle for local player
  if (localPlayerId && pointerWorld) {
    ctx.save();
    ctx.translate(pointerWorld.x, pointerWorld.y);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.moveTo(-15, 0);
    ctx.lineTo(-6, 0);
    ctx.moveTo(6, 0);
    ctx.lineTo(15, 0);
    ctx.moveTo(0, -15);
    ctx.lineTo(0, -6);
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 15);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
