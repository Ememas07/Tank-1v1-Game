import React from 'react';
import { Home, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { RoomChatPanel } from './RoomChatPanel';
import type { ChatMessage, PlayerId } from '../game/types';

interface PauseMenuModalProps {
  isSoloMode: boolean;
  roomCode: string | null;
  muted: boolean;
  localPlayerId: PlayerId;
  chatMessages: ChatMessage[];
  onResume: () => void;
  onToggleMute: () => void;
  onRestartSolo: () => void;
  onLeaveMatch: () => void;
  onSendChat: (text: string) => void;
}

export const PauseMenuModal: React.FC<PauseMenuModalProps> = ({
  isSoloMode,
  roomCode,
  muted,
  localPlayerId,
  chatMessages,
  onResume,
  onToggleMute,
  onRestartSolo,
  onLeaveMatch,
  onSendChat,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-heading"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl border border-zinc-700 bg-[#161921] p-6 text-center shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          {isSoloMode ? 'Solo Skirmish' : `Multiplayer Room ${roomCode ?? ''}`}
        </div>
        <h2
          id="pause-heading"
          className="mt-1 font-display text-3xl font-extrabold tracking-wide text-zinc-100"
        >
          {isSoloMode ? 'MATCH PAUSED' : 'MATCH MENU'}
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          {isSoloMode
            ? 'Simulation is paused. Press Esc or Resume to return.'
            : 'Live multiplayer arena continues while menu is open.'}
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-500 transition-colors"
          >
            <Play className="h-4 w-4" />
            Resume Match (Esc)
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {muted ? 'Audio: Muted (M)' : 'Audio: Enabled (M)'}
          </button>

          {isSoloMode && (
            <button
              type="button"
              onClick={onRestartSolo}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Restart Skirmish
            </button>
          )}

          <button
            type="button"
            onClick={onLeaveMatch}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-800/70 bg-red-950/60 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/60 transition-colors"
          >
            <Home className="h-4 w-4" />
            Leave Match
          </button>

          <a
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            Exit to AI Studio Hub
          </a>
        </div>

        {!isSoloMode && (
          <div className="mt-4">
            <RoomChatPanel
              messages={chatMessages}
              localPlayerId={localPlayerId}
              onSend={onSendChat}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
};
