'use strict';

jest.mock('fs');
import fs from 'fs';
import exportMap from '../src/json-export';
import { makeMinimalMap, makeMultiAreaMap, makeMinimalColor, makeMapWithLabels, makeMinimalLabel } from './fixtures';

const fsMock = fs as jest.Mocked<typeof fs>;

function getWrittenJson(): Record<string, unknown> {
  expect(fsMock.writeFileSync).toHaveBeenCalledTimes(1);
  const call = fsMock.writeFileSync.mock.calls[0];
  return JSON.parse(call[1] as string) as Record<string, unknown>;
}

describe('json-export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fsMock.writeFileSync.mockImplementation(() => undefined);
  });

  describe('map-level fields', () => {
    test('formatVersion is 1', () => {
      exportMap(makeMinimalMap(), '/tmp/out.json');
      expect(getWrittenJson().formatVersion).toBe(1);
    });

    test('areaCount and roomCount are correct', () => {
      // Use makeMultiAreaMap (2 areas, 3 rooms) so areaCount !== roomCount
      // and a swapped implementation would fail
      exportMap(makeMultiAreaMap(), '/tmp/out.json');
      const result = getWrittenJson();
      expect(result.areaCount).toBe(2);
      expect(result.roomCount).toBe(3);
    });

    test('mapSymbolFontDetails encodes font fields as comma-separated string', () => {
      exportMap(makeMinimalMap(), '/tmp/out.json');
      // makeMinimalFont: family=Arial, pointSize=12, pixelSize=-1, styleHint=5,
      // weight=50, styleSetting=false, underline=false, strikeOut=false, fixedPitch=false
      expect(getWrittenJson().mapSymbolFontDetails).toBe('Arial,12,-1,5,50,0,0,0,0,0');
    });

    test('envToColorMapping reflects map.envColors', () => {
      const map = makeMinimalMap();
      map.envColors = { 5: 3 };
      exportMap(map, '/tmp/out.json');
      expect(getWrittenJson().envToColorMapping).toEqual({ 5: 3 });
    });

    test('custom env colors appear in customEnvColors with correct RGB and id', () => {
      const map = makeMinimalMap();
      map.mCustomEnvColors[42] = makeMinimalColor(); // alpha=255 → color24RGB
      exportMap(map, '/tmp/out.json');
      expect(getWrittenJson().customEnvColors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 42, color24RGB: [0, 0, 0] }),
        ])
      );
    });

    test('defaultAreaName and anonymousAreaName have fixed values', () => {
      exportMap(makeMinimalMap(), '/tmp/out.json');
      const result = getWrittenJson();
      expect(result.defaultAreaName).toBe('Default Area');
      expect(result.anonymousAreaName).toBe('Unnamed Area');
    });
  });

  describe('area and room conversion', () => {
    test('area id and name are present', () => {
      exportMap(makeMinimalMap(), '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown>;
      expect(area.id).toBe(1);
      expect(area.name).toBe('Test Area');
    });

    test('room coordinates are packed into array', () => {
      const map = makeMinimalMap();
      map.rooms[1].x = 3;
      map.rooms[1].y = -2;
      map.rooms[1].z = 1;
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown>;
      expect(room.coordinates).toEqual([3, -2, 1]);
    });

    test('standard exit with default weight has no weight field', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 1;
      map.rooms[1].exitWeights = {};
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown[]>;
      const exit = room.exits.find((e) => (e as Record<string, unknown>).name === 'north') as Record<string, unknown>;
      expect(exit).toBeDefined();
      expect(exit.weight).toBeUndefined();
    });

    test('standard exit with non-default weight includes weight', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 1;
      map.rooms[1].exitWeights = { n: 5 };
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown[]>;
      const exit = room.exits.find((e) => (e as Record<string, unknown>).name === 'north') as Record<string, unknown>;
      expect(exit.weight).toBe(5);
    });

    test('special exit appears in exits array with correct exitId', () => {
      const map = makeMinimalMap();
      map.rooms[1].mSpecialExits = { 'climb ladder': 2 };
      map.rooms[1].mSpecialExitLocks = [];
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown[]>;
      const exit = room.exits.find((e) => (e as Record<string, unknown>).name === 'climb ladder') as Record<string, unknown>;
      expect(exit).toBeDefined();
      expect(exit.exitId).toBe(2);
    });

    test('label is converted with correct fields', () => {
      exportMap(makeMapWithLabels(), '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const label = area.labels[0] as Record<string, unknown>;

      expect(label.text).toBe('Test Label');
      expect(label.coordinates).toEqual([0, 0, 0]);
      expect(label.size).toEqual([100, 50]);
      expect(label.scaledels).toBe(true);   // !noScaling
      expect(label.showOnTop).toBe(false);
      // chunkString on empty base64 string returns null (no regex matches)
      expect(label.image).toBeNull();
    });

    test('color with alpha < 255 uses color32RGBA', () => {
      const map = makeMinimalMap();
      map.mCustomEnvColors[10] = { spec: 1, alpha: 128, r: 50, g: 60, b: 70, pad: 0 };
      exportMap(map, '/tmp/out.json');
      const result = getWrittenJson();
      const entry = (result.customEnvColors as Record<string, unknown>[]).find(
        (c) => c.id === 10
      );
      expect(entry).toEqual(expect.objectContaining({ color32RGBA: [50, 60, 70, 128] }));
      expect(entry).not.toHaveProperty('color24RGB');
    });

    test('standard exit with exitLock has locked: true', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 2;
      map.rooms[1].exitLocks = [1]; // 1-based: 1 = north (index 0 + 1)
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown[]>;
      const exit = room.exits.find((e) => (e as Record<string, unknown>).name === 'north') as Record<string, unknown>;
      expect(exit.locked).toBe(true);
    });

    test('standard exit with door includes door type', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 2;
      map.rooms[1].doors = { n: 3 }; // 3 = locked
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown[]>;
      const exit = room.exits.find((e) => (e as Record<string, unknown>).name === 'north') as Record<string, unknown>;
      expect(exit.door).toBe('locked');
    });

    test('area with userData includes userData', () => {
      const map = makeMinimalMap();
      map.areas[1].userData = { key1: 'value1' };
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown>;
      expect(area.userData).toEqual({ key1: 'value1' });
    });

    test('area with gridMode true includes gridMode', () => {
      const map = makeMinimalMap();
      map.areas[1].gridMode = true;
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown>;
      expect(area.gridMode).toBe(true);
    });

    test('room with non-empty userData includes userData', () => {
      const map = makeMinimalMap();
      map.rooms[1].userData = { foo: 'bar' };
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown>;
      expect(room.userData).toEqual({ foo: 'bar' });
    });

    test('room with non-default weight includes weight', () => {
      const map = makeMinimalMap();
      map.rooms[1].weight = 5;
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown>;
      expect(room.weight).toBe(5);
    });

    test('locked room has locked: true', () => {
      const map = makeMinimalMap();
      map.rooms[1].isLocked = true;
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown>;
      expect(room.locked).toBe(true);
    });

    test('room with symbol includes symbol object', () => {
      const map = makeMinimalMap();
      map.rooms[1].symbol = 'X';
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown>;
      expect(room.symbol).toEqual({ text: 'X' });
    });

    test('room with empty name has undefined name', () => {
      const map = makeMinimalMap();
      map.rooms[1].name = '';
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown>;
      expect(room.name).toBeUndefined();
    });

    test('room with hash includes hash', () => {
      const map = makeMinimalMap();
      map.rooms[1].hash = 'abc123';
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown>;
      expect(room.hash).toBe('abc123');
    });

    test('label with real pixMap produces chunked base64 image', () => {
      const map = makeMinimalMap();
      const label = makeMinimalLabel();
      label.pixMap = Buffer.from('some-image-data-that-is-long-enough-to-chunk');
      map.labels[1] = [label];
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const lbl = area.labels[0] as Record<string, unknown>;
      expect(lbl.image).toBeInstanceOf(Array);
      expect((lbl.image as string[]).length).toBeGreaterThan(0);
    });

    test('mUserData is included when non-empty', () => {
      const map = makeMinimalMap();
      map.mUserData = { mapKey: 'mapValue' };
      exportMap(map, '/tmp/out.json');
      expect(getWrittenJson().userData).toEqual({ mapKey: 'mapValue' });
    });

    test('font family with comma is truncated at first comma', () => {
      const map = makeMinimalMap();
      map.mapSymbolFont.family = 'Noto Sans,Helvetica';
      exportMap(map, '/tmp/out.json');
      const fontStr = getWrittenJson().mapSymbolFontDetails as string;
      expect(fontStr.startsWith('Noto Sans,')).toBe(true);
      expect(fontStr).not.toContain('Helvetica');
    });

    test('locked special exit has locked: true', () => {
      const map = makeMinimalMap();
      map.rooms[1].mSpecialExits = { 'push button': 2 };
      map.rooms[1].mSpecialExitLocks = [2];
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown[]>;
      const exit = room.exits.find((e) => (e as Record<string, unknown>).name === 'push button') as Record<string, unknown>;
      expect(exit.locked).toBe(true);
    });
  });

  describe('stub exits', () => {
    test('stubs are converted with direction names', () => {
      const map = makeMinimalMap();
      // direction index 0 = north, index 3 = east (1-based in stubs: 1=north, 4=east)
      map.rooms[1].stubs = [1, 4];
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown>;
      const stubs = room.stubExits as unknown[];
      expect(stubs).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'north' }),
        expect.objectContaining({ name: 'east' }),
      ]));
    });

    test('room with no stubs has undefined stubExits', () => {
      exportMap(makeMinimalMap(), '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown>;
      expect(room.stubExits).toBeUndefined();
    });
  });

  describe('custom lines', () => {
    // json-export.ts accesses customLines by SHORT direction name ('n', 'ne', etc.)
    // and only includes a custom line when the corresponding exit is active (!= -1).
    test('custom line encodes color, style, coordinates, and arrow', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 1;          // must be active for custom line to appear
      map.rooms[1].customLines = { n: [[0.0, 1.0], [2.0, 3.0]] };
      map.rooms[1].customLinesArrow = { n: true };
      map.rooms[1].customLinesColor = { n: { spec: 1, alpha: 255, r: 10, g: 20, b: 30, pad: 0 } };
      map.rooms[1].customLinesStyle = { n: 2 };
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown[]>;
      const exit = room.exits.find((e) => (e as Record<string, unknown>).name === 'north') as Record<string, unknown>;
      expect(exit.customLine).toMatchObject({
        color24RGB: [10, 20, 30],
        coordinates: [[0, 1], [2, 3]],
        endsInArrow: true,
        style: 'dash line',
      });
    });

    test('exit without custom line has undefined customLine', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 1;          // active exit, but no custom line defined
      exportMap(map, '/tmp/out.json');
      const areas = getWrittenJson().areas as unknown[];
      const area = areas[0] as Record<string, unknown[]>;
      const room = area.rooms[0] as Record<string, unknown[]>;
      const exit = room.exits.find((e) => (e as Record<string, unknown>).name === 'north') as Record<string, unknown>;
      expect(exit.customLine).toBeUndefined();
    });
  });

  describe('file output', () => {
    test('writes to the provided file path', () => {
      exportMap(makeMinimalMap(), '/my/map.json');
      expect(fsMock.writeFileSync).toHaveBeenCalledWith('/my/map.json', expect.any(String));
    });

    test('minified output has no indentation', () => {
      exportMap(makeMinimalMap(), '/my/map.json', true);
      const content = fsMock.writeFileSync.mock.calls[0][1] as string;
      expect(content).not.toMatch(/\n {2}/);
    });

    test('non-minified output is indented', () => {
      exportMap(makeMinimalMap(), '/my/map.json', false);
      const content = fsMock.writeFileSync.mock.calls[0][1] as string;
      expect(content).toMatch(/\n {2}/);
    });
  });
});
