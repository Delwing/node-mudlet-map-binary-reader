import {
  QBool,
  QClass,
  QUserType,
  qtype,
  QInt,
  QUInt,
  QDouble,
} from 'qtdatastream-web/types';
import type { ReadBuffer } from 'qtdatastream-web';
import { registerBaseTypes, Types } from './base-types';
import { createMudletLabels, createMudletRooms, createMudletAreas } from './mudlet-types';
import { QList, QMap, QPair, QMultiMap } from './qstream-containers';
import { QString, QColor, QPoint } from './qstream-types';
import { registerMapModel } from './model-registry';
import { applyMapFallbacks, applyRoomFallbacks } from './fallback-keys';
import type { MudletColor, MudletFont, MudletMap, MudletMapHeader, MudletRoom } from '../types';

// ---------------------------------------------------------------------------
// Mudlet map formats, versions 16-19 (read-only).
//
// These older formats differ from v20 in a handful of fields. Rather than copy
// the whole v20 module four times, this builder takes a per-version config of
// the deltas and registers a read-only MapModel. The deltas mirror the
// version-gated branches in Mudlet's C++ TMap::restore / TRoom::restore /
// TArea operator>> exactly:
//
//   * mUserData (map-level)   : v17+         (absent in v16)
//   * map symbol font fields  : v19+         (absent in v16-v18)
//   * mRoomIdHash             : QMap in v18+, a single legacy int in v16-v17
//   * area per-Z extent maps  : 4 maps in v17+, 6 (2 unused) in v16
//   * area userData           : v17+         (absent in v16)
//   * room.symbol             : QString in v19+, a single qint8 char in v16-v18
//   * room.customLinesColor   : QColor in v20, QList<int> (RGB) in v16-v19
//   * room.customLinesStyle   : QUInt in v20, QString style-name in v16-v19
//
// Writing these versions is intentionally unsupported: Mudlet only ever saves
// the newest format, so a round-trip would have to be lossy. writeMap throws.
// ---------------------------------------------------------------------------

registerBaseTypes();

// Qt pen styles, mirroring the QString -> Qt::PenStyle mapping in TRoom::restore
// for pre-v20 maps. Values match Qt::PenStyle (SolidLine = 1 ... DashDotDotLine = 5).
const PEN_STYLE: Record<string, number> = {
  'dot line': 3,
  'dash line': 2,
  'dash dot line': 4,
  'dash dot dot line': 5,
};

// Pre-v20 maps stored custom-line keys for the standard exits in upper case
// (N, NE, UP, ...). Mudlet lower-cases those known direction tokens while
// loading (TRoom::restore); special-exit command keys are left untouched.
// Downstream (e.g. json-export) indexes custom lines by these lower-case short
// names, so legacy maps must be normalized the same way or their custom lines
// lose their color/style/arrow on export.
const LEGACY_DIRECTION_KEYS: Record<string, string> = {
  N: 'n',
  E: 'e',
  S: 's',
  W: 'w',
  UP: 'up',
  DOWN: 'down',
  NE: 'ne',
  SE: 'se',
  SW: 'sw',
  NW: 'nw',
  IN: 'in',
  OUT: 'out',
};

/** Lower-case known direction keys, mirroring Mudlet's legacy custom-line load. */
function normalizeDirectionKeys<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(record)) {
    out[LEGACY_DIRECTION_KEYS[key] ?? key] = record[key];
  }
  return out;
}

// A neutral default map symbol font for versions (v16-v18) that don't store one.
// Mudlet itself falls back to extracting these from userData keys; we surface a
// sane stand-in so downstream consumers (e.g. JSON export) always have a font.
const DEFAULT_FONT: MudletFont = {
  family: 'Bitstream Vera Sans Mono',
  style: '',
  pointSize: 10,
  pixelSize: -1,
  styleHint: 0,
  styleStrategy: 0,
  weight: 50,
  fontBits: 0,
  stretch: 0,
  extendedFontBits: 0,
  letterSpacing: 0,
  wordSpacing: 0,
  hintingPreference: 0,
  capital: 0,
  styleSetting: false,
  underline: false,
  overline: false,
  strikeOut: false,
  fixedPitch: true,
  kerning: false,
  styleOblique: false,
  ignorePitch: false,
  letterSpacingIsAbsolute: false,
};

/** Reads a v16-v18 room symbol: a single signed byte (Qt qint8 char code). */
class QSymbolByte extends QClass {
  static override read(buffer: ReadBuffer): string {
    const code = buffer.readInt8();
    // Mudlet keeps codes <= 32 (control/space) as "no symbol".
    return code > 32 ? String.fromCodePoint(code) : '';
  }

  override toBuffer(): Uint8Array {
    throw new Error('writing legacy Mudlet map versions is not supported');
  }
}

/** Reads a pre-v20 custom-line colour: a QList<int> of [r, g, b] -> MudletColor. */
class QColorFromIntList extends QClass {
  static override read(buffer: ReadBuffer): MudletColor {
    const count = QUInt.read(buffer);
    const channels: number[] = [];
    for (let i = 0; i < count; i++) {
      channels.push(QInt.read(buffer));
    }
    // C++ only keeps lists with >= 3 entries; missing colours default to red.
    if (channels.length >= 3) {
      return { spec: 1, alpha: 255, r: channels[0], g: channels[1], b: channels[2], pad: 0 };
    }
    return { spec: 1, alpha: 255, r: 255, g: 0, b: 0, pad: 0 };
  }

  override toBuffer(): Uint8Array {
    throw new Error('writing legacy Mudlet map versions is not supported');
  }
}

/** Reads a pre-v20 custom-line style: a QString style-name -> Qt::PenStyle int. */
class QStyleFromString extends QClass {
  static override read(buffer: ReadBuffer): number {
    const name = QString.read(buffer) as unknown as string;
    return PEN_STYLE[name] ?? 1; // default Qt::SolidLine
  }

  override toBuffer(): Uint8Array {
    throw new Error('writing legacy Mudlet map versions is not supported');
  }
}

/**
 * Reads the pre-v18 mRoomIdHash: a single legacy "current room" int. The
 * profile name it was keyed by in C++ isn't in the stream, so the value can't
 * be reattached meaningfully — we consume the int and surface an empty map.
 */
class QLegacyRoomId extends QClass {
  static override read(buffer: ReadBuffer): Record<string, number> {
    QInt.read(buffer);
    return {};
  }

  override toBuffer(): Uint8Array {
    throw new Error('writing legacy Mudlet map versions is not supported');
  }
}

// Shared Qt type ids for the legacy-only value readers above. Registered once.
const LEGACY_TYPE = {
  SYMBOL_BYTE: 300,
  COLOR_INTLIST: 301,
  STYLE_STRING: 302,
  ROOM_ID: 303,
} as const;

let legacyTypesRegistered = false;
function registerLegacyValueTypes(): void {
  if (legacyTypesRegistered) return;
  legacyTypesRegistered = true;
  qtype(LEGACY_TYPE.SYMBOL_BYTE)(QSymbolByte);
  qtype(LEGACY_TYPE.COLOR_INTLIST)(QColorFromIntList);
  qtype(LEGACY_TYPE.STYLE_STRING)(QStyleFromString);
  qtype(LEGACY_TYPE.ROOM_ID)(QLegacyRoomId);
}

interface LegacyConfig {
  /** Map-level user data exists (v17+). */
  hasMapUserData: boolean;
  /** Map symbol font / fudge factor / only-font flag exist (v19+). */
  hasMapFont: boolean;
  /** mRoomIdHash is a real QMap (v18+) vs a single legacy int (v16-v17). */
  modernRoomIdHash: boolean;
  /** Area stores 4 per-Z extent maps + userData (v17+) vs 6 maps, no userData (v16). */
  modernArea: boolean;
  /** room.symbol is a QString (v19+) vs a single qint8 char (v16-v18). */
  stringSymbol: boolean;
}

const CONFIGS: Record<number, LegacyConfig> = {
  16: { hasMapUserData: false, hasMapFont: false, modernRoomIdHash: false, modernArea: false, stringSymbol: false },
  17: { hasMapUserData: true, hasMapFont: false, modernRoomIdHash: false, modernArea: true, stringSymbol: false },
  18: { hasMapUserData: true, hasMapFont: false, modernRoomIdHash: true, modernArea: true, stringSymbol: false },
  19: { hasMapUserData: true, hasMapFont: true, modernRoomIdHash: true, modernArea: true, stringSymbol: true },
};

/**
 * Backfill header-level (non-room) fields this version's layout doesn't
 * carry, so the canonical `MudletMapHeader`/`MudletMap` is always fully
 * populated for downstream consumers. Shared by the full `read` and the
 * streaming `readHeader`.
 */
function backfillHeader(
  header: MudletMapHeader & Record<string, unknown>,
  cfg: LegacyConfig,
  version: number
): void {
  if (!cfg.hasMapUserData) header.mUserData = {};
  if (!cfg.hasMapFont) {
    // A stand-in only: v17/v18 carry the real font in the map user data, which
    // applyMapFallbacks layers over these defaults below (v16 has no map user
    // data at all, so there the stand-in is all there is).
    header.mapSymbolFont = { ...DEFAULT_FONT };
    header.mapFontFudgeFactor = 1.0;
    header.useOnlyMapFont = false;
  }
  applyMapFallbacks(header, version);
  if (!cfg.modernArea) {
    for (const value of Object.values(header.areas)) {
      const area = value as unknown as Record<string, unknown>;
      delete area.legacyForZUnused1;
      delete area.legacyForZUnused2;
      area.userData = {};
    }
  }
}

/**
 * Backfill a single room's fields this version's layout doesn't carry.
 * Shared by the full `read` and the streaming `readRoom`.
 */
function backfillRoom(room: MudletRoom & Record<string, unknown>, version: number): void {
  // v16-v18 carried the real (non-ASCII / multi-char) symbol in userData and
  // overrode the qint8 char after reading it; v19 carries it in the stream and
  // any copy left in userData is stale. applyRoomFallbacks handles both.
  applyRoomFallbacks(room, version);
  // Lower-case the legacy upper-case direction keys so all four
  // custom-line maps line up with how consumers index them.
  room.customLines = normalizeDirectionKeys(room.customLines);
  room.customLinesArrow = normalizeDirectionKeys(room.customLinesArrow);
  room.customLinesColor = normalizeDirectionKeys(room.customLinesColor);
  room.customLinesStyle = normalizeDirectionKeys(room.customLinesStyle);
}

/**
 * Register a read-only MapModel for one of the legacy versions 16-19. Each
 * version gets its own version-qualified QUserType names and Qt container ids
 * so the global registry never clobbers another version (including v20).
 */
export function registerLegacyMapModel(version: number): void {
  const cfg = CONFIGS[version];
  if (!cfg) throw new Error(`No legacy config for Mudlet map version ${version}`);

  registerLegacyValueTypes();

  const TYPE = {
    MAP: `MudletMap@${version}`,
    HEADER: `MudletMapHeader@${version}`,
    AREA: `MudletArea@${version}`,
    ROOM: `MudletRoom@${version}`,
    LABEL: `MudletLabel@${version}`,
  };

  // Per-version Qt container ids (e.g. 160/161/162 for v16) so each version's
  // label/room/area containers resolve their own nested version-qualified type.
  const CONTAINER = {
    LABELS: version * 10,
    ROOMS: version * 10 + 1,
    AREAS: version * 10 + 2,
  };

  qtype(CONTAINER.LABELS)(createMudletLabels(TYPE.LABEL));
  qtype(CONTAINER.ROOMS)(createMudletRooms(TYPE.ROOM));
  qtype(CONTAINER.AREAS)(createMudletAreas(TYPE.AREA));

  // --- Area -------------------------------------------------------------
  const areaFields: Record<string, number>[] = [
    { rooms: QList(QUInt) },
    { zLevels: QList(QInt) },
    { mAreaExits: QMultiMap(QInt, QPair(QInt, QInt)) },
    { gridMode: Types.BOOL },
    { max_x: Types.INT },
    { max_y: Types.INT },
    { max_z: Types.INT },
    { min_x: Types.INT },
    { min_y: Types.INT },
    { min_z: Types.INT },
    { span: Types.VECTOR },
  ];
  if (cfg.modernArea) {
    areaFields.push(
      { xmaxForZ: QMap(QInt, QInt) },
      { ymaxForZ: QMap(QInt, QInt) },
      { xminForZ: QMap(QInt, QInt) },
      { yminForZ: QMap(QInt, QInt) }
    );
  } else {
    // v16 interleaves two unused QMap<int,int> blocks between the extents.
    areaFields.push(
      { xmaxForZ: QMap(QInt, QInt) },
      { ymaxForZ: QMap(QInt, QInt) },
      { legacyForZUnused1: QMap(QInt, QInt) },
      { xminForZ: QMap(QInt, QInt) },
      { yminForZ: QMap(QInt, QInt) },
      { legacyForZUnused2: QMap(QInt, QInt) }
    );
  }
  areaFields.push({ pos: Types.VECTOR }, { isZone: Types.BOOL }, { zoneAreaRef: Types.INT });
  if (cfg.modernArea) {
    areaFields.push({ userData: QMap(QString, QString) });
  }
  QUserType.register(TYPE.AREA, areaFields);

  // --- Room -------------------------------------------------------------
  QUserType.register(TYPE.ROOM, [
    { area: Types.INT },
    { x: Types.INT },
    { y: Types.INT },
    { z: Types.INT },
    { north: Types.INT },
    { northeast: Types.INT },
    { east: Types.INT },
    { southeast: Types.INT },
    { south: Types.INT },
    { southwest: Types.INT },
    { west: Types.INT },
    { northwest: Types.INT },
    { up: Types.INT },
    { down: Types.INT },
    { in: Types.INT },
    { out: Types.INT },
    { environment: Types.INT },
    { weight: Types.INT },
    { name: Types.STRING },
    { isLocked: Types.BOOL },
    { rawSpecialExits: QMultiMap(QUInt, QString) },
    { symbol: cfg.stringSymbol ? Types.STRING : LEGACY_TYPE.SYMBOL_BYTE },
    { userData: QMap(QString, QString) },
    { customLines: QMap(QString, QList(QPoint)) },
    { customLinesArrow: QMap(QString, QBool) },
    { customLinesColor: QMap(QString, QColorFromIntList) },
    { customLinesStyle: QMap(QString, QStyleFromString) },
    { exitLocks: QList(QInt) },
    { stubs: QList(QInt) },
    { exitWeights: QMap(QString, QInt) },
    { doors: QMap(QString, QInt) },
  ]);

  // --- Label (unchanged across v11-v20) ---------------------------------
  QUserType.register(TYPE.LABEL, [
    { id: Types.INT },
    { pos: Types.VECTOR },
    { dummy1: Types.DOUBLE },
    { dummy2: Types.DOUBLE },
    { size: QPair(QDouble, QDouble) },
    { text: Types.STRING },
    { fgColor: Types.COLOR },
    { bgColor: Types.COLOR },
    { pixMap: Types.PIXMAP },
    { noScaling: Types.BOOL },
    { showOnTop: Types.BOOL },
  ]);

  // --- Map --------------------------------------------------------------
  const mapFields: Record<string, number>[] = [
    { version: Types.INT },
    { envColors: QMap(QInt, QInt) },
    { areaNames: QMap(QInt, QString, true) },
    { mCustomEnvColors: QMap(QInt, QColor) },
    { mpRoomDbHashToRoomId: QMap(QString, QUInt) },
  ];
  if (cfg.hasMapUserData) {
    mapFields.push({ mUserData: QMap(QString, QString) });
  }
  if (cfg.hasMapFont) {
    mapFields.push(
      { mapSymbolFont: Types.FONT },
      { mapFontFudgeFactor: Types.DOUBLE },
      { useOnlyMapFont: Types.BOOL }
    );
  }
  mapFields.push({ areas: CONTAINER.AREAS });
  mapFields.push(
    cfg.modernRoomIdHash
      ? { mRoomIdHash: QMap(QString, QInt) }
      : { mRoomIdHash: LEGACY_TYPE.ROOM_ID }
  );
  mapFields.push({ labels: CONTAINER.LABELS });

  // Registered without `rooms` so a caller can read up through `labels` and
  // stop right at the start of the (unframed) rooms blob — see readHeader.
  QUserType.register(TYPE.HEADER, mapFields);

  QUserType.register(TYPE.MAP, [...mapFields, { rooms: CONTAINER.ROOMS }]);

  registerMapModel({
    version,
    read: (rb) => {
      const map = QUserType.read(rb, TYPE.MAP) as MudletMap & Record<string, unknown>;
      backfillHeader(map, cfg, version);
      for (const room of Object.values(map.rooms)) {
        backfillRoom(room as MudletRoom & Record<string, unknown>, version);
      }
      return map as MudletMap;
    },
    write: () => {
      throw new Error(
        `Writing Mudlet map version ${version} is not supported (read-only). ` +
          `Mudlet only saves the latest format.`
      );
    },
    readHeader: (rb) => {
      const header = QUserType.read(rb, TYPE.HEADER) as MudletMapHeader & Record<string, unknown>;
      backfillHeader(header, cfg, version);
      return header as MudletMapHeader;
    },
    readRoom: (rb) => {
      const id = QInt.read(rb) as number;
      const room = QUserType.get(TYPE.ROOM).read(rb) as MudletRoom;
      backfillRoom(room as MudletRoom & Record<string, unknown>, version);
      return { id, room };
    },
  });
}
