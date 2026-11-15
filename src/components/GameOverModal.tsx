import React from 'react';
import { CheckCircle2, Home, RotateCcw } from 'lucide-react';
import { PAINT_PALETTES } from '../game/customization';
import { cleanPlayerName } from '../game/sync';
import type { GameSnapshot, PlayerId, RoomPlayerInfo, TankState } from '../game/types';

interface GameOverModalProps {
  snapshot: GameSnapshot;
  localPlayerId: PlayerId;
  localStatsTank: TankState;
  isSoloMode: boolean;
  roomPlayers: RoomPlayerInfo[];
  rematchVotes: PlayerId[];
  rematchTotal: number;
  hasVotedRematch: boolean;
  onRematch: () => void;
  onLeaveToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  snapshot,
  localPlayerId,
  localStatsTank,
  isSoloMode,
  roomPlayers,
  rematchVotes,
  rematchTotal,
  hasVotedRematch,
  onRematch,
  onLeaveToMenu,
}) => {
  const didLocalWin = snapshot.winnerTeamId === localStatsTank.teamId;
  const accuracy =
    localStatsTank.shotsFired > 0
      ? Math.round((localStatsTank.shotsHit / localStatsTank.shotsFired) * 100)
      : 0;

  const winnerLabel = (() => {
    if (!snapshot.winnerTeamId) return null;
    if (snapshot.format === '2v2') {
      return `Team ${snapshot.winnerTeamId === 1 ? 'Alpha' : 'Bravo'}`;
    }
    const winTank = snapshot.activePlayerIds
      .map((id) => snapshot.tanks[id])
      .find((t) => t && t.teamId === snapshot.winnerTeamId);
    return cleanPlayerName(winTank?.name) || (snapshot.winnerTeamId ? `Commander ${snapshot.winnerTeamId}` : null);
  })();

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-heading"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-[#161921] p-6 text-center shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Match Complete
        </div>
        <h2
          id="gameover-heading"
          className={`mt-1 font-display text-4xl font-extrabold tracking-wide ${
            didLocalWin ? 'text-amber-400' : 'text-red-400'
          }`}
        >
          {didLocalWin ? 'VICTORY' : 'DEFEAT'}
        </h2>
        {winnerLabel && (
          <p className="mt-1 text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">{winnerLabel}</span> claimed the arena
          </p>
        )}

        {/* Match Standings Breakdown */}
        <div className="mt-4 space-y-1.5 rounded-lg border border-zinc-800 bg-[#111318] p-3 text-left">
          {snapshot.activePlayerIds.map((id) => {
            const t = snapshot.tanks[id];
            if (!t) return null;
            const score =
              snapshot.mode === 'koth'
                ? `${Math.round(snapshot.teamKothProgress[t.teamId] ?? 0)}%`
                : `${snapshot.teamScores[t.teamId] ?? 0}`;
            return (
              <div key={id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: PAINT_PALETTES[t.loadout.paint].primary }}
                  />
                  <span className="font-semibold text-zinc-200">
                    {cleanPlayerName(t.name) || `Commander ${id}`}
                    {id === localPlayerId ? ' (You)' : ''}
                    {snapshot.format === '2v2' ? (
                      <span className="ml-1.5 text-[10px] text-zinc-400">
                        {t.teamId === 1 ? 'Alpha' : 'Bravo'}
                      </span>
                    ) : null}
                  </span>
                </div>
                <span className="font-mono-num text-zinc-300">
                  {t.kills} KO · Score {score}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-[#111318] p-2.5">
          <div>
            <div className="text-[11px] text-zinc-400">Your Eliminations</div>
            <div className="font-mono-num text-base font-bold text-zinc-100">
              {localStatsTank.kills}
            </div>
          </div>
          <div className="border-l border-zinc-800">
            <div className="text-[11px] text-zinc-400">Your Accuracy</div>
            <div className="font-mono-num text-base font-bold text-amber-400">
              {accuracy}%
            </div>
          </div>
        </div>

        {!isSoloMode && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-[#111318] px-3 py-2.5 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-400">Rematch Confirmation</span>
              <span className="font-mono-num font-bold text-amber-400">
                {rematchVotes.length} / {Math.max(1, roomPlayers.length || rematchTotal)} Confirmed
              </span>
            </div>
            {roomPlayers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {roomPlayers.map((rp) => {
                  const voted = rematchVotes.includes(rp.id);
                  return (
                    <span
                      key={rp.id}
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        voted ? 'text-emerald-400' : 'text-zinc-500'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {cleanPlayerName(rp.name) || `Commander ${rp.id}`}
                      {rp.id === localPlayerId ? ' (You)' : ''}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            data-start="true"
            data-testid="rematch-btn"
            onClick={onRematch}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors ${
              !isSoloMode && hasVotedRematch
                ? 'border border-emerald-500 bg-emerald-600/25 text-emerald-200 hover:bg-emerald-600/35'
                : 'bg-amber-600 text-white hover:bg-amber-500'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            {isSoloMode
              ? 'Play Again'
              : hasVotedRematch
                ? 'Confirmed ✓ (Cancel)'
                : 'Confirm Rematch'}
          </button>
          <button
            type="button"
            onClick={onLeaveToMenu}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            <Home className="h-4 w-4" />
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
