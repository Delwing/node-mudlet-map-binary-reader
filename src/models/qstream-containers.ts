/* eslint-disable @typescript-eslint/no-explicit-any */
import { qtype, QClass, QUInt } from 'qtdatastream-web/types';
import type { ReadBuffer } from 'qtdatastream-web';
import { concat } from 'qtdatastream-web/bytes';

let customCounter = 1000;
const customMapCache: Record<string, Record<string, number>> = {};
const customMultiMapCache: Record<string, Record<string, number>> = {};
const customArrayCache: Record<string, number> = {};
const customPairCache: Record<string, number> = {};

type QtTypeParam = typeof QClass | number;

function resolveQType(typeOrClass: QtTypeParam): typeof QClass {
  if (typeof typeOrClass === 'number' || !(typeOrClass as typeof QClass).qtype) {
    return QClass.types.get(typeOrClass as number) as typeof QClass;
  }
  return typeOrClass as typeof QClass;
}

function mudletSorter(a: [string, any], b: [string, any]): number {
  if (parseInt(a[0]) === -1) return -1;
  if (parseInt(b[0]) === -1) return 1;
  return parseInt(a[0]) - parseInt(b[0]);
}

function createTypedMultiMap(keyClass: typeof QClass, valueClass: typeof QClass): typeof QClass {
  return class QTypedMultiMap extends QClass {
    static override read(buffer: ReadBuffer): Record<string, any[]> {
      const map: Record<string, any[]> = {};
      const count = QUInt.read(buffer);
      for (let index = 0; index < count; index++) {
        const key = keyClass.read(buffer) as string;
        const value = valueClass.read(buffer);
        if (map[key] === undefined) {
          map[key] = [];
        }
        map[key].push(value);
      }
      return map;
    }

    override toBuffer(): Uint8Array {
      const bufs: Uint8Array[] = [];
      const obj = this.__obj;
      if (obj instanceof Map) {
        bufs.push(QUInt.from(obj.size).toBuffer());
        for (const [key, value] of obj) {
          bufs.push(keyClass.from(key).toBuffer());
          bufs.push(valueClass.from(value).toBuffer());
        }
      } else {
        let counter = 0;
        for (const [key, value] of Object.entries(obj as Record<string, any[]>).reverse()) {
          for (const item of value) {
            counter++;
            bufs.push(keyClass.from(key).toBuffer());
            bufs.push(valueClass.from(item).toBuffer());
          }
        }
        bufs.unshift(QUInt.from(counter).toBuffer());
      }
      return concat(bufs);
    }
  } as unknown as typeof QClass;
}

function createTypedMap(keyClass: typeof QClass, valueClass: typeof QClass): typeof QClass {
  return class QTypedMap extends QClass {
    static override read(buffer: ReadBuffer): Record<string, any> {
      const map: Record<string, any> = {};
      const count = QUInt.read(buffer);
      for (let index = 0; index < count; index++) {
        const key = keyClass.read(buffer) as string;
        map[key] = valueClass.read(buffer);
      }
      return map;
    }

    override toBuffer(): Uint8Array {
      const bufs: Uint8Array[] = [];
      const obj = this.__obj;
      if (obj instanceof Map) {
        bufs.push(QUInt.from(obj.size).toBuffer());
        for (const [key, value] of obj) {
          bufs.push(keyClass.from(key).toBuffer());
          bufs.push(valueClass.from(value).toBuffer());
        }
      } else {
        const entries = Object.entries(obj as Record<string, any>);
        bufs.push(QUInt.from(entries.length).toBuffer());
        for (const [key, value] of entries.sort(mudletSorter)) {
          bufs.push(keyClass.from(key).toBuffer());
          bufs.push(valueClass.from(value).toBuffer());
        }
      }
      return concat(bufs);
    }
  } as unknown as typeof QClass;
}

function createTypedList(valueClass: typeof QClass): typeof QClass {
  return class QTypedList extends QClass {
    static override read(buffer: ReadBuffer): any[] {
      const list: any[] = [];
      const count = QUInt.read(buffer);
      for (let index = 0; index < count; index++) {
        list.push(valueClass.read(buffer));
      }
      return list;
    }

    override toBuffer(): Uint8Array {
      const bufs: Uint8Array[] = [];
      const arr = this.__obj as any[];
      bufs.push(QUInt.from(arr.length).toBuffer());
      for (const el of arr) {
        bufs.push(valueClass.from(el).toBuffer());
      }
      return concat(bufs);
    }
  } as unknown as typeof QClass;
}

function createTypedPair(first: typeof QClass, second: typeof QClass): typeof QClass {
  return class QTypedPair extends QClass {
    static override read(buffer: ReadBuffer): [any, any] {
      return [first.read(buffer), second.read(buffer)];
    }

    override toBuffer(): Uint8Array {
      const pair = this.__obj as [any, any];
      return concat([first.from(pair[0]).toBuffer(), second.from(pair[1]).toBuffer()]);
    }
  } as unknown as typeof QClass;
}

export function QMultiMap(keyClass: QtTypeParam, valueClass: QtTypeParam): number {
  const resolvedKey = resolveQType(keyClass);
  const resolvedValue = resolveQType(valueClass);

  const keyStr = String(resolvedKey);
  const valStr = String(resolvedValue);

  if (!customMultiMapCache[keyStr]) {
    customMultiMapCache[keyStr] = {};
  }
  if (!customMultiMapCache[keyStr][valStr]) {
    const clazz = createTypedMultiMap(resolvedKey, resolvedValue);
    const counter = customCounter++;
    qtype(counter)(clazz);
    customMultiMapCache[keyStr][valStr] = counter;
  }

  return customMultiMapCache[keyStr][valStr];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function QMap(keyClass: QtTypeParam, valueClass: QtTypeParam, _reversed?: boolean): number {
  const resolvedKey = resolveQType(keyClass);
  const resolvedValue = resolveQType(valueClass);

  const keyStr = String(resolvedKey);
  const valStr = String(resolvedValue);

  if (!customMapCache[keyStr]) {
    customMapCache[keyStr] = {};
  }
  if (!customMapCache[keyStr][valStr]) {
    const clazz = createTypedMap(resolvedKey, resolvedValue);
    const counter = customCounter++;
    qtype(counter)(clazz);
    customMapCache[keyStr][valStr] = counter;
  }

  return customMapCache[keyStr][valStr];
}

export function QList(valueClass: typeof QClass): number {
  const cacheKey = String(valueClass);
  if (!customArrayCache[cacheKey]) {
    const clazz = createTypedList(valueClass);
    const counter = customCounter++;
    qtype(counter)(clazz);
    customArrayCache[cacheKey] = counter;
  }
  return customArrayCache[cacheKey];
}

export function QPair(first: typeof QClass, second: typeof QClass): number {
  const key = `${first.name}#${second.name}`;
  if (!customPairCache[key]) {
    const clazz = createTypedPair(first, second);
    const counter = customCounter++;
    qtype(counter)(clazz);
    customPairCache[key] = counter;
  }
  return customPairCache[key];
}
