import fs from 'fs';
import _ from 'lodash';
import type { MudletColor, MudletLabel, MudletMap, MudletRoom } from './types';
import mudletColors from '../mudlet-colors.json';

const roomExits = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down', 'in', 'out'] as const;
type RoomExit = (typeof roomExits)[number];

const penStyles: Record<number, string> = {
  1: 'solid line',
  2: 'dash line',
  3: 'dot line',
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

/** A room as consumed by the JS Mudlet Map Renderer. */
export interface RendererRoom {
  id: number;
  area: number;
  env?: number;
  roomChar?: string;
  exits: Record<string, number>;
  specialExits: Record<string, number>;
  customLines: Record<string, RendererCustomLine>;
  hash?: string;
}

/** A map label as consumed by the JS Mudlet Map Renderer. */
export interface RendererLabel {
  X: number;
  Y: number;
  Z: number;
  Width: number;
  Height: number;
  Text: string;
  FgColor: Omit<MudletColor, 'spec' | 'pad'>;
  BgColor: Omit<MudletColor, 'spec' | 'pad'>;
  pixMap: string;
}

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
  roomExits.forEach((key) => {
    const dest = room[key as RoomExit] as number;
    if (dest !== -1) {
      exits[key] = dest;
    }
  });

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

  return {
    id: roomId,
    area: room.area,
    ...(room.environment !== undefined ? { env: room.environment } : {}),
    ...(room.symbol ? { roomChar: room.symbol } : {}),
    exits,
    specialExits: room.mSpecialExits,
    customLines,
    ...(hash ? { hash } : {}),
  };
}

function convertLabel(label: MudletLabel, directory?: string): RendererLabel {
  let pixMap: string;
  if (directory) {
    if (!fs.existsSync(`${directory}/labels`)) {
      fs.mkdirSync(`${directory}/labels`);
    }
    fs.writeFileSync(
      `${directory}/labels/${label.areaId}-${label.labelId}.png`,
      Buffer.from(label.pixMap as Buffer)
    );
    pixMap = '';
  } else {
    pixMap = Buffer.from(label.pixMap as Buffer).toString('base64');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { spec: _fSpec, pad: _fPad, ...fgColor } = label.fgColor;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { spec: _bSpec, pad: _bPad, ...bgColor } = label.bgColor;

  return {
    X: label.pos[0],
    Y: label.pos[1],
    Z: label.pos[2],
    Width: label.size[0],
    Height: label.size[1],
    Text: label.text,
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
export default function readerExport(mapModel: MudletMap, directory?: string): RendererExport {
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
          ? map.labels[areaId].map((label) => convertLabel(label, directory))
          : [],
      };
      mapData.push(area);
    }
  }

  const colors = generateColors(map);

  if (directory) {
    fs.writeFileSync(`${directory}/mapExport.js`, 'mapData = ' + JSON.stringify(mapData));
    fs.writeFileSync(`${directory}/colors.js`, 'colors = ' + JSON.stringify(colors));
    fs.writeFileSync(`${directory}/mapExport.json`, JSON.stringify(mapData));
    fs.writeFileSync(`${directory}/colors.json`, JSON.stringify(colors));
  }

  return { mapData, colors };
}
