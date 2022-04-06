declare namespace Mudlet {
  interface MudletMap {
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
    labels: Record<number, MudletLabel>;
    rooms: Record<number, MudletRoom>;
  }
}

interface MudletArea {
  rooms: Array<number>;
  zLevels: Array<number>;
  mAreaExits: Record<number, Array<Array<number>>>
  gridMode: boolean;
  max_x: number;
  max_y: number;
  max_z: number;
  min_x: number;
  min_y: number;
  min_z: number;
  span: Array<number>;
  xmaxForZ: Record<number, number>;
  ymaxForZ: Record<number, number>;
  xminForZ: Record<number, number>;
  yminForZ: Record<number, number>;
  pos: Array<number>;
  isZone: boolean;
  zoneAreaRef: number;
  userData: Record<string, string>;
}

interface MudletRoom {
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
  mSpecialExits: Record<string, number>;
  mSpecialExitLock: Array<number>;
  symbol: string;
  userData: Record<string, string>;
  customLines: Record<string, Array<Array<number>>>;
  customLinesArrow: Record<string, boolean>;
  customLinesColor: Record<string, MudletColor>;
  customLinesStyle: Record<string, number>;
  exitLocks: Array<number>;
  stubs: Array<number>;
  exitWeights: Record<string, number>;
  doors: Record<string, number>;
}

interface MudletLabel {
  id: number;
  pos: Array<number>;
  size: Array<number>;
  text: string;
  fgColor: MudletColor;
  bgColor: MudletColor;
  pixMap: Buffer;
  noScaling: boolean;
  showOnTop: boolean;
}

interface MudletColor {
  spec: number;
  alpha: number;
  r: number;
  g: number;
  b: number;
}

interface MudletFont {
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
