const { ReadBuffer } = require("qtdatastream").buffer;
const { QUserType } = require("./types/mudlet-models");
const fs = require("fs");

function writeMap(map, file) {
  fs.writeFileSync(file, QUserType.get("MudletMap").from(map).toBuffer(true));
}

function readMap(file) {
  let buffer = new ReadBuffer(fs.readFileSync(file));
  let map = QUserType.read(buffer, "MudletMap");

  for (const roomId in map.rooms) {
    if (Object.hasOwnProperty.call(map.rooms, roomId)) {
      const room = map.rooms[roomId];
      room.mSpecialExits = {};
      room.mSpecialExitLocks = [];
      for (const key in room.rawSpecialExits) {
        if (Object.hasOwnProperty.call(room.rawSpecialExits, key)) {
          const elements = room.rawSpecialExits[key];
          elements.forEach((ex) => {
            if (ex.startsWith("0")) {
              room.mSpecialExits[ex.substring(1)] = key;
            } else if (key.startsWith("1")) {
              room.mSpecialExits[ex.substring(1)] = key;
              room.mSpecialExitLocks.push(ex.substring(1));
            } else {
              room.mSpecialExits[key] = ex;
            }
          });
        }
      }
    }
  }
  
  return map;
}

module.exports = {
  writeMap,
  readMap,
};
