
const { ReadBuffer } = require("qtdatastream").buffer;
const { QUserType } = require("./types/mudlet-models");
const fs = require("fs");

function writeMap(map, file) {
    fs.writeFileSync(file, QUserType.get("MudletMap").from(map).toBuffer(true))
}

function readMap(file) {
    let buffer = new ReadBuffer(fs.readFileSync(file));
    let map = QUserType.read(buffer, "MudletMap");
    return map;
}


module.exports = {
    writeMap,
    readMap
}