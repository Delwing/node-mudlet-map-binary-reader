import { QClass, QInt, QUserType } from 'qtdatastream-web/types';
import type { ReadBuffer } from 'qtdatastream-web';
import { concat } from 'qtdatastream-web/bytes';

import type { MudletArea, MudletLabel, MudletRoom } from '../types';

// These three containers are the Mudlet-specific collections in the map
// format. Each reads/writes a nested QUserType (a label, area, or room) by
// name. The nested type's layout is version-specific, so these are built as
// factories bound to a version's registered type name rather than hardcoding
// it — letting each version model wire up its own label/area/room layout.

/** Build the per-area label-list container for a given `MudletLabel` type name. */
export function createMudletLabels(labelType: string): typeof QClass {
  return class MudletLabels extends QClass {
    static override read(buffer: ReadBuffer): Record<number, MudletLabel[]> {
      const areasWithLabelsTotal = QInt.read(buffer);
      const labels: Record<number, MudletLabel[]> = {};
      for (let index = 0; index < areasWithLabelsTotal; index++) {
        const totalLabels = QInt.read(buffer);
        const areaId = QInt.read(buffer);
        labels[areaId] = [];
        for (let i = 0; i < totalLabels; i++) {
          labels[areaId].push(QUserType.get(labelType).read(buffer) as MudletLabel);
        }
      }
      return labels;
    }

    override toBuffer(): Uint8Array {
      const obj = this.__obj as Record<number, MudletLabel[]>;
      const buffers: Uint8Array[] = [];
      buffers.push(QInt.from(Object.keys(obj).length).toBuffer());
      for (const key of Object.keys(obj)) {
        const areaId = parseInt(key);
        buffers.push(QInt.from(obj[areaId].length).toBuffer());
        buffers.push(QInt.from(areaId).toBuffer());
        for (const label of obj[areaId]) {
          buffers.push(QUserType.get(labelType).from(label).toBuffer(true));
        }
      }
      return concat(buffers);
    }
  } as unknown as typeof QClass;
}

/** Build the area-table container for a given `MudletArea` type name. */
export function createMudletAreas(areaType: string): typeof QClass {
  return class MudletAreas extends QClass {
    static override read(buffer: ReadBuffer): Record<number, MudletArea> {
      const areas: Record<number, MudletArea> = {};
      const areaSize = QInt.read(buffer);
      for (let index = 0; index < areaSize; index++) {
        const id = QInt.read(buffer);
        areas[id] = QUserType.get(areaType).read(buffer) as MudletArea;
      }
      return areas;
    }

    override toBuffer(): Uint8Array {
      const obj = this.__obj as Record<number, MudletArea>;
      const buffers: Uint8Array[] = [];
      buffers.push(QInt.from(Object.keys(obj).length).toBuffer());
      for (const [key, area] of Object.entries(obj).sort(
        (a, b) => parseInt(a[0]) - parseInt(b[0])
      )) {
        buffers.push(QInt.from(parseInt(key)).toBuffer());
        buffers.push(QUserType.get(areaType).from(area).toBuffer(true));
      }
      return concat(buffers);
    }
  } as unknown as typeof QClass;
}

/** Build the room-table container for a given `MudletRoom` type name. */
export function createMudletRooms(roomType: string): typeof QClass {
  return class MudletRooms extends QClass {
    static override read(buffer: ReadBuffer): Record<number, MudletRoom> {
      const rooms: Record<number, MudletRoom> = {};
      while (buffer.buffer.length > buffer.read_offset) {
        const id = QInt.read(buffer);
        rooms[id] = QUserType.get(roomType).read(buffer) as MudletRoom;
      }
      return rooms;
    }

    override toBuffer(): Uint8Array {
      const obj = this.__obj as Record<number, MudletRoom>;
      const buffers: Uint8Array[] = [];
      for (const [key, room] of Object.entries(obj).reverse()) {
        buffers.push(QInt.from(parseInt(key)).toBuffer());
        buffers.push(QUserType.get(roomType).from(room).toBuffer(true));
      }
      return concat(buffers);
    }
  } as unknown as typeof QClass;
}
