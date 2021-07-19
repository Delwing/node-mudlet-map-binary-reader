const { qtype, QMap, QBool, QInt, QUInt64, QUInt, QString, Types } = require('qtdatastream').types;
const {ReadBuffer} = require('qtdatastream').buffer
const fs = require("fs")




let buffer = new ReadBuffer(fs.readFileSync(file)) 

let version = QUInt.read(buffer)
let colors = QMap.read(buffer)

let numberOfAreas = QUInt.read(buffer)
let areas = {}
for (let index = 0; index < numberOfAreas; index++) {
    areas[QUInt.read(buffer)] = QString.read(buffer)

}

let customEnvColorsSize = QUInt.read(buffer)
console.log(customEnvColorsSize)
let customEnvColors = {}
console.log(QInt.read(buffer))


console.log(customEnvColors)