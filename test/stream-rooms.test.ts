import { QInt, QUInt, QDouble, QBool } from 'qtdatastream-web/types';
import { concat, fromInt8 } from 'qtdatastream-web/bytes';
import { readMapFromBuffer, streamRooms, writeMapToBuffer } from '../src';
import type { MudletRoom } from '../src';
import { QString } from '../src/models/qstream-types';
import {
  makeMultiAreaMap,
  makeMapWithSpecialExits,
  makeMapWithCustomLines,
  makeMapWithLabels,
} from './fixtures';

describe('streamRooms', () => {
  it('emits exactly the same rooms as a full read (multi-area, v20)', () => {
    const buf = writeMapToBuffer(makeMultiAreaMap());
    const full = readMapFromBuffer(buf);

    const streamed: Record<number, MudletRoom> = {};
    const header = streamRooms(buf, (id, room) => {
      streamed[id] = room;
    });

    // Same set of room ids, same count.
    expect(Object.keys(streamed).sort()).toEqual(Object.keys(full.rooms).sort());

    // Each room is structurally identical (hash is intentionally not set by
    // streamRooms, so drop it from the full-read rooms before comparing).
    for (const id of Object.keys(full.rooms).map(Number)) {
      const expected = { ...full.rooms[id] };
      delete expected.hash;
      expect(streamed[id]).toEqual(expected);
    }

    // Header carries the non-room metadata, and no `rooms` field.
    expect(header.version).toBe(full.version);
    expect(header.areaNames).toEqual(full.areaNames);
    expect(Object.keys(header.areas).sort()).toEqual(Object.keys(full.areas).sort());
    expect('rooms' in header).toBe(false);
  });

  it('hydrates special exits per room just like a full read', () => {
    const buf = writeMapToBuffer(makeMapWithSpecialExits());
    const full = readMapFromBuffer(buf);

    streamRooms(buf, (id, room) => {
      expect(room.mSpecialExits).toEqual(full.rooms[id].mSpecialExits);
      expect(room.mSpecialExitLocks.sort()).toEqual(full.rooms[id].mSpecialExitLocks.sort());
    });
  });

  it('preserves custom lines and label metadata in the header', () => {
    const linesBuf = writeMapToBuffer(makeMapWithCustomLines());
    streamRooms(linesBuf, (_id, room) => {
      expect(room.customLines).toEqual({ north: [[0, 0], [1, 1]] });
    });

    const labelBuf = writeMapToBuffer(makeMapWithLabels());
    const header = streamRooms(labelBuf, () => {});
    expect(header.labels[1]?.length).toBe(1);
  });

  it('never builds a rooms map (callback is the only sink)', () => {
    const buf = writeMapToBuffer(makeMultiAreaMap());
    let count = 0;
    const header = streamRooms(buf, () => {
      count++;
    });
    expect(count).toBe(3);
    // @ts-expect-error rooms must not exist on the header type
    expect(header.rooms).toBeUndefined();
  });

  it('throws the same unsupported-version error as readMapFromBuffer', () => {
    const buf = QInt.from(999).toBuffer();
    expect(() => streamRooms(buf, () => {})).toThrow(/Unsupported Mudlet map version 999/);
  });

  // --- Legacy version (v16) streaming ---------------------------------------
  // Hand-serialize a minimal v16 buffer (mirrors test/legacy-versions.test.ts)
  // to confirm streamRooms dispatches through the per-version MapModel
  // (readHeader/readRoom), including the v16-specific room-symbol and
  // custom-line-key backfills, not just the v20 path.
  const i = (n: number) => QInt.from(n).toBuffer();
  const u = (n: number) => QUInt.from(n).toBuffer();
  const b = (v: boolean) => QBool.from(v).toBuffer();
  const s = (str: string) => QString.from(str).toBuffer();
  const sized = (count: number, ...parts: Uint8Array[]) => concat([u(count), ...parts]);
  const emptyMap = () => u(0);
  const d = (n: number) => QDouble.from(n).toBuffer();
  const vec3 = (x: number, y: number, z: number) => concat([d(x), d(y), d(z)]);

  it('streams a legacy (v16) map through its version-specific model', () => {
    // v16 area layout: rooms, zLevels, mAreaExits, gridMode, max/min x/y/z, span,
    // xmax/ymax/legacyUnused1/xmin/ymin/legacyUnused2 ForZ, pos, isZone, zoneAreaRef.
    const area = concat([
      i(1), // areaId
      sized(1, u(100)), // rooms: [100]
      sized(1, i(0)), // zLevels: [0]
      emptyMap(), // mAreaExits
      b(false), // gridMode
      i(5), i(6), i(0), i(-5), i(-6), i(0), // max_x/max_y/max_z/min_x/min_y/min_z
      vec3(0, 0, 0), // span
      emptyMap(), emptyMap(), emptyMap(), emptyMap(), emptyMap(), emptyMap(), // v16's 6 per-Z maps
      vec3(0, 0, 0), // pos
      b(false), // isZone
      i(0), // zoneAreaRef
      // no userData (v16 has none)
    ]);

    const room = concat([
      i(100), // room id
      i(1), i(2), i(3), i(0), // area, x, y, z
      i(0), i(0), i(0), i(0), i(0), i(0), i(0), i(0), i(0), i(0), i(0), i(0), // 12 exits
      i(1), i(1), // environment, weight
      s('Test Room'), // name
      b(false), // isLocked
      emptyMap(), // rawSpecialExits
      fromInt8(64), // symbol: qint8 '@' (v16 uses a byte, not a QString)
      emptyMap(), // userData
      sized(1, s('N'), sized(1, concat([d(1), d(2)]))), // customLines {N:[[1,2]]}
      sized(1, s('N'), b(true)), // customLinesArrow
      sized(1, s('N'), sized(3, i(255), i(128), i(0))), // customLinesColor (int list, v16)
      sized(1, s('N'), s('dash line')), // customLinesStyle (string, v16)
      emptyMap(), // exitLocks
      emptyMap(), // stubs
      emptyMap(), // exitWeights
      emptyMap(), // doors
    ]);

    const buf = concat([
      i(16), // version
      emptyMap(), // envColors
      emptyMap(), // areaNames
      emptyMap(), // mCustomEnvColors
      emptyMap(), // mpRoomDbHashToRoomId
      // no mUserData (v16 has none)
      // no map font fields (v16 has none)
      concat([i(1), area]), // areas: count=1, then area
      i(0), // mRoomIdHash: legacy single int (v16/v17)
      i(0), // labels: areasWithLabelsTotal = 0
      room, // rooms: read-to-EOF
    ]);

    const full = readMapFromBuffer(buf);
    expect(full.version).toBe(16);
    expect(full.rooms[100].customLines).toEqual({ n: [[1, 2]] });

    const streamed: Record<number, MudletRoom> = {};
    const header = streamRooms(buf, (id, room) => {
      streamed[id] = room;
    });

    expect(header.version).toBe(16);
    expect('rooms' in header).toBe(false);
    expect(Object.keys(streamed)).toEqual(['100']);
    // Same v16-specific backfills as the full read: lower-cased direction
    // keys and the qint8 symbol.
    expect(streamed[100].customLines).toEqual({ n: [[1, 2]] });
    expect(streamed[100].symbol).toBe('@');
    expect(streamed[100]).toEqual(full.rooms[100]);
  });
});
