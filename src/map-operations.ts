import { buffer } from 'qtdatastream';
import { QUserType } from './models/mudlet-models';
import type { MudletMap, MudletRoom } from './types';

const { ReadBuffer } = buffer;

type RawRoom = MudletRoom & { rawSpecialExits: Record<number, string[]> };

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
 * Parse a Mudlet binary map from an in-memory buffer. Environment-
 * independent: no `fs`, no file path. Callers in Node can pass
 * `fs.readFileSync(path)`; callers in the browser can pass a `Buffer`
 * constructed from a `File` / `ArrayBuffer`.
 */
export function readMapFromBuffer(buf: Buffer): MudletMap {
  const rb = new ReadBuffer(buf);
  const map = QUserType.read(rb, 'MudletMap') as MudletMap;
  hydrateSpecialExits(map);
  return map;
}

/**
 * Serialise a map model to a Mudlet binary buffer. Environment-
 * independent: no `fs`. Node callers persist with
 * `fs.writeFileSync(path, writeMapToBuffer(map))`; browser callers can
 * hand it to a `Blob` or HTTP response.
 */
export function writeMapToBuffer(map: MudletMap): Buffer {
  dehydrateSpecialExits(map);
  return QUserType.get('MudletMap').from(map).toBuffer(true);
}

/**
 * Node-only convenience: read a Mudlet binary map straight from disk.
 * For browser / buffer-based reading, use {@link readMapFromBuffer}.
 */
export function readMap(file: string): MudletMap {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  return readMapFromBuffer(fs.readFileSync(file));
}

/**
 * Node-only convenience: serialise and write a Mudlet binary map to disk.
 * For browser / buffer-based writing, use {@link writeMapToBuffer} and
 * persist the returned `Buffer` with whatever mechanism fits.
 */
export function writeMap(map: MudletMap, file: string): void {
  const bytes = writeMapToBuffer(map);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  fs.writeFileSync(file, bytes);
}
