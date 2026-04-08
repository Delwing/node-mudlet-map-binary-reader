# Jest Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Jest test suite covering binary round-trip read/write and the two export transforms, written in plain JS so no test code changes are needed during the TypeScript rewrite.

**Architecture:** Layered approach — round-trip integration tests exercise `readMap`/`writeMap` through temp files; unit tests for `reader-export` and `json-export` use constructed JS objects as input. All tests call through the public API or well-defined function inputs. A shared `test/fixtures.js` module provides factory functions that build minimal valid `MudletMap` objects so no real `.dat` files are needed.

**Tech Stack:** Jest 29, Node.js `os.tmpdir()` for temp files, Jest's `jest.mock` for `fs` isolation in export tests.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `jest` dev dependency and `test` script |
| `jest.config.js` | Create | Jest configuration |
| `test/fixtures.js` | Create | Factory functions: `makeMinimalMap`, `makeRoomWithSpecialExits`, `makeRoomWithCustomLines` |
| `test/map-operations.test.js` | Create | Round-trip tests for `readMap` / `writeMap` |
| `test/reader-export.test.js` | Create | Unit tests for `reader-export.js` transform |
| `test/json-export.test.js` | Create | Unit tests for `json-export.js` transform |

---

### Task 1: Install Jest and configure

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`

- [ ] **Step 1: Install Jest**

```bash
npm install --save-dev jest
```

Expected output: jest added under `devDependencies` in `package.json`.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add `scripts` and `devDependencies` (npm install already added devDependencies; just add the script):

```json
{
  "name": "mudlet-map-binary-reader",
  "version": "0.6.1",
  "scripts": {
    "test": "jest"
  },
  ...
}
```

- [ ] **Step 3: Create jest.config.js**

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
};
```

- [ ] **Step 4: Verify Jest runs (no tests yet)**

```bash
npm test
```

Expected: `No tests found` or `Test Suites: 0` — no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json jest.config.js
git commit -m "chore: add jest test infrastructure"
```

---

### Task 2: Create test fixtures

**Files:**
- Create: `test/fixtures.js`

These factories build the minimal in-memory objects that `writeMap` accepts. Key constraints:
- All `MudletRoom` fields must be present (required by qtdatastream serialization)
- `mSpecialExits` / `mSpecialExitLocks` are the JS-layer fields; `writeMap` converts them to `rawSpecialExits` before serializing
- `QColor` requires `{ spec, alpha, r, g, b, pad }` — all 0–255
- `QVector` serializes as `[x, y, z]` (3 doubles)
- `QFont.toBuffer` only uses `fontBits` raw — boolean fields (`kerning`, etc.) are derived on read; ensure they match `fontBits`

- [ ] **Step 1: Create test/fixtures.js**

```js
'use strict';

const makeMinimalColor = () => ({ spec: 1, alpha: 255, r: 0, g: 0, b: 0, pad: 0 });

const makeMinimalFont = () => ({
  family: 'Arial',
  style: '',
  pointSize: 12.0,
  pixelSize: -1,
  styleHint: 5,
  styleStrategy: 1,
  weight: 50,
  fontBits: 16,        // 0x10 = kerning bit only
  stretch: 100,
  extendedFontBits: 0,
  letterSpacing: 0,
  wordSpacing: 0,
  hintingPreference: 0,
  capital: 0,
  styleSetting: false,
  underline: false,
  overline: false,
  strikeOut: false,
  fixedPitch: false,
  kerning: true,       // matches fontBits 0x10
  styleOblique: false,
  ignorePitch: false,
  letterSpacingIsAbsolute: false,
});

const makeMinimalRoom = (id, areaId = 1) => ({
  area: areaId,
  x: 0,
  y: 0,
  z: 0,
  north: -1,
  northeast: -1,
  east: -1,
  southeast: -1,
  south: -1,
  southwest: -1,
  west: -1,
  northwest: -1,
  up: -1,
  down: -1,
  in: -1,
  out: -1,
  environment: 1,
  weight: 1,
  name: `Room ${id}`,
  isLocked: false,
  mSpecialExits: {},
  mSpecialExitLocks: [],
  symbol: '',
  userData: {},
  customLines: {},
  customLinesArrow: {},
  customLinesColor: {},
  customLinesStyle: {},
  exitLocks: [],
  stubs: [],
  exitWeights: {},
  doors: {},
});

const makeMinimalArea = (roomIds) => ({
  rooms: roomIds,
  zLevels: [0],
  mAreaExits: {},
  gridMode: false,
  max_x: 0,
  max_y: 0,
  max_z: 0,
  min_x: 0,
  min_y: 0,
  min_z: 0,
  span: [0, 0, 0],
  xmaxForZ: {},
  ymaxForZ: {},
  xminForZ: {},
  yminForZ: {},
  pos: [0, 0, 0],
  isZone: false,
  zoneAreaRef: -1,
  userData: {},
});

const makeMinimalMap = () => ({
  version: 20,
  envColors: {},
  areaNames: { 1: 'Test Area' },
  mCustomEnvColors: {},
  mpRoomDbHashToRoomId: {},
  mUserData: {},
  mapSymbolFont: makeMinimalFont(),
  mapFontFudgeFactor: 1.0,
  useOnlyMapFont: false,
  areas: { 1: makeMinimalArea([1]) },
  mRoomIdHash: {},
  labels: {},
  rooms: { 1: makeMinimalRoom(1) },
});

// Room with unlocked and locked special exits.
// Targets are fictional room IDs (99, 100) — they don't need to exist in the map.
// mSpecialExitLocks is per destination room ID: 100 is locked, 99 is not.
const makeMapWithSpecialExits = () => {
  const map = makeMinimalMap();
  map.rooms[1].mSpecialExits = { 'open door': 99, 'push lever': 100 };
  map.rooms[1].mSpecialExitLocks = [100];
  return map;
};

// Room with custom lines
const makeMapWithCustomLines = () => {
  const map = makeMinimalMap();
  map.rooms[1].customLines = { north: [[0.0, 0.0], [1.0, 1.0]] };
  map.rooms[1].customLinesArrow = { north: true };
  map.rooms[1].customLinesColor = { north: makeMinimalColor() };
  map.rooms[1].customLinesStyle = { north: 1 };
  return map;
};

// Map with 2 areas and 3 rooms total
const makeMultiAreaMap = () => {
  const map = makeMinimalMap();
  map.areaNames[2] = 'Second Area';
  map.areas[2] = makeMinimalArea([2, 3]);
  map.rooms[2] = makeMinimalRoom(2, 2);
  map.rooms[3] = makeMinimalRoom(3, 2);
  return map;
};

module.exports = {
  makeMinimalColor,
  makeMinimalFont,
  makeMinimalRoom,
  makeMinimalArea,
  makeMinimalMap,
  makeMapWithSpecialExits,
  makeMapWithCustomLines,
  makeMultiAreaMap,
};
```

- [ ] **Step 2: Verify the fixtures file loads without error**

```bash
node -e "const f = require('./test/fixtures'); console.log(Object.keys(f));"
```

Expected output:
```
[
  'makeMinimalColor',
  'makeMinimalFont',
  'makeMinimalRoom',
  'makeMinimalArea',
  'makeMinimalMap',
  'makeMapWithSpecialExits',
  'makeMapWithCustomLines',
  'makeMultiAreaMap'
]
```

- [ ] **Step 3: Commit**

```bash
git add test/fixtures.js
git commit -m "test: add map fixture factory functions"
```

---

### Task 3: Basic round-trip test

**Files:**
- Create: `test/map-operations.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run the test**

```bash
npm test -- --testPathPattern=map-operations
```

Expected: PASS (the existing code should handle a minimal map).

- [ ] **Step 3: Commit**

```bash
git add test/map-operations.test.js
git commit -m "test: basic map round-trip test"
```

---

### Task 4: Special exits round-trip test

**Files:**
- Modify: `test/map-operations.test.js`

- [ ] **Step 1: Add special exits test inside the existing `describe` block**

Add after the existing `test(...)` block, inside `describe('readMap / writeMap round-trip', () => {`:

```js
  test('special exits and locks survive write → read', () => {
    const input = makeMapWithSpecialExits();
    // room 1 has 'open door' → 99 (unlocked), 'push lever' → 100 (locked)

    MudletMapReader.write(input, tmpFile);
    const result = MudletMapReader.read(tmpFile);

    expect(result.rooms[1].mSpecialExits).toEqual({
      'open door': 99,
      'push lever': 100,
    });
    expect(result.rooms[1].mSpecialExitLocks).toEqual([100]);
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
```

Also add `makeMapWithSpecialExits` to the require at the top:
```js
const { makeMinimalMap, makeMapWithSpecialExits } = require('./fixtures');
```

- [ ] **Step 2: Run the tests**

```bash
npm test -- --testPathPattern=map-operations
```

Expected: all 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add test/map-operations.test.js
git commit -m "test: special exits round-trip tests"
```

---

### Task 5: Multi-area round-trip test

**Files:**
- Modify: `test/map-operations.test.js`

- [ ] **Step 1: Add multi-area test and update require**

Update the require line at the top:
```js
const { makeMinimalMap, makeMapWithSpecialExits, makeMultiAreaMap } = require('./fixtures');
```

Add inside the `describe` block:

```js
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
```

- [ ] **Step 2: Run the tests**

```bash
npm test -- --testPathPattern=map-operations
```

Expected: all 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add test/map-operations.test.js
git commit -m "test: multi-area round-trip test"
```

---

### Task 6: reader-export unit tests

**Files:**
- Create: `test/reader-export.test.js`

`reader-export` is the default export from `reader-export.js` — it's `(mapModel, directory?) => { mapData, colors }`.  
It calls `_.cloneDeep` internally, so the input is never mutated.  
`fs.writeFileSync` is called only when `directory` is provided — mock `fs` for that test.

- [ ] **Step 1: Create test/reader-export.test.js**

```js
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
```

- [ ] **Step 2: Run the tests**

```bash
npm test -- --testPathPattern=reader-export
```

Expected: all tests PASS. If any fail, inspect the output — likely a field name mismatch in the fixture.

- [ ] **Step 3: Commit**

```bash
git add test/reader-export.test.js
git commit -m "test: reader-export unit tests"
```

---

### Task 7: json-export unit tests

**Files:**
- Create: `test/json-export.test.js`

`json-export` exports `exportMap(map, mapFile, minified)` which calls `fs.writeFileSync`. Mock `fs`.  
The converter reads from the raw `MudletMap` model — same object shape as `readMap` returns, including `mSpecialExits` on rooms.

- [ ] **Step 1: Create test/json-export.test.js**

```js
'use strict';

jest.mock('fs');
const fs = require('fs');
const exportMap = require('../json-export');
const { makeMinimalMap, makeMinimalColor } = require('./fixtures');

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
      exportMap(makeMinimalMap(), '/tmp/out.json');
      const result = getWrittenJson();
      expect(result.areaCount).toBe(1);
      expect(result.roomCount).toBe(1);
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
```

- [ ] **Step 2: Run the tests**

```bash
npm test -- --testPathPattern=json-export
```

Expected: all tests PASS.

- [ ] **Step 3: Run all tests together**

```bash
npm test
```

Expected: all test suites PASS.

- [ ] **Step 4: Commit**

```bash
git add test/json-export.test.js
git commit -m "test: json-export unit tests"
```
