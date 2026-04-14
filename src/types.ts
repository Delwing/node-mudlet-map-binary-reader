/** Top-level Mudlet map model as stored in the binary map file. */
export interface MudletMap {
  version: number;
  envColors: Record<number, number>;
  areaNames: Record<number, string>;
  mCustomEnvColors: Record<number, MudletColor>;
  mpRoomDbHashToRoomId: Record<string, number>;
  mUserData: Record<string, string>;
  mapSymbolFont: MudletFont;
  mapFontFudgeFactor: number;
  useOnlyMapFont: boolean;
  areas: Record<number, MudletArea>;
  mRoomIdHash: Record<string, number>;
  labels: Record<number, MudletLabel[]>;
  rooms: Record<number, MudletRoom>;
}

/** A single area containing rooms, spatial bounds, and per-Z-level extents. */
export interface MudletArea {
  rooms: number[];
  zLevels: number[];
  mAreaExits: Record<number, [number, number][]>;
  gridMode: boolean;
  max_x: number;
  max_y: number;
  max_z: number;
  min_x: number;
  min_y: number;
  min_z: number;
  span: [number, number, number];
  xmaxForZ: Record<number, number>;
  ymaxForZ: Record<number, number>;
  xminForZ: Record<number, number>;
  yminForZ: Record<number, number>;
  pos: [number, number, number];
  isZone: boolean;
  zoneAreaRef: number;
  userData: Record<string, string>;
}

/** A single room with coordinates, exits, custom lines, and user data. */
export interface MudletRoom {
  area: number;
  x: number;
  y: number;
  z: number;
  north: number;
  northeast: number;
  east: number;
  southeast: number;
  south: number;
  southwest: number;
  west: number;
  northwest: number;
  up: number;
  down: number;
  in: number;
  out: number;
  environment: number;
  weight: number;
  name: string;
  isLocked: boolean;
  rawSpecialExits?: Record<number, string[]>;
  mSpecialExits: Record<string, number>;
  mSpecialExitLocks: number[];
  symbol: string;
  userData: Record<string, string>;
  customLines: Record<string, [number, number][]>;
  customLinesArrow: Record<string, boolean>;
  customLinesColor: Record<string, MudletColor>;
  customLinesStyle: Record<string, number>;
  exitLocks: number[];
  stubs: number[];
  exitWeights: Record<string, number>;
  doors: Record<string, number>;
  hash?: string;
}

/** A text/image label placed on the map at a specific position and size. */
export interface MudletLabel {
  id: number;
  labelId?: number;
  areaId?: number;
  pos: [number, number, number];
  dummy1?: number;
  dummy2?: number;
  size: [number, number];
  text: string;
  fgColor: MudletColor;
  bgColor: MudletColor;
  pixMap: Buffer | string;
  noScaling: boolean;
  showOnTop: boolean;
}

/** An RGBA color as stored by Qt's QColor (spec-qualified). */
export interface MudletColor {
  spec: number;
  alpha: number;
  r: number;
  g: number;
  b: number;
  pad?: number;
}

/** A font descriptor as stored by Qt's QFont (QDataStream v5.12 layout). */
export interface MudletFont {
  family: string;
  style: string;
  pointSize: number;
  pixelSize: number;
  styleHint: number;
  styleStrategy: number;
  weight: number;
  fontBits: number;
  stretch: number;
  extendedFontBits: number;
  letterSpacing: number;
  wordSpacing: number;
  hintingPreference: number;
  capital: number;
  styleSetting: boolean;
  underline: boolean;
  overline: boolean;
  strikeOut: boolean;
  fixedPitch: boolean;
  kerning: boolean;
  styleOblique: boolean;
  ignorePitch: boolean;
  letterSpacingIsAbsolute: boolean;
}
