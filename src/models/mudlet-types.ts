import { QClass, QInt, QUserType } from 'qtdatastream/types';
import type { ReadBuffer } from 'qtdatastream';

import type { MudletArea, MudletLabel, MudletRoom } from '../types';

export class MudletLabels extends QClass {
  static override read(buffer: ReadBuffer): Record<number, MudletLabel[]> {
    const areasWithLabelsTotal = QInt.read(buffer);
    const labels: Record<number, MudletLabel[]> = {};
    for (let index = 0; index < areasWithLabelsTotal; index++) {
      const totalLabels = QInt.read(buffer);
      const areaId = QInt.read(buffer);
      labels[areaId] = [];
      for (let i = 0; i < totalLabels; i++) {
        labels[areaId].push(QUserType.get('MudletLabel').read(buffer) as MudletLabel);
      }
    }
    return labels;
  }

  override toBuffer(): Buffer {
    const obj = this.__obj as Record<number, MudletLabel[]>;
    const buffers: Uint8Array[] = [];
    buffers.push(QInt.from(Object.keys(obj).length).toBuffer());
    for (const key of Object.keys(obj)) {
      const areaId = parseInt(key);
      buffers.push(QInt.from(obj[areaId].length).toBuffer());
      buffers.push(QInt.from(areaId).toBuffer());
      for (const label of obj[areaId]) {
        buffers.push(QUserType.get('MudletLabel').from(label).toBuffer(true));
      }
    }
    return Buffer.concat(buffers);
  }
}

export class MudletAreas extends QClass {
  static override read(buffer: ReadBuffer): Record<number, MudletArea> {
    const areas: Record<number, MudletArea> = {};
    const areaSize = QInt.read(buffer);
    for (let index = 0; index < areaSize; index++) {
      const id = QInt.read(buffer);
      areas[id] = QUserType.get('MudletArea').read(buffer) as MudletArea;
    }
    return areas;
  }

  override toBuffer(): Buffer {
    const obj = this.__obj as Record<number, MudletArea>;
    const buffers: Uint8Array[] = [];
    buffers.push(QInt.from(Object.keys(obj).length).toBuffer());
    for (const [key, area] of Object.entries(obj).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
      buffers.push(QInt.from(parseInt(key)).toBuffer());
      buffers.push(QUserType.get('MudletArea').from(area).toBuffer(true));
    }
    return Buffer.concat(buffers);
  }
}

export class MudletRooms extends QClass {
  static override read(buffer: ReadBuffer): Record<number, MudletRoom> {
    const rooms: Record<number, MudletRoom> = {};
    while (buffer.buffer.length > buffer.read_offset) {
      const id = QInt.read(buffer);
      rooms[id] = QUserType.get('MudletRoom').read(buffer) as MudletRoom;
    }
    return rooms;
  }

  override toBuffer(): Buffer {
    const obj = this.__obj as Record<number, MudletRoom>;
    const buffers: Uint8Array[] = [];
    for (const [key, room] of Object.entries(obj).reverse()) {
      buffers.push(QInt.from(parseInt(key)).toBuffer());
      buffers.push(QUserType.get('MudletRoom').from(room).toBuffer(true));
    }
    return Buffer.concat(buffers);
  }
}
