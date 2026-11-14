export const SYNC_READY_MARKER = '\u200B';
export const SYNC_BOTS_MARKER = '\u200C';

/**
 * Strips zero-width synchronization characters from a player name.
 */
export function cleanPlayerName(name?: string | null): string {
  if (!name) return '';
  return name.replace(/[\u200B\u200C]/g, '').trim();
}

/**
 * Encodes readiness and bot-fill preference into the player name using zero-width characters.
 * Ensures the resulting string never exceeds maxLength (default 18).
 */
export function encodeSyncPlayerName(
  baseName: string,
  isReady: boolean,
  fillBots: boolean = false,
  maxLength: number = 18
): string {
  const clean = cleanPlayerName(baseName).slice(0, Math.max(1, maxLength - 2)) || 'Commander';
  return `${clean}${isReady ? SYNC_READY_MARKER : ''}${fillBots ? SYNC_BOTS_MARKER : ''}`;
}

/**
 * Parses player readiness from native boolean or encoded name marker.
 */
export function parsePlayerReady(name?: string | null, nativeReady?: boolean): boolean {
  if (typeof nativeReady === 'boolean') return nativeReady;
  return typeof name === 'string' && name.includes(SYNC_READY_MARKER);
}

/**
 * Parses host's bot-fill preference from native boolean or encoded host name marker.
 */
export function parseHostFillBots(hostName?: string | null, nativeFillBots?: boolean): boolean {
  if (typeof nativeFillBots === 'boolean') return nativeFillBots;
  return typeof hostName === 'string' && hostName.includes(SYNC_BOTS_MARKER);
}
