import { describe, test, expect } from 'vitest';
import { QInt, QUInt, QDouble, QBool } from 'qtdatastream-web/types';
import { concat, fromInt8 } from 'qtdatastream-web/bytes';
import { readMapFromBuffer, writeMapToBuffer } from '../src/map-operations';
import { getSupportedVersions } from '../src/models/mudlet-models';
import { QString, QFont } from '../src/models/qstream-types';
import type { MudletFont } from '../src/types';

// These tests hand-serialize minimal Mudlet map buffers for versions 16-19,
// following the exact field order/types of Mudlet's C++ TMap::restore /
// TArea operator>> / TRoom::restore. They serve as an independent oracle for
// the readers registered in src/models/v16..v19 (built from legacy.ts).

// --- Low-level serialization helpers (Qt QDataStream big-endian) -----------
const i = (n: number) => QInt.from(n).toBuffer();
const u = (n: number) => QUInt.from(n).toBuffer();
const d = (n: number) => QDouble.from(n).toBuffer();
const b = (v: boolean) => QBool.from(v).toBuffer();
const s = (str: string) => QString.from(str).toBuffer();
const vec3 = (x: number, y: number, z: number) => concat([d(x), d(y), d(z)]);

/** A Qt container/map count prefix followed by already-serialized entries. */
const sized = (count: number, ...parts: Uint8Array[]) => concat([u(count), ...parts]);
const emptyMap = () => u(0);

const TEST_FONT: MudletFont = {
  family: 'Ubuntu Mono',
  style: '',
  pointSize: 12,
  pixelSize: -1,
  styleHint: 5,
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

interface BuildOpts {
  version: number;
  hasMapUserData: boolean;
  hasMapFont: boolean;
  modernRoomIdHash: boolean;
  modernArea: boolean;
  stringSymbol: boolean;
}

/** Serialize one area (id 1, containing room 100) per this version's layout. */
function serializeArea(opts: BuildOpts): Uint8Array {
  const parts: Uint8Array[] = [
    i(1), // areaId (read by the AREAS container)
    sized(1, u(100)), // rooms: QList<uint> = [100]
    sized(1, i(0)), // zLevels: QList<int> = [0]
    emptyMap(), // mAreaExits: QMultiMap = {}
    b(false), // gridMode
    i(5), // max_x
    i(6), // max_y
    i(0), // max_z
    i(-5), // min_x
    i(-6), // min_y
    i(0), // min_z
    vec3(0, 0, 0), // span
  ];
  if (opts.modernArea) {
    parts.push(emptyMap(), emptyMap(), emptyMap(), emptyMap()); // xmax/ymax/xmin/ymin ForZ
  } else {
    // v16: two unused QMap<int,int> blocks interleaved between the extents.
    parts.push(emptyMap(), emptyMap(), emptyMap(), emptyMap(), emptyMap(), emptyMap());
  }
  parts.push(vec3(0, 0, 0), b(false), i(0)); // pos, isZone, zoneAreaRef
  if (opts.modernArea) {
    parts.push(emptyMap()); // area userData
  }
  return concat(parts);
}

interface RoomExtras {
  /** Direction key the custom lines are stored under (default lower-case 'n'). */
  lineKey?: string;
  /** userData entries (e.g. a legacy symbol fallback). */
  userData?: [string, string][];
}

/** Serialize a QMap<QString,QString> from key/value pairs. */
function strMap(entries: [string, string][]): Uint8Array {
  if (entries.length === 0) return emptyMap();
  return sized(entries.length, ...entries.flatMap(([k, v]) => [s(k), s(v)]));
}

/** Serialize one room (id 100) per this version's layout. */
function serializeRoom(opts: BuildOpts, extras: RoomExtras = {}): Uint8Array {
  const lineKey = extras.lineKey ?? 'n';
  const parts: Uint8Array[] = [
    i(100), // room id (read by the ROOMS container loop)
    i(1), // area
    i(2), // x
    i(3), // y
    i(0), // z
    i(0), // north
    i(0), // northeast
    i(0), // east
    i(0), // southeast
    i(0), // south
    i(0), // southwest
    i(0), // west
    i(0), // northwest
    i(0), // up
    i(0), // down
    i(0), // in
    i(0), // out
    i(1), // environment
    i(1), // weight
    s('Test Room'), // name
    b(false), // isLocked
    emptyMap(), // rawSpecialExits: QMultiMap = {}
  ];
  // symbol: qint8 char code (v16-v18) or QString (v19+)
  parts.push(opts.stringSymbol ? s('@') : fromInt8(64)); // 64 == '@'
  parts.push(strMap(extras.userData ?? [])); // userData
  parts.push(sized(1, s(lineKey), sized(1, concat([d(1), d(2)])))); // customLines {key:[[1,2]]}
  parts.push(sized(1, s(lineKey), b(true))); // customLinesArrow {key:true}
  // customLinesColor: pre-v20 is QMap<QString, QList<int>> = {key:[255,128,0]}
  parts.push(sized(1, s(lineKey), sized(3, i(255), i(128), i(0))));
  // customLinesStyle: pre-v20 is QMap<QString, QString> = {key:"dash line"}
  parts.push(sized(1, s(lineKey), s('dash line')));
  parts.push(emptyMap()); // exitLocks: QList<int> = []
  parts.push(emptyMap()); // stubs: QList<int> = []
  parts.push(emptyMap()); // exitWeights
  parts.push(emptyMap()); // doors
  return concat(parts);
}

/** Build a full minimal map buffer for the given legacy version. */
function buildMap(opts: BuildOpts, withContent: boolean, roomExtras: RoomExtras = {}): Uint8Array {
  const parts: Uint8Array[] = [
    i(opts.version),
    emptyMap(), // envColors
    emptyMap(), // areaNames
    emptyMap(), // mCustomEnvColors
    emptyMap(), // mpRoomDbHashToRoomId
  ];
  if (opts.hasMapUserData) parts.push(emptyMap());
  if (opts.hasMapFont) {
    parts.push(QFont.from(TEST_FONT).toBuffer(), d(1.5), b(true)); // font, fudge, onlyMapFont
  }
  // areas container: int count, then each area
  parts.push(withContent ? concat([i(1), serializeArea(opts)]) : i(0));
  // mRoomIdHash: QMap (v18+) or a single legacy int (v16-v17)
  parts.push(opts.modernRoomIdHash ? emptyMap() : i(0));
  // labels container: int areasWithLabelsTotal
  parts.push(i(0));
  // rooms: read until EOF
  if (withContent) parts.push(serializeRoom(opts, roomExtras));
  return concat(parts);
}

const VERSION_OPTS: Record<number, BuildOpts> = {
  16: { version: 16, hasMapUserData: false, hasMapFont: false, modernRoomIdHash: false, modernArea: false, stringSymbol: false },
  17: { version: 17, hasMapUserData: true, hasMapFont: false, modernRoomIdHash: false, modernArea: true, stringSymbol: false },
  18: { version: 18, hasMapUserData: true, hasMapFont: false, modernRoomIdHash: true, modernArea: true, stringSymbol: false },
  19: { version: 19, hasMapUserData: true, hasMapFont: true, modernRoomIdHash: true, modernArea: true, stringSymbol: true },
};

describe('legacy map versions 16-19', () => {
  test('all of 16-19 (and 20) are registered as supported', () => {
    expect(getSupportedVersions()).toEqual(expect.arrayContaining([16, 17, 18, 19, 20]));
  });

  for (const version of [16, 17, 18, 19]) {
    const opts = VERSION_OPTS[version];

    test(`v${version}: reads a minimal empty map`, () => {
      const map = readMapFromBuffer(buildMap(opts, false));
      expect(map.version).toBe(version);
      expect(map.areas).toEqual({});
      expect(map.rooms).toEqual({});
      // Fields the on-disk layout doesn't carry are backfilled to canonical defaults.
      expect(map.mUserData).toEqual({});
      expect(typeof map.mapSymbolFont.family).toBe('string');
      expect(typeof map.mapFontFudgeFactor).toBe('number');
      expect(typeof map.useOnlyMapFont).toBe('boolean');
    });

    test(`v${version}: reads an area + room with version-specific fields`, () => {
      const map = readMapFromBuffer(buildMap(opts, true));

      // Area parsed correctly, including the v16 6-map extent layout.
      const area = map.areas[1];
      expect(area).toBeDefined();
      expect(area.rooms).toEqual([100]);
      expect(area.max_x).toBe(5);
      expect(area.min_x).toBe(-5);
      expect(area.userData).toEqual({});
      // The v16 unused dummy maps must not leak onto the model.
      expect(area).not.toHaveProperty('legacyForZUnused1');
      expect(area).not.toHaveProperty('legacyForZUnused2');

      // Room parsed correctly.
      const room = map.rooms[100];
      expect(room).toBeDefined();
      expect(room.name).toBe('Test Room');
      expect(room.x).toBe(2);
      expect(room.environment).toBe(1);

      // symbol: '@' from either a byte (v16-18) or a QString (v19).
      expect(room.symbol).toBe('@');

      // customLinesColor: parsed from a QList<int> [255,128,0] into a MudletColor.
      expect(room.customLinesColor.n).toMatchObject({ r: 255, g: 128, b: 0 });
      // customLinesStyle: "dash line" maps to Qt::DashLine (2).
      expect(room.customLinesStyle.n).toBe(2);
      // unchanged-format custom-line fields round-trip as before.
      expect(room.customLines.n).toEqual([[1, 2]]);
      expect(room.customLinesArrow.n).toBe(true);
    });
  }

  for (const version of [16, 17, 18]) {
    test(`v${version}: room symbol falls back to userData["system.fallback_symbol"]`, () => {
      // A non-ASCII / multi-char symbol can't fit in the legacy qint8, so Mudlet
      // stashed it in userData and overrode the byte after the fact.
      const map = readMapFromBuffer(
        buildMap(VERSION_OPTS[version], true, { userData: [['system.fallback_symbol', '☠']] })
      );
      const room = map.rooms[100];
      expect(room.symbol).toBe('☠');
      // The fallback key is consumed (taken), not left to leak into export.
      expect(room.userData).not.toHaveProperty('system.fallback_symbol');
    });
  }

  for (const version of [16, 17, 18, 19]) {
    test(`v${version}: legacy upper-case custom-line direction keys are lower-cased`, () => {
      const map = readMapFromBuffer(buildMap(VERSION_OPTS[version], true, { lineKey: 'NE' }));
      const room = map.rooms[100];
      // 'NE' must be normalized to 'ne' across all four custom-line maps so the
      // JSON/reader exports (which index by lower-case short names) find them.
      expect(room.customLines.ne).toEqual([[1, 2]]);
      expect(room.customLinesArrow.ne).toBe(true);
      expect(room.customLinesColor.ne).toMatchObject({ r: 255, g: 128, b: 0 });
      expect(room.customLinesStyle.ne).toBe(2);
      expect(room.customLines).not.toHaveProperty('NE');
    });
  }

  test('v19 reads the stored map symbol font and fudge factor', () => {
    const map = readMapFromBuffer(buildMap(VERSION_OPTS[19], false));
    expect(map.mapSymbolFont.family).toBe('Ubuntu Mono');
    expect(map.mapFontFudgeFactor).toBeCloseTo(1.5);
    expect(map.useOnlyMapFont).toBe(true);
  });

  test('writing a legacy version is rejected with a clear error', () => {
    const map = readMapFromBuffer(buildMap(VERSION_OPTS[18], false));
    // writeMapToBuffer dispatches on map.version; legacy models refuse to write.
    expect(() => writeMapToBuffer(map)).toThrow(/version 18 is not supported/);
  });

  test('a v16 map can be upgraded to v20 by re-stamping version, then written', () => {
    // Reading backfills every field the v20 writer needs, so flipping the
    // version is enough to persist a legacy map in the modern format.
    const map = readMapFromBuffer(buildMap(VERSION_OPTS[16], true));
    expect(map.version).toBe(16);

    map.version = 20; // opt in to the v20 writer
    const reread = readMapFromBuffer(writeMapToBuffer(map));

    expect(reread.version).toBe(20);
    // Area survived the upgrade.
    expect(reread.areas[1].rooms).toEqual([100]);
    // Room + the converted legacy fields survived (symbol char, colour, style).
    const room = reread.rooms[100];
    expect(room.symbol).toBe('@');
    expect(room.customLinesColor.n).toMatchObject({ r: 255, g: 128, b: 0 });
    expect(room.customLinesStyle.n).toBe(2);
    expect(room.customLines.n).toEqual([[1, 2]]);
    expect(room.customLinesArrow.n).toBe(true);
  });
});
