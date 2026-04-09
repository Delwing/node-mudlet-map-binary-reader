'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { MudletMapReader } = require('../index');
const { makeMinimalMap, makeMapWithSpecialExits, makeMultiAreaMap, makeMapWithLabels } = require('./fixtures');

describe('readMap / writeMap round-trip', () => {
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `mudlet-test-${randomUUID()}.dat`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  test('basic map survives write → read with key fields intact', () => {
    const input = makeMinimalMap();

    MudletMapReader.write(input, tmpFile);
    const result = MudletMapReader.read(tmpFile);

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

    MudletMapReader.write(input, tmpFile);
    const result = MudletMapReader.read(tmpFile);

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

    MudletMapReader.write(input, tmpFile);
    const result = MudletMapReader.read(tmpFile);

    expect(result.rooms[1].mSpecialExits).toEqual({ 'enter portal': 99 });
    expect(result.rooms[1].mSpecialExitLocks).toEqual([]);
  });

  test('label survives write → read with key fields intact', () => {
    const input = makeMapWithLabels();

    MudletMapReader.write(input, tmpFile);
    const result = MudletMapReader.read(tmpFile);

    expect(result.labels[1]).toHaveLength(1);
    const label = result.labels[1][0];
    expect(label.text).toBe('Test Label');
    expect(label.pos).toEqual([0, 0, 0]);
    expect(label.size).toEqual([100, 50]);
    expect(label.noScaling).toBe(false);
    expect(label.showOnTop).toBe(false);
  });

  test('multi-area map preserves all areas and room assignments', () => {
    const input = makeMultiAreaMap();

    MudletMapReader.write(input, tmpFile);
    const result = MudletMapReader.read(tmpFile);

    expect(result.areaNames[1]).toBe('Test Area');
    expect(result.areaNames[2]).toBe('Second Area');
    expect(result.areas[1].rooms).toEqual([1]);
    expect(result.areas[2].rooms).toEqual(expect.arrayContaining([2, 3]));
    expect(result.rooms[2]).toMatchObject({ name: 'Room 2', area: 2 });
    expect(result.rooms[3]).toMatchObject({ name: 'Room 3', area: 2 });
  });
});
