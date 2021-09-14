const fs = require("fs");
const roomExits = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest", "up", "down", "in", "out"];
const penStyles = {
    1 : "solid line",
    2 : "dash line",
    3 : "dot line"
}
const mudletColors = require("./mudlet-colors.json")

function converRoom(room) {
  if (room.environment) {
    room.env = room.environment;
    delete room.environment;
  }
  if (room.symbol) {
    room.roomChar = room.symbol;
    delete room.symbol;
  }
  room.exits = {}
  roomExits.forEach(key => {
      if (room[key] !== -1) {
        room.exits[key] = room[key]
      }
      delete room[key]
  })
  delete isLocked
  room.specialExits = room.mSpecialExits
  delete room.mSpecialExits
  delete room.mSpecialExitLocks
  delete room.exitWeights
  delete room.exitLocks
  delete room.isLocked
  for (const key in room.customLines) {
      if (Object.hasOwnProperty.call(room.customLines, key)) {
          const element = room.customLines[key];
          let line = {
              points: element.map(points => {return {x: points[0], y : points[1]}}),
              attributes : {
                  color: {
                      r: room.customLinesColor[key].r,
                      g: room.customLinesColor[key].g,
                      b: room.customLinesColor[key].b
                  },
                  style: penStyles[room.customLinesStyle[key]],
                  arrow: room.customLinesArrow[key]
              }
          }
          room.customLines[key] = line
      }
  }
  delete room.customLinesArrow
  delete room.customLinesColor
  delete room.customLinesStyle
  return room;
}

function getLabel(label, directory) {
    if (directory) {
        if (!fs.existsSync(`${directory}/labels`)) {
            fs.mkdirSync(`${directory}/labels`)
        }
        fs.writeFileSync(`${directory}/labels/${label.areaId}-${label.labelId}.png`, Buffer.from(label.pixMap));
        delete label.pixMap;
    } else {
        label.pixMap = Buffer.from(label.pixMap).toString('base64');
    }
    label.X = label.pos[0]
    label.Y = label.pos[1]
    label.Z = label.pos[2]
    delete label.pos
    label.Width = label.size[0]
    label.Height = label.size[1]
    delete label.size
    delete label.noScaling
    delete label.showOnTop
    label.FgColor = label.fgColor
    label.BgColor = label.bgColor
    delete label.FgColor.spec
    delete label.BgColor.spec
    delete label.FgColor.pad
    delete label.BgColor.pad
    delete label.fgColor
    delete label.bgColor
    return label
}

function generateColors(customEnvColors) {
    let colors = {}
    for (let i = 0; i <= 255; i++) {
        if (i !== 16) {
            let key = `ansi_${("00" + i).slice (-3)}`
            let envId
            if (i == 0 || i == 8) {
                envId = i + 8
            } else {
                envId = i
            }
            colors[envId] = mudletColors[key]
        }
    }

    for (const key in customEnvColors) {
        if (Object.hasOwnProperty.call(customEnvColors, key)) {
            const element = customEnvColors[key];
            delete element.pad
            delete element.alpha
            delete element.spec
            colors[key] = [element.r, element.g, element.b]
        }
    }

    let output = []
    for (const key in colors) {
        if (Object.hasOwnProperty.call(colors, key)) {
            const element = colors[key];
            output.push({
                envId: key,
                colors: element
            })
        }
    } 
    return output
}

module.exports = (map, directory) => {
    let mapData = [];
    for (const key in map.areas) {
      if (Object.hasOwnProperty.call(map.areas, key)) {
        const element = map.areas[key];
        let area = {
          areaName: map.areaNames[key],
          areaId: key,
          rooms: element.rooms.map((element) => converRoom(map.rooms[element])),
          labels : map.labels[key] ? map.labels[key].map((element) => getLabel(element, directory)) : []
        };
        mapData.push(area);
      }
    }

    if (directory) {
        fs.writeFileSync(`${directory}/mapExport.js`, "mapData = " + JSON.stringify(mapData))
        fs.writeFileSync(`${directory}/colors.js`, "colors = " + JSON.stringify(generateColors(map.customEnvColors)))
        fs.writeFileSync(`${directory}/mapExport.json`, JSON.stringify(mapData))
        fs.writeFileSync(`${directory}/colors.json`, JSON.stringify(generateColors(map.customEnvColors)))
    }

    return mapData
}

