import React, { useEffect, useId, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { PAINT_PALETTES } from '../game/customization';
import { cleanPlayerName } from '../game/sync';
import type { ChatMessage, PlayerId } from '../game/types';

interface RoomChatPanelProps {
  messages: ChatMessage[];
  localPlayerId: PlayerId;
  onSend: (text: string) => void;
  compact?: boolean;
}

export const RoomChatPanel: React.FC<RoomChatPanelProps> = ({
  messages,
  localPlayerId,
  onSend,
  compact = false,
}) => {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputId = useId();

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    onSend(clean);
    setDraft('');
  };

  return (
    <div
      data-testid="room-chat-panel"
      className={`flex flex-col rounded-lg border border-zinc-700/80 bg-[#111318] ${
        compact ? 'p-3' : 'p-3.5 h-full'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
          <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
          <span>Squad Comms</span>
        </div>
        <span className="font-mono-num text-[10px] text-zinc-500">
          {messages.length} msg{messages.length === 1 ? '' : 's'}
        </span>
      </div>

      <div
        ref={listRef}
        data-testid="room-chat-list"
        className={`mt-2 flex-1 overflow-y-auto space-y-1.5 pr-1 text-left ${
          compact ? 'h-28' : 'min-h-[140px] max-h-[300px] lg:max-h-none'
        }`}
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[72px] items-center justify-center text-center text-xs text-zinc-500">
            No messages yet. Coordinate tactics here.
          </div>
        ) : (
          messages.map((m) => {
            const swatch = PAINT_PALETTES[m.paint]?.primary ?? '#94a3b8';
            const isLocal = m.playerId === localPlayerId;
            return (
              <div
                key={m.id}
                className="rounded bg-[#161921] px-2.5 py-1.5 text-xs leading-snug border border-zinc-800/80"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: swatch }}
                  />
                  <span
                    className={`font-bold truncate ${
                      isLocal ? 'text-amber-300' : 'text-zinc-200'
                    }`}
                  >
                    {cleanPlayerName(m.playerName) || `Commander ${m.playerId}`}
                    {isLocal ? ' (You)' : ''}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-zinc-300">{m.text}</p>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-2.5 flex items-center gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Chat message
        </label>
        <input
          id={inputId}
          type="text"
          maxLength={180}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message squad..."
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-[#161921] px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          aria-label="Send chat message"
          className="inline-flex h-7 w-8 shrink-0 items-center justify-center rounded bg-amber-600 text-white hover:bg-amber-500 transition-colors disabled:opacity-45"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
};
