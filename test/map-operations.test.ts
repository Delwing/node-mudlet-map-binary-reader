'use strict';

import { MudletMapReader, readMapFromBuffer } from '../src';
import { getMapModel } from '../src/models/mudlet-models';
import {
  makeMinimalMap,
  makeMinimalRoom,
  makeMapWithSpecialExits,
  makeMultiAreaMap,
  makeMapWithLabels,
  makeCrossAreaMap,
  makeExtentsFixture,
  makeMapWithHashes,
} from './fixtures';

describe('readBuffer / writeBuffer round-trip', () => {
  test('basic map survives write → read with key fields intact', () => {
    const input = makeMinimalMap();

    const result = MudletMapReader.readBuffer(MudletMapReader.writeBuffer(input));

    expect(result.version).toBe(20);
    expect(result.areaNames[1]).toBe('Test Area');
    expect(result.areas[1].rooms).toEqual([1]);
    expect(result.rooms[1]).toMatchObject({
      name: 'Room 1',
      x: 0,
      y: 0,
      z: 0,
      environment: 1,
      weight: 1,
      isLocked: false,
      mSpecialExits: {},
      mSpecialExitLocks: [],
    });
  });

  test('special exits and locks survive write → read', () => {
    const input = makeMapWithSpecialExits();
    // room 1 has 'open door' → 99 (unlocked), 'push lever' → 100 (locked)

    const result = MudletMapReader.readBuffer(MudletMapReader.writeBuffer(input));

    expect(result.rooms[1].mSpecialExits).toEqual({
      'open door': 99,
      'push lever': 100,
    });
    expect(result.rooms[1].mSpecialExitLocks).toEqual(expect.arrayContaining([100]));
    expect(result.rooms[1].mSpecialExitLocks).toHaveLength(1);
    expect(result.rooms[1].mSpecialExitLocks).not.toContain(99);
  });

  test('unlocked special exit has no entry in mSpecialExitLocks', () => {
    const input = makeMinimalMap();
    input.rooms[1].mSpecialExits = { 'enter portal': 99 };
    input.rooms[1].mSpecialExitLocks = [];

    const result = MudletMapReader.readBuffer(MudletMapReader.writeBuffer(input));

    expect(result.rooms[1].mSpecialExits).toEqual({ 'enter portal': 99 });
    expect(result.rooms[1].mSpecialExitLocks).toEqual([]);
  });

  test('label survives write → read with key fields intact', () => {
    const input = makeMapWithLabels();

    const result = MudletMapReader.readBuffer(MudletMapReader.writeBuffer(input));

    expect(result.labels[1]).toHaveLength(1);
    const label = result.labels[1][0];
    expect(label.text).toBe('Test Label');
    expect(label.pos).toEqual([0, 0, 0]);
    expect(label.size).toEqual([100, 50]);
    expect(label.noScaling).toBe(false);
    expect(label.showOnTop).toBe(false);
  });

  test('special exit without 0/1 prefix is treated as unlocked exit name', () => {
    // Older Mudlet versions stored special exits without a '0' or '1' prefix.
    // Line 33 of map-operations.ts handles this legacy format.
    const input = makeMinimalMap();
    // Set rawSpecialExits directly with an unprefixed exit name, bypassing writeMap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input.rooms[1] as any).rawSpecialExits = { 99: ['legacy door'] };

    // Serialize via the v20 model directly (bypassing writeMapToBuffer's
    // dehydrate/rebuild passes) to preserve the unprefixed rawSpecialExits.
    const result = readMapFromBuffer(getMapModel(20)!.write(input));

    expect(result.rooms[1].mSpecialExits).toEqual({ 'legacy door': 99 });
    expect(result.rooms[1].mSpecialExitLocks).toEqual([]);
  });

  test('multi-area map preserves all areas and room assignments', () => {
    const input = makeMultiAreaMap();

    const result = MudletMapReader.readBuffer(MudletMapReader.writeBuffer(input));

    expect(result.areaNames[1]).toBe('Test Area');
    expect(result.areaNames[2]).toBe('Second Area');
    expect(result.areas[1].rooms).toEqual([1]);
    expect(result.areas[2].rooms).toEqual(expect.arrayContaining([2, 3]));
    expect(result.rooms[2]).toMatchObject({ name: 'Room 2', area: 2 });
    expect(result.rooms[3]).toMatchObject({ name: 'Room 3', area: 2 });
  });
});

describe('map version dispatch', () => {
  test('reads a supported v20 map without throwing', () => {
    const buf = MudletMapReader.writeBuffer(makeMinimalMap());
    expect(() => readMapFromBuffer(buf)).not.toThrow();
  });

  test('throws a clear error for an unsupported map version', () => {
    // writeBuffer always emits v20; the version is the leading big-endian
    // int32, so bytes 0..3 are [0, 0, 0, 20]. Patch it to 16 to simulate an
    // older map without needing a real v16 fixture.
    const buf = MudletMapReader.writeBuffer(makeMinimalMap()).slice();
    expect([buf[0], buf[1], buf[2], buf[3]]).toEqual([0, 0, 0, 20]);
    buf[3] = 16;

    expect(() => readMapFromBuffer(buf)).toThrow(/Unsupported Mudlet map version 16/);
  });
});

describe('rebuildAreaExits on write', () => {
  // Round-tripping through writeMapToBuffer/readMapFromBuffer lets us observe
  // the side effect on mAreaExits end-to-end: it's rebuilt on write and then
  // read back by the reader.
  const roundTrip = (map: Parameters<typeof MudletMapReader.writeBuffer>[0]) =>
    MudletMapReader.readBuffer(MudletMapReader.writeBuffer(map));

  test('minimal cross-area fixture produces correct mAreaExits for both areas', () => {
    // 3 rooms in area 1, 2 in area 2, one cross-area exit each direction:
    //   room 2 (area 1) east → room 10 (area 2)
    //   room 10 (area 2) west → room 2  (area 1)
    const result = roundTrip(makeCrossAreaMap());

    // DIR_EAST = 4, DIR_WEST = 5
    expect(result.areas[1].mAreaExits).toEqual({ 2: [[10, 4]] });
    expect(result.areas[2].mAreaExits).toEqual({ 10: [[2, 5]] });
  });

  test('intra-area exits are not recorded in mAreaExits', () => {
    const input = makeCrossAreaMap();
    input.rooms[1].east = 2; // same-area: room 1 (area 1) → room 2 (area 1)
    const result = roundTrip(input);

    expect(result.areas[1].mAreaExits).toEqual({ 2: [[10, 4]] });
  });

  test('adding a cross-area exit on edit surfaces in mAreaExits; removing clears it', () => {
    // Start with the stock cross-area fixture and add a second A→B exit
    // (room 3 south → room 11). Saving should record it in area 1.
    const edited = makeCrossAreaMap();
    edited.rooms[3].south = 11;
    let result = roundTrip(edited);
    // DIR_SOUTH = 6
    expect(result.areas[1].mAreaExits).toEqual({ 2: [[10, 4]], 3: [[11, 6]] });

    // Now remove the original A→B exit (room 2 east) and re-save.
    const removed = makeCrossAreaMap();
    removed.rooms[3].south = 11;
    removed.rooms[2].east = -1;
    result = roundTrip(removed);
    expect(result.areas[1].mAreaExits).toEqual({ 3: [[11, 6]] });
  });

  test('deleting a room with cross-area exits leaves no stale mAreaExits entries', () => {
    const input = makeCrossAreaMap();
    input.rooms[3].south = 11;
    delete input.rooms[2]; // owner of the only cross-area exit from area 1

    const result = roundTrip(input);
    expect(result.areas[1].mAreaExits).toEqual({ 3: [[11, 6]] });
    // room 10 west → 2 is now dangling, so area 2's cache should be empty
    expect(result.areas[2].mAreaExits).toEqual({});
  });

  test('dangling exits (target not in map.rooms) are skipped', () => {
    const input = makeCrossAreaMap();
    input.rooms[1].up = 999; // nonexistent
    input.rooms[1].down = 0;
    input.rooms[1].north = -1;

    const result = roundTrip(input);
    expect(result.areas[1].mAreaExits).toEqual({ 2: [[10, 4]] });
  });

  test('special exits to another area are encoded with DIR_OTHER (13)', () => {
    const input = makeCrossAreaMap();
    input.rooms[1].mSpecialExits = { 'teleport pad': 10 };

    const result = roundTrip(input);
    expect(result.areas[1].mAreaExits).toEqual({
      1: [[10, 13]],
      2: [[10, 4]],
    });
  });

  test('special exits to the same area are ignored', () => {
    const input = makeCrossAreaMap();
    input.rooms[1].mSpecialExits = { 'climb tree': 2 }; // same-area

    const result = roundTrip(input);
    expect(result.areas[1].mAreaExits).toEqual({ 2: [[10, 4]] });
  });

  test('stale mAreaExits from caller input is overwritten by the rebuilt cache', () => {
    const input = makeCrossAreaMap();
    // Caller supplied a bogus cache entry; the rebuild should clobber it.
    input.areas[1].mAreaExits = { 99: [[999, 4]] };

    const result = roundTrip(input);
    expect(result.areas[1].mAreaExits).toEqual({ 2: [[10, 4]] });
  });

  test('multiple cardinal cross-area exits on one room preserve C++ insertion order', () => {
    // Mudlet's TArea iterates N, NE, E, SE, S, SW, W, NW, U, D, In, Out.
    // Set them out of order in the input; the rebuild must emit them sorted
    // by that iteration, so the on-disk pair sequence matches C++ Mudlet.
    const input = makeCrossAreaMap();
    input.rooms[1].south = 11;      // DIR_SOUTH = 6
    input.rooms[1].north = 10;      // DIR_NORTH = 1
    input.rooms[1].east = 10;       // DIR_EAST  = 4

    const result = roundTrip(input);
    expect(result.areas[1].mAreaExits[1]).toEqual([
      [10, 1],
      [10, 4],
      [11, 6],
    ]);
  });
});

describe('rebuildAreaExtents on write', () => {
  // Same round-trip helper pattern as the mAreaExits suite — we observe
  // the side effect end-to-end by writing then reading back.
  const roundTrip = (map: Parameters<typeof MudletMapReader.writeBuffer>[0]) =>
    MudletMapReader.readBuffer(MudletMapReader.writeBuffer(map));

  test('4-room fixture across 2 z-levels produces exact bounds, zLevels, and per-Z maps', () => {
    // z=0: room 1 (1,  2), room 2 (5, -3)    → -y values: -2, 3
    // z=1: room 3 (0,  0), room 4 (7,  4)    → -y values:  0, -4
    const result = roundTrip(makeExtentsFixture());
    const area = result.areas[1];

    expect(area.min_x).toBe(0);
    expect(area.max_x).toBe(7);
    expect(area.min_y).toBe(-4);
    expect(area.max_y).toBe(3);
    expect(area.min_z).toBe(0);
    expect(area.max_z).toBe(1);

    expect(area.zLevels).toEqual([0, 1]);

    expect(area.xminForZ).toEqual({ 0: 1, 1: 0 });
    expect(area.xmaxForZ).toEqual({ 0: 5, 1: 7 });
    expect(area.yminForZ).toEqual({ 0: -2, 1: -4 });
    expect(area.ymaxForZ).toEqual({ 0: 3, 1: 0 });
  });

  test('area.min_y is -max(room.y), confirming the Mudlet y-sign inversion', () => {
    // Sanity check on the convention: one room with strictly positive y.
    // Mudlet's TArea::calcSpan stores -pR->y(), so area.min_y == area.max_y == -5.
    const map = makeMinimalMap();
    map.rooms[1].y = 5;
    const area = roundTrip(map).areas[1];
    expect(area.min_y).toBe(-5);
    expect(area.max_y).toBe(-5);
    expect(area.yminForZ).toEqual({ 0: -5 });
    expect(area.ymaxForZ).toEqual({ 0: -5 });
  });

  test('moving a room updates bounds and per-Z maps on next save', () => {
    const input = makeExtentsFixture();
    input.rooms[2].x = 100; // was 5
    input.rooms[2].y = -50; // was -3, so -y goes 3 → 50
    const area = roundTrip(input).areas[1];

    expect(area.max_x).toBe(100);
    expect(area.max_y).toBe(50);
    expect(area.xmaxForZ[0]).toBe(100);
    expect(area.ymaxForZ[0]).toBe(50);
  });

  test('adding a room beyond the current extents expands bounds and zLevels', () => {
    const input = makeExtentsFixture();
    input.rooms[5] = { ...input.rooms[1], x: -10, y: 100, z: 9 };
    input.areas[1].rooms.push(5);
    const area = roundTrip(input).areas[1];

    expect(area.min_x).toBe(-10);
    expect(area.min_y).toBe(-100); // -y of 100
    expect(area.max_z).toBe(9);
    expect(area.zLevels).toEqual([0, 1, 9]);
    expect(area.xminForZ[9]).toBe(-10);
    expect(area.ymaxForZ[9]).toBe(-100);
  });

  test('deleting the only room at a z-level removes that z from zLevels and per-Z maps', () => {
    const input = makeExtentsFixture();
    // rooms 3 and 4 are the only rooms at z=1
    delete input.rooms[3];
    delete input.rooms[4];
    input.areas[1].rooms = [1, 2];

    const area = roundTrip(input).areas[1];
    expect(area.zLevels).toEqual([0]);
    expect(area.xminForZ[1]).toBeUndefined();
    expect(area.xmaxForZ[1]).toBeUndefined();
    expect(area.yminForZ[1]).toBeUndefined();
    expect(area.ymaxForZ[1]).toBeUndefined();
    expect(area.max_x).toBe(5);
    expect(area.min_z).toBe(0);
    expect(area.max_z).toBe(0);
  });

  test('empty area clears per-Z maps and zLevels but preserves min/max', () => {
    // Matches TArea::calcSpan: min_x..max_z are only updated inside the room
    // loop, so an area with zero valid rooms keeps whatever bounds it had.
    const input = makeMinimalMap();
    input.areas[1].rooms = [];
    input.areas[1].min_x = -5;
    input.areas[1].max_x = 10;
    input.areas[1].min_y = -3;
    input.areas[1].max_y = 7;
    input.areas[1].min_z = 0;
    input.areas[1].max_z = 2;
    input.areas[1].zLevels = [0, 1, 2];
    input.areas[1].xminForZ = { 0: -5, 1: 0, 2: 0 };
    input.areas[1].xmaxForZ = { 0: 10, 1: 0, 2: 0 };
    input.areas[1].yminForZ = { 0: -3, 1: 0, 2: 0 };
    input.areas[1].ymaxForZ = { 0: 7, 1: 0, 2: 0 };

    const area = roundTrip(input).areas[1];
    expect(area.min_x).toBe(-5);
    expect(area.max_x).toBe(10);
    expect(area.min_y).toBe(-3);
    expect(area.max_y).toBe(7);
    expect(area.zLevels).toEqual([]);
    expect(area.xminForZ).toEqual({});
    expect(area.xmaxForZ).toEqual({});
    expect(area.yminForZ).toEqual({});
    expect(area.ymaxForZ).toEqual({});
  });

  test('rooms listed on area.rooms but missing from map.rooms are skipped', () => {
    const input = makeExtentsFixture();
    input.areas[1].rooms.push(999); // dangling id

    // Should not throw, should not pollute bounds, should match the no-dangling case.
    const area = roundTrip(input).areas[1];
    expect(area.min_x).toBe(0);
    expect(area.max_x).toBe(7);
    expect(area.min_y).toBe(-4);
    expect(area.max_y).toBe(3);
    expect(area.zLevels).toEqual([0, 1]);
  });

  test('zLevels is sorted ascending regardless of rooms iteration order', () => {
    const map = makeMinimalMap();
    // Insert rooms so we hit z=5 before z=-2 before z=0 during iteration
    map.rooms[1] = { ...makeMinimalRoom(1, 1), z: 5 };
    map.rooms[2] = { ...makeMinimalRoom(2, 1), z: -2 };
    map.rooms[3] = { ...makeMinimalRoom(3, 1), z: 0 };
    map.areas[1].rooms = [1, 2, 3];

    expect(roundTrip(map).areas[1].zLevels).toEqual([-2, 0, 5]);
  });

  test('stale extent fields from caller input are overwritten by the rebuild', () => {
    const input = makeExtentsFixture();
    // Caller-supplied bogus cache
    input.areas[1].min_x = 9999;
    input.areas[1].max_x = -9999;
    input.areas[1].zLevels = [42, 43];
    input.areas[1].xmaxForZ = { 99: 99 };

    const area = roundTrip(input).areas[1];
    expect(area.min_x).toBe(0);
    expect(area.max_x).toBe(7);
    expect(area.zLevels).toEqual([0, 1]);
    expect(area.xmaxForZ).toEqual({ 0: 5, 1: 7 });
  });

  test('span is left untouched on save (matches TArea::calcSpan, which never writes it)', () => {
    const input = makeExtentsFixture();
    input.areas[1].span = [11, 22, 33];
    const area = roundTrip(input).areas[1];
    expect(area.span).toEqual([11, 22, 33]);
  });
});

describe('rebuildRoomHashIndex on write', () => {
  const roundTrip = (map: Parameters<typeof MudletMapReader.writeBuffer>[0]) =>
    MudletMapReader.readBuffer(MudletMapReader.writeBuffer(map));

  test('round-trip preserves mpRoomDbHashToRoomId exactly for a map with hashed rooms', () => {
    const result = roundTrip(makeMapWithHashes());
    expect(result.mpRoomDbHashToRoomId).toEqual({
      'hash-room-1': 1,
      'hash-room-2': 2,
    });
  });

  test('room.hash is populated on load from the inverse of mpRoomDbHashToRoomId', () => {
    const result = roundTrip(makeMapWithHashes());
    expect(result.rooms[1].hash).toBe('hash-room-1');
    expect(result.rooms[2].hash).toBe('hash-room-2');
    expect(result.rooms[3].hash).toBeUndefined();
  });

  test('changing a room hash updates the index on next save; old entry is dropped', () => {
    const input = makeMapWithHashes();
    input.rooms[1].hash = 'new-hash-1';
    const result = roundTrip(input);
    expect(result.mpRoomDbHashToRoomId).toEqual({
      'new-hash-1': 1,
      'hash-room-2': 2,
    });
  });

  test('adding a room with a hash surfaces a new index entry', () => {
    const input = makeMapWithHashes();
    input.rooms[4] = { ...makeMinimalRoom(4, 1), hash: 'hash-room-4' };
    input.areas[1].rooms.push(4);
    const result = roundTrip(input);
    expect(result.mpRoomDbHashToRoomId).toEqual({
      'hash-room-1': 1,
      'hash-room-2': 2,
      'hash-room-4': 4,
    });
  });

  test('deleting a hashed room removes its entry from the index (no orphans)', () => {
    const input = makeMapWithHashes();
    delete input.rooms[1];
    input.areas[1].rooms = input.areas[1].rooms.filter((r) => r !== 1);
    const result = roundTrip(input);
    expect(result.mpRoomDbHashToRoomId).toEqual({
      'hash-room-2': 2,
    });
  });

  test('rooms with undefined or empty-string hash do not produce an empty-string key', () => {
    const input = makeMapWithHashes();
    input.rooms[4] = { ...makeMinimalRoom(4, 1), hash: '' };
    input.rooms[5] = { ...makeMinimalRoom(5, 1) }; // hash undefined
    input.areas[1].rooms.push(4, 5);
    const result = roundTrip(input);
    expect(Object.keys(result.mpRoomDbHashToRoomId).sort()).toEqual([
      'hash-room-1',
      'hash-room-2',
    ]);
    expect(result.mpRoomDbHashToRoomId['']).toBeUndefined();
  });

  test('minimal 3-room fixture produces the exact expected index shape', () => {
    const input = makeMapWithHashes();
    // Wipe the input index so we can see the rebuild populate it from room.hash
    // rather than merely preserving whatever was passed in.
    input.mpRoomDbHashToRoomId = {};
    const result = roundTrip(input);
    expect(result.mpRoomDbHashToRoomId).toEqual({
      'hash-room-1': 1,
      'hash-room-2': 2,
    });
  });

  test('round-trip does not touch mRoomIdHash (per-profile player cursor)', () => {
    const input = makeMapWithHashes();
    input.mRoomIdHash = { 'profile-one': 2, 'profile-two': 1 };
    const result = roundTrip(input);
    expect(result.mRoomIdHash).toEqual({ 'profile-one': 2, 'profile-two': 1 });
  });

  test('duplicate hashes on two rooms: last wins and a warning is logged', () => {
    const input = makeMapWithHashes();
    input.rooms[3].hash = 'hash-room-1'; // collides with room 1
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = roundTrip(input);
      // writeBuffer iterates room ids in insertion order (1, 2, 3); 3 overwrites 1
      expect(result.mpRoomDbHashToRoomId['hash-room-1']).toBe(3);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('duplicate room hash'));
    } finally {
      warnSpy.mockRestore();
    }
  });
});
