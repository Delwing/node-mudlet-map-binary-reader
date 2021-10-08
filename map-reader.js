const { QMap, QBool, QInt, QDouble, QUInt, QString, QShort } = require("qtdatastream").types;
const { ReadBuffer } = require("qtdatastream").buffer;
const fs = require("fs");

function readQColor(buffer) {
  return {
    spec: buffer.readInt8(),
    alpha: buffer.readUInt16BE() >> 8,
    r: buffer.readUInt16BE() >> 8,
    g: buffer.readUInt16BE() >> 8,
    b: buffer.readUInt16BE() >> 8,
    pad: buffer.readUInt16BE() >> 8,
  };
}

function readQFont(buffer) {
  let font = {
    family: QString.read(buffer),
    style: QString.read(buffer),
    pointSize: QDouble.read(buffer),
  };
  buffer.read_offset += 32; // QFont deserialization ???
  return font;
}

function readMap(buffer, keyFunc, valueFunc, swap) {
  let map = {};
  let count = QUInt.read(buffer);
  for (let index = 0; index < count; index++) {
    let key = keyFunc(buffer);
    let value = valueFunc(buffer);
    if (swap) {
      map[value] = key;
    } else {
      map[key] = value;
    }
  }
  return map;
}

function readArray(buffer, valueFunc) {
  let map = [];
  let count = QUInt.read(buffer);
  for (let index = 0; index < count; index++) {
    map.push(valueFunc(buffer));
  }
  return map;
}

function readArrayFactory(valueFunc) {
  return function (buffer) {
    return readArray(buffer, valueFunc);
  };
}

function readPair(buffer, t1Func, t2Func) {
  return [t1Func(buffer), t2Func(buffer)];
}

function readPairFactory(t1Func, t2Func) {
  return function (buffer) {
    return readPair(buffer, t1Func, t2Func);
  };
}

function readQ3Vector(buffer) {
  return [QDouble.read(buffer), QDouble.read(buffer), QDouble.read(buffer)];
}

function readPoint(buffer) {
  return [QDouble.read(buffer), QDouble.read(buffer)];
}

function readPng(buffer, area, id) {
  QUInt.read(buffer);
  let start = buffer.read_offset;
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
  const newBuffer = buffer.slice(size);
  buffer.read_offset += 4;
  return newBuffer;
}

function readLabel(buffer, areaId, id) {
  let label = {};
  label.labelId = id;
  label.areaId = areaId;
  label.pos = readQ3Vector(buffer);
  QDouble.read(buffer);
  QDouble.read(buffer);
  label.size = [QDouble.read(buffer), QDouble.read(buffer)];
  label.text = QString.read(buffer);
  label.fgColor = readQColor(buffer);
  label.bgColor = readQColor(buffer);
  label.pixMap = readPng(buffer, areaId, label.labelId);
  label.noScaling = QBool.read(buffer);
  label.showOnTop = QBool.read(buffer);
  return label;
}

function readArea(buffer, id) {
  let area = {};
  area.id = id;
  area.rooms = readArray(buffer, QUInt.read);
  area.zLevels = readArray(buffer, QInt.read);
  area.mAreaExits = readMap(buffer, QInt.read, readPairFactory(QInt.read, QInt.read));
  area.gridMode = QBool.read(buffer);
  area.max_x = QInt.read(buffer);
  area.max_y = QInt.read(buffer);
  area.max_z = QInt.read(buffer);
  area.min_x = QInt.read(buffer);
  area.min_y = QInt.read(buffer);
  area.min_z = QInt.read(buffer);
  (area.span = readQ3Vector(buffer)), (area.xmaxForZ = readMap(buffer, QInt.read, QInt.read));
  area.ymaxForZ = readMap(buffer, QInt.read, QInt.read);
  area.xminForZ = readMap(buffer, QInt.read, QInt.read);
  area.yminForZ = readMap(buffer, QInt.read, QInt.read);
  area.pos = readQ3Vector(buffer);
  area.isZone = QBool.read(buffer);
  area.zoneAreaRef = QInt.read(buffer);
  area.userData = readMap(buffer, QString.read, QString.read);
  return area;
}

function readRoom(buffer, id) {
  let room = {};
  room.id = id;
  room.area = QInt.read(buffer);
  room.x = QInt.read(buffer);
  room.y = QInt.read(buffer);
  room.z = QInt.read(buffer);
  room.north = QInt.read(buffer);
  room.northeast = QInt.read(buffer);
  room.east = QInt.read(buffer);
  room.southeast = QInt.read(buffer);
  room.south = QInt.read(buffer);
  room.southwest = QInt.read(buffer);
  room.west = QInt.read(buffer);
  room.northwest = QInt.read(buffer);
  room.up = QInt.read(buffer);
  room.down = QInt.read(buffer);
  room.in = QInt.read(buffer);
  room.out = QInt.read(buffer);
  room.environment = QInt.read(buffer);
  room.weight = QInt.read(buffer);
  room.name = QString.read(buffer);
  room.isLocked = QBool.read(buffer);
  let rawSpecialExits = readMap(buffer, QUInt.read, QString.read, true);
  room.mSpecialExits = {};
  room.mSpecialExitLocks = [];
  for (const key in rawSpecialExits) {
    if (Object.hasOwnProperty.call(rawSpecialExits, key)) {
      const element = rawSpecialExits[key];
      if (key.startsWith("0")) {
        room.mSpecialExits[key.substring(1)] = element;
      } else if (key.startsWith("1")) {
        room.mSpecialExits[key.substring(1)] = element;
        room.mSpecialExitLocks.push(key.substring(1));
      } else {
        room.mSpecialExits[key] = element;
      }
    }
  }
  room.symbol = QString.read(buffer);
  room.userData = readMap(buffer, QString.read, QString.read);
  room.customLines = readMap(buffer, QString.read, readArrayFactory(readPoint));
  room.customLinesArrow = readMap(buffer, QString.read, QBool.read);
  room.customLinesColor = readMap(buffer, QString.read, readQColor);
  room.customLinesStyle = readMap(buffer, QString.read, QUInt.read);
  room.exitLocks = readArray(buffer, QInt.read);
  room.stubs = readArray(buffer, QInt.read);
  room.exitWeights = readMap(buffer, QString.read, QInt.read);
  room.doors = readMap(buffer, QString.read, QInt.read);
  return room;
}

module.exports = (file) => {
  let origBuffer = fs.readFileSync(file);
  let buffer = new ReadBuffer(origBuffer);

  let mVersion = QUInt.read(buffer);
  if (mVersion !== 20) {
      throw new Error(`Map version ${mVersion} not supported.`)
  }
  let mEnvColors = QMap.read(buffer);
  let areaNames = readMap(buffer, QInt.read, QString.read);
  let mCustomEnvColors = readMap(buffer, QInt.read, readQColor);
  let mpRoomDbHashToRoomId = readMap(buffer, QString.read, QUInt.read);
  let mUserData = readMap(buffer, QString.read, QString.read);
  let mMapSymbolFont = readQFont(buffer);
  let areaSize = QInt.read(buffer);
  let areas = {};
  for (let index = 0; index < areaSize; index++) {
    let id = QInt.read(buffer);
    areas[id] = readArea(buffer, id);
  }
  let mRoomIdHash = readMap(buffer, QString.read, QInt.read);
  let areasWithLabelsTotal = QInt.read(buffer);
  let labels = {};
  for (let index = 0; index < areasWithLabelsTotal; index++) {
    let totalLabels = QInt.read(buffer);
    let areaId = QInt.read(buffer);
    labels[areaId] = [];
    for (let index = 0; index < totalLabels; index++) {
      let id = QInt.read(buffer);
      labels[areaId].push(readLabel(buffer, areaId, id));
    }
  }

  let rooms = {};
  while (origBuffer.length > buffer.read_offset) {
    let id = QUInt.read(buffer);
    rooms[id] = readRoom(buffer, id);
  }

  for (const key in mpRoomDbHashToRoomId) {
    if (Object.hasOwnProperty.call(mpRoomDbHashToRoomId, key)) {
      const element = mpRoomDbHashToRoomId[key];
      rooms[element].hash = key;
    }
  }

  console.log(`${Object.keys(areas).length} areas found`);
  console.log(`${Object.keys(rooms).length} rooms found`);

  return {
    version: mVersion,
    envColors: mEnvColors,
    areaNames: areaNames,
    customEnvColors: mCustomEnvColors,
    hashToRoomId: mpRoomDbHashToRoomId,
    userData: mUserData,
    mapSymbolFont: mMapSymbolFont,
    rooms: rooms,
    labels: labels,
    areas: areas,
    areaNames: areaNames,
    roomIdHash: mRoomIdHash,
  };
};
