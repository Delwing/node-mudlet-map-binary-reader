import type { MudletMap, MudletMapHeader, MudletRoom } from '../../src/types';

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

/**
 * Incrementally accumulates {@link MapStats} one room at a time, so a caller
 * can feed it rooms from `streamRooms` without ever materialising the whole
 * room graph. {@link computeStats} is just this run over a fully-read map.
 */
export class StreamingMapStats {
  private normalExits = 0;
  private specialExits = 0;
  private stubs = 0;
  private lockedRooms = 0;
  private doors = 0;
  private roomsWithSymbol = 0;
  private roomsWithUserData = 0;
  private roomCount = 0;
  private readonly zLevels = new Set<number>();
  private readonly symbols = new Set<string>();
  private readonly roomsPerArea = new Map<number, number>();
  private readonly roomsPerEnv = new Map<number, number>();

  /** Number of rooms folded in so far. */
  get count(): number {
    return this.roomCount;
  }

  addRoom(room: MudletRoom): void {
    this.roomCount++;
    for (const dir of CARDINAL_DIRS) {
      if ((room[dir] as number) > 0) this.normalExits++;
    }
    this.specialExits += Object.keys(room.mSpecialExits ?? {}).length;
    this.stubs += room.stubs?.length ?? 0;
    this.doors += Object.keys(room.doors ?? {}).length;
    if (room.isLocked) this.lockedRooms++;
    if (room.symbol) {
      this.roomsWithSymbol++;
      this.symbols.add(room.symbol);
    }
    if (Object.keys(room.userData ?? {}).length > 0) this.roomsWithUserData++;

    this.zLevels.add(room.z);
    this.roomsPerArea.set(room.area, (this.roomsPerArea.get(room.area) ?? 0) + 1);
    this.roomsPerEnv.set(room.environment, (this.roomsPerEnv.get(room.environment) ?? 0) + 1);
  }

  /** Combine the accumulated per-room totals with header-level metadata. */
  finish(header: MudletMapHeader): MapStats {
    const labelCount = Object.values(header.labels ?? {}).reduce(
      (sum, arr) => sum + (arr?.length ?? 0),
      0,
    );

    const topAreasByRooms = [...this.roomsPerArea.entries()]
      .map(([id, count]) => ({
        id,
        name: header.areaNames?.[id] ?? `Area ${id}`,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const topEnvironments = [...this.roomsPerEnv.entries()]
      .map(([id, count]) => ({ id, name: `Env ${id}`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const sortedZ = [...this.zLevels].sort((a, b) => a - b);

    return {
      version: header.version,
      areaCount: Object.keys(header.areas ?? {}).length,
      roomCount: this.roomCount,
      labelCount,
      envColorCount: Object.keys(header.envColors ?? {}).length,
      customEnvColorCount: Object.keys(header.mCustomEnvColors ?? {}).length,
      zLevelCount: this.zLevels.size,
      zLevels: sortedZ,
      normalExits: this.normalExits,
      specialExits: this.specialExits,
      stubs: this.stubs,
      lockedRooms: this.lockedRooms,
      doors: this.doors,
      roomsWithSymbol: this.roomsWithSymbol,
      distinctSymbols: this.symbols.size,
      roomsWithUserData: this.roomsWithUserData,
      topAreasByRooms,
      topEnvironments,
    };
  }
}

/** Derive a set of headline statistics from a parsed Mudlet map. */
export function computeStats(map: MudletMap): MapStats {
  const acc = new StreamingMapStats();
  for (const room of Object.values(map.rooms)) acc.addRoom(room);
  return acc.finish(map);
}
