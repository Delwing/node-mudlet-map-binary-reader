const { qtype, QClass, QUInt } = require("qtdatastream/src/types");

let customCounter = 1000;
let customMapCache = {};
let customMultiMapCache = {};
let customArrayCache = {};
let customPairCache = {};

function mudletSorter(a,b) {
    if (parseInt(a[0]) === -1) {
        return -1;
    }
    if (parseInt(b[0]) === -1) {
        return 1;
    }
    return a[0] - b[0];
}

function QMultiMap(keyClass, valueClass) {
  if (!keyClass.qtype) {
    keyClass = QClass.types.get(keyClass);
  }
  if (!valueClass.qtype) {
    valueClass = QClass.types.get(valueClass);
  }

  if (!customMultiMapCache[keyClass]) {
    customMultiMapCache[keyClass] = {};
  }
  if (!customMultiMapCache[keyClass][valueClass]) {
    let clazz = createTypedMultiMap(keyClass, valueClass);

    let counter = customCounter++;
    qtype(counter)(clazz);
    customMultiMapCache[keyClass][valueClass] = counter;
  }

  return customMultiMapCache[keyClass][valueClass];
}

function createTypedMultiMap(keyClass, valueClass) {
  return class QTypedMultiMap extends QClass {
    static read(buffer) {
      let map = {};
      let count = QUInt.read(buffer);
      for (let index = 0; index < count; index++) {
        let key = keyClass.read(buffer);
        let value = valueClass.read(buffer);
        if (map[key] == undefined) {
          map[key] = [];
        }
        map[key].push(value);
      }
      return map;
    }

    toBuffer() {
      const bufs = [];
      if (this.__obj instanceof Map) {
        bufs.push(QUInt.from(this.__obj.size).toBuffer());
        for (let [key, value] of this.__obj) {
          bufs.push(keyClass.from(key).toBuffer());
          bufs.push(valueClass.from(value).toBuffer());
        }
      } else {
        let counter = 0;
        for (const [key, value] of Object.entries(this.__obj).reverse()) {
          value.forEach((item) => {
            counter++;
            bufs.push(keyClass.from(key).toBuffer());
            bufs.push(valueClass.from(item).toBuffer());
          });
        }
        bufs.unshift(QUInt.from(counter).toBuffer());
      }
      return Buffer.concat(bufs);
    }
  };
}

function createTypedMap(keyClass, valueClass) {
    return class QTypedMap extends QClass {
      static read(buffer) {
        let map = {};
        let count = QUInt.read(buffer);
        for (let index = 0; index < count; index++) {
          let key = keyClass.read(buffer);
          let value = valueClass.read(buffer);
          map[key] = value;
        }
        return map;
      }
  
      toBuffer() {
        const bufs = [];
        if (this.__obj instanceof Map) {
          bufs.push(QUInt.from(this.__obj.size).toBuffer());
          for (let [key, value] of this.__obj) {
            bufs.push(keyClass.from(key).toBuffer());
            bufs.push(valueClass.from(value).toBuffer());
          }
        } else {
          const entries = Object.entries(this.__obj);
          bufs.push(QUInt.from(entries.length).toBuffer());
          for (const [key, value] of entries.sort(mudletSorter)) {
            bufs.push(keyClass.from(key).toBuffer());
            bufs.push(valueClass.from(value).toBuffer());
          }
        }
        return Buffer.concat(bufs);
      }
    };
  }

function QMap(keyClass, valueClass) {
  if (!keyClass.qtype) {
    keyClass = QClass.types.get(keyClass);
  }
  if (!valueClass.qtype) {
    valueClass = QClass.types.get(valueClass);
  }

  if (!customMapCache[keyClass]) {
    customMapCache[keyClass] = {};
  }
  if (!customMapCache[keyClass][valueClass]) {
    let clazz = createTypedMap(keyClass, valueClass);

    let counter = customCounter++;
    qtype(counter)(clazz);
    customMapCache[keyClass][valueClass] = counter;
  }

  return customMapCache[keyClass][valueClass];
}

function createTypedList(valueClass) {
  return class QTypeList extends QClass {
    static read(buffer) {
      let map = [];
      let count = QUInt.read(buffer);
      for (let index = 0; index < count; index++) {
        map.push(valueClass.read(buffer));
      }
      return map;
    }
    
    toBuffer() {
      const bufs = [];
      bufs.push(QUInt.from(this.__obj.length).toBuffer());
      for (let el of this.__obj) {
        bufs.push(valueClass.from(el).toBuffer());
      }
      return Buffer.concat(bufs);
    }
  };
}

function QList(valueClass) {
  if (!customArrayCache[valueClass]) {
    let clazz = createTypedList(valueClass);
    let counter = customCounter++;
    qtype(counter)(clazz);
    customArrayCache[valueClass] = counter;
  }
  return customArrayCache[valueClass];
}

function QPair(first, second) {
  let key = `${first.name}#${second.name}`;
  if (!customPairCache[key]) {
    let clazz = createTypedPair(first, second);
    let counter = customCounter++;
    qtype(counter)(clazz);
    customPairCache[key] = counter;
  }
  return customPairCache[key];
}

function createTypedPair(first, second) {
  return class QTypedPair extends QClass {
    static read(buffer) {
      return [first.read(buffer), second.read(buffer)];
    }
    toBuffer() {
      return Buffer.concat([first.from(this.__obj[0]).toBuffer(), second.from(this.__obj[1]).toBuffer()]);
    }
  };
}

module.exports = {
  QPair,
  QList,
  QMap,
  QMultiMap,
};
