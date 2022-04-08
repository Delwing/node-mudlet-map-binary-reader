const fs = require('fs');
const _ = require('lodash');

const directions = [
  'north',
  'northeast',
  'northwest',
  'east',
  'west',
  'south',
  'southeast',
  'southwest',
  'up',
  'down',
  'in',
  'out',
];
const directionShortNames = [
  'n',
  'ne',
  'nw',
  'e',
  'w',
  's',
  'se',
  'sw',
  'up',
  'down',
  'in',
  'out',
];
const doorMap = [undefined, 'open', 'closed', 'locked'];

const exportMap = (map, mapFile, minified) => {
  const mudletMap = convertMapToMudletFormat(map);

  const mapJson = JSON.stringify(mudletMap, null, minified ? 0 : 2);

  fs.writeFileSync(mapFile, mapJson);
};

const convertMapToMudletFormat = (map) => {
  const convertedObject = {
    formatVersion: 1.0,
  };

  convertUserData(map, convertedObject);
  convertAreas(map, convertedObject);
  addMapStatistics(map, convertedObject);
  addDefaultAreaName(map, convertedObject);
  addAnonymousAreaName(map, convertedObject);
  convertEnvironmentColors(map, convertedObject);
  convertPlayerRooms(map, convertedObject);
  convertCustomEnvironmentColours(map, convertedObject);
  convertMapSymbolInfo(map, convertedObject);
  convertPlayerRoomLook(map, convertedObject);

  return convertedObject;
};

const convertUserData = (map, convertedObject) => {
  if (_.isEmpty(map.userData)) {
    return;
  }
  convertedObject.userData = map.userData;
};

const convertAreas = (map, convertedObject) => {
  const convertedAreas = _.map(map.areas, (area, areaid) => convertArea(area, areaid, map));
  convertedObject.areas = convertedAreas;
};

const convertArea = (area, areaid, map) => {
  const convertedArea = {
    id: parseInt(areaid),
    name: map.areaNames[areaid] || '',
    gridMode: area.gridMode ? true : undefined,
    roomCount: area.rooms.length,
    rooms: _.map(area.rooms, (roomId) => convertRoom(roomId, map)),
  };
  if (!_.isEmpty(area.userData)) {
    convertedArea.userData = area.userData;
  }
  if (!_.isEmpty(map.labels[areaid])) {
    convertedArea.labels = _.map(map.labels[areaid], convertLabel);
  }
  return convertedArea;
};

const convertRoom = (roomId, map) => {
  const room = map.rooms[roomId];
  const convertedRoom = {
    id: room.id,
    name: room.name !== '' ? room.name : undefined,
    coordinates: [room.x, room.y, room.z],
    locked: room.isLocked ? true : undefined,
    weight: room.weight !== 1 ? room.weight : undefined,
    symbol: room.symbol !== '' ? { text: room.symbol } : undefined, //binary map does not seem to support symbol colours
    environment: room.environment,
    hash: room.hash,
    exits: [],
    stubExits: convertStubExits(room.stubs, room.doors),
    userData: _.isEmpty(room.userData) ? undefined : room.userData,
  };

  for (let i = 0; i < directions.length; i++) {
    const direction = directions[i];
    const shortDirection = directionShortNames[i];
    if (room[direction] !== -1) {
      convertedRoom.exits.push({
        exitId: room[direction],
        name: direction,
        weight: getExitWeight(shortDirection, room.exitWeights, 1),
        locked: _.find(room.exitLocks, (num) => i === num - 1)
          ? true
          : undefined,
        door:
          room.doors[shortDirection] !== undefined
            ? doorMap[room.doors[shortDirection]]
            : undefined,
        customLine: convertCustomLine(
          room.customLines[shortDirection],
          room.customLinesArrow[shortDirection],
          room.customLinesColor[shortDirection],
          room.customLinesStyle[shortDirection]
        ),
      });
    }
  }
  for (const specialExit in room.mSpecialExits) {
    convertedRoom.exits.push({
      name: specialExit,
      exitId: room.mSpecialExits[specialExit],
      weight: getExitWeight(specialExit, room.exitWeights, 1),
      locked: _.find(
        room.mSpecialExitLocks,
        (exitCommand) => specialExit === exitCommand
      )
        ? true
        : undefined,
      door:
        room.doors[specialExit] !== undefined
          ? doorMap[room.doors[specialExit]]
          : undefined,
      customLine: convertCustomLine(
        room.customLines[specialExit],
        room.customLinesArrow[specialExit],
        room.customLinesColor[specialExit],
        room.customLinesStyle[specialExit]
      ),
    });
  }
  return convertedRoom;
};

const getExitWeight = (direction, weights, defaultValue) => {
  const weight = weights[direction];
  if (weight === undefined || weight === defaultValue) {
    return undefined;
  }
  return weight;
};

const convertCustomLine = (coordinates, arrow, color, style) => {
  if (coordinates === undefined || _.isEmpty(coordinates)) {
    return undefined;
  }
  // use the color object as base as we don't have a nesting in this case
  const line = convertColor(color);
  line.coordinates = coordinates;
  line.endsInArrow = arrow;
  line.style = convertLineStyle(style);
  return line;
};

const lineStyles = {
  2: 'dash line',
  3: 'dot line',
  4: 'dash dot line',
  5: 'dash dot dot line',
};

const convertLineStyle = (style) => {
  return lineStyles[style];
};

const convertStubExits = (stubs, doors) => {
  if (stubs.length === 0) {
    return undefined;
  }
  const convertedStubs = [];
  for (const dirNum of stubs) {
    const direction = directions[dirNum - 1];
    const shortDirection = directionShortNames[dirNum - 1];
    const stub = {
      name: direction,
      door:
        doors[shortDirection] !== undefined
          ? doorMap[doors[shortDirection]]
          : undefined,
    };
    convertedStubs.push(stub);
  }
  return convertedStubs;
};

const convertLabel = (label) => {
  return {
    colors: [convertColor(label.fgColor), convertColor(label.bgColor)],
    coordinates: [label.pos[0], label.pos[1], label.pos[2]],
    id: label.labelId,
    image: chunkString(Buffer.from(label.pixMap).toString('base64'), 64), // not the same base64 string as in Mudlet's JSON, but should yield the same result
    scaledels: !label.noScaling,
    showOnTop: label.showOnTop,
    text: label.text,
    size: [label.size[0], label.size[1]],
  };
};

const chunkString = (str, length) => {
  return str.match(new RegExp(`.{1,${length}}`, 'g'));
};

const addMapStatistics = (map, convertedObject) => {
  convertedObject.areaCount = Object.keys(map.areas).length;
  convertedObject.roomCount = Object.keys(map.rooms).length;
  convertedObject.labelCount = _.flatMap(map.labels, (label) => label).length;
};

// currently not in the binary map
const addDefaultAreaName = (_map, convertedObject) => {
  convertedObject.defaultAreaName = 'Default Area';
};

// currently not in the binary map
const addAnonymousAreaName = (_map, convertedObject) => {
  convertedObject.anonymousAreaName = 'Unnamed Area';
};

const convertEnvironmentColors = (map, convertedObject) => {
  convertedObject.envToColorMapping = map.envColors;
};

const convertPlayerRooms = (map, convertedObject) => {
  convertedObject.playersRoomId = map.roomIdHash;
};

const convertCustomEnvironmentColours = (map, convertedObject) => {
  const colors = _.map(map.mCustomEnvColors, (color, index) => {
    const convertedColor = convertColor(color);
    convertedColor.id = parseInt(index);
    return convertedColor;
  });
  convertedObject.customEnvColors = colors;
};

const convertColor = (color) => {
  const ret = {};
  const colorArray = [color.r, color.g, color.b];
  if (color.alpha < 255) {
    colorArray.push(color.alpha);
    ret.color32RGBA = colorArray;
  } else {
    ret.color24RGB = colorArray;
  }
  return ret;
};

const convertMapSymbolInfo = (map, convertedObject) => {
  const f = map.mapSymbolFont;
  const firstFamilyComma = f.family.indexOf(',');
  const family =
    firstFamilyComma > -1 ? f.family.substr(0, firstFamilyComma) : f.family;
  // the string produced by the QFont source does not seem to match the one in the QFont::toString() documentation as it's missing some values
  // However, the source code string seems to match what is in our JSON so we reproduce that.
  const fontString = `${family},${f.pointSize},${f.pixelSize},${f.styleHint},${
    f.weight
  },${f.styleSetting ? 1 : 0},${f.underline ? 1 : 0},${f.strikeOut ? 1 : 0},${
    f.fixedPitch ? 1 : 0
  },0`;

  convertedObject.mapSymbolFontDetails = fontString;
  convertedObject.mapSymbolFontFudgeFactor = map.mapFontFudgeFactor;
  convertedObject.onlyMapSymbolFontToBeUsed = map.useOnlyMapFont;
};

const convertPlayerRoomLook = (_map, convertedObject) => {
  // not part of the binary map... These are some kind of setting, why are they even part of the JSON map?
  // so use a fixed value
  convertedObject.playerRoomColors = [
    { color24RGB: [255, 0, 0] },
    { color24RGB: [255, 255, 255] },
  ];
  convertedObject.playerRoomInnerDiameterPercentage = 70;
  convertedObject.playerRoomOuterDiameterPercentage = 120;
  convertedObject.playerRoomStyle = 0;
};

module.exports = exportMap;
