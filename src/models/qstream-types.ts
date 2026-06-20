import { QClass, QInt, QDouble, QUInt, QString as QStringBroken } from 'qtdatastream-web/types';
import type { ReadBuffer } from 'qtdatastream-web';

import type { MudletColor, MudletFont } from '../types';

const toHex = (u8: Uint8Array): string =>
  Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

class QEnum extends QClass {
  static override read(buffer: ReadBuffer): number {
    return buffer.readInt8();
  }

  override toBuffer(): Buffer {
    const buf = Buffer.alloc(1);
    buf.writeInt8(this.__obj as number, 0);
    return buf;
  }
}

class QUint16 extends QClass {
  static override read(buffer: ReadBuffer): number {
    return buffer.readUInt16BE();
  }

  override toBuffer(): Buffer {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(this.__obj as number);
    return buf;
  }
}

/**
 * Supports RGB only
 */
export class QColor extends QClass {
  static override read(buffer: ReadBuffer): MudletColor {
    return {
      spec: QEnum.read(buffer),
      alpha: QUint16.read(buffer) >> 8,
      r: QUint16.read(buffer) >> 8,
      g: QUint16.read(buffer) >> 8,
      b: QUint16.read(buffer) >> 8,
      pad: QUint16.read(buffer) >> 8,
    };
  }

  override toBuffer(): Buffer {
    const color = this.__obj as MudletColor;
    const bufs: Uint8Array[] = [];
    bufs.push(QEnum.from(color.spec).toBuffer(false));
    bufs.push(QUint16.from(color.alpha * 257).toBuffer(false));
    bufs.push(QUint16.from(color.r * 257).toBuffer(false));
    bufs.push(QUint16.from(color.g * 257).toBuffer(false));
    bufs.push(QUint16.from(color.b * 257).toBuffer(false));
    bufs.push(QUint16.from((color.pad ?? 0) * 257).toBuffer(false));
    return Buffer.concat(bufs);
  }
}

export class QString extends QStringBroken {
  override toBuffer(): Uint8Array {
    if (this.__obj === '') {
      return QUInt.from(0xffffffff).toBuffer();
    }
    return super.toBuffer();
  }
}

export class QFont extends QClass {
  static override read(buffer: ReadBuffer): MudletFont {
    // extracted from the QFont source code
    // Mudlet locks the QDataStream version to 5.12 for backwards compat
    const family = QString.read(buffer);
    const style = QString.read(buffer);
    const pointSize = QDouble.read(buffer);
    const pixelSize = QInt.read(buffer);
    const styleHint = QEnum.read(buffer);
    const styleStrategy = QUint16.read(buffer);
    buffer.readInt8();
    const weight = buffer.readInt8() >>> 0;
    const fontBits = buffer.readInt8() >>> 0;
    const stretch = buffer.readUInt16BE();
    const extendedFontBits = buffer.readInt8() >>> 0;
    const letterSpacing = QInt.read(buffer);
    const wordSpacing = QInt.read(buffer);
    const hintingPreference = buffer.readInt8() >>> 0;
    const capital = buffer.readInt8() >>> 0;

    return {
      family,
      style,
      pointSize,
      pixelSize,
      styleHint,
      styleStrategy,
      weight,
      fontBits,
      stretch,
      extendedFontBits,
      letterSpacing,
      wordSpacing,
      hintingPreference,
      capital,
      styleSetting: (fontBits & 0x01) !== 0,
      underline: (fontBits & 0x02) !== 0,
      overline: (fontBits & 0x40) !== 0,
      strikeOut: (fontBits & 0x04) !== 0,
      fixedPitch: (fontBits & 0x08) !== 0,
      kerning: (fontBits & 0x10) !== 0,
      styleOblique: (fontBits & 0x80) !== 0,
      ignorePitch: (extendedFontBits & 0x01) !== 0,
      letterSpacingIsAbsolute: (extendedFontBits & 0x02) !== 0,
    };
  }

  override toBuffer(): Buffer {
    const f = this.__obj as MudletFont;

    const buf8Int = (el: number): Buffer => {
      const buf = Buffer.alloc(1);
      buf.writeInt8(el);
      return buf;
    };

    const bufUInt16BE = (el: number): Buffer => {
      const buf = Buffer.alloc(2);
      buf.writeUint16BE(el);
      return buf;
    };

    return Buffer.concat([
      QString.from(f.family).toBuffer(),
      QString.from(f.style).toBuffer(),
      QDouble.from(f.pointSize).toBuffer(),
      QInt.from(f.pixelSize).toBuffer(),
      QEnum.from(f.styleHint).toBuffer(),
      QUint16.from(f.styleStrategy).toBuffer(),
      Buffer.alloc(1),
      buf8Int(f.weight),
      buf8Int(f.fontBits),
      bufUInt16BE(f.stretch),
      buf8Int(f.extendedFontBits),
      QInt.from(f.letterSpacing).toBuffer(),
      QInt.from(f.wordSpacing).toBuffer(),
      buf8Int(f.hintingPreference),
      buf8Int(f.capital),
    ]);
  }
}

export class QPoint extends QClass {
  static override read(buffer: ReadBuffer): [number, number] {
    return [QDouble.read(buffer), QDouble.read(buffer)];
  }

  override toBuffer(): Buffer {
    const [x, y] = this.__obj as [number, number];
    return Buffer.concat([QDouble.from(x).toBuffer(), QDouble.from(y).toBuffer()]);
  }
}

export class QVector extends QClass {
  static override read(buffer: ReadBuffer): [number, number, number] {
    return [QDouble.read(buffer), QDouble.read(buffer), QDouble.read(buffer)];
  }

  override toBuffer(): Buffer {
    const [x, y, z] = this.__obj as [number, number, number];
    return Buffer.concat([
      QDouble.from(x).toBuffer(),
      QDouble.from(y).toBuffer(),
      QDouble.from(z).toBuffer(),
    ]);
  }
}

/**
 * Supports .pngs
 */
export class QPixMap extends QClass {
  static override read(buffer: ReadBuffer): Uint8Array | string {
    QUInt.read(buffer);
    const start = buffer.read_offset;
    if (toHex(buffer.slice(4)) !== '89504e47') {
      buffer.read_offset -= 4;
      return '';
    }
    while (toHex(buffer.slice(4)) !== '49454e44') {
      buffer.read_offset -= 3;
    }
    const end = buffer.read_offset;
    buffer.read_offset = start;
    const size = end - start;
    return buffer.slice(size + 4);
  }

  override toBuffer(): Buffer {
    const data = this.__obj as Uint8Array | string;
    return Buffer.concat([QUInt.from(1).toBuffer(), data !== '' ? (data as Uint8Array) : Buffer.from('')]);
  }
}
