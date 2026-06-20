import { QBool, QUserType, qtype, QInt, QDouble, QUInt } from 'qtdatastream-web/types';
import { registerBaseTypes, Types } from './base-types';
import { createMudletLabels, createMudletRooms, createMudletAreas } from './mudlet-types';
import { QList, QMap, QPair, QMultiMap } from './qstream-containers';
import { QString, QColor, QPoint } from './qstream-types';
import { registerMapModel } from './model-registry';
import type { MudletMap } from '../types';

// ---------------------------------------------------------------------------
// Mudlet map format, version 20.
//
// This module is self-contained: it registers every type the v20 layout needs
// under version-qualified names and registers a MapModel so the reader can
// dispatch on the on-disk version. Adding another version means copying this
// file, changing VERSION + the field lists, and importing it from
// mudlet-models.ts — nothing here is shared mutable state.
// ---------------------------------------------------------------------------

const VERSION = 20;

registerBaseTypes();

// Version-qualified QUserType names so multiple version models can coexist
// in the global type registry without clobbering each other.
const TYPE = {
  MAP: `MudletMap@${VERSION}`,
  AREA: `MudletArea@${VERSION}`,
  ROOM: `MudletRoom@${VERSION}`,
  LABEL: `MudletLabel@${VERSION}`,
} as const;

// Qt type ids for this version's Mudlet container classes. Each version uses
// its own ids so the containers resolve the right nested (version-qualified)
// type. v20 keeps the historical 200/201/202.
const CONTAINER = {
  LABELS: 200,
  ROOMS: 201,
  AREAS: 202,
} as const;

qtype(CONTAINER.LABELS)(createMudletLabels(TYPE.LABEL));
qtype(CONTAINER.ROOMS)(createMudletRooms(TYPE.ROOM));
qtype(CONTAINER.AREAS)(createMudletAreas(TYPE.AREA));

QUserType.register(TYPE.AREA, [
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

QUserType.register(TYPE.ROOM, [
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

QUserType.register(TYPE.LABEL, [
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

QUserType.register(TYPE.MAP, [
  { version: Types.INT },
  { envColors: QMap(QInt, QInt) },
  { areaNames: QMap(QInt, QString, true) },
  { mCustomEnvColors: QMap(QInt, QColor) },
  { mpRoomDbHashToRoomId: QMap(QString, QUInt) },
  { mUserData: QMap(QString, QString) },
  { mapSymbolFont: Types.FONT },
  { mapFontFudgeFactor: Types.DOUBLE },
  { useOnlyMapFont: Types.BOOL },
  { areas: CONTAINER.AREAS },
  { mRoomIdHash: QMap(QString, QInt) },
  { labels: CONTAINER.LABELS },
  { rooms: CONTAINER.ROOMS },
]);

registerMapModel({
  version: VERSION,
  read: (rb) => QUserType.read(rb, TYPE.MAP) as MudletMap,
  write: (map) => QUserType.get(TYPE.MAP).from(map).toBuffer(true) as Uint8Array,
});
