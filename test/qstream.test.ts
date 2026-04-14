'use strict';

import { buffer } from 'qtdatastream';
import { QClass, QUInt, QInt } from 'qtdatastream/src/types';
import { QMap, QMultiMap } from '../src/models/qstream-containers';
import { QPoint, QPixMap, QString } from '../src/models/qstream-types';

const { ReadBuffer } = buffer;

describe('qstream-types', () => {
  describe('QPoint', () => {
    test('toBuffer round-trips through read', () => {
      const point: [number, number] = [3.5, -7.25];
      const buf = QPoint.from(point).toBuffer();
      const result = QPoint.read(new ReadBuffer(buf));
      expect(result).toEqual(point);
    });

    test('toBuffer produces 16 bytes (two doubles)', () => {
      const buf = QPoint.from([0, 0]).toBuffer();
      expect(buf.length).toBe(16);
    });
  });

  describe('QPixMap', () => {
    // PNG magic: 89 50 4e 47 (hex) = \x89PNG
    // IEND chunk: 49 45 4e 44 (hex)
    const PNG_HEADER = Buffer.from('89504e47', 'hex');
    const IEND_MARKER = Buffer.from('49454e44', 'hex');

    function buildPngBuffer(): Buffer {
      // Minimal structure: PNG header + some body bytes + IEND marker + CRC placeholder
      const body = Buffer.from('deadbeef', 'hex');
      return Buffer.concat([PNG_HEADER, body, IEND_MARKER]);
    }

    test('read returns empty string for non-PNG data', () => {
      // QPixMap.read expects: 4 bytes (QUInt, ignored), then checks next 4 bytes for PNG magic.
      const prefix = QUInt.from(1).toBuffer();
      const nonPng = Buffer.from('00000000', 'hex'); // not PNG magic
      const trailing = Buffer.alloc(32); // padding so buffer doesn't underflow
      const buf = new ReadBuffer(Buffer.concat([prefix, nonPng, trailing]));
      const result = QPixMap.read(buf);
      expect(result).toBe('');
    });

    test('read extracts PNG data up to and including IEND', () => {
      const pngData = buildPngBuffer();
      // QPixMap.toBuffer writes QUInt(1) + raw data
      const serialized = QPixMap.from(pngData).toBuffer();
      const result = QPixMap.read(new ReadBuffer(serialized));
      // Result should be a Buffer containing the full PNG (header through IEND + 4 bytes for CRC/trailing)
      expect(Buffer.isBuffer(result)).toBe(true);
      // The extracted data should start with the PNG header
      expect((result as Buffer).subarray(0, 4).toString('hex')).toBe('89504e47');
    });

    test('toBuffer with empty string produces QUInt(1) + empty', () => {
      const buf = QPixMap.from('').toBuffer();
      // QUInt is 4 bytes, then empty data
      expect(buf.length).toBe(4);
    });

    test('toBuffer with Buffer data includes QUInt(1) prefix + data', () => {
      const data = Buffer.from('hello');
      const buf = QPixMap.from(data).toBuffer();
      expect(buf.length).toBe(4 + data.length);
    });
  });
});

describe('qstream-containers', () => {
  // Get the resolved type IDs so we can instantiate the generated classes
  const qMapTypeId = QMap(QInt, QInt);
  const qMultiMapTypeId = QMultiMap(QString, QInt);

  const QMapIntInt = QClass.types.get(qMapTypeId)!;
  const QMultiMapStringInt = QClass.types.get(qMultiMapTypeId)!;

  describe('QMap with Map instance', () => {
    test('toBuffer round-trips through read', () => {
      const input = new Map<number, number>([
        [1, 100],
        [2, 200],
      ]);

      const buf = QMapIntInt.from(input).toBuffer();
      const result = QMapIntInt.read(new ReadBuffer(buf));

      // read returns a plain object with string keys
      expect(result).toEqual({ '1': 100, '2': 200 });
    });

    test('toBuffer encodes correct count for Map', () => {
      const input = new Map<number, number>([
        [10, 1],
        [20, 2],
        [30, 3],
      ]);

      const buf = QMapIntInt.from(input).toBuffer();
      // First 4 bytes should be the count (3)
      expect(buf.readUInt32BE(0)).toBe(3);
    });
  });

  describe('QMultiMap with Map instance', () => {
    test('toBuffer round-trips through read', () => {
      const input = new Map<string, number>([
        ['alpha', 10],
        ['beta', 20],
      ]);

      const buf = QMultiMapStringInt.from(input).toBuffer();
      const result = QMultiMapStringInt.read(new ReadBuffer(buf));

      // MultiMap read returns { key: [values] }
      expect(result).toEqual({ alpha: [10], beta: [20] });
    });

    test('toBuffer encodes correct count for Map', () => {
      const input = new Map<string, number>([
        ['a', 1],
        ['b', 2],
      ]);

      const buf = QMultiMapStringInt.from(input).toBuffer();
      // First 4 bytes = count
      expect(buf.readUInt32BE(0)).toBe(2);
    });
  });
});
