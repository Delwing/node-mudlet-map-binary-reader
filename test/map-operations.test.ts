'use strict';

import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { MudletMapReader } from '../src';
import { QUserType } from '../src/models/mudlet-models';
import { makeMinimalMap, makeMapWithSpecialExits, makeMultiAreaMap, makeMapWithLabels } from './fixtures';

describe('readMap / writeMap round-trip', () => {
  let tmpFile: string;

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

  test('special exit without 0/1 prefix is treated as unlocked exit name', () => {
    // Older Mudlet versions stored special exits without a '0' or '1' prefix.
    // Line 33 of map-operations.ts handles this legacy format.
    const input = makeMinimalMap();
    // Set rawSpecialExits directly with an unprefixed exit name, bypassing writeMap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input.rooms[1] as any).rawSpecialExits = { 99: ['legacy door'] };

    // Serialize at the low level to preserve the unprefixed rawSpecialExits
    const buf = QUserType.get('MudletMap').from(input).toBuffer(true);
    fs.writeFileSync(tmpFile, buf);

    const result = MudletMapReader.read(tmpFile);

    expect(result.rooms[1].mSpecialExits).toEqual({ 'legacy door': 99 });
    expect(result.rooms[1].mSpecialExitLocks).toEqual([]);
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
