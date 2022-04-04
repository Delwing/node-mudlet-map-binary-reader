const { QClass, QInt, QDouble, QUInt, QString: QStringBroken } = require("qtdatastream").types;

class QEnum extends QClass {
  static read(buffer) {
    return buffer.readInt8();
  }

  toBuffer() {
    const buf = Buffer.alloc(1);
    buf.writeInt8(this.__obj, 0);
    return buf;
  }
}

class QUint16 extends QClass {
  static read(buffer) {
    return buffer.readUInt16BE();
  }

  toBuffer() {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(this.__obj);
    return buf;
  }
}

/**
 * Supports RGB only
 */
class QColor extends QClass {
  static read(buffer) {
    return {
      spec: QEnum.read(buffer),
      alpha: QUint16.read(buffer) >> 8,
      r: QUint16.read(buffer) >> 8,
      g: QUint16.read(buffer) >> 8,
      b: QUint16.read(buffer) >> 8,
      pad: QUint16.read(buffer) >> 8,
    };
  }

  /**
   *
   * @param {Buffer} buffer
   * @returns
   */
  toBuffer() {
    let bufs = [];
    bufs.push(QEnum.from(this.__obj.spec).toBuffer(false));
    bufs.push(QUint16.from(this.__obj.alpha * 257).toBuffer(false));
    bufs.push(QUint16.from(this.__obj.r * 257).toBuffer(false));
    bufs.push(QUint16.from(this.__obj.g * 257).toBuffer(false));
    bufs.push(QUint16.from(this.__obj.b * 257).toBuffer(false));
    bufs.push(QUint16.from(this.__obj.pad * 257).toBuffer(false));
    return Buffer.concat(bufs);
  }
}

class QString extends QStringBroken {
  toBuffer() {
    if (this.__obj === "") {
      return QUInt.from(0xffffffff).toBuffer();
    }
    return super.toBuffer();
  }
}

class QFont extends QClass {
  static read(buffer) {
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

    const styleSetting = (fontBits & 0x01) !== 0;
    const underline = (fontBits & 0x02) !== 0;
    const overline = (fontBits & 0x40) !== 0;
    const strikeOut = (fontBits & 0x04) !== 0;
    const fixedPitch = (fontBits & 0x08) !== 0;
    const kerning = (fontBits & 0x10) !== 0;
    const styleOblique = (fontBits & 0x80) !== 0;

    const ignorePitch = (extendedFontBits & 0x01) !== 0;
    const letterSpacingIsAbsolute = (extendedFontBits & 0x02) !== 0;

    const font = {
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
      styleSetting,
      underline,
      overline,
      strikeOut,
      fixedPitch,
      kerning,
      styleOblique,
      ignorePitch,
      letterSpacingIsAbsolute,
    };
    return font;
  }

  toBuffer() {
    let buf8Int = (el) => {
      let buf = Buffer.alloc(1);
      buf.writeInt8(el);
      return buf;
    };

    let bufUInt16BE = (el) => {
      let buf = Buffer.alloc(2);
      buf.writeUint16BE(el << 8);
      return buf;
    };

    return Buffer.concat([
      QString.from(this.__obj.family).toBuffer(),
      QString.from(this.__obj.style).toBuffer(),
      QDouble.from(this.__obj.pointSize).toBuffer(),
      QInt.from(this.__obj.pixelSize).toBuffer(),
      QEnum.from(this.__obj.styleHint).toBuffer(),
      QUint16.from(this.__obj.styleStrategy).toBuffer(),
      Buffer.alloc(1),
      buf8Int(this.__obj.weight),
      buf8Int(this.__obj.fontBits),
      bufUInt16BE(this.__obj.stretch),
      buf8Int(this.__obj.extendedFontBits),
      QInt.from(this.__obj.letterSpacing).toBuffer(),
      QInt.from(this.__obj.wordSpacing).toBuffer(),
      buf8Int(this.__obj.hintingPreference),
      buf8Int(this.__obj.capital),
    ]);
  }
}

class QPoint extends QClass {
  static read(buffer) {
    return [QDouble.read(buffer), QDouble.read(buffer)];
  }

  toBuffer() {
    return Buffer.concat([QDouble.from(this.__obj[0]).toBuffer(), QDouble.from(this.__obj[1]).toBuffer()]);
  }
}

class QVector extends QClass {
  static read(buffer) {
    return [QDouble.read(buffer), QDouble.read(buffer), QDouble.read(buffer)];
  }

  toBuffer() {
    return Buffer.concat([QDouble.from(this.__obj[0]).toBuffer(), QDouble.from(this.__obj[1]).toBuffer(), QDouble.from(this.__obj[2]).toBuffer()]);
  }
}

/**
 * Supports .pngs
 */
class QPixMap extends QClass {
  static read(buffer) {
    QUInt.read(buffer);
    let start = buffer.read_offset;
    let slice;
    if ((slice = buffer.slice(4).toString("hex")) != 89504e47) {
      buffer.read_offset -= 4;
      return "";
    }
    while ((slice = buffer.slice(4).toString("hex")) != 49454e44) {
      buffer.read_offset -= 3;
    }
    let end = buffer.read_offset;
    buffer.read_offset = start;
    let size = end - start;
    const newBuffer = buffer.slice(size + 4);
    return newBuffer;
  }

  toBuffer() {
    return Buffer.concat([QUInt.from(1).toBuffer(), this.__obj]);
  }
}

module.exports = {
    QColor,
    QEnum,
    QFont,
    QPixMap,
    QPoint,
    QString,
    QUint16,
    QVector
};
