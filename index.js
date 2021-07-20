const { qtype, QMap, QBool, QInt, QInt64, QDouble, QUInt, QString, Types } = require('qtdatastream').types;
const {ReadBuffer} = require('qtdatastream').buffer
const fs = require("fs")

const file = ''


let origBuffer = fs.readFileSync(file)
let buffer = new ReadBuffer(origBuffer) 

/**
 * 
 * @param {Buffer} buffer 
 * @returns 
 */
function readQColor(buffer) {
    return {
        spec: buffer.readInt8(),
        alpha: buffer.readUInt16BE() >> 8,
        r: buffer.readUInt16BE() >> 8,
        g: buffer.readUInt16BE() >> 8,
        b: buffer.readUInt16BE() >> 8,
        pad: buffer.readUInt16BE() >> 8
    }
}

/**
 * 
 * @param {Buffer} buffer 
 * @returns 
 */
function readQFont(buffer) {
    let font = {
        family: QString.read(buffer),
        style: QString.read(buffer),
        pointSize : QDouble.read(buffer)
    }
    buffer.read_offset += 32 // I QFont deserialization ???
    return font
}

/**
 * 
 * @param {Buffer} buffer 
 * @param {Function} keyFunc
 * @param {Function} valueFunc
 * @returns 
 */
function readMap(buffer, keyFunc, valueFunc) {
    let map = {}
    let count = QUInt.read(buffer)
    for (let index = 0; index < count; index++) {
        map[keyFunc(buffer)] = valueFunc(buffer)
    }
    return map
}

/**
 * 
 * @param {Buffer} buffer 
 * @param {Function} keyFunc
 * @param {Function} valueFunc
 * @returns 
 */
 function readArray(buffer, valueFunc) {
    let map = []
    let count = QUInt.read(buffer)
    for (let index = 0; index < count; index++) {
        map.push(valueFunc(buffer))
    }
    return map
}

function readPair(buffer, t1Func, t2Func) {
    return [
        t1Func(buffer),
        t2Func(buffer)
    ]
}

function readPairFactory(t1Func, t2Func) {
    return function(buffer) {
        return readPair(buffer, t1Func, t2Func)
    }
}

function readQ3Vector(buffer) {
    return [
        QDouble.read(buffer),
        QDouble.read(buffer),
        QDouble.read(buffer)
    ]
}

let version = QUInt.read(buffer)
let colors = QMap.read(buffer)
let areas = readMap(buffer, QUInt.read, QString.read)
let customEnvColors = readMap(buffer, QInt.read, readQColor)
let hashToRoomId = readMap(buffer, QString.read, QUInt.read)
let userData = readMap(buffer, QString.read, QString.read)
let mMapSymbolFont = readQFont(buffer)
let areaSize = QInt.read(buffer) - 1
buffer.read_offset += 114 // SKIP -1 area
let areaDb = {}
for (let index = 0; index < areaSize; index++) {
    let area = {}
    area.id = QInt.read(buffer)   
    area.rooms = readArray(buffer, QUInt.read)
    area.zLevels = readArray(buffer, QInt.read)
    area.mAreaExits = readMap(buffer, QInt.read, readPairFactory(QInt.read, QInt.read))
    area.gridMode = QBool.read(buffer)
    area.max_x = QInt.read(buffer)
    area.max_y = QInt.read(buffer)
    area.max_z = QInt.read(buffer)
    area.min_x = QInt.read(buffer)
    area.min_y = QInt.read(buffer)
    area.min_z = QInt.read(buffer)
    area.span = readQ3Vector(buffer),
    area.xmaxForZ = readMap(buffer, QInt.read, QInt.read)
    area.ymaxForZ = readMap(buffer, QInt.read, QInt.read)
    area.xminForZ = readMap(buffer, QInt.read, QInt.read)
    area.yminForZ = readMap(buffer, QInt.read, QInt.read)
    area.pos = readQ3Vector(buffer)
    area.isZone = QBool.read(buffer)
    area.zoneAreaRef = QInt.read(buffer)
    area.userData = readMap(buffer, QString.read, QString.read)
    areaDb[area.id] = area
}

let roomHashes = readMap(buffer, QString.read, QInt.read)

let areasWithLabels = QInt.read(buffer)
let labelsDb = {}
for (let index = 0; index < areasWithLabels; index++) {
    let totalLabels = QInt.read(buffer)
    let areaId = QInt.read(buffer)
    labelsDb[areaId] = {}
    for (let index = 0; index < totalLabels; index++) {
        let label = {}
        label.labelId = QInt.read(buffer)
        label.pos = readQ3Vector(buffer)
        QDouble.read(buffer)
        QDouble.read(buffer)
        label.size = [
            QDouble.read(buffer),
            QDouble.read(buffer)
        ]
        label.text = QString.read(buffer)
        label.fgColor = readQColor(buffer),
        label.bgColor = readQColor(buffer)
        
        labelsDb[areaId][label.labelId] = label
        console.log(label)
        break
    }
    break
}

let size = buffer.readUInt64BE()
console.log(size)