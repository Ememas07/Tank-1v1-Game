import React from 'react';
import { Volume2, VolumeX, Pause, Home } from 'lucide-react';
import {
  BULLET_UPGRADES,
  computeTankStats,
  PAINT_PALETTES,
  POWERUP_CATALOG,
} from '../game/customization';
import { CTF_CAPTURES_TARGET, DM_WINS_TARGET } from '../game/engine';
import { ARENA_MAPS } from '../game/maps';
import type { GameSnapshot, PlayerId, TankState } from '../game/types';

interface GameHudProps {
  snapshot: GameSnapshot;
  localPlayerId: PlayerId;
  roomCode: string | null;
  muted: boolean;
  onToggleMute: () => void;
  onOpenPause: () => void;
}

function ActiveBuffChips({ tank, elapsed }: { tank: TankState; elapsed: number }) {
  const chips: Array<{ label: string; secs: number; color: string }> = [];
  if (tank.buffs.shieldHp > 0 && tank.buffs.shieldUntil > elapsed) {
    chips.push({
      label: `${POWERUP_CATALOG.shield.shortLabel} ${Math.round(tank.buffs.shieldHp)}`,
      secs: tank.buffs.shieldUntil - elapsed,
      color: POWERUP_CATALOG.shield.color,
    });
  }
  if (tank.buffs.speedUntil > elapsed) {
    chips.push({
      label: POWERUP_CATALOG.speed.shortLabel,
      secs: tank.buffs.speedUntil - elapsed,
      color: POWERUP_CATALOG.speed.color,
    });
  }
  if (tank.buffs.rapidUntil > elapsed) {
    chips.push({
      label: POWERUP_CATALOG.rapid.shortLabel,
      secs: tank.buffs.rapidUntil - elapsed,
      color: POWERUP_CATALOG.rapid.color,
    });
  }
  if (tank.buffs.tripleUntil > elapsed) {
    chips.push({
      label: POWERUP_CATALOG.triple.shortLabel,
      secs: tank.buffs.tripleUntil - elapsed,
      color: POWERUP_CATALOG.triple.color,
    });
  }
  if (tank.buffs.ricochetUntil > elapsed) {
    chips.push({
      label: POWERUP_CATALOG.ricochet.shortLabel,
      secs: tank.buffs.ricochetUntil - elapsed,
      color: POWERUP_CATALOG.ricochet.color,
    });
  }
  if (tank.buffs.damageUntil > elapsed) {
    chips.push({
      label: POWERUP_CATALOG.damage.shortLabel,
      secs: tank.buffs.damageUntil - elapsed,
      color: POWERUP_CATALOG.damage.color,
    });
  }
  if (tank.buffs.cloakUntil > elapsed) {
    chips.push({
      label: POWERUP_CATALOG.stealth.shortLabel,
      secs: tank.buffs.cloakUntil - elapsed,
      color: POWERUP_CATALOG.stealth.color,
    });
  }
  if (tank.buffs.slowUntil > elapsed) {
    chips.push({
      label: 'SLOWED',
      secs: tank.buffs.slowUntil - elapsed,
      color: '#c084fc',
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-mono-num">
      {chips.map((c) => (
        <span key={c.label} className="font-semibold" style={{ color: c.color }}>
          {c.label} {c.secs.toFixed(1)}s
        </span>
      ))}
    </div>
  );
}

function TeamCluster({
  teamId,
  teamName,
  tanks,
  snapshot,
  localPlayerId,
  align,
}: {
  teamId: 1 | 2;
  teamName: string;
  tanks: TankState[];
  snapshot: GameSnapshot;
  localPlayerId: PlayerId;
  align: 'left' | 'right';
}) {
  const accentColor = teamId === 1 ? '#3b82f6' : '#ef4444';
  const score = snapshot.teamScores[teamId] ?? 0;
  const kothPct = snapshot.teamKothProgress[teamId] ?? 0;
  const targetScore =
    snapshot.mode === 'deathmatch'
      ? DM_WINS_TARGET
      : snapshot.mode === 'ctf'
      ? CTF_CAPTURES_TARGET
      : 100;

  return (
    <div
      className={`w-48 sm:w-64 rounded-lg border border-zinc-700/80 bg-[#14161b]/95 px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-lg ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {/* Team Header & Score */}
      <div
        className={`flex items-center justify-between gap-2 pb-1.5 border-b border-zinc-800 ${
          align === 'right' ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        <div
          className={`flex items-center gap-2 min-w-0 ${
            align === 'right' ? 'flex-row-reverse' : ''
          }`}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: accentColor }}
          />
          <span className="truncate text-xs font-bold text-zinc-100">{teamName}</span>
        </div>
        {snapshot.mode === 'koth' ? (
          <span className="font-mono-num text-xs font-bold text-amber-400">
            {Math.round(kothPct)}%
          </span>
        ) : (
          <div className="flex items-center gap-1">
            {Array.from({ length: targetScore }).map((_, i) => (
              <span
                key={i}
                className="h-2 w-3.5 rounded-sm"
                style={{
                  backgroundColor: i < score ? accentColor : '#27272a',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Member HP Rows */}
      <div className="mt-2 space-y-2">
        {tanks.map((tank) => {
          const palette = PAINT_PALETTES[tank.loadout.paint];
          const hpPct = Math.max(0, Math.min(100, (tank.hp / tank.maxHp) * 100));
          const shieldPct = Math.max(0, Math.min(100, (tank.buffs.shieldHp / 50) * 100));
          const isLocal = tank.id === localPlayerId;

          return (
            <div key={tank.id}>
              <div
                className={`flex items-center justify-between gap-2 text-[11px] ${
                  align === 'right' ? 'flex-row-reverse' : ''
                }`}
              >
                <span className="truncate font-medium text-zinc-200">
                  {tank.name}
                  {isLocal ? ' (You)' : ''}
                </span>
                <span className="font-mono-num font-semibold text-zinc-100 shrink-0">
                  {tank.alive ? Math.round(tank.hp) : 'KO'}
                  <span className="text-[10px] font-normal text-zinc-400">
                    /{Math.round(tank.maxHp)}
                  </span>
                </span>
              </div>

              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-zinc-800">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${tank.alive ? hpPct : 0}%`,
                    backgroundColor: hpPct > 30 ? palette.primary : '#ef4444',
                    marginLeft: align === 'right' ? 'auto' : undefined,
                  }}
                />
              </div>

              {tank.buffs.shieldHp > 0 && tank.alive && (
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-sm bg-zinc-800">
                  <div
                    className="h-full bg-sky-400 transition-all duration-100"
                    style={{
                      width: `${shieldPct}%`,
                      marginLeft: align === 'right' ? 'auto' : undefined,
                    }}
                  />
                </div>
              )}

              {!tank.alive && snapshot.mode !== 'deathmatch' && (
                <div className="mt-0.5 font-mono-num text-[10px] font-semibold text-amber-400">
                  Respawn {tank.respawnTimer.toFixed(1)}s
                </div>
              )}

              {isLocal && <ActiveBuffChips tank={tank} elapsed={snapshot.elapsed} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FfaStandingsCluster({
  tanks,
  snapshot,
  localPlayerId,
}: {
  tanks: TankState[];
  snapshot: GameSnapshot;
  localPlayerId: PlayerId;
}) {
  const sorted = [...tanks].sort((a, b) => {
    const scoreA =
      snapshot.mode === 'koth'
        ? snapshot.teamKothProgress[a.teamId] ?? 0
        : snapshot.teamScores[a.teamId] ?? 0;
    const scoreB =
      snapshot.mode === 'koth'
        ? snapshot.teamKothProgress[b.teamId] ?? 0
        : snapshot.teamScores[b.teamId] ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.kills - a.kills;
  });

  return (
    <div className="w-64 sm:w-80 rounded-lg border border-zinc-700/80 bg-[#14161b]/95 px-3 py-2 shadow-lg">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Free-For-All Standings
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {sorted.map((tank) => {
          const pal = PAINT_PALETTES[tank.loadout.paint];
          const score =
            snapshot.mode === 'koth'
              ? `${Math.round(snapshot.teamKothProgress[tank.teamId] ?? 0)}%`
              : `${snapshot.teamScores[tank.teamId] ?? 0}/${DM_WINS_TARGET}`;
          const hpPct = Math.max(0, Math.min(100, (tank.hp / tank.maxHp) * 100));
          const isLocal = tank.id === localPlayerId;

          return (
            <div key={tank.id} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: pal.primary }}
                  />
                  <span
                    className={`truncate ${
                      isLocal ? 'font-bold text-amber-300' : 'font-medium text-zinc-200'
                    }`}
                  >
                    {tank.name}
                    {isLocal ? ' (You)' : ''}
                  </span>
                </div>
                <span className="font-mono-num text-[11px] font-bold text-zinc-100 shrink-0">
                  {score}
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-zinc-800">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${tank.alive ? hpPct : 0}%`,
                    backgroundColor: hpPct > 30 ? pal.primary : '#ef4444',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const GameHud: React.FC<GameHudProps> = ({
  snapshot,
  localPlayerId,
  roomCode,
  muted,
  onToggleMute,
  onOpenPause,
}) => {
  const localTank = snapshot.tanks[localPlayerId] ?? snapshot.tanks[snapshot.activePlayerIds[0]];
  if (!localTank) return null;

  const localStats = computeTankStats(localTank.loadout);
  const reloadPct =
    localTank.reloadTimer <= 0
      ? 100
      : Math.max(0, Math.min(100, (1 - localTank.reloadTimer / localStats.reloadTime) * 100));
  const dashPct =
    localTank.dashCooldownTimer <= 0
      ? 100
      : Math.max(0, Math.min(100, (1 - localTank.dashCooldownTimer / localStats.dashCooldown) * 100));

  const formatPrefix =
    snapshot.format === '2v2' ? '2v2' : snapshot.format === 'ffa' ? 'FFA' : '1v1';
  const modeLabel =
    snapshot.mode === 'deathmatch'
      ? `${formatPrefix} Deathmatch · Round ${snapshot.round}`
      : snapshot.mode === 'koth'
      ? `${formatPrefix} King of the Hill · First to 100%`
      : `${formatPrefix} Capture the Flag · First to 3`;

  const allTanks = snapshot.activePlayerIds
    .map((id) => snapshot.tanks[id])
    .filter((t): t is TankState => Boolean(t));

  const alphaTanks = allTanks.filter((t) => t.teamId === 1);
  const bravoTanks = allTanks.filter((t) => t.teamId === 2);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-4">
        {snapshot.format === 'ffa' ? (
          <FfaStandingsCluster
            tanks={allTanks}
            snapshot={snapshot}
            localPlayerId={localPlayerId}
          />
        ) : (
          <TeamCluster
            teamId={1}
            teamName={snapshot.format === '2v2' ? 'Team Alpha' : alphaTanks[0]?.name || 'Player 1'}
            tanks={alphaTanks}
            snapshot={snapshot}
            localPlayerId={localPlayerId}
            align="left"
          />
        )}

        {/* Top-Center Match Scoreboard */}
        <div className="flex flex-col items-center rounded-lg border border-zinc-700/80 bg-[#14161b]/95 px-5 py-2 shadow-lg">
          {snapshot.format === 'ffa' ? (
            <div className="font-display text-2xl font-extrabold tracking-wide text-zinc-100">
              {snapshot.mode === 'koth' ? 'HILL CONTROL' : `ROUND ${snapshot.round}`}
            </div>
          ) : (
            <div className="flex items-center gap-4 font-display text-3xl font-extrabold leading-none text-zinc-100">
              <span className="font-mono-num text-blue-400">
                {snapshot.mode === 'koth'
                  ? `${Math.round(snapshot.teamKothProgress[1] ?? 0)}%`
                  : snapshot.teamScores[1] ?? 0}
              </span>
              <span className="text-base font-normal text-zinc-500">—</span>
              <span className="font-mono-num text-red-400">
                {snapshot.mode === 'koth'
                  ? `${Math.round(snapshot.teamKothProgress[2] ?? 0)}%`
                  : snapshot.teamScores[2] ?? 0}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-zinc-400 whitespace-nowrap">
            <span>{modeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="text-zinc-300">{ARENA_MAPS[snapshot.mapId].name}</span>
            {roomCode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-amber-400">Room {roomCode}</span>
              </>
            )}
          </div>
        </div>

        {/* Top-Right Cluster + Utility Controls */}
        <div className="flex items-start gap-2">
          {snapshot.format === 'ffa' ? (
            <div className="w-44 rounded-lg border border-zinc-700/80 bg-[#14161b]/95 px-3 py-2 text-right shadow-lg">
              <div className="text-[11px] font-semibold text-zinc-400">Your Armor</div>
              <div className="font-mono-num text-lg font-bold text-zinc-100">
                {localTank.alive ? Math.round(localTank.hp) : 'KO'}
                <span className="text-xs font-normal text-zinc-400">
                  /{Math.round(localTank.maxHp)}
                </span>
              </div>
              {!localTank.alive && snapshot.mode !== 'deathmatch' && (
                <div className="font-mono-num text-[11px] font-semibold text-amber-400">
                  Respawn {localTank.respawnTimer.toFixed(1)}s
                </div>
              )}
              <ActiveBuffChips tank={localTank} elapsed={snapshot.elapsed} />
            </div>
          ) : (
            <TeamCluster
              teamId={2}
              teamName={snapshot.format === '2v2' ? 'Team Bravo' : bravoTanks[0]?.name || 'Player 2'}
              tanks={bravoTanks}
              snapshot={snapshot}
              localPlayerId={localPlayerId}
              align="right"
            />
          )}

          <div className="pointer-events-auto flex flex-col gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              title={muted ? 'Unmute [M]' : 'Mute [M]'}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700/80 bg-[#14161b]/95 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenPause();
              }}
              aria-label="Pause menu (Esc)"
              title="Pause menu [Esc]"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700/80 bg-[#14161b]/95 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Round-Over Banner */}
      {snapshot.phase === 'round_over' && (
        <div className="mx-auto mt-3 rounded-lg border border-amber-500/70 bg-[#14161b]/95 px-6 py-2.5 text-center shadow-xl">
          <div className="font-display text-2xl font-bold tracking-wide text-amber-400">
            {snapshot.roundWinnerTeamId === null
              ? `Round ${snapshot.round} Draw`
              : snapshot.format === '2v2'
              ? `Team ${snapshot.roundWinnerTeamId === 1 ? 'Alpha' : 'Bravo'} Wins Round ${snapshot.round}`
              : `${
                  allTanks.find((t) => t.teamId === snapshot.roundWinnerTeamId)?.name ?? 'Commander'
                } Wins Round ${snapshot.round}`}
          </div>
          <div className="text-xs text-zinc-400">Deploying next tactical sector...</div>
        </div>
      )}

      <div className="flex-1" />

      {/* Bottom-Left Compact Weapon & Dash Indicators */}
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-4 rounded-lg border border-zinc-700/80 bg-[#14161b]/95 px-3.5 py-2 shadow-lg">
          <div className="w-36">
            <div className="flex items-center justify-between text-[11px] font-medium text-zinc-300">
              <span>
                {BULLET_UPGRADES[localTank.loadout.bulletType ?? 'standard'].shortCode} Cannon
              </span>
              <span className="font-mono-num text-amber-400">
                {localTank.reloadTimer <= 0 ? 'READY' : `${localTank.reloadTimer.toFixed(1)}s`}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-zinc-800">
              <div
                className="h-full bg-amber-500 transition-all duration-75"
                style={{ width: `${reloadPct}%` }}
              />
            </div>
          </div>
          <div className="h-6 w-px bg-zinc-800" />
          <div className="w-28">
            <div className="flex items-center justify-between text-[11px] font-medium text-zinc-300">
              <span>Dash [Shift]</span>
              <span className="font-mono-num text-sky-400">
                {localTank.dashCooldownTimer <= 0
                  ? 'READY'
                  : `${localTank.dashCooldownTimer.toFixed(1)}s`}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-zinc-800">
              <div
                className="h-full bg-sky-400 transition-all duration-75"
                style={{ width: `${dashPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
