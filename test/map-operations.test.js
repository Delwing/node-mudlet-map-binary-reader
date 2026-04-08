'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { MudletMapReader } = require('../index');
const { makeMinimalMap } = require('./fixtures');

describe('readMap / writeMap round-trip', () => {
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `mudlet-test-${Date.now()}.dat`);
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
});
