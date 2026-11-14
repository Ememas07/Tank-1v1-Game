export const SYNC_TAG_READY = '~R';
export const SYNC_TAG_BOTS = '~B';
export const SYNC_READY_MARKER = '\u200B';
export const SYNC_BOTS_MARKER = '\u200C';

/**
 * Strips synchronization characters (both ASCII tags and zero-width markers) from a player name.
 */
export function cleanPlayerName(name?: string | null): string {
  if (!name) return '';
  return name
    .replace(/~[RB]/g, '')
    .replace(/[\u200B\u200C]/g, '')
    .trim();
}

/**
 * Encodes readiness and bot-fill preference into the player name.
 * Uses both pure ASCII delimiters (~R, ~B) and zero-width Unicode markers for 100% resilience across all networks and browsers.
 * Truncates baseName to max 12 chars so the total length never exceeds 18 chars.
 */
export function encodeSyncPlayerName(
  baseName: string,
  isReady: boolean,
  fillBots: boolean = false,
  maxLength: number = 18
): string {
  const maxBase = Math.max(1, maxLength - 6); // 18 - 6 = 12
  const clean = cleanPlayerName(baseName).slice(0, maxBase) || 'Commander';
  const readyPart = isReady ? `${SYNC_TAG_READY}${SYNC_READY_MARKER}` : '';
  const botsPart = fillBots ? `${SYNC_TAG_BOTS}${SYNC_BOTS_MARKER}` : '';
  return `${clean}${readyPart}${botsPart}`;
}

/**
 * Parses player readiness from native boolean, ASCII tag, or zero-width marker.
 */
export function parsePlayerReady(name?: string | null, nativeReady?: boolean): boolean {
  if (typeof nativeReady === 'boolean') return nativeReady;
  if (!name || typeof name !== 'string') return false;
  return name.includes(SYNC_TAG_READY) || name.includes(SYNC_READY_MARKER);
}

/**
 * Parses host's bot-fill preference from native boolean, ASCII tag, or zero-width marker.
 */
export function parseHostFillBots(hostName?: string | null, nativeFillBots?: boolean): boolean {
  if (typeof nativeFillBots === 'boolean') return nativeFillBots;
  if (!hostName || typeof hostName !== 'string') return false;
  return hostName.includes(SYNC_TAG_BOTS) || hostName.includes(SYNC_BOTS_MARKER);
}
