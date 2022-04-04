const { QClass, QInt, QUserType } = require("qtdatastream/src/types");

class MudletLabels extends QClass {
    static read(buffer) {
      let areasWithLabelsTotal = QInt.read(buffer);
      let labels = {};
      for (let index = 0; index < areasWithLabelsTotal; index++) {
        let totalLabels = QInt.read(buffer);
        let areaId = QInt.read(buffer);
        labels[areaId] = [];
        for (let index = 0; index < totalLabels; index++) {
          labels[areaId].push(QUserType.get("MudletLabel").read(buffer));
        }
      }
      return labels;
    }
  
    toBuffer() {
      let buffers = [];
      buffers.push(QInt.from(Object.keys(this.__obj).length).toBuffer());
      Object.keys(this.__obj).forEach((key) => {
        buffers.push(QInt.from(this.__obj[key].length).toBuffer());
        buffers.push(QInt.from(key).toBuffer());
        this.__obj[key].forEach((label) => {
          buffers.push(QUserType.get("MudletLabel").from(label).toBuffer(true));
        });
      });
      return Buffer.concat(buffers);
    }
  }
  
  class MudletAreas extends QClass {
    static read(buffer) {
      let areas = {};
      let areaSize = QInt.read(buffer);
      for (let index = 0; index < areaSize; index++) {
        let id = QInt.read(buffer);
        areas[id] = QUserType.get("MudletArea").read(buffer);
      }
      return areas;
    }
  
    toBuffer() {
      let buffers = [];
      buffers.push(QInt.from(Object.keys(this.__obj).length).toBuffer());
      for (const [key, area] of Object.entries(this.__obj).sort((a,b) => a[0] - b[0])) {
        buffers.push(QInt.from(key).toBuffer());
        buffers.push(QUserType.get("MudletArea").from(area).toBuffer(true));
      }
      return Buffer.concat(buffers);
    }
  }
  
  class MudletRooms extends QClass {
    static read(buffer) {
      let rooms = {};
      while (buffer.buffer.length > buffer.read_offset) {
        let id = QInt.read(buffer);
        rooms[id] = QUserType.get("MudletRoom").read(buffer);
      }
      return rooms;
    }
  
    toBuffer() {
      let buffers = [];
      for (const [key, room] of Object.entries(this.__obj).reverse()) {
        buffers.push(QInt.from(key).toBuffer());
        buffers.push(QUserType.get("MudletRoom").from(room).toBuffer(true));
      }
      return Buffer.concat(buffers);
    }
  }

  module.exports = {
      MudletAreas,
      MudletLabels,
      MudletRooms
  }