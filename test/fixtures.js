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

const makeMinimalArea = (roomIds) => ({
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

// Room with custom lines. Uses 'north' key — reader-export iterates keys freely.
// Style 1 = 'solid line' in reader-export's penStyles.
// Do NOT pass this fixture to json-export tests: json-export uses short direction names ('n')
// and its lineStyles map starts at 2, so style 1 would produce undefined.
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
