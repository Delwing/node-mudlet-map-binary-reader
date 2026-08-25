import type { MudletArea, MudletColor, MudletLabel, MudletMap } from './types';
import { uint8ToBase64 } from './base64';

/** Mirror of lodash `_.isEmpty` for the null/array/object values used here. */
function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return true;
}

const directions = [
  'north',
  'northeast',
  'northwest',
  'east',
  'west',
  'south',
  'southeast',
  'southwest',
  'up',
  'down',
  'in',
  'out',
] as const;

const directionShortNames = [
  'n', 'ne', 'nw', 'e', 'w', 's', 'se', 'sw', 'up', 'down', 'in', 'out',
] as const;

type Direction = (typeof directions)[number];
type ShortDirection = (typeof directionShortNames)[number];

const doorMap: (string | undefined)[] = [undefined, 'open', 'closed', 'locked'];

interface ColorOutput {
  color24RGB?: number[];
  color32RGBA?: number[];
}

interface CustomLineOutput extends ColorOutput {
  coordinates: [number, number][];
  endsInArrow: boolean;
  style: string | undefined;
}

interface ExitOutput {
  exitId: number;
  name: string;
  weight?: number;
  locked?: true;
  door?: string;
  customLine?: CustomLineOutput;
}

interface StubOutput {
  name: string;
  door?: string;
}

interface RoomOutput {
  id: number;
  name?: string;
  coordinates: [number, number, number];
  locked?: true;
  weight?: number;
  symbol?: { text: string };
  environment: number;
  hash?: string;
  exits: ExitOutput[];
  stubExits: StubOutput[] | undefined;
  userData?: Record<string, string>;
}

interface LabelOutput {
  colors: ColorOutput[];
  coordinates: [number, number, number];
  id: number;
  image: RegExpMatchArray | null;
  scaledels: boolean;
  showOnTop: boolean;
  text: string;
  size: [number, number];
}

interface AreaOutput {
  id: number;
  name: string;
  gridMode?: true;
  roomCount: number;
  rooms: RoomOutput[];
  userData?: Record<string, string>;
  labels?: LabelOutput[];
}

interface MapOutput {
  formatVersion: number;
  userData?: Record<string, string>;
  areas: AreaOutput[];
  areaCount: number;
  roomCount: number;
  labelCount: number;
  defaultAreaName: string;
  anonymousAreaName: string;
  envToColorMapping: Record<number, number>;
  playersRoomId: Record<string, number>;
  customEnvColors: (ColorOutput & { id: number })[];
  mapSymbolFontDetails: string;
  mapSymbolFontFudgeFactor: number;
  onlyMapSymbolFontToBeUsed: boolean;
  playerRoomColors: ColorOutput[];
  playerRoomInnerDiameterPercentage: number;
  playerRoomOuterDiameterPercentage: number;
  playerRoomStyle: number;
}

const lineStyles: Record<number, string> = {
  2: 'dash line',
  3: 'dot line',
  4: 'dash dot line',
  5: 'dash dot dot line',
};

function convertColor(color: MudletColor): ColorOutput {
  const colorArray = [color.r, color.g, color.b];
  if (color.alpha < 255) {
    return { color32RGBA: [...colorArray, color.alpha] };
  }
  return { color24RGB: colorArray };
}

function convertLineStyle(style: number): string | undefined {
  return lineStyles[style];
}

function getExitWeight(direction: string, weights: Record<string, number>, defaultValue: number): number | undefined {
  const weight = weights[direction];
  if (weight === undefined || weight === defaultValue) {
    return undefined;
  }
  return weight;
}

function convertCustomLine(
  coordinates: [number, number][] | undefined,
  arrow: boolean | undefined,
  color: MudletColor | undefined,
  style: number | undefined
): CustomLineOutput | undefined {
  if (coordinates === undefined || isEmpty(coordinates) || color === undefined) {
    return undefined;
  }
  return {
    ...convertColor(color),
    coordinates,
    endsInArrow: arrow ?? false,
    style: style !== undefined ? convertLineStyle(style) : undefined,
  };
}

function convertStubExits(stubs: number[], doors: Record<string, number>): StubOutput[] | undefined {
  if (stubs.length === 0) {
    return undefined;
  }
  return stubs.map((dirNum) => {
    const direction = directions[dirNum - 1];
    const shortDirection = directionShortNames[dirNum - 1];
    return {
      name: direction,
      door: doors[shortDirection] !== undefined ? doorMap[doors[shortDirection]] : undefined,
    };
  });
}

function chunkString(str: string, length: number): RegExpMatchArray | null {
  return str.match(new RegExp(`.{1,${length}}`, 'g'));
}

function convertLabel(label: MudletLabel): LabelOutput {
  return {
    colors: [convertColor(label.fgColor), convertColor(label.bgColor)],
    coordinates: [label.pos[0], label.pos[1], label.pos[2]],
    id: label.id,
    image: chunkString(uint8ToBase64(label.pixMap as Uint8Array), 64),
    scaledels: !label.noScaling,
    showOnTop: label.showOnTop,
    text: label.text,
    size: [label.size[0], label.size[1]],
  };
}

function convertRoom(roomId: number, map: MudletMap): RoomOutput {
  const room = map.rooms[roomId];
  const exits: ExitOutput[] = [];

  for (let i = 0; i < directions.length; i++) {
    const direction = directions[i] as Direction;
    const shortDirection = directionShortNames[i] as ShortDirection;
    const destId = room[direction] as number;
    if (destId !== -1) {
      exits.push({
        exitId: destId,
        name: direction,
        weight: getExitWeight(shortDirection, room.exitWeights, 1),
        locked: room.exitLocks?.find((num) => i === num - 1) ? true : undefined,
        door: room.doors[shortDirection] !== undefined ? doorMap[room.doors[shortDirection]] : undefined,
        customLine: convertCustomLine(
          room.customLines[shortDirection],
          room.customLinesArrow[shortDirection],
          room.customLinesColor[shortDirection],
          room.customLinesStyle[shortDirection]
        ),
      });
    }
  }

  for (const specialExit in room.mSpecialExits) {
    const destId = room.mSpecialExits[specialExit];
    exits.push({
      name: specialExit,
      exitId: destId,
      weight: getExitWeight(specialExit, room.exitWeights, 1),
      locked: room.mSpecialExitLocks?.includes(specialExit) ? true : undefined,
      door: room.doors[specialExit] !== undefined ? doorMap[room.doors[specialExit]] : undefined,
      customLine: convertCustomLine(
        room.customLines[specialExit],
        room.customLinesArrow[specialExit],
        room.customLinesColor[specialExit],
        room.customLinesStyle[specialExit]
      ),
    });
  }

  return {
    id: roomId,
    name: room.name !== '' ? room.name : undefined,
    coordinates: [room.x, room.y, room.z],
    locked: room.isLocked ? true : undefined,
    weight: room.weight !== 1 ? room.weight : undefined,
    symbol: room.symbol !== '' ? { text: room.symbol } : undefined,
    environment: room.environment,
    hash: room.hash,
    exits,
    stubExits: convertStubExits(room.stubs, room.doors),
    userData: isEmpty(room.userData) ? undefined : room.userData,
  };
}

function convertArea(area: MudletArea, areaid: string, map: MudletMap): AreaOutput {
  const id = parseInt(areaid);
  const converted: AreaOutput = {
    id,
    name: map.areaNames[id] ?? '',
    gridMode: area.gridMode ? true : undefined,
    roomCount: area.rooms.length,
    rooms: area.rooms.map((roomId) => convertRoom(roomId, map)).sort((a, b) => a.id - b.id),
  };
  if (!isEmpty(area.userData)) {
    converted.userData = area.userData;
  }
  if (!isEmpty(map.labels[id])) {
    converted.labels = map.labels[id].map(convertLabel);
  }
  return converted;
}

function convertMapToMudletFormat(map: MudletMap): MapOutput {
  const areas = Object.entries(map.areas)
    .map(([areaid, area]) => convertArea(area, areaid, map))
    .sort((a, b) => a.id - b.id);

  const customEnvColors = Object.entries(map.mCustomEnvColors).map(([index, color]) => {
    const converted = convertColor(color);
    return { ...converted, id: parseInt(index) };
  });

  const f = map.mapSymbolFont;
  const firstFamilyComma = f.family.indexOf(',');
  const family = firstFamilyComma > -1 ? f.family.substring(0, firstFamilyComma) : f.family;
  const fontString = `${family},${f.pointSize},${f.pixelSize},${f.styleHint},${f.weight},${
    f.styleSetting ? 1 : 0
  },${f.underline ? 1 : 0},${f.strikeOut ? 1 : 0},${f.fixedPitch ? 1 : 0},0`;

  return {
    formatVersion: 1.0,
    ...(isEmpty(map.mUserData) ? {} : { userData: map.mUserData }),
    areas,
    areaCount: Object.keys(map.areas).length,
    roomCount: Object.keys(map.rooms).length,
    labelCount: Object.values(map.labels).flat().length,
    defaultAreaName: 'Default Area',
    anonymousAreaName: 'Unnamed Area',
    envToColorMapping: map.envColors,
    playersRoomId: map.mRoomIdHash,
    customEnvColors,
    mapSymbolFontDetails: fontString,
    mapSymbolFontFudgeFactor: map.mapFontFudgeFactor,
    onlyMapSymbolFontToBeUsed: map.useOnlyMapFont,
    playerRoomColors: [{ color24RGB: [255, 0, 0] }, { color24RGB: [255, 255, 255] }],
    playerRoomInnerDiameterPercentage: 70,
    playerRoomOuterDiameterPercentage: 120,
    playerRoomStyle: 0,
  };
}

/**
 * Convert a map model to the Mudlet JSON export format.
 *
 * Pure: returns the JSON string. Persist it with your tool of choice.
 *
 * @param map - the Mudlet map model
 * @param minified - if true, JSON is emitted without indentation
 */
export default function exportMap(map: MudletMap, minified?: boolean): string {
  const mudletMap = convertMapToMudletFormat(map);
  return JSON.stringify(mudletMap, null, minified ? 0 : 2);
}
