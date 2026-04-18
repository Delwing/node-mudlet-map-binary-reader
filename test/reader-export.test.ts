'use strict';

jest.mock('fs');
import fs from 'fs';
import readerExport from '../src/reader-export';
import { makeMinimalMap, makeMinimalColor, makeMapWithCustomLines, makeMapWithLabels, makeLabelWithPixMap } from './fixtures';
import mudletColors from '../mudlet-colors.json';

const fsMock = fs as jest.Mocked<typeof fs>;

describe('reader-export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fsMock.existsSync.mockReturnValue(false);
    fsMock.mkdirSync.mockImplementation(() => undefined);
    fsMock.writeFileSync.mockImplementation(() => undefined);
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

    test('room area id is preserved on the converted room', () => {
      const map = makeMinimalMap();
      map.rooms[1].area = 1;

      const { mapData } = readerExport(map);
      const room = mapData[0].rooms[0];

      expect(room.area).toBe(1);
    });

    test('room environment is remapped to env', () => {
      const map = makeMinimalMap();
      map.rooms[1].environment = 7;

      const { mapData } = readerExport(map);
      const room = mapData[0].rooms[0];

      expect(room.env).toBe(7);
      expect(room).not.toHaveProperty('environment');
    });

    test('room coordinates and metadata fields are preserved (0.6.0 contract)', () => {
      const map = makeMinimalMap();
      map.rooms[1].x = 10;
      map.rooms[1].y = 20;
      map.rooms[1].z = 3;
      map.rooms[1].weight = 5;
      map.rooms[1].name = 'The Hall';
      map.rooms[1].isLocked = true;
      map.rooms[1].userData = { key: 'value' };
      map.rooms[1].doors = { north: 2 };
      map.rooms[1].exitLocks = [1];
      map.rooms[1].stubs = [4];
      map.rooms[1].exitWeights = { north: 7 };
      map.rooms[1].mSpecialExitLocks = [99];

      const { mapData } = readerExport(map);
      const room = mapData[0].rooms[0] as unknown as Record<string, unknown>;

      expect(room.x).toBe(10);
      expect(room.y).toBe(20);
      expect(room.z).toBe(3);
      expect(room.weight).toBe(5);
      expect(room.name).toBe('The Hall');
      expect(room.isLocked).toBe(true);
      expect(room.userData).toEqual({ key: 'value' });
      expect(room.doors).toEqual({ north: 2 });
      expect(room.exitLocks).toEqual([1]);
      expect(room.stubs).toEqual([4]);
      expect(room.exitWeights).toEqual({ north: 7 });
      expect(room.mSpecialExitLocks).toEqual([99]);
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

  describe('label conversion', () => {
    test('label fields are remapped to uppercase keys', () => {
      const { mapData } = readerExport(makeMapWithLabels());
      const label = mapData[0].labels[0];

      expect(label.Text).toBe('Test Label');
      expect(label.X).toBe(0);
      expect(label.Y).toBe(0);
      expect(label.Z).toBe(0);
      expect(label.Width).toBe(100);
      expect(label.Height).toBe(50);
    });

    test('label pixMap is base64-encoded (empty string for empty pixMap)', () => {
      const { mapData } = readerExport(makeMapWithLabels());
      const label = mapData[0].labels[0];

      // Buffer.from('').toString('base64') === ''
      expect(label.pixMap).toBe('');
    });

    test('label colors have spec and pad removed', () => {
      const { mapData } = readerExport(makeMapWithLabels());
      const label = mapData[0].labels[0];

      expect(label.FgColor).not.toHaveProperty('spec');
      expect(label.FgColor).not.toHaveProperty('pad');
      expect(label.BgColor).not.toHaveProperty('spec');
      expect(label.BgColor).not.toHaveProperty('pad');
    });

    test('label id, areaId, labelId are preserved (0.6.0 contract)', () => {
      const map = makeMinimalMap();
      map.labels[1] = [makeLabelWithPixMap()];

      const { mapData } = readerExport(map);
      const label = mapData[0].labels[0] as unknown as Record<string, unknown>;

      expect(label.id).toBe(1);
      expect(label.areaId).toBe(1);
      expect(label.labelId).toBe(42);
    });

    test('label dropped fields (dummy1, dummy2, noScaling, showOnTop, pos, size, text, fgColor, bgColor) are removed', () => {
      const { mapData } = readerExport(makeMapWithLabels());
      const label = mapData[0].labels[0] as unknown as Record<string, unknown>;

      expect(label).not.toHaveProperty('dummy1');
      expect(label).not.toHaveProperty('dummy2');
      expect(label).not.toHaveProperty('noScaling');
      expect(label).not.toHaveProperty('showOnTop');
      expect(label).not.toHaveProperty('pos');
      expect(label).not.toHaveProperty('size');
      expect(label).not.toHaveProperty('text');
      expect(label).not.toHaveProperty('fgColor');
      expect(label).not.toHaveProperty('bgColor');
    });
  });

  describe('color generation', () => {
    test('generates 255 standard ANSI color entries', () => {
      const { colors } = readerExport(makeMinimalMap());
      // Loop runs i=0..255, skipping i=16 (ansi_016 is never mapped).
      // i=0 and i=8 remap to envIds 8 and 16 respectively, so no envId slot is lost.
      // Total: 255 entries.
      const stdEntries = colors.filter((c) => c.envId <= 255);
      expect(stdEntries.length).toBe(255);
    });

    test('ansi_001 maps to envId 1 with correct RGB', () => {
      const { colors } = readerExport(makeMinimalMap());
      const entry = colors.find((c) => c.envId === 1);
      expect(entry).toBeDefined();
      expect(entry!.colors).toEqual((mudletColors as Record<string, number[]>)['ansi_001']);
    });

    test('custom env color overrides standard color', () => {
      const map = makeMinimalMap();
      map.mCustomEnvColors[99] = makeMinimalColor(); // r=0, g=0, b=0

      const { colors } = readerExport(map);
      const entry = colors.find((c) => c.envId === 99);
      expect(entry).toBeDefined();
      expect(entry!.colors).toEqual([0, 0, 0]);
    });
  });

  describe('label with directory', () => {
    test('does not write label PNG files to disk when directory is provided', () => {
      const map = makeMinimalMap();
      map.labels[1] = [makeLabelWithPixMap()];

      readerExport(map, '/tmp/export');

      const labelWrite = fsMock.writeFileSync.mock.calls.find((c) =>
        (c[0] as string).includes('/labels/')
      );
      expect(labelWrite).toBeUndefined();
      expect(fsMock.mkdirSync).not.toHaveBeenCalled();
    });

    test('label pixMap is base64-encoded inline even when directory is provided', () => {
      const map = makeMinimalMap();
      map.labels[1] = [makeLabelWithPixMap()];

      const { mapData } = readerExport(map, '/tmp/export');
      const label = mapData[0].labels[0];

      expect(label.pixMap).toBe(Buffer.from('fake-image-data').toString('base64'));
    });
  });

  describe('mpRoomDbHashToRoomId mapping', () => {
    test('room hash is included when mpRoomDbHashToRoomId has entry', () => {
      const map = makeMinimalMap();
      map.mpRoomDbHashToRoomId = { 'hash123': 1 };

      const { mapData } = readerExport(map);
      const room = mapData[0].rooms[0];

      expect(room.hash).toBe('hash123');
    });
  });

  describe('envColors override', () => {
    test('envColors remaps standard color to ANSI lookup', () => {
      const map = makeMinimalMap();
      // envId 5 is a standard ANSI color slot; map envColors[5] = 1 means
      // "override envId 5 with ANSI color 1"
      map.envColors = { 5: 1 };

      const { colors } = readerExport(map);
      const entry = colors.find((c) => c.envId === 5);
      expect(entry).toBeDefined();
      // envColors[5]=1 means use ansi_001 colors
      const mudletColorsTyped = mudletColors as Record<string, number[]>;
      expect(entry!.colors).toEqual(mudletColorsTyped['ansi_001']);
    });
  });

  describe('directory output', () => {
    test('writes mapExport.js, colors.js, mapExport.json, colors.json when directory provided', () => {
      readerExport(makeMinimalMap(), '/tmp/export');

      const writtenFiles = fsMock.writeFileSync.mock.calls.map((c) => c[0]);
      expect(writtenFiles).toContain('/tmp/export/mapExport.js');
      expect(writtenFiles).toContain('/tmp/export/colors.js');
      expect(writtenFiles).toContain('/tmp/export/mapExport.json');
      expect(writtenFiles).toContain('/tmp/export/colors.json');
    });

    test('mapExport.js content starts with "mapData = "', () => {
      readerExport(makeMinimalMap(), '/tmp/export');

      const jsCall = fsMock.writeFileSync.mock.calls.find((c) => c[0] === '/tmp/export/mapExport.js');
      expect(jsCall![1]).toMatch(/^mapData = /);
    });
  });
});
