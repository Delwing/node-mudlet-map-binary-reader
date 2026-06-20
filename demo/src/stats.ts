import type { MudletMap, MudletRoom } from '../../src/types';

const CARDINAL_DIRS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'up',
  'down',
  'in',
  'out',
] as const satisfies readonly (keyof MudletRoom)[];

export interface NamedCount {
  id: number;
  name: string;
  count: number;
}

export interface MapStats {
  version: number;
  areaCount: number;
  roomCount: number;
  labelCount: number;
  envColorCount: number;
  customEnvColorCount: number;
  zLevelCount: number;
  zLevels: number[];
  normalExits: number;
  specialExits: number;
  stubs: number;
  lockedRooms: number;
  doors: number;
  roomsWithSymbol: number;
  distinctSymbols: number;
  roomsWithUserData: number;
  topAreasByRooms: NamedCount[];
  topEnvironments: NamedCount[];
}

/** Derive a set of headline statistics from a parsed Mudlet map. */
export function computeStats(map: MudletMap): MapStats {
  const rooms = Object.values(map.rooms);

  let normalExits = 0;
  let specialExits = 0;
  let stubs = 0;
  let lockedRooms = 0;
  let doors = 0;
  let roomsWithSymbol = 0;
  let roomsWithUserData = 0;

  const zLevels = new Set<number>();
  const symbols = new Set<string>();
  const roomsPerArea = new Map<number, number>();
  const roomsPerEnv = new Map<number, number>();

  for (const room of rooms) {
    for (const dir of CARDINAL_DIRS) {
      if ((room[dir] as number) > 0) normalExits++;
    }
    specialExits += Object.keys(room.mSpecialExits ?? {}).length;
    stubs += room.stubs?.length ?? 0;
    doors += Object.keys(room.doors ?? {}).length;
    if (room.isLocked) lockedRooms++;
    if (room.symbol) {
      roomsWithSymbol++;
      symbols.add(room.symbol);
    }
    if (Object.keys(room.userData ?? {}).length > 0) roomsWithUserData++;

    zLevels.add(room.z);
    roomsPerArea.set(room.area, (roomsPerArea.get(room.area) ?? 0) + 1);
    roomsPerEnv.set(room.environment, (roomsPerEnv.get(room.environment) ?? 0) + 1);
  }

  const labelCount = Object.values(map.labels ?? {}).reduce(
    (sum, arr) => sum + (arr?.length ?? 0),
    0,
  );

  const topAreasByRooms = [...roomsPerArea.entries()]
    .map(([id, count]) => ({
      id,
      name: map.areaNames?.[id] ?? `Area ${id}`,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topEnvironments = [...roomsPerEnv.entries()]
    .map(([id, count]) => ({ id, name: `Env ${id}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const sortedZ = [...zLevels].sort((a, b) => a - b);

  return {
    version: map.version,
    areaCount: Object.keys(map.areas ?? {}).length,
    roomCount: rooms.length,
    labelCount,
    envColorCount: Object.keys(map.envColors ?? {}).length,
    customEnvColorCount: Object.keys(map.mCustomEnvColors ?? {}).length,
    zLevelCount: zLevels.size,
    zLevels: sortedZ,
    normalExits,
    specialExits,
    stubs,
    lockedRooms,
    doors,
    roomsWithSymbol,
    distinctSymbols: symbols.size,
    roomsWithUserData,
    topAreasByRooms,
    topEnvironments,
  };
}
