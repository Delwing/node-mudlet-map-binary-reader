'use strict';

jest.mock('fs');
const fs = require('fs');
const exportMap = require('../json-export');
const { makeMinimalMap, makeMultiAreaMap, makeMinimalColor } = require('./fixtures');

function getWrittenJson() {
  expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  return JSON.parse(fs.writeFileSync.mock.calls[0][1]);
}

describe('json-export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.writeFileSync.mockImplementation(() => {});
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
      const area = getWrittenJson().areas[0];
      expect(area.id).toBe(1);
      expect(area.name).toBe('Test Area');
    });

    test('room coordinates are packed into array', () => {
      const map = makeMinimalMap();
      map.rooms[1].x = 3;
      map.rooms[1].y = -2;
      map.rooms[1].z = 1;
      exportMap(map, '/tmp/out.json');
      const room = getWrittenJson().areas[0].rooms[0];
      expect(room.coordinates).toEqual([3, -2, 1]);
    });

    test('standard exit with default weight has no weight field', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 1;
      map.rooms[1].exitWeights = {};
      exportMap(map, '/tmp/out.json');
      const exit = getWrittenJson().areas[0].rooms[0].exits.find(e => e.name === 'north');
      expect(exit).toBeDefined();
      expect(exit.weight).toBeUndefined();
    });

    test('standard exit with non-default weight includes weight', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 1;
      map.rooms[1].exitWeights = { n: 5 };
      exportMap(map, '/tmp/out.json');
      const exit = getWrittenJson().areas[0].rooms[0].exits.find(e => e.name === 'north');
      expect(exit.weight).toBe(5);
    });

    test('special exit appears in exits array with correct exitId', () => {
      const map = makeMinimalMap();
      map.rooms[1].mSpecialExits = { 'climb ladder': 2 };
      map.rooms[1].mSpecialExitLocks = [];
      exportMap(map, '/tmp/out.json');
      const exit = getWrittenJson().areas[0].rooms[0].exits.find(e => e.name === 'climb ladder');
      expect(exit).toBeDefined();
      expect(exit.exitId).toBe(2);
    });

    test('locked special exit has locked: true', () => {
      const map = makeMinimalMap();
      map.rooms[1].mSpecialExits = { 'push button': 2 };
      map.rooms[1].mSpecialExitLocks = [2];
      exportMap(map, '/tmp/out.json');
      const exit = getWrittenJson().areas[0].rooms[0].exits.find(e => e.name === 'push button');
      expect(exit.locked).toBe(true);
    });
  });

  describe('stub exits', () => {
    test('stubs are converted with direction names', () => {
      const map = makeMinimalMap();
      // direction index 0 = north, index 3 = east (1-based in stubs: 1=north, 4=east)
      map.rooms[1].stubs = [1, 4];
      exportMap(map, '/tmp/out.json');
      const stubs = getWrittenJson().areas[0].rooms[0].stubExits;
      expect(stubs).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'north' }),
        expect.objectContaining({ name: 'east' }),
      ]));
    });

    test('room with no stubs has undefined stubExits', () => {
      exportMap(makeMinimalMap(), '/tmp/out.json');
      const room = getWrittenJson().areas[0].rooms[0];
      expect(room.stubExits).toBeUndefined();
    });
  });

  describe('custom lines', () => {
    // json-export.js accesses customLines by SHORT direction name ('n', 'ne', etc.)
    // and only includes a custom line when the corresponding exit is active (!= -1).
    test('custom line encodes color, style, coordinates, and arrow', () => {
      const map = makeMinimalMap();
      map.rooms[1].north = 1;          // must be active for custom line to appear
      map.rooms[1].customLines = { n: [[0.0, 1.0], [2.0, 3.0]] };
      map.rooms[1].customLinesArrow = { n: true };
      map.rooms[1].customLinesColor = { n: { spec: 1, alpha: 255, r: 10, g: 20, b: 30, pad: 0 } };
      map.rooms[1].customLinesStyle = { n: 2 };
      exportMap(map, '/tmp/out.json');
      const exit = getWrittenJson().areas[0].rooms[0].exits.find(e => e.name === 'north');
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
      const exit = getWrittenJson().areas[0].rooms[0].exits.find(e => e.name === 'north');
      expect(exit.customLine).toBeUndefined();
    });
  });

  describe('file output', () => {
    test('writes to the provided file path', () => {
      exportMap(makeMinimalMap(), '/my/map.json');
      expect(fs.writeFileSync).toHaveBeenCalledWith('/my/map.json', expect.any(String));
    });

    test('minified output has no indentation', () => {
      exportMap(makeMinimalMap(), '/my/map.json', true);
      const content = fs.writeFileSync.mock.calls[0][1];
      expect(content).not.toMatch(/\n  /);
    });

    test('non-minified output is indented', () => {
      exportMap(makeMinimalMap(), '/my/map.json', false);
      const content = fs.writeFileSync.mock.calls[0][1];
      expect(content).toMatch(/\n  /);
    });
  });
});
