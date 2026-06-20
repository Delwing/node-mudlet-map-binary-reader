import { buffer } from 'qtdatastream-web';
import { QInt } from 'qtdatastream-web/types';
import { getMapModel, getSupportedVersions } from './models/mudlet-models';
import type { MudletMap, MudletRoom } from './types';

const { ReadBuffer } = buffer;

type RawRoom = MudletRoom & { rawSpecialExits: Record<number, string[]> };

// Mirrors Mudlet's DIR_* constants from src/TMap.h. Used as the second element
// of each QPair<int,int> entry in TArea::mAreaExits.
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

const DIR_INDEX: Record<(typeof CARDINAL_DIRS)[number], number> = {
  north: 1,
  northeast: 2,
  northwest: 3,
  east: 4,
  west: 5,
  south: 6,
  southeast: 7,
  southwest: 8,
  up: 9,
  down: 10,
  in: 11,
  out: 12,
};

const DIR_OTHER = 13;

/**
 * Rebuild every area's `mAreaExits` from the current room graph. This field
 * is a cache Mudlet's autowalker/pathfinder uses to navigate between zones,
 * and mirrors TArea::determineAreaExits in Mudlet's C++ source. Any editor
 * that mutates rooms / exits and re-saves must regenerate it — otherwise the
 * cache goes stale and Mudlet's routing breaks.
 */
function rebuildAreaExits(map: MudletMap): void {
  for (const areaId in map.areas) {
    if (!Object.hasOwn(map.areas, areaId)) continue;
    map.areas[areaId as unknown as number].mAreaExits = {};
  }

  for (const idStr in map.rooms) {
    if (!Object.hasOwn(map.rooms, idStr)) continue;
    const roomId = Number(idStr);
    const room = map.rooms[roomId];
    const srcArea = map.areas[room.area];
    if (!srcArea) continue;

    const entries: [number, number][] = [];

    for (const dir of CARDINAL_DIRS) {
      const targetId = room[dir] as number;
      if (!targetId || targetId < 1) continue;
      const target = map.rooms[targetId];
      if (!target || target.area === room.area) continue;
      entries.push([targetId, DIR_INDEX[dir]]);
    }

    const specials = room.mSpecialExits ?? {};
    const specialNames = Object.keys(specials).sort();
    for (const name of specialNames) {
      const targetId = specials[name];
      if (!targetId || targetId < 1) continue;
      const target = map.rooms[targetId];
      if (!target || target.area === room.area) continue;
      entries.push([targetId, DIR_OTHER]);
    }

    if (entries.length > 0) {
      srcArea.mAreaExits[roomId] = entries;
    }
  }
}

/**
 * Rebuild every area's spatial-extent cache (zLevels, min/max x/y/z, and the
 * per-Z xminForZ/xmaxForZ/yminForZ/ymaxForZ maps) from the current room graph.
 * Mirrors Mudlet's TArea::calcSpan in src/TArea.cpp.
 *
 * Two quirks inherited from C++:
 *   1. y is negated when stored on the area. room.y is plain, but
 *      area.min_y / max_y / yminForZ / ymaxForZ all hold `-room.y`.
 *   2. span and pos are NOT recomputed. calcSpan never touches them, and
 *      the TArea.h header flags them both as effectively dead. We leave
 *      them as-is so round-tripping an untouched map stays byte-identical.
 *   3. For an area with zero valid rooms, the per-Z maps and zLevels are
 *      cleared but min/max are preserved — again, matching C++.
 */
function rebuildAreaExtents(map: MudletMap): void {
  for (const areaIdStr in map.areas) {
    if (!Object.hasOwn(map.areas, areaIdStr)) continue;
    const area = map.areas[areaIdStr as unknown as number];

    area.xminForZ = {};
    area.xmaxForZ = {};
    area.yminForZ = {};
    area.ymaxForZ = {};
    area.zLevels = [];

    let first = true;
    for (const roomId of area.rooms) {
      const room = map.rooms[roomId];
      if (!room) continue;
      const x = room.x;
      const y = -room.y;
      const z = room.z;

      if (first) {
        area.min_x = x;
        area.max_x = x;
        area.min_y = y;
        area.max_y = y;
        area.min_z = z;
        area.max_z = z;
        area.zLevels.push(z);
        area.xminForZ[z] = x;
        area.xmaxForZ[z] = x;
        area.yminForZ[z] = y;
        area.ymaxForZ[z] = y;
        first = false;
        continue;
      }

      if (!area.zLevels.includes(z)) area.zLevels.push(z);

      if (area.xminForZ[z] === undefined || x < area.xminForZ[z]) area.xminForZ[z] = x;
      if (x < area.min_x) area.min_x = x;
      if (area.xmaxForZ[z] === undefined || x > area.xmaxForZ[z]) area.xmaxForZ[z] = x;
      if (x > area.max_x) area.max_x = x;

      if (area.yminForZ[z] === undefined || y < area.yminForZ[z]) area.yminForZ[z] = y;
      if (y < area.min_y) area.min_y = y;
      if (y > area.max_y) area.max_y = y;
      if (area.ymaxForZ[z] === undefined || y > area.ymaxForZ[z]) area.ymaxForZ[z] = y;

      if (z < area.min_z) area.min_z = z;
      if (z > area.max_z) area.max_z = z;
    }

    if (area.zLevels.length > 1) area.zLevels.sort((a, b) => a - b);
  }
}

/**
 * Populate each `room.hash` from the inverse of `map.mpRoomDbHashToRoomId`.
 * The binary format doesn't carry a per-room hash field — the hash lives
 * only in the map-level index. Copying it onto the room on load lets
 * editors treat `room.hash` as the source of truth, and lets
 * {@link rebuildRoomHashIndex} rebuild the index cleanly on save.
 *
 * NOTE: this is specifically about the content hash index
 * (`mpRoomDbHashToRoomId` — mirrors Mudlet's `TRoomDB::hashToRoomID`).
 * The similarly-named `mRoomIdHash` is something else entirely: it maps
 * Mudlet profile name → player's current room ID. Do not touch it here.
 */
function populateRoomHashes(map: MudletMap): void {
  for (const hash in map.mpRoomDbHashToRoomId) {
    if (!Object.hasOwn(map.mpRoomDbHashToRoomId, hash)) continue;
    const roomId = map.mpRoomDbHashToRoomId[hash];
    const room = map.rooms[roomId];
    if (room) room.hash = hash;
  }
}

/**
 * Rebuild `map.mpRoomDbHashToRoomId` from the `hash` field on each room.
 * Mirrors Mudlet's `TRoomDB::hashToRoomID`. Callers can freely mutate
 * `room.hash` (or add/remove rooms) between load and save; this helper
 * keeps the on-disk index consistent.
 *
 * Rooms with `hash === undefined`, `''`, or `null` are skipped. If two
 * rooms declare the same non-empty hash (should not happen in a sane
 * map) the later iteration wins and a warning is logged — the underlying
 * data is already inconsistent at that point.
 *
 * NOTE: does not touch `mRoomIdHash`. That's the per-profile player
 * cursor (profile name → room ID) and is not derivable from rooms.
 */
function rebuildRoomHashIndex(map: MudletMap): void {
  map.mpRoomDbHashToRoomId = {};
  for (const idStr in map.rooms) {
    if (!Object.hasOwn(map.rooms, idStr)) continue;
    const room = map.rooms[idStr as unknown as number];
    const hash = room.hash;
    if (typeof hash !== 'string' || hash.length === 0) continue;
    const roomId = Number(idStr);
    if (Object.hasOwn(map.mpRoomDbHashToRoomId, hash)) {
      const prev = map.mpRoomDbHashToRoomId[hash];
      console.warn(
        `[mudlet-map-binary-reader] duplicate room hash "${hash}" on rooms ${prev} and ${roomId}; last wins`
      );
    }
    map.mpRoomDbHashToRoomId[hash] = roomId;
  }
}

/**
 * Hydrate the `mSpecialExits` / `mSpecialExitLocks` fields on every room
 * by parsing the `rawSpecialExits` layout Qt stores on disk.
 */
function hydrateSpecialExits(map: MudletMap): void {
  for (const roomId in map.rooms) {
    if (!Object.hasOwn(map.rooms, roomId)) continue;
    const room = map.rooms[roomId] as RawRoom;
    room.mSpecialExits = {};
    room.mSpecialExitLocks = [];
    for (const key in room.rawSpecialExits) {
      if (!Object.hasOwn(room.rawSpecialExits, key)) continue;
      for (const ex of room.rawSpecialExits[key as unknown as number]) {
        if (ex.startsWith('0')) {
          room.mSpecialExits[ex.substring(1)] = parseInt(key);
        } else if (ex.startsWith('1')) {
          room.mSpecialExits[ex.substring(1)] = parseInt(key);
          room.mSpecialExitLocks.push(parseInt(key));
        } else {
          room.mSpecialExits[ex] = parseInt(key);
        }
      }
    }
  }
}

/**
 * Inverse of {@link hydrateSpecialExits}: repacks `mSpecialExits` /
 * `mSpecialExitLocks` back into the `rawSpecialExits` layout Qt expects
 * before serialising.
 */
function dehydrateSpecialExits(map: MudletMap): void {
  for (const roomId in map.rooms) {
    const room = map.rooms[roomId];
    const rawSpecialExits: Record<number, string[]> = {};
    for (const exit in room.mSpecialExits) {
      if (!Object.hasOwn(room.mSpecialExits, exit)) continue;
      const exRoomId = room.mSpecialExits[exit];
      if (rawSpecialExits[exRoomId] === undefined) {
        rawSpecialExits[exRoomId] = [];
      }
      const locked = room.mSpecialExitLocks.indexOf(exRoomId) > -1;
      rawSpecialExits[exRoomId].push((locked ? '1' : '0') + exit);
    }
    room.rawSpecialExits = rawSpecialExits;
  }
}

/**
 * Read just the leading version int, on a throwaway buffer, so we can pick the
 * right version model before parsing the rest of the stream.
 */
function readMapVersion(buf: Uint8Array): number {
  return QInt.read(new ReadBuffer(buf)) as number;
}

/**
 * Parse a Mudlet binary map from an in-memory buffer. Environment-
 * independent: no `fs`, no file path. Callers in Node can pass
 * `fs.readFileSync(path)`; callers in the browser can pass a `Buffer`
 * constructed from a `File` / `ArrayBuffer`.
 *
 * The format version (the first int in the stream) selects the model. An
 * unsupported version fails fast with a clear error rather than silently
 * mis-parsing a layout it doesn't match (reading a v16 map as v20 desyncs the
 * stream and dies with an opaque "Invalid array length").
 */
export function readMapFromBuffer(buf: Uint8Array): MudletMap {
  const version = readMapVersion(buf);
  const model = getMapModel(version);
  if (!model) {
    throw new Error(
      `Unsupported Mudlet map version ${version}. Supported version(s): ${getSupportedVersions().join(', ')}.`
    );
  }
  const map = model.read(new ReadBuffer(buf));
  hydrateSpecialExits(map);
  populateRoomHashes(map);
  return map;
}

/**
 * Serialise a map model to a Mudlet binary buffer. Environment-
 * independent: no `fs`. Node callers persist with
 * `fs.writeFileSync(path, writeMapToBuffer(map))`; browser callers can
 * hand it to a `Blob` or HTTP response.
 */
export function writeMapToBuffer(map: MudletMap): Uint8Array {
  const model = getMapModel(map.version);
  if (!model) {
    throw new Error(
      `Cannot write Mudlet map: unsupported version ${map.version}. Supported version(s): ${getSupportedVersions().join(', ')}.`
    );
  }
  dehydrateSpecialExits(map);
  rebuildAreaExits(map);
  rebuildAreaExtents(map);
  rebuildRoomHashIndex(map);
  return model.write(map);
}
