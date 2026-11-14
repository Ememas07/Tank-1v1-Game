import React, { useState } from 'react';
import { Copy, Check, Wrench, Users, Play, Bot, ArrowRight, ArrowLeftRight, CheckCircle2, Clock } from 'lucide-react';
import { BULLET_UPGRADES, DECAL_OPTIONS, PAINT_PALETTES } from '../game/customization';
import { ARENA_MAPS, MAP_ORDER, MAP_THEME_TINTS } from '../game/maps';
import type {
  GameMode,
  MapSelection,
  MatchFormat,
  PlayerId,
  RoomPlayerInfo,
  TankLoadout,
} from '../game/types';

export const MATCH_FORMAT_META: Record<
  MatchFormat,
  { name: string; subtitle: string; maxPlayers: number }
> = {
  '1v1': { name: '1v1 Duel', subtitle: '2 Players', maxPlayers: 2 },
  '2v2': { name: '2v2 Teams', subtitle: '4 Players · Alpha vs Bravo', maxPlayers: 4 },
  ffa: { name: '4P Free-For-All', subtitle: 'Up to 4 Solo Tanks', maxPlayers: 4 },
};

export const GAME_MODE_META: Record<
  GameMode,
  { name: string; summary: string; winTarget: string }
> = {
  deathmatch: {
    name: 'Deathmatch',
    summary: 'Classic tactical elimination across rotating arenas with ricochet shells.',
    winTarget: 'First to 3 Round Wins',
  },
  koth: {
    name: 'King of the Hill',
    summary: 'Capture and hold the central radar zone uncontested while respawning.',
    winTarget: 'First to 100% Control',
  },
  ctf: {
    name: 'Capture the Flag',
    summary: 'Infiltrate the enemy bastion, steal their flag, and return it to your base.',
    winTarget: 'First to 3 Captures',
  },
};

interface TitleOverlayProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  loadout: TankLoadout;
  selectedFormat: MatchFormat;
  onSelectFormat: (format: MatchFormat) => void;
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  selectedMap: MapSelection;
  onSelectMap: (map: MapSelection) => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  errorMsg: string | null;
  connecting: boolean;
  onHostRoom: () => void;
  onJoinRoom: () => void;
  onSoloSkirmish: () => void;
  onOpenGarage: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  playerName,
  onPlayerNameChange,
  loadout,
  selectedFormat,
  onSelectFormat,
  selectedMode,
  onSelectMode,
  selectedMap,
  onSelectMap,
  joinCode,
  onJoinCodeChange,
  errorMsg,
  connecting,
  onHostRoom,
  onJoinRoom,
  onSoloSkirmish,
  onOpenGarage,
}) => {
  const palette = PAINT_PALETTES[loadout.paint];

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-between bg-gradient-to-b from-black/75 via-black/45 to-black/80 px-4 py-5 overflow-y-auto">
      {/* Bespoke SVG Emblem */}
      <a
        href="/"
        title="Return to Hub"
        className="flex flex-col items-center pt-1 text-center group cursor-pointer"
      >
        <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 group-hover:text-amber-400 transition-colors">
          <span aria-hidden="true">←</span> Return to Hub
        </span>
        <svg
          viewBox="0 0 360 74"
          className="h-14 w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
          aria-label="Ironclad Duel"
        >
          <path
            d="M16 14 L34 6 L326 6 L344 14 L344 58 L326 66 L34 66 L16 58 Z"
            fill="#14161b"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          <path
            d="M24 18 L38 11 L322 11 L336 18 L336 54 L322 61 L38 61 L24 54 Z"
            fill="none"
            stroke="#3f3f46"
            strokeWidth="1"
          />
          <rect x="28" y="33" width="24" height="6" rx="1.5" fill="#d97706" />
          <rect x="308" y="33" width="24" height="6" rx="1.5" fill="#d97706" />
          <text
            x="180"
            y="45"
            textAnchor="middle"
            fill="#f4f4f5"
            fontFamily="Barlow Condensed, sans-serif"
            fontWeight="800"
            fontSize="34"
            letterSpacing="3"
          >
            IRONCLAD DUEL
          </text>
        </svg>
      </a>

      {/* Main Command Panel */}
      <main className="w-full max-w-xl rounded-xl border border-zinc-700/90 bg-[#161921]/95 p-5 sm:p-6 shadow-2xl">
        {/* Callsign + Customize */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-zinc-800">
          <div className="flex-1">
            <label htmlFor="callsign-input" className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Commander Callsign
            </label>
            <input
              id="callsign-input"
              type="text"
              maxLength={18}
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              placeholder="Commander"
              className="w-full rounded-lg border border-zinc-700 bg-[#101217] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onOpenGarage}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-amber-500 hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0"
          >
            <span
              className="h-3 w-3 rounded-sm border border-black/50"
              style={{ backgroundColor: palette.primary }}
            />
            <Wrench className="h-4 w-4 text-amber-400" />
            Customize Tank
          </button>
        </div>

        {/* Team / Player Format Selector */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-zinc-400 mb-2">Squad Organization</div>
          <div className="grid grid-cols-3 gap-2">
            {(['1v1', '2v2', 'ffa'] as MatchFormat[]).map((fmt) => {
              const active = selectedFormat === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onSelectFormat(fmt)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-amber-500 bg-amber-500/15 text-white'
                      : 'border-zinc-700/80 bg-[#111318] text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="text-xs font-bold whitespace-nowrap">{MATCH_FORMAT_META[fmt].name}</div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {MATCH_FORMAT_META[fmt].subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Game Mode Selector */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-zinc-400 mb-2">Battle Mode</div>
          <div className="grid grid-cols-3 gap-2">
            {(['deathmatch', 'koth', 'ctf'] as GameMode[]).map((mode) => {
              const active = selectedMode === mode;
              const disabledForFfa = selectedFormat === 'ffa' && mode === 'ctf';
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabledForFfa}
                  onClick={() => onSelectMode(mode)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    disabledForFfa
                      ? 'border-zinc-800 bg-[#101217] text-zinc-600 cursor-not-allowed'
                      : active
                      ? 'border-amber-500 bg-amber-500/15 text-white'
                      : 'border-zinc-700/80 bg-[#111318] text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="text-xs font-bold whitespace-nowrap">{GAME_MODE_META[mode].name}</div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {disabledForFfa ? '2-Team Modes Only' : GAME_MODE_META[mode].winTarget}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-zinc-400">{GAME_MODE_META[selectedMode].summary}</p>
        </div>

        {/* Arena Map Selector */}
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <label htmlFor="arena-map-select" className="text-xs font-semibold text-zinc-400 whitespace-nowrap">
            Arena Sector
          </label>
          <select
            id="arena-map-select"
            value={selectedMap}
            onChange={(e) => onSelectMap(e.target.value as MapSelection)}
            className="flex-1 rounded-lg border border-zinc-700 bg-[#101217] px-3 py-1.5 text-xs font-medium text-zinc-100 focus:border-amber-500 focus:outline-none"
          >
            <option value="auto">Auto Rotate (All 6 Arenas)</option>
            {MAP_ORDER.map((mid) => (
              <option key={mid} value={mid}>
                {ARENA_MAPS[mid].name} — {MAP_THEME_TINTS[mid].label}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-200"
          >
            {errorMsg}
          </div>
        )}

        {/* Primary Multiplayer Actions */}
        <div className="mt-5 space-y-3">
          <button
            type="button"
            data-start="true"
            disabled={connecting}
            onClick={onHostRoom}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-500 transition-colors disabled:opacity-60"
          >
            <Users className="h-4 w-4" />
            {connecting
              ? 'Connecting to Server...'
              : `Host ${MATCH_FORMAT_META[selectedFormat].name} Room`}
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onJoinRoom();
            }}
            className="flex items-stretch gap-2"
          >
            <label htmlFor="room-code-input" className="sr-only">
              Room Code
            </label>
            <input
              id="room-code-input"
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
              placeholder="ENTER ROOM CODE"
              className="flex-1 rounded-lg border border-zinc-700 bg-[#101217] px-3.5 py-2.5 font-mono-num text-sm font-bold tracking-widest text-zinc-100 placeholder-zinc-500 uppercase focus:border-amber-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={connecting || joinCode.trim().length < 4}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 transition-colors disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              Join Room
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="pt-1 flex justify-center">
            <button
              type="button"
              data-solo="true"
              onClick={onSoloSkirmish}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-amber-300 transition-colors"
            >
              <Bot className="h-3.5 w-3.5" />
              Practice Solo vs Bots ({MATCH_FORMAT_META[selectedFormat].name})
            </button>
          </div>
        </div>
      </main>

      <div className="text-center text-xs text-zinc-400 pb-1">
        WASD Move · Mouse Aim · Click / Space Fire · Shift Dash · M Mute
      </div>
    </div>
  );
};

interface WaitingLobbyProps {
  roomCode: string;
  playerId: PlayerId;
  hostId: PlayerId;
  format: MatchFormat;
  mode: GameMode;
  mapSelection: MapSelection;
  fillBots: boolean;
  players: RoomPlayerInfo[];
  playerName: string;
  onUpdatePlayerName: (name: string) => void;
  errorMsg: string | null;
  onChangeFormat: (format: MatchFormat) => void;
  onChangeMode: (mode: GameMode) => void;
  onChangeMap: (map: MapSelection) => void;
  onToggleFillBots: (fill: boolean) => void;
  onSwitchTeam: (teamId: 1 | 2) => void;
  onToggleReady: (ready: boolean) => void;
  onOpenGarage: () => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export const WaitingLobby: React.FC<WaitingLobbyProps> = ({
  roomCode,
  playerId,
  hostId,
  format,
  mode,
  mapSelection,
  fillBots,
  players,
  playerName,
  onUpdatePlayerName,
  errorMsg,
  onChangeFormat,
  onChangeMode,
  onChangeMap,
  onToggleFillBots,
  onSwitchTeam,
  onToggleReady,
  onOpenGarage,
  onStartMatch,
  onLeaveRoom,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isHost = playerId === hostId;
  const maxPlayers = MATCH_FORMAT_META[format].maxPlayers;

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
      : `?room=${roomCode}`;

  const copyText = (text: string, which: 'link' | 'code') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    if (which === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  const localPlayer = players.find((p) => p.id === playerId);
  const isLocalReady = Boolean(localPlayer?.ready);
  const alphaPlayers = players.filter((p) => p.teamId === 1);
  const bravoPlayers = players.filter((p) => p.teamId === 2);

  const hasEnoughPlayers = fillBots
    ? players.length >= 1
    : format === '2v2'
    ? alphaPlayers.length >= 1 && bravoPlayers.length >= 1
    : players.length >= 2;
  const allGuestsReady = players.filter((p) => !p.isHost).every((p) => p.ready);
  const canLaunch = hasEnoughPlayers && allGuestsReady;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700/90 bg-[#161921] p-6 shadow-2xl">
        {/* Room Code & Invite Share Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {MATCH_FORMAT_META[format].name} Staging Room · {players.length}/{maxPlayers} Connected
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span
                data-testid="room-code-display"
                className="font-mono-num text-3xl font-bold tracking-[0.22em] text-amber-400"
              >
                {roomCode}
              </span>
              <button
                type="button"
                onClick={() => copyText(roomCode, 'code')}
                className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? 'Copied' : 'Copy Code'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => copyText(inviteUrl, 'link')}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/60 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors whitespace-nowrap"
          >
            {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copiedLink ? 'Invite Link Copied' : 'Copy Friend Invite Link'}
          </button>
        </div>

        {/* Local Callsign Quick-Edit */}
        <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-zinc-800 bg-[#111318] px-3.5 py-2.5">
          <label htmlFor="lobby-callsign-input" className="text-xs font-semibold text-zinc-400 whitespace-nowrap">
            Your Callsign
          </label>
          <input
            id="lobby-callsign-input"
            type="text"
            maxLength={18}
            value={playerName}
            onChange={(e) => onUpdatePlayerName(e.target.value)}
            placeholder="Commander"
            className="flex-1 rounded border border-zinc-700 bg-[#161921] px-2.5 py-1 text-xs font-semibold text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onOpenGarage}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-100 hover:border-amber-500 whitespace-nowrap"
          >
            <Wrench className="h-3.5 w-3.5 text-amber-400" />
            Customize Tank
          </button>
        </div>

        {/* Squad / Roster Organization */}
        {format === '2v2' ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { teamId: 1 as const, label: 'Team Alpha (West Spawn)', color: '#3b82f6', list: alphaPlayers },
              { teamId: 2 as const, label: 'Team Bravo (East Spawn)', color: '#ef4444', list: bravoPlayers },
            ].map((team) => {
              const isMyTeam = localPlayer?.teamId === team.teamId;
              const teamFull = team.list.length >= 2;
              return (
                <div
                  key={team.teamId}
                  className="rounded-lg border border-zinc-700/90 bg-[#111318] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="text-xs font-bold text-zinc-100">{team.label}</span>
                    </div>
                    {!isMyTeam && (
                      <button
                        type="button"
                        disabled={teamFull}
                        onClick={() => onSwitchTeam(team.teamId)}
                        className="inline-flex items-center gap-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-200 hover:border-amber-500 disabled:opacity-40"
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                        Join
                      </button>
                    )}
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {[0, 1].map((idx) => {
                      const p = team.list[idx];
                      if (!p) {
                        if (fillBots) {
                          return (
                            <div
                              key={`bot-${team.teamId}-${idx}`}
                              className="flex items-center justify-between gap-2 rounded border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs"
                            >
                              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                                <Bot className="h-3.5 w-3.5" />
                                Sentinel Bot (AI)
                              </span>
                              <span className="text-[10px] font-bold uppercase text-emerald-400">Ready</span>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={`empty-${team.teamId}-${idx}`}
                            className="rounded border border-dashed border-zinc-800 px-3 py-2 text-xs text-zinc-500"
                          >
                            Open {team.teamId === 1 ? 'Alpha' : 'Bravo'} Slot
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`player-${p.id}`}
                          className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-[#161921] px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-3 w-3 shrink-0 rounded-sm"
                              style={{ backgroundColor: PAINT_PALETTES[p.loadout.paint].primary }}
                            />
                            <span className="truncate text-xs font-bold text-zinc-100">
                              {p.name}
                              {p.id === playerId ? ' (You)' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono-num text-[10px] text-zinc-400">
                              {BULLET_UPGRADES[p.loadout.bulletType ?? 'standard'].shortCode} · A{p.loadout.armorLevel}·S{p.loadout.speedLevel}·P{p.loadout.powerLevel}
                            </span>
                            {p.isHost ? (
                              <span className="text-[10px] font-bold uppercase text-amber-400">Host</span>
                            ) : (
                              <span
                                className={`text-[10px] font-bold uppercase ${
                                  p.ready ? 'text-emerald-400' : 'text-zinc-500'
                                }`}
                              >
                                {p.ready ? 'Ready' : 'Not Ready'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: maxPlayers }).map((_, idx) => {
              const slotNum = (idx + 1) as PlayerId;
              const p = players.find((pl) => pl.id === slotNum);
              const isYou = p?.id === playerId;
              return (
                <div
                  key={slotNum}
                  className={`rounded-lg border p-3.5 ${
                    p
                      ? 'border-zinc-700 bg-[#111318]'
                      : 'border-dashed border-zinc-700/70 bg-[#111318]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-400">
                      Commander {slotNum} {p?.isHost ? '· Host' : ''} {isYou ? '· You' : ''}
                    </span>
                    {p && !p.isHost && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase ${
                          p.ready ? 'text-emerald-400' : 'text-zinc-400'
                        }`}
                      >
                        {p.ready ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Ready
                          </>
                        ) : (
                          <>
                            <Clock className="h-3.5 w-3.5" />
                            Not Ready
                          </>
                        )}
                      </span>
                    )}
                    {p?.isHost && (
                      <span className="text-[11px] font-bold uppercase text-amber-400">Host</span>
                    )}
                  </div>
                  {p ? (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-sm"
                          style={{ backgroundColor: PAINT_PALETTES[p.loadout.paint].primary }}
                        />
                        <span className="text-sm font-bold text-zinc-100">{p.name}</span>
                      </div>
                      <div className="mt-1.5 font-mono-num text-[11px] text-zinc-400">
                        {BULLET_UPGRADES[p.loadout.bulletType ?? 'standard'].name} · A{p.loadout.armorLevel}·S{p.loadout.speedLevel}·P{p.loadout.powerLevel}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 text-xs">
                      {fillBots ? (
                        <div className="flex items-center justify-between gap-2 text-amber-300 font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5" />
                            {maxPlayers === 2 ? 'Sentinel Bot' : `Bot ${slotNum}`} (AI)
                          </span>
                          <span className="text-[10px] font-bold uppercase text-emerald-400">Ready</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500">
                          Waiting for player to join via invite link...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Format, Mode & Map Selection (Host controls) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-xs font-semibold text-zinc-400 mb-1.5">
              Squad Format {!isHost ? '(Host)' : ''}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['1v1', '2v2', 'ffa'] as MatchFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={!isHost}
                  onClick={() => onChangeFormat(f)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    format === f
                      ? 'border-amber-500 bg-amber-500/15 text-white'
                      : 'border-zinc-700/80 bg-[#111318] text-zinc-400'
                  } ${isHost ? 'hover:border-zinc-500' : 'cursor-default'}`}
                >
                  {f === 'ffa' ? '4P FFA' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-400 mb-1.5">
              Match Mode {!isHost ? '(Host)' : ''}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['deathmatch', 'koth', 'ctf'] as GameMode[]).map((m) => {
                const disabled = !isHost || (format === 'ffa' && m === 'ctf');
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChangeMode(m)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                      format === 'ffa' && m === 'ctf'
                        ? 'border-zinc-800 bg-[#101217] text-zinc-600 cursor-not-allowed'
                        : mode === m
                        ? 'border-amber-500 bg-amber-500/15 text-white'
                        : 'border-zinc-700/80 bg-[#111318] text-zinc-400'
                    } ${!disabled ? 'hover:border-zinc-500' : ''}`}
                  >
                    {m === 'deathmatch' ? 'DM' : m === 'koth' ? 'KOTH' : 'CTF'}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="lobby-map-select" className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Arena Sector {!isHost ? '(Host)' : ''}
            </label>
            <select
              id="lobby-map-select"
              disabled={!isHost}
              value={mapSelection}
              onChange={(e) => onChangeMap(e.target.value as MapSelection)}
              className="w-full rounded-lg border border-zinc-700 bg-[#111318] px-2.5 py-1.5 text-xs font-semibold text-zinc-100 focus:border-amber-500 focus:outline-none disabled:opacity-75"
            >
              <option value="auto">Auto Rotate (6 Maps)</option>
              {MAP_ORDER.map((mid) => (
                <option key={mid} value={mid}>
                  {ARENA_MAPS[mid].name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bot Fill Option */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-[#111318] px-3.5 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="text-xs font-medium text-zinc-300">
              Fill empty slots with AI bots {!isHost ? '(Host setting)' : ''}
            </span>
          </div>
          <button
            type="button"
            disabled={!isHost}
            data-testid="fill-bots-toggle"
            aria-pressed={fillBots}
            onClick={() => onToggleFillBots(!fillBots)}
            className={`rounded-md border px-3 py-1 text-xs font-bold transition-colors shrink-0 ${
              fillBots
                ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                : 'border-zinc-700 bg-zinc-800 text-zinc-400'
            } ${isHost ? 'hover:border-amber-400' : 'opacity-75 cursor-default'}`}
          >
            {fillBots ? 'Bots: ON' : 'Bots: OFF'}
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
          >
            Leave Room
          </button>

          {isHost ? (
            <button
              type="button"
              disabled={!canLaunch}
              onClick={onStartMatch}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-500 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Play className="h-4 w-4" />
              {!hasEnoughPlayers
                ? 'Waiting for Players...'
                : !allGuestsReady
                ? 'Waiting for Ready...'
                : 'Start Match'}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {isLocalReady && (
                <span className="text-xs font-medium text-emerald-300">
                  Ready — waiting for Host to start
                </span>
              )}
              <button
                type="button"
                data-testid="ready-toggle-btn"
                onClick={() => onToggleReady(!isLocalReady)}
                className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors ${
                  isLocalReady
                    ? 'border border-emerald-500 bg-emerald-600/25 text-emerald-200 hover:bg-emerald-600/35'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {isLocalReady ? 'Ready ✓ (Cancel)' : 'Ready Up'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export interface InviteRoomPreview {
  exists: boolean;
  format?: MatchFormat;
  mode?: GameMode;
  players?: number;
  maxPlayers?: number;
  message?: string;
}

interface InviteJoinModalProps {
  roomCode: string;
  roomInfo: InviteRoomPreview | null;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  loadout: TankLoadout;
  connecting: boolean;
  errorMsg: string | null;
  onOpenGarage: () => void;
  onConfirmJoin: () => void;
  onCancel: () => void;
}

export const InviteJoinModal: React.FC<InviteJoinModalProps> = ({
  roomCode,
  roomInfo,
  playerName,
  onPlayerNameChange,
  loadout,
  connecting,
  errorMsg,
  onOpenGarage,
  onConfirmJoin,
  onCancel,
}) => {
  const palette = PAINT_PALETTES[loadout.paint];
  const bullet = BULLET_UPGRADES[loadout.bulletType ?? 'standard'];
  const decalName = DECAL_OPTIONS.find((d) => d.id === loadout.decal)?.name ?? 'Clean Hull';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-join-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700/90 bg-[#161921] p-6 shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Multiplayer Room Invite
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h2 id="invite-join-title" className="font-display text-2xl font-bold tracking-wide text-zinc-100">
            Configure Before Joining
          </h2>
          <span className="font-mono-num rounded border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-sm font-bold tracking-widest text-amber-300">
            {roomCode}
          </span>
        </div>

        {roomInfo && roomInfo.exists && roomInfo.format && roomInfo.mode && (
          <div className="mt-2 text-xs text-zinc-400">
            {MATCH_FORMAT_META[roomInfo.format].name} · {GAME_MODE_META[roomInfo.mode].name} ·{' '}
            {roomInfo.players}/{roomInfo.maxPlayers} Connected
          </div>
        )}
        {roomInfo && !roomInfo.exists && (
          <div className="mt-2 rounded border border-red-500/50 bg-red-950/50 px-3 py-1.5 text-xs text-red-200">
            {roomInfo.message || `Room ${roomCode} was not found or has already closed.`}
          </div>
        )}

        {/* Callsign Input */}
        <div className="mt-4">
          <label htmlFor="invite-callsign-input" className="block text-xs font-semibold text-zinc-400 mb-1.5">
            Commander Callsign
          </label>
          <input
            id="invite-callsign-input"
            type="text"
            maxLength={18}
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            placeholder="Commander"
            className="w-full rounded-lg border border-zinc-700 bg-[#101217] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Tank Summary + Customize CTA */}
        <div className="mt-4 rounded-lg border border-zinc-700/80 bg-[#111318] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Your Tank Loadout
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/40"
                  style={{ backgroundColor: palette.primary }}
                />
                <span className="truncate text-sm font-bold text-zinc-100">{palette.name}</span>
              </div>
              <div className="mt-1 font-mono-num text-[11px] text-zinc-400">
                {bullet.name} · {decalName} · A{loadout.armorLevel}·S{loadout.speedLevel}·P{loadout.powerLevel}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenGarage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-amber-500 hover:bg-zinc-700 transition-colors shrink-0"
            >
              <Wrench className="h-3.5 w-3.5 text-amber-400" />
              Customize Tank
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-200"
          >
            {errorMsg}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
          >
            Back to Menu
          </button>
          <button
            type="button"
            disabled={connecting || (roomInfo !== null && !roomInfo.exists)}
            onClick={onConfirmJoin}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-500 transition-colors disabled:opacity-50"
          >
            {connecting ? 'Joining...' : 'Enter Staging Room'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
