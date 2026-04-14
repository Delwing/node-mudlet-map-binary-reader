import { QBool, QUserType } from 'qtdatastream/src/types';
import { types } from 'qtdatastream';
import { MudletLabels, MudletRooms, MudletAreas } from './mudlet-types';
import { QList, QMap, QPair, QMultiMap } from './qstream-containers';
import { QString, QColor, QPoint, QFont, QPixMap, QVector } from './qstream-types';

const { qtype, QInt, QDouble, QUInt, Types } = types;

Types.POINT = 25;
Types.FONT = 64;
Types.PIXMAP = 65;
Types.COLOR = 67;
Types.VECTOR = 84;

const MudletTypeIds = {
  LABELS: 200,
  ROOMS: 201,
  AREAS: 202,
} as const;

qtype(Types.POINT)(QPoint);
qtype(Types.FONT)(QFont);
qtype(Types.PIXMAP)(QPixMap);
qtype(Types.COLOR)(QColor);
qtype(Types.VECTOR)(QVector);
qtype(MudletTypeIds.LABELS)(MudletLabels);
qtype(MudletTypeIds.ROOMS)(MudletRooms);
qtype(MudletTypeIds.AREAS)(MudletAreas);

QUserType.register('MudletArea', [
  { rooms: QList(QUInt) },
  { zLevels: QList(QInt) },
  { mAreaExits: QMultiMap(QInt, QPair(QInt, QInt)) },
  { gridMode: Types.BOOL },
  { max_x: Types.INT },
  { max_y: Types.INT },
  { max_z: Types.INT },
  { min_x: Types.INT },
  { min_y: Types.INT },
  { min_z: Types.INT },
  { span: Types.VECTOR },
  { xmaxForZ: QMap(QInt, QInt) },
  { ymaxForZ: QMap(QInt, QInt) },
  { xminForZ: QMap(QInt, QInt) },
  { yminForZ: QMap(QInt, QInt) },
  { pos: Types.VECTOR },
  { isZone: Types.BOOL },
  { zoneAreaRef: Types.INT },
  { userData: QMap(QString, QString) },
]);

QUserType.register('MudletRoom', [
  { area: Types.INT },
  { x: Types.INT },
  { y: Types.INT },
  { z: Types.INT },
  { north: Types.INT },
  { northeast: Types.INT },
  { east: Types.INT },
  { southeast: Types.INT },
  { south: Types.INT },
  { southwest: Types.INT },
  { west: Types.INT },
  { northwest: Types.INT },
  { up: Types.INT },
  { down: Types.INT },
  { in: Types.INT },
  { out: Types.INT },
  { environment: Types.INT },
  { weight: Types.INT },
  { name: Types.STRING },
  { isLocked: Types.BOOL },
  { rawSpecialExits: QMultiMap(QUInt, QString) },
  { symbol: Types.STRING },
  { userData: QMap(QString, QString) },
  { customLines: QMap(QString, QList(QPoint)) },
  { customLinesArrow: QMap(QString, QBool) },
  { customLinesColor: QMap(QString, QColor) },
  { customLinesStyle: QMap(QString, QUInt) },
  { exitLocks: QList(QInt) },
  { stubs: QList(QInt) },
  { exitWeights: QMap(QString, QInt) },
  { doors: QMap(QString, QInt) },
]);

QUserType.register('MudletLabel', [
  { id: Types.INT },
  { pos: Types.VECTOR },
  { dummy1: Types.DOUBLE },
  { dummy2: Types.DOUBLE },
  { size: QPair(QDouble, QDouble) },
  { text: Types.STRING },
  { fgColor: Types.COLOR },
  { bgColor: Types.COLOR },
  { pixMap: Types.PIXMAP },
  { noScaling: Types.BOOL },
  { showOnTop: Types.BOOL },
]);

QUserType.register('MudletMap', [
  { version: Types.INT },
  { envColors: QMap(QInt, QInt) },
  { areaNames: QMap(QInt, QString, true) },
  { mCustomEnvColors: QMap(QInt, QColor) },
  { mpRoomDbHashToRoomId: QMap(QString, QUInt) },
  { mUserData: QMap(QString, QString) },
  { mapSymbolFont: Types.FONT },
  { mapFontFudgeFactor: Types.DOUBLE },
  { useOnlyMapFont: Types.BOOL },
  { areas: MudletTypeIds.AREAS },
  { mRoomIdHash: QMap(QString, QInt) },
  { labels: MudletTypeIds.LABELS },
  { rooms: MudletTypeIds.ROOMS },
]);

export { QUserType, MudletTypeIds };
