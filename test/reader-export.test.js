'use strict';

jest.mock('fs');
const fs = require('fs');
const readerExport = require('../reader-export');
const { makeMinimalMap, makeMinimalColor, makeMapWithCustomLines } = require('./fixtures');
const mudletColors = require('../mudlet-colors.json');

describe('reader-export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
  });

  describe('room conversion', () => {
    test('standard exits set to -1 are excluded from exits object', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 2;       // valid exit
      map.rooms[1].south = -1;      // no exit
      map.areas[1].rooms = [1];

      const { mapData } = readerExport(map);
      const room = mapData[0].rooms[0];

      expect(room.exits).toHaveProperty('north', 2);
      expect(room.exits).not.toHaveProperty('south');
    });

    test('special exits are mapped to specialExits', () => {
      const map = makeMinimalMap();
      map.rooms[1].mSpecialExits = { 'climb rope': 5 };

      const { mapData } = readerExport(map);
      const room = mapData[0].rooms[0];

      expect(room.specialExits).toEqual({ 'climb rope': 5 });
    });

    test('room symbol is remapped to roomChar', () => {
      const map = makeMinimalMap();
      map.rooms[1].symbol = 'X';

      const { mapData } = readerExport(map);
      const room = mapData[0].rooms[0];

      expect(room.roomChar).toBe('X');
      expect(room).not.toHaveProperty('symbol');
    });

    test('room environment is remapped to env', () => {
      const map = makeMinimalMap();
      map.rooms[1].environment = 7;

      const { mapData } = readerExport(map);
      const room = mapData[0].rooms[0];

      expect(room.env).toBe(7);
      expect(room).not.toHaveProperty('environment');
    });
  });

  describe('custom lines conversion', () => {
    test('custom line points, color, style and arrow are nested correctly', () => {
      const map = makeMapWithCustomLines();

      const { mapData } = readerExport(map);
      const room = mapData[0].rooms[0];

      expect(room.customLines.north).toEqual({
        points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        attributes: {
          color: { r: 0, g: 0, b: 0 },
          style: 'solid line',
          arrow: true,
        },
      });
    });
  });

  describe('color generation', () => {
    test('generates 255 standard ANSI color entries', () => {
      const { colors } = readerExport(makeMinimalMap());
      // 256 entries minus envId 16 (skipped in the loop) = 255
      const stdEntries = colors.filter(c => c.envId <= 255);
      expect(stdEntries.length).toBe(255);
    });

    test('ansi_001 maps to envId 1 with correct RGB', () => {
      const { colors } = readerExport(makeMinimalMap());
      const entry = colors.find(c => c.envId === 1);
      expect(entry).toBeDefined();
      expect(entry.colors).toEqual(mudletColors['ansi_001']);
    });

    test('custom env color overrides standard color', () => {
      const map = makeMinimalMap();
      map.mCustomEnvColors[99] = makeMinimalColor(); // r=0, g=0, b=0

      const { colors } = readerExport(map);
      const entry = colors.find(c => c.envId === 99);
      expect(entry).toBeDefined();
      expect(entry.colors).toEqual([0, 0, 0]);
    });
  });

  describe('directory output', () => {
    test('writes mapExport.js, colors.js, mapExport.json, colors.json when directory provided', () => {
      readerExport(makeMinimalMap(), '/tmp/export');

      const writtenFiles = fs.writeFileSync.mock.calls.map(c => c[0]);
      expect(writtenFiles).toContain('/tmp/export/mapExport.js');
      expect(writtenFiles).toContain('/tmp/export/colors.js');
      expect(writtenFiles).toContain('/tmp/export/mapExport.json');
      expect(writtenFiles).toContain('/tmp/export/colors.json');
    });

    test('mapExport.js content starts with "mapData = "', () => {
      readerExport(makeMinimalMap(), '/tmp/export');

      const jsCall = fs.writeFileSync.mock.calls.find(c => c[0] === '/tmp/export/mapExport.js');
      expect(jsCall[1]).toMatch(/^mapData = /);
    });
  });
});
