/** 
 * @type import("./types/map")
 */

const { ReadBuffer } = require("qtdatastream").buffer;
const { QUserType } = require("./models/mudlet-models");
const fs = require("fs");

/**
 * Reads Mudlet's binary map file
 *
 * @param {string} file - path to map file
 * @returns {Mudlet.MudletMap} map model
 */
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
              room.mSpecialExits[ex.substring(1)] = parseInt(key);
            } else if (ex.startsWith("1")) {
              room.mSpecialExits[ex.substring(1)] = parseInt(key);
              room.mSpecialExitLocks.push(parseInt(key));
            } else {
              room.mSpecialExits[ex] = key;
            }
          });
        }
      }
    }
  }

  return map;
}

/**
 * Stores map model as a Mudlet's map binary file
 *
 * @param {Mudlet.MudletMap} map
 * @param {string} file Path to file
 */
function writeMap(map, file) {
  for (const roomId in map.rooms) {
      let rawSpecialExits = {}
      const room = map.rooms[roomId]
      for (const exit in room.mSpecialExits) {
          if (Object.hasOwnProperty.call(room.mSpecialExits, exit)) {
              const exRoomId = room.mSpecialExits[exit];
              if (rawSpecialExits[exRoomId] == undefined) {
                  rawSpecialExits[exRoomId] = []
              }
              rawSpecialExits[exRoomId].push((room.mSpecialExitLocks.indexOf(exRoomId) > -1 ? "1" : "0") + exit)
          }
      }
      room.rawSpecialExits = rawSpecialExits;
  }

  fs.writeFileSync(file, QUserType.get("MudletMap").from(map).toBuffer(true));
}

module.exports = {
  writeMap,
  readMap,
};
