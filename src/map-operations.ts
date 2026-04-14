import { buffer } from 'qtdatastream';
import { QUserType } from './models/mudlet-models';
import fs from 'fs';
import type { MudletMap, MudletRoom } from './types';

const { ReadBuffer } = buffer;

/**
 * Reads Mudlet's binary map file
 *
 * @param file - path to map file
 * @returns map model
 */
export function readMap(file: string): MudletMap {
  const buf = new ReadBuffer(fs.readFileSync(file));
  const map = QUserType.read(buf, 'MudletMap') as MudletMap;

  for (const roomId in map.rooms) {
    if (Object.hasOwn(map.rooms, roomId)) {
      const room = map.rooms[roomId] as MudletRoom & { rawSpecialExits: Record<number, string[]> };
      room.mSpecialExits = {};
      room.mSpecialExitLocks = [];
      for (const key in room.rawSpecialExits) {
        if (Object.hasOwn(room.rawSpecialExits, key)) {
          const elements = room.rawSpecialExits[key as unknown as number];
          for (const ex of elements) {
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
  }

  return map;
}

/**
 * Stores map model as a Mudlet's map binary file
 *
 * @param map - map model
 * @param file - path to file
 */
export function writeMap(map: MudletMap, file: string): void {
  for (const roomId in map.rooms) {
    const room = map.rooms[roomId];
    const rawSpecialExits: Record<number, string[]> = {};
    for (const exit in room.mSpecialExits) {
      if (Object.hasOwn(room.mSpecialExits, exit)) {
        const exRoomId = room.mSpecialExits[exit];
        if (rawSpecialExits[exRoomId] === undefined) {
          rawSpecialExits[exRoomId] = [];
        }
        const locked = room.mSpecialExitLocks.indexOf(exRoomId) > -1;
        rawSpecialExits[exRoomId].push((locked ? '1' : '0') + exit);
      }
    }
    room.rawSpecialExits = rawSpecialExits;
  }

  fs.writeFileSync(file, QUserType.get('MudletMap').from(map).toBuffer(true));
}
