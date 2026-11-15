export const SYNC_TAG_READY = '~R';
export const SYNC_TAG_BOTS = '~B';
export const SYNC_READY_MARKER = '\u200B';
export const SYNC_BOTS_MARKER = '\u200C';

/**
 * Checks if a name payload represents an in-band chat packet.
 */
export function isInBandChat(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false;
  return name.startsWith('!c:') || /^![a-z0-9]{4}:/i.test(name);
}

/**
 * Strips synchronization characters (both ASCII tags and zero-width markers) from a player name.
 */
export function cleanPlayerName(name?: string | null): string {
  if (!name) return '';
  if (isInBandChat(name)) return '';
  return name
    .replace(/~[RB]/gi, '')
    .replace(/[\u200B\u200C\uFEFF]/g, '')
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
  return name.toUpperCase().includes('~R') || name.includes(SYNC_READY_MARKER);
}

/**
 * Parses host's bot-fill preference from native boolean, ASCII tag, or zero-width marker.
 */
export function parseHostFillBots(hostName?: string | null, nativeFillBots?: boolean): boolean {
  if (typeof nativeFillBots === 'boolean') return nativeFillBots;
  if (!hostName || typeof hostName !== 'string') return false;
  return hostName.toUpperCase().includes('~B') || hostName.includes(SYNC_BOTS_MARKER);
}

/**
 * Encodes a chat message into chunked in-band name packets (max 18 chars per packet).
 * Protects spaces at boundaries using trailing '|' against server-side .trim().
 */
export function encodeInBandChatPackets(msgId: string, text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= 14) {
    return [`!c:${clean}|`];
  }
  const chunkSize = 11;
  const total = Math.ceil(clean.length / chunkSize);
  const packets: string[] = [];
  const safeId = (msgId || 'm1').slice(0, 2).toLowerCase().padStart(2, 'x');
  for (let i = 0; i < total; i++) {
    const chunk = clean.slice(i * chunkSize, (i + 1) * chunkSize);
    const seq = (i + 1).toString(36);
    const tot = total.toString(36);
    packets.push(`!${safeId}${seq}${tot}:${chunk}|`);
  }
  return packets;
}
