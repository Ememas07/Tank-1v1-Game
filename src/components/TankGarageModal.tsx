import React, { useEffect, useRef } from 'react';
import { Shield, Gauge, Crosshair, RotateCcw, X } from 'lucide-react';
import {
  BULLET_ORDER,
  BULLET_UPGRADES,
  computeTankStats,
  DECAL_OPTIONS,
  MAX_COMPONENT_TIER,
  MAX_UPGRADE_POINTS,
  PAINT_PALETTES,
} from '../game/customization';
import { drawTankPreview } from '../game/renderer';
import type { BulletType, DecalId, PaintId, TankLoadout } from '../game/types';

interface TankGarageModalProps {
  loadout: TankLoadout;
  defaultLoadout: TankLoadout;
  onChange: (next: TankLoadout) => void;
  onClose: () => void;
}

export const TankGarageModal: React.FC<TankGarageModalProps> = ({
  loadout,
  defaultLoadout,
  onChange,
  onClose,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadoutRef = useRef(loadout);
  loadoutRef.current = loadout;

  useEffect(() => {
    const start = performance.now();
    const draw = () => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawTankPreview(
            ctx,
            canvas.width,
            canvas.height,
            loadoutRef.current,
            (performance.now() - start) / 1000
          );
        }
      }
    };
    draw();
    const id = window.setInterval(draw, 50);
    return () => window.clearInterval(id);
  }, [loadout]);

  const usedPoints = loadout.armorLevel + loadout.speedLevel + loadout.powerLevel;
  const remainingPoints = MAX_UPGRADE_POINTS - usedPoints;
  const stats = computeTankStats(loadout);
  const bulletMeta = BULLET_UPGRADES[loadout.bulletType ?? 'standard'];

  const adjustComponent = (
    key: 'armorLevel' | 'speedLevel' | 'powerLevel',
    delta: 1 | -1
  ) => {
    const current = loadout[key];
    const next = current + delta;
    if (next < 0 || next > MAX_COMPONENT_TIER) return;
    if (delta > 0 && remainingPoints <= 0) return;
    onChange({ ...loadout, [key]: next });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="garage-title"
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl border border-zinc-700/80 bg-[#191c24] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3.5">
          <div>
            <h2 id="garage-title" className="font-display text-2xl font-bold tracking-wide text-zinc-100">
              Tank Customization Bay
            </h2>
            <p className="text-xs text-zinc-400">
              Configure hull paint, tactical decals, chassis upgrades, and munition type
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(defaultLoadout)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close customization"
              className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5">
          {/* Left: Live Tank Preview & Combat Telemetry */}
          <div className="md:col-span-5 flex flex-col gap-3.5">
            <div className="relative overflow-hidden rounded-lg border border-zinc-700/80 bg-[#14161c]">
              <canvas
                ref={previewCanvasRef}
                width={320}
                height={220}
                className="w-full h-[200px] block"
                data-testid="tank-preview-canvas"
              />
              <div className="flex items-center justify-between border-t border-zinc-800 bg-[#14171e] px-3 py-2 text-xs text-zinc-400">
                <span>{PAINT_PALETTES[loadout.paint].name}</span>
                <span className="font-medium text-zinc-200">{bulletMeta.name}</span>
                <span>{DECAL_OPTIONS.find((d) => d.id === loadout.decal)?.name}</span>
              </div>
            </div>

            {/* Live Stat Readouts */}
            <div className="grid grid-cols-4 gap-2 rounded-lg border border-zinc-800 bg-[#14161c] p-3 text-center">
              <div>
                <div className="text-[11px] font-medium text-zinc-400">Armor HP</div>
                <div className="font-mono-num text-base font-bold text-zinc-100">
                  {Math.round(stats.maxHp)}
                </div>
              </div>
              <div className="border-l border-zinc-800">
                <div className="text-[11px] font-medium text-zinc-400">Speed</div>
                <div className="font-mono-num text-base font-bold text-zinc-100">
                  {Math.round(stats.moveSpeed)}
                </div>
              </div>
              <div className="border-l border-zinc-800">
                <div className="text-[11px] font-medium text-zinc-400">Shell Dmg</div>
                <div className="font-mono-num text-base font-bold text-amber-400">
                  {stats.projectilesPerShot > 1
                    ? `${stats.projectilesPerShot}×${Math.round(stats.shellDamage)}`
                    : Math.round(stats.shellDamage)}
                </div>
              </div>
              <div className="border-l border-zinc-800">
                <div className="text-[11px] font-medium text-zinc-400">Bounces</div>
                <div className="font-mono-num text-base font-bold text-cyan-300">
                  {stats.baseBounces}
                </div>
              </div>
            </div>

            {/* Chassis Upgrades (left bottom for clean balance) */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Chassis Upgrades
                </span>
                <span className="font-mono-num text-xs font-semibold text-amber-400">
                  {remainingPoints} / {MAX_UPGRADE_POINTS} pts available
                </span>
              </div>

              <div className="space-y-2">
                {[
                  {
                    key: 'armorLevel' as const,
                    label: 'Armor Plating',
                    hint: 'Side skirts, sloped wedge & max HP',
                    icon: Shield,
                    value: loadout.armorLevel,
                  },
                  {
                    key: 'speedLevel' as const,
                    label: 'Turbo Drive',
                    hint: 'Twin exhausts, fins, speed & dash',
                    icon: Gauge,
                    value: loadout.speedLevel,
                  },
                  {
                    key: 'powerLevel' as const,
                    label: 'Heavy Cannon',
                    hint: 'Heavy barrel, muzzle brake & dmg',
                    icon: Crosshair,
                    value: loadout.powerLevel,
                  },
                ].map((comp) => {
                  const Icon = comp.icon;
                  return (
                    <div
                      key={comp.key}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-[#14161c] px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 shrink-0 text-amber-400" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100">{comp.label}</div>
                          <div className="text-[11px] text-zinc-400 truncate">{comp.hint}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => adjustComponent(comp.key, -1)}
                          disabled={comp.value <= 0}
                          aria-label={`Decrease ${comp.label}`}
                          className="h-6 w-6 rounded border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          -
                        </button>
                        <div className="flex items-center gap-0.5" aria-label={`${comp.label} tier ${comp.value}`}>
                          {[1, 2, 3].map((tier) => (
                            <span
                              key={tier}
                              className={`h-2 w-3 rounded-sm ${
                                comp.value >= tier ? 'bg-amber-500' : 'bg-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => adjustComponent(comp.key, 1)}
                          disabled={comp.value >= MAX_COMPONENT_TIER || remainingPoints <= 0}
                          aria-label={`Increase ${comp.label}`}
                          className="h-6 w-6 rounded border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Paint, Decals, and Bullet Upgrades */}
          <div className="md:col-span-7 flex flex-col gap-4">
            {/* Paint Colors */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Hull Paint Finish
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PAINT_PALETTES) as PaintId[]).map((pid) => {
                  const pal = PAINT_PALETTES[pid];
                  const active = loadout.paint === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => onChange({ ...loadout, paint: pid })}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'border-amber-500 bg-amber-500/15 text-white'
                          : 'border-zinc-700/80 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/40"
                        style={{ backgroundColor: pal.primary }}
                      />
                      <span className="truncate">{pal.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Decals */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Tactical Decal
              </div>
              <div className="flex flex-wrap gap-2">
                {DECAL_OPTIONS.map((d) => {
                  const active = loadout.decal === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onChange({ ...loadout, decal: d.id as DecalId })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'border-amber-500 bg-amber-500/15 text-white'
                          : 'border-zinc-700/80 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bullet / Munition Upgrade Types */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Munition / Bullet Upgrade
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BULLET_ORDER.map((bid: BulletType) => {
                  const meta = BULLET_UPGRADES[bid];
                  const active = (loadout.bulletType ?? 'standard') === bid;
                  return (
                    <button
                      key={bid}
                      type="button"
                      onClick={() => onChange({ ...loadout, bulletType: bid })}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        active
                          ? 'border-amber-500 bg-amber-500/15 text-white'
                          : 'border-zinc-700/80 bg-[#14161c] text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full border border-black/50"
                        style={{ backgroundColor: meta.color }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-100 whitespace-nowrap">
                            {meta.name}
                          </span>
                          <span className="font-mono-num text-[10px] text-zinc-400">
                            {meta.shortCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">{meta.summary}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 bg-[#14161c] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
          >
            Confirm Loadout
          </button>
        </div>
      </div>
    </div>
  );
};
