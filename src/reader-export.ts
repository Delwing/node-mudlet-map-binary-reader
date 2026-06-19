import _ from 'lodash';
import type { MudletColor, MudletLabel, MudletMap, MudletRoom } from './types';
import mudletColors from '../mudlet-colors.json';

const roomExits = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down', 'in', 'out'] as const;
type RoomExit = (typeof roomExits)[number];

const penStyles: Record<number, string> = {
  1: 'solid line',
  2: 'dash line',
  3: 'dot line',
  4: 'dash dot line',
  5: 'dash dot dot line',
};

/** RGB color for the JS Mudlet Map Renderer. */
export interface RendererColor {
  r: number;
  g: number;
  b: number;
}

/** A custom line between rooms, with waypoints and visual attributes. */
export interface RendererCustomLine {
  points: { x: number; y: number }[];
  attributes: {
    color: RendererColor;
    style: string;
    arrow: boolean;
  };
}

/**
 * A room as consumed by the JS Mudlet Map Renderer.
 *
 * Preserves every field from {@link MudletRoom} (`x`, `y`, `z`, `weight`, `name`,
 * `userData`, `doors`, `exitLocks`, `stubs`, `exitWeights`, `mSpecialExitLocks`,
 * `isLocked`, …) and only remaps the per-direction exits, special exits, custom lines,
 * environment, and symbol fields.
 */
export type RendererRoom = Omit<
  MudletRoom,
  | 'north' | 'northeast' | 'east' | 'southeast'
  | 'south' | 'southwest' | 'west' | 'northwest'
  | 'up' | 'down' | 'in' | 'out'
  | 'environment' | 'symbol'
  | 'mSpecialExits'
  | 'customLines' | 'customLinesArrow' | 'customLinesColor' | 'customLinesStyle'
  | 'hash'
> & {
  id: number;
  env?: number;
  roomChar?: string;
  exits: Record<string, number>;
  specialExits: Record<string, number>;
  customLines: Record<string, RendererCustomLine>;
  hash?: string;
};

/**
 * A map label as consumed by the JS Mudlet Map Renderer.
 *
 * Preserves every field from {@link MudletLabel} (`id`, `areaId`, `labelId`, …) other than
 * the ones that are renamed (`pos` → X/Y/Z, `size` → Width/Height, `text` → Text,
 * `fgColor`/`bgColor` → FgColor/BgColor) or dropped (`dummy1`, `dummy2`).
 * `pixMap` is always base64-encoded inline.
 */
export type RendererLabel = Omit<
  MudletLabel,
  'pos' | 'size' | 'text' | 'fgColor' | 'bgColor'
  | 'dummy1' | 'dummy2'
  | 'pixMap'
> & {
  X: number;
  Y: number;
  Z: number;
  Width: number;
  Height: number;
  Text: string;
  FgColor: Omit<MudletColor, 'spec' | 'pad'>;
  BgColor: Omit<MudletColor, 'spec' | 'pad'>;
  pixMap: string;
};

/** An area with its rooms and labels, formatted for the JS Mudlet Map Renderer. */
export interface RendererArea {
  areaName: string;
  areaId: string;
  rooms: RendererRoom[];
  labels: RendererLabel[];
}

/** Complete renderer export: map data (areas/rooms/labels) and environment color palette. */
export interface RendererExport {
  mapData: RendererArea[];
  colors: { envId: number; colors: number[] }[];
}

function convertRoom(roomId: number, room: MudletRoom, hash?: string): RendererRoom {
  const exits: Record<string, number> = {};
  for (const key of roomExits) {
    const dest = room[key as RoomExit];
    if (dest !== -1) {
      exits[key] = dest;
    }
  }

  const customLines: Record<string, RendererCustomLine> = {};
  for (const key in room.customLines) {
    if (Object.hasOwn(room.customLines, key)) {
      const color = room.customLinesColor[key];
      customLines[key] = {
        points: room.customLines[key].map(([x, y]) => ({ x, y })),
        attributes: {
          color: { r: color.r, g: color.g, b: color.b },
          style: penStyles[room.customLinesStyle[key]],
          arrow: room.customLinesArrow[key],
        },
      };
    }
  }

  // Mirror 0.6.0: spread the original room (preserving x, y, z, weight, name,
  // userData, doors, exitLocks, stubs, exitWeights, mSpecialExitLocks, isLocked, …),
  // strip the per-direction exit keys and custom-line working fields, and rename
  // mSpecialExits/environment/symbol. environment and symbol are only renamed when
  // truthy (matching 0.6.0's `if (room.environment)` / `if (room.symbol)` checks).
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    north: _n, northeast: _ne, east: _e, southeast: _se,
    south: _s, southwest: _sw, west: _w, northwest: _nw,
    up: _u, down: _d, in: _in, out: _out,
    mSpecialExits,
    customLines: _cl, customLinesArrow: _cla, customLinesColor: _clc, customLinesStyle: _cls,
    environment, symbol, hash: _h,
    ...rest
  } = room;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const result: RendererRoom = {
    ...rest,
    id: roomId,
    exits,
    specialExits: mSpecialExits,
    customLines,
  };
  if (environment) result.env = environment;
  if (symbol) result.roomChar = symbol;
  if (hash) result.hash = hash;
  return result;
}

function convertLabel(label: MudletLabel): RendererLabel {
  const pixMap = Buffer.from(label.pixMap as Uint8Array).toString('base64');

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { spec: _fSpec, pad: _fPad, ...fgColor } = label.fgColor;
  const { spec: _bSpec, pad: _bPad, ...bgColor } = label.bgColor;

  // Mirror 0.6.0: spread the original label (preserving id, areaId, labelId, …),
  // strip the renamed/dropped fields, and add the renderer-shaped fields.
  const {
    pos, size, text,
    fgColor: _fg, bgColor: _bg,
    dummy1: _d1, dummy2: _d2,
    pixMap: _pm,
    ...rest
  } = label;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return {
    ...rest,
    X: pos[0],
    Y: pos[1],
    Z: pos[2],
    Width: size[0],
    Height: size[1],
    Text: text,
    FgColor: fgColor,
    BgColor: bgColor,
    pixMap,
  };
}

type MudletColorsJson = Record<string, number[]>;
const mudletColorsTyped = mudletColors as MudletColorsJson;

function generateColors(map: MudletMap): { envId: number; colors: number[] }[] {
  const customEnvColors = map.mCustomEnvColors;
  const colors: Record<number, number[]> = {};

  for (let i = 0; i <= 255; i++) {
    if (i !== 16) {
      const key = `ansi_${String(i).padStart(3, '0')}`;
      let envId: number;
      if (i === 0 || i === 8) {
        envId = i + 8;
      } else {
        envId = i;
      }
      colors[envId] = mudletColorsTyped[key];
    }
  }

  for (const key in customEnvColors) {
    if (Object.hasOwn(customEnvColors, key)) {
      const element = customEnvColors[key as unknown as number];
      colors[key as unknown as number] = [element.r, element.g, element.b];
    }
  }

  for (const key in map.envColors) {
    if (Object.hasOwn(map.envColors, key)) {
      const element = map.envColors[key as unknown as number];
      if (colors[key as unknown as number]) {
        const ansiKey = `ansi_${String(element).padStart(3, '0')}`;
        colors[key as unknown as number] = mudletColorsTyped[ansiKey];
      }
    }
  }

  return Object.entries(colors).map(([key, value]) => ({
    envId: parseInt(key),
    colors: value,
  }));
}

/**
 * Exports model into format understandable by JS Mudlet Map Renderer - https://github.com/Delwing/js-mudlet-map-renderer
 *
 * @param mapModel - the Mudlet map model
 * @param directory - directory path; if provided, writes export as .js and .json files
 * @returns exported map data and colors
 */
/**
 * Build the renderer-ready export (`{ mapData, colors }`) from a Mudlet map
 * model. Pure: returns the data, never touches disk. Persist with your
 * tool of choice (`fs.writeFileSync`, a `Blob`, an HTTP response, …).
 */
export default function readerExport(mapModel: MudletMap): RendererExport {
  const map = _.cloneDeep(mapModel);
  const mapData: RendererArea[] = [];
  const roomToHash = Object.entries(map.mpRoomDbHashToRoomId).reduce<Record<number, string>>(
    (acc, [key, value]) => {
      acc[value] = key;
      return acc;
    },
    {}
  );

  for (const key in map.areas) {
    if (Object.hasOwn(map.areas, key)) {
      const areaId = key as unknown as number;
      const element = map.areas[areaId];
      const area: RendererArea = {
        areaName: map.areaNames[areaId],
        areaId: key,
        rooms: element.rooms.map((roomId) =>
          convertRoom(roomId, map.rooms[roomId], roomToHash[roomId])
        ),
        labels: map.labels[areaId]
          ? map.labels[areaId].map((label) => convertLabel(label))
          : [],
      };
      mapData.push(area);
    }
  }

  const colors = generateColors(map);

  return { mapData, colors };
}
