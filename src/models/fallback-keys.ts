import type { MudletFont, MudletMapHeader, MudletRoom } from '../types';

/**
 * Mudlet's `system.fallback_*` user-data keys.
 *
 * When Mudlet saves a map in a format older than the one that carries a field
 * natively, it copies that field into user data under a `system.fallback_*`
 * key so an older client still sees the value; on load it takes the key back
 * out. Two rules follow, and this module implements both (mirroring
 * `TRoom::restore` and `TMap::restore`):
 *
 * - below the version that carries the field natively: recover the value from
 *   the key, then remove it
 * - at or above that version: the stream is authoritative, so a key that is
 *   still present is a stale leak from an older save — remove it unread
 *
 * The stale-key cleanup only reached Mudlet in 2026 (PR #9469); every earlier
 * version loaded such keys and wrote them straight back, so real files do
 * carry them. Stripping them here is what keeps our model equal to the one
 * Mudlet holds in memory — and keeps a map we write from re-introducing keys
 * the next Mudlet load would drop, which shows up as a phantom diff.
 */

/** Carries a room's symbol for formats before 19 (v19 stores a QString). */
const ROOM_SYMBOL_KEY = 'system.fallback_symbol';

/** Carry the map symbol font settings for formats before 19. */
const MAP_FONT_KEY = 'system.fallback_mapSymbolFont';
const MAP_FONT_FUDGE_KEY = 'system.fallback_mapSymbolFontFudgeFactor';
const MAP_ONLY_FONT_KEY = 'system.fallback_onlyUseMapSymbolFont';

/** The format version from which the field is stored in the stream itself. */
const NATIVE_SYMBOL_VERSION = 19;
const NATIVE_MAP_FONT_VERSION = 19;

/** Read a key and remove it, mirroring Qt's `QMap::take`. */
function take(userData: Record<string, string>, key: string): string | undefined {
  const value = userData[key];
  delete userData[key];
  return value;
}

/**
 * QFont bit flags, as packed into the byte `QFont`'s QDataStream operator
 * writes. Only the four that `QFont::toString()` carries are set from a
 * fallback string; the rest keep whatever the base font had.
 */
const FONT_BIT = {
  italic: 0x01,
  underline: 0x02,
  strikeOut: 0x04,
  fixedPitch: 0x08,
  oblique: 0x80,
} as const;

/** `QFont::Style` value for oblique, as serialised by `QFont::toString()`
 * (0 normal, 1 italic, 2 oblique — anything non-zero sets the italic bit). */
const STYLE_OBLIQUE = 2;

/**
 * Rebuild a font from a `QFont::toString()` description, over a base font
 * supplying everything the description does not carry (style strategy,
 * stretch, spacing, …) — the same shape as Qt's `QFont::fromString()` over a
 * default-constructed font.
 *
 * Only the first ten comma-separated fields are read, and this is not
 * defensive trimming: `QFont::toString()`/`fromString()` round-tripping in
 * older Qt duplicated the trailing nine fields on every cycle, so a map saved
 * repeatedly grows a description hundreds of fields long. Mudlet applies the
 * same `mid(0, 10)` cut for exactly this reason.
 *
 * Returns `undefined` for a description too short to be a font.
 */
export function fontFromString(description: string, base: MudletFont): MudletFont | undefined {
  const fields = description.split(',').slice(0, 10);
  if (fields.length < 10) return undefined;

  const [family, pointSize, pixelSize, styleHint, weight, style, underline, strikeOut, fixedPitch] =
    fields;

  const italic = Number(style) !== 0;
  const oblique = Number(style) === STYLE_OBLIQUE;
  const isSet = (field: string) => Number(field) !== 0;

  let fontBits = base.fontBits;
  const setBit = (bit: number, on: boolean) => {
    fontBits = on ? fontBits | bit : fontBits & ~bit;
  };
  setBit(FONT_BIT.italic, italic);
  setBit(FONT_BIT.oblique, oblique);
  setBit(FONT_BIT.underline, isSet(underline));
  setBit(FONT_BIT.strikeOut, isSet(strikeOut));
  setBit(FONT_BIT.fixedPitch, isSet(fixedPitch));

  return {
    ...base,
    family,
    pointSize: Number(pointSize),
    pixelSize: Number(pixelSize),
    styleHint: Number(styleHint),
    weight: Number(weight),
    fontBits,
    styleSetting: italic,
    styleOblique: oblique,
    underline: isSet(underline),
    strikeOut: isSet(strikeOut),
    fixedPitch: isSet(fixedPitch),
  };
}

/**
 * Apply — or strip — a room's symbol fallback, mirroring `TRoom::restore`.
 * Before v19 the stream holds a single byte, so the real (multi-character or
 * non-ASCII) symbol lives in the fallback key; from v19 the stream holds the
 * QString and the key is stale.
 */
export function applyRoomFallbacks(room: MudletRoom, version: number): void {
  const userData = room.userData;
  if (!userData) return;

  if (version >= NATIVE_SYMBOL_VERSION) {
    delete userData[ROOM_SYMBOL_KEY];
    return;
  }

  const symbol = take(userData, ROOM_SYMBOL_KEY);
  if (symbol) room.symbol = symbol;
}

/**
 * Apply — or strip — the map symbol font fallbacks, mirroring `TMap::restore`.
 * Before v19 the font, its fudge factor and the only-use-this-font flag are
 * carried in map user data; from v19 all three are in the stream.
 *
 * The caller is expected to have populated `mapSymbolFont` already (with the
 * stream's value, or a default for versions that carry none) — recovered
 * fields are layered over it.
 */
export function applyMapFallbacks(header: MudletMapHeader, version: number): void {
  const userData = header.mUserData;
  if (!userData) return;

  if (version >= NATIVE_MAP_FONT_VERSION) {
    delete userData[MAP_FONT_KEY];
    delete userData[MAP_FONT_FUDGE_KEY];
    delete userData[MAP_ONLY_FONT_KEY];
    return;
  }

  const description = take(userData, MAP_FONT_KEY);
  const fudgeFactor = take(userData, MAP_FONT_FUDGE_KEY);
  const onlyUseMapFont = take(userData, MAP_ONLY_FONT_KEY);

  if (description) {
    const font = fontFromString(description, header.mapSymbolFont);
    if (font) header.mapSymbolFont = font;
  }
  if (fudgeFactor) header.mapFontFudgeFactor = Number(fudgeFactor);
  if (onlyUseMapFont) header.useOnlyMapFont = onlyUseMapFont.toLowerCase() === 'true';
}
