import type { MudletArea, MudletColor, MudletFont, MudletLabel, MudletMap, MudletRoom } from '../src';

export const makeMinimalColor = (): MudletColor => ({
  spec: 1,
  alpha: 255,
  r: 0,
  g: 0,
  b: 0,
  pad: 0,
});

export const makeMinimalFont = (): MudletFont => ({
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

export const makeMinimalRoom = (id: number, areaId = 1): MudletRoom => ({
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
  // rawSpecialExits is intentionally absent: writeMap derives it from mSpecialExits before serializing
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

export const makeMinimalArea = (roomIds: number[]): MudletArea => ({
  rooms: [...roomIds],
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

export const makeMinimalMap = (): MudletMap => ({
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
export const makeMapWithSpecialExits = (): MudletMap => {
  const map = makeMinimalMap();
  map.rooms[1].mSpecialExits = { 'open door': 99, 'push lever': 100 };
  map.rooms[1].mSpecialExitLocks = [100];
  return map;
};

// Room with custom lines. Uses 'north' key — reader-export iterates keys freely.
// Style 1 = 'solid line' in reader-export's penStyles.
// Do NOT pass this fixture to json-export tests: json-export uses short direction names ('n')
// and its lineStyles map starts at 2, so style 1 would produce undefined.
export const makeMapWithCustomLines = (): MudletMap => {
  const map = makeMinimalMap();
  map.rooms[1].customLines = { north: [[0.0, 0.0], [1.0, 1.0]] };
  map.rooms[1].customLinesArrow = { north: true };
  map.rooms[1].customLinesColor = { north: makeMinimalColor() };
  map.rooms[1].customLinesStyle = { north: 1 };
  return map;
};

// Map with 2 areas and 3 rooms total
export const makeMultiAreaMap = (): MudletMap => {
  const map = makeMinimalMap();
  map.areaNames[2] = 'Second Area';
  map.areas[2] = makeMinimalArea([2, 3]);
  map.rooms[2] = makeMinimalRoom(2, 2);
  map.rooms[3] = makeMinimalRoom(3, 2);
  return map;
};

// Map with 2 areas: A=1 (rooms 1,2,3) and B=2 (rooms 10,11).
// Cross-area exits: room 2 (area 1) east → room 10 (area 2);
//                   room 10 (area 2) west → room 2 (area 1).
// Intra-area exits left as stubs/unset so they don't muddy mAreaExits.
export const makeCrossAreaMap = (): MudletMap => {
  const map = makeMinimalMap();
  map.areaNames[2] = 'Area B';
  map.areas[1] = makeMinimalArea([1, 2, 3]);
  map.areas[2] = makeMinimalArea([10, 11]);
  map.rooms[1] = makeMinimalRoom(1, 1);
  map.rooms[2] = makeMinimalRoom(2, 1);
  map.rooms[3] = makeMinimalRoom(3, 1);
  map.rooms[10] = makeMinimalRoom(10, 2);
  map.rooms[11] = makeMinimalRoom(11, 2);
  map.rooms[2].east = 10;
  map.rooms[10].west = 2;
  return map;
};

// Map with 4 rooms in area 1 spread across 2 z-levels with varying x/y,
// for exercising rebuildAreaExtents. Coordinates are picked so every
// min/max and every per-Z bound is distinct and so the y-sign inversion
// is observable (areas store -room.y; see TArea::calcSpan in Mudlet).
//
//   z=0: room 1 at (1,  2), room 2 at (5, -3)
//   z=1: room 3 at (0,  0), room 4 at (7,  4)
export const makeExtentsFixture = (): MudletMap => {
  const map = makeMinimalMap();
  map.areas[1] = makeMinimalArea([1, 2, 3, 4]);
  map.rooms[1] = { ...makeMinimalRoom(1, 1), x: 1, y: 2, z: 0 };
  map.rooms[2] = { ...makeMinimalRoom(2, 1), x: 5, y: -3, z: 0 };
  map.rooms[3] = { ...makeMinimalRoom(3, 1), x: 0, y: 0, z: 1 };
  map.rooms[4] = { ...makeMinimalRoom(4, 1), x: 7, y: 4, z: 1 };
  return map;
};

// Map with 3 rooms in area 1: rooms 1 and 2 carry distinct non-empty hashes,
// room 3 has no hash. Used to exercise rebuildRoomHashIndex — after a round
// trip, mpRoomDbHashToRoomId should contain the two hash keys and nothing else.
export const makeMapWithHashes = (): MudletMap => {
  const map = makeMinimalMap();
  map.areas[1] = makeMinimalArea([1, 2, 3]);
  map.rooms[1] = { ...makeMinimalRoom(1, 1), hash: 'hash-room-1' };
  map.rooms[2] = { ...makeMinimalRoom(2, 1), hash: 'hash-room-2' };
  map.rooms[3] = makeMinimalRoom(3, 1);
  map.mpRoomDbHashToRoomId = {
    'hash-room-1': 1,
    'hash-room-2': 2,
  };
  return map;
};

export const makeMinimalLabel = (): MudletLabel => ({
  id: 1,
  pos: [0, 0, 0],
  dummy1: 0,
  dummy2: 0,
  size: [100, 50],
  text: 'Test Label',
  fgColor: makeMinimalColor(),
  bgColor: makeMinimalColor(),
  pixMap: '',
  noScaling: false,
  showOnTop: false,
});

// Label with a real pixMap buffer (tiny valid-ish data) and areaId/labelId set
export const makeLabelWithPixMap = (): MudletLabel => ({
  ...makeMinimalLabel(),
  areaId: 1,
  labelId: 42,
  pixMap: Buffer.from('fake-image-data'),
});

// Map with one label in area 1
export const makeMapWithLabels = (): MudletMap => {
  const map = makeMinimalMap();
  map.labels[1] = [makeMinimalLabel()];
  return map;
};
