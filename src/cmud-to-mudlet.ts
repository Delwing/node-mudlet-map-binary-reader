import type {
  CmudDirection,
  CmudExit,
  CmudLabel,
  CmudMap,
  CmudNote,
  CmudRoom,
  CmudStyle,
  CmudZone,
} from './cmud/cmud-types';
import type { MudletArea, MudletColor, MudletLabel, MudletMap, MudletRoom } from './types';

/**
 * Converts a native `CmudMap` into a `MudletMap`.
 *
 * Lossy by nature — see README for the list of cMUD concepts that don't
 * survive the translation. The only losses we actively salvage here:
 *   - Notes are folded into per-room `userData` under `cmud.note.<category>`.
 *   - Per-room color overrides and styles synthesise `mCustomEnvColors`.
 *   - Unexplored exits (`exitIdTo === -1`) become Mudlet `stubs`.
 *   - Non-cardinal directions become `mSpecialExits`.
 */
export function cmudToMudletMap(cmud: CmudMap): MudletMap {
  const rooms: Record<number, MudletRoom> = {};
  const fallbackScale = deriveFallbackScale(cmud.directions);
  const zoneScales = computeZoneScales(
    cmud.rooms,
    cmud.exits,
    cmud.directions,
    cmud.zones,
    fallbackScale,
  );

  for (const room of Object.values(cmud.rooms)) {
    const scale = zoneScales[room.zoneId] ?? fallbackScale;
    rooms[room.id] = buildRoom(room, scale);
  }

  applyExits(rooms, cmud.exits, cmud.directions);
  applyNotes(rooms, cmud.notes);

  const { envColors, roomEnv } = buildEnvironments(cmud.rooms, cmud.styles);
  for (const [idStr, envId] of Object.entries(roomEnv)) {
    const r = rooms[Number(idStr)];
    if (r) r.environment = envId;
  }

  const areas = buildAreas(rooms, cmud.zones);
  const areaNames: Record<number, string> = {};
  for (const zone of Object.values(cmud.zones)) areaNames[zone.id] = zone.name;

  const labels = buildLabels(cmud.labels, zoneScales, fallbackScale);

  return {
    version: 20,
    envColors: {},
    areaNames,
    mCustomEnvColors: envColors,
    mpRoomDbHashToRoomId: {},
    mUserData: {},
    mapSymbolFont: DEFAULT_FONT(),
    mapFontFudgeFactor: 1.0,
    useOnlyMapFont: false,
    areas,
    mRoomIdHash: {},
    labels,
    rooms,
  };
}

/**
 * Per-zone coordinate scale computed from the observed cardinal-exit strides.
 *
 * For each zone we collect |Δx| / |Δy| between east/west / north/south
 * exit-connected rooms, then:
 *   1. Identify the "dominant" strides (≥ 10% of the mode count).
 *   2. Use `min(dominant) / 2` as the zone scale.
 *
 * This makes every dominant stride round to **2 Mudlet cells**, even when a
 * zone mixes e.g. a 256-step main grid with a 240-step sub-region (zone 2 in
 * Arka). With a fixed `defSize` scale the minority stride rounds to 1 or 2
 * inconsistently; the data-driven value avoids that. Zones with no usable
 * exit data fall back to `defSize` (or the global east.dx).
 */
function computeZoneScales(
  rooms: Record<number, CmudRoom>,
  exits: CmudExit[],
  directions: Record<number, CmudDirection>,
  zones: Record<number, CmudZone>,
  fallback: number,
): Record<number, number> {
  const stepCounts: Record<number, Map<number, number>> = {};
  for (const exit of exits) {
    const from = rooms[exit.fromId];
    const to = rooms[exit.toId];
    if (!from || !to || from.zoneId !== to.zoneId) continue;
    const dir = exit.dirType >= 0 ? directions[exit.dirType + 1] : undefined;
    const name = dir?.name.toLowerCase() ?? '';
    let delta = 0;
    if (name === 'east' || name === 'west') delta = Math.abs(to.x - from.x);
    else if (name === 'north' || name === 'south') delta = Math.abs(to.y - from.y);
    if (!delta) continue;
    if (!stepCounts[from.zoneId]) stepCounts[from.zoneId] = new Map();
    const m = stepCounts[from.zoneId];
    m.set(delta, (m.get(delta) || 0) + 1);
  }

  const scales: Record<number, number> = {};
  const zoneIds = new Set<number>([
    ...Object.keys(zones).map(Number),
    ...Object.keys(stepCounts).map(Number),
  ]);
  for (const zoneId of zoneIds) {
    const zone = zones[zoneId];
    const defSize = zone && zone.defSize > 0 ? zone.defSize : 0;
    const counts = stepCounts[zoneId];
    if (!counts || counts.size === 0) {
      scales[zoneId] = defSize || fallback;
      continue;
    }
    const sorted = [...counts].sort((a, b) => b[1] - a[1]);
    const modeCount = sorted[0][1];
    const threshold = Math.max(1, modeCount * 0.1);
    const dominant = sorted.filter(([, c]) => c >= threshold).map(([s]) => s);
    scales[zoneId] = Math.max(1, Math.floor(Math.min(...dominant) / 2));
  }
  return scales;
}

/** Global fallback scale derived from the east direction vector, if any. */
function deriveFallbackScale(dirs: Record<number, CmudDirection>): number {
  for (const d of Object.values(dirs)) {
    if (d.name.toLowerCase() === 'east' && d.dx > 0) return d.dx;
  }
  return 200;
}

function buildRoom(room: CmudRoom, scale: number): MudletRoom {
  return {
    area: room.zoneId,
    x: Math.round(room.x / scale),
    // Y flips on read so the adapter pair composes to identity.
    y: Math.round(-room.y / scale),
    z: Math.round(room.z),
    north: -1,
    northeast: -1,
    east: -1,
    southeast: -1,
    south: -1,
    southwest: -1,
    west: -1,
    northwest: -1,
    up: -1,
    down: -1,
    in: -1,
    out: -1,
    environment: 1,
    weight: 1,
    name: room.name,
    isLocked: false,
    mSpecialExits: {},
    mSpecialExitLocks: [],
    symbol: '',
    userData: room.description ? { 'cmud.description': room.description } : {},
    customLines: {},
    customLinesArrow: {},
    customLinesColor: {},
    customLinesStyle: {},
    exitLocks: [],
    stubs: [],
    exitWeights: {},
    doors: {},
  };
}

/** Mudlet cardinal exit slot keys, indexed by normalised direction name. */
const CARDINAL_SLOTS: Record<string, keyof MudletRoom> = {
  n: 'north',
  north: 'north',
  ne: 'northeast',
  northeast: 'northeast',
  e: 'east',
  east: 'east',
  se: 'southeast',
  southeast: 'southeast',
  s: 'south',
  south: 'south',
  sw: 'southwest',
  southwest: 'southwest',
  w: 'west',
  west: 'west',
  nw: 'northwest',
  northwest: 'northwest',
  u: 'up',
  up: 'up',
  d: 'down',
  down: 'down',
  in: 'in',
  out: 'out',
};

/**
 * Stub-direction IDs as interpreted by the JS Mudlet Map Renderer and this
 * project's `json-export` (N, NE, NW, E, W, S, SE, SW, U, D, I, O — see
 * `directions` in `src/json-export.ts`). Not the same as Mudlet's C++ `DIR_*`
 * enum; getting this wrong manifests as stubs pointing the wrong way.
 */
const STUB_IDS: Record<string, number> = {
  north: 1,
  northeast: 2,
  northwest: 3,
  east: 4,
  west: 5,
  south: 6,
  southeast: 7,
  southwest: 8,
  up: 9,
  down: 10,
  in: 11,
  out: 12,
};

/** cMUD `ExitTbl.Flags` bit 1 — "draw as short stub, suppress the connecting line". */
const CMUD_EXIT_FLAG_STUB = 2;

function applyExits(
  rooms: Record<number, MudletRoom>,
  exits: CmudExit[],
  dirs: Record<number, CmudDirection>,
): void {
  for (const exit of exits) {
    const room = rooms[exit.fromId];
    if (!room) continue;
    // cMUD stores ExitTbl.DirType as (DirId - 1) — zero-indexed. Undo the shift here.
    const dir = exit.dirType >= 0 ? dirs[exit.dirType + 1] : undefined;
    const dirName = (dir?.name ?? '').toLowerCase();
    // Fall back to ExitTbl.Name for specials (no canonical direction).
    const label = dirName || (exit.name ?? '').toLowerCase();
    if (!label) continue;

    const slot = CARDINAL_SLOTS[label];
    const drawAsStub =
      exit.exitIdTo === -1 ||
      exit.toId === exit.fromId ||
      (exit.flags !== undefined && (exit.flags & CMUD_EXIT_FLAG_STUB) !== 0);

    if (slot) {
      if (drawAsStub) {
        const stubId = STUB_IDS[slot as string];
        if (stubId && !room.stubs.includes(stubId)) room.stubs.push(stubId);
      } else {
        (room[slot] as number) = exit.toId;
      }
    } else if (!drawAsStub) {
      room.mSpecialExits[label] = exit.toId;
    }
  }
}

function applyNotes(
  rooms: Record<number, MudletRoom>,
  notes: CmudNote[],
): void {
  for (const note of notes) {
    const room = rooms[note.objectId];
    if (!room) continue;
    const key = note.category
      ? `cmud.note.${note.category}`
      : 'cmud.note';
    const existing = room.userData[key];
    room.userData[key] = existing ? `${existing}\n${note.text}` : note.text;
  }
}

/**
 * cMUD sentinel for `ObjectTbl.Color` meaning "no per-room override — inherit
 * from style/kind palette".
 */
const CMUD_INHERIT_SENTINEL = 0x1fffffff;

/** Decode cMUD's 24-bit BGR integer (`0x00BBGGRR`) into RGB channels. */
function decodeBgr(v: number): { r: number; g: number; b: number } {
  return { r: v & 0xff, g: (v >> 8) & 0xff, b: (v >> 16) & 0xff };
}

/**
 * Build the Mudlet env-color palette and per-room env assignment.
 *
 * Color resolution order for each room:
 *   1. Per-room `ObjectTbl.Color` override, unless it's the "inherit" sentinel.
 *   2. The room's style bg (or fg if no bg).
 *   3. A synthesised neutral grey, shared across all unclassified rooms.
 *
 * Mudlet's built-in env IDs occupy 257-272, so we start synthesised ones at
 * 300 to stay clear. Unique RGB triples are deduped across all sources.
 */
function buildEnvironments(
  cmudRooms: Record<number, CmudRoom>,
  styles: Record<number, CmudStyle>,
): { envColors: Record<number, MudletColor>; roomEnv: Record<number, number> } {
  const envColors: Record<number, MudletColor> = {};
  const rgbToEnv = new Map<string, number>();
  let nextId = 300;

  const getEnv = (rgb: { r: number; g: number; b: number }): number => {
    const key = `${rgb.r},${rgb.g},${rgb.b}`;
    let id = rgbToEnv.get(key);
    if (id === undefined) {
      id = nextId++;
      rgbToEnv.set(key, id);
      envColors[id] = { spec: 1, alpha: 255, r: rgb.r, g: rgb.g, b: rgb.b, pad: 0 };
    }
    return id;
  };

  let defaultEnv: number | undefined;
  const getDefaultEnv = (): number => {
    if (defaultEnv === undefined) defaultEnv = getEnv({ r: 128, g: 128, b: 128 });
    return defaultEnv;
  };

  const roomEnv: Record<number, number> = {};
  for (const room of Object.values(cmudRooms)) {
    let rgb: { r: number; g: number; b: number } | undefined;
    if (room.color !== undefined && room.color !== CMUD_INHERIT_SENTINEL) {
      rgb = decodeBgr(room.color);
    } else if (room.styleId !== undefined && styles[room.styleId]) {
      const s = styles[room.styleId];
      rgb = s.bg ?? s.fg;
    }
    roomEnv[room.id] = rgb ? getEnv(rgb) : getDefaultEnv();
  }
  return { envColors, roomEnv };
}

function buildAreas(
  rooms: Record<number, MudletRoom>,
  zones: Record<number, CmudZone>,
): Record<number, MudletArea> {
  const areas: Record<number, MudletArea> = {};
  for (const zone of Object.values(zones)) {
    areas[zone.id] = emptyArea();
  }
  for (const [idStr, room] of Object.entries(rooms)) {
    const id = Number(idStr);
    let area = areas[room.area];
    if (!area) {
      area = emptyArea();
      areas[room.area] = area;
    }
    area.rooms.push(id);
    updateAreaBounds(area, room);
  }
  for (const area of Object.values(areas)) finaliseArea(area);
  return areas;
}

function emptyArea(): MudletArea {
  return {
    rooms: [],
    zLevels: [],
    mAreaExits: {},
    gridMode: false,
    max_x: 0,
    max_y: 0,
    max_z: 0,
    min_x: 0,
    min_y: 0,
    min_z: 0,
    span: [0, 0, 0],
    xmaxForZ: {},
    ymaxForZ: {},
    xminForZ: {},
    yminForZ: {},
    pos: [0, 0, 0],
    isZone: false,
    zoneAreaRef: -1,
    userData: {},
  };
}

function updateAreaBounds(area: MudletArea, room: MudletRoom): void {
  const first = area.rooms.length === 1;
  if (first) {
    area.min_x = area.max_x = room.x;
    area.min_y = area.max_y = room.y;
    area.min_z = area.max_z = room.z;
  } else {
    if (room.x < area.min_x) area.min_x = room.x;
    if (room.x > area.max_x) area.max_x = room.x;
    if (room.y < area.min_y) area.min_y = room.y;
    if (room.y > area.max_y) area.max_y = room.y;
    if (room.z < area.min_z) area.min_z = room.z;
    if (room.z > area.max_z) area.max_z = room.z;
  }
  if (!area.zLevels.includes(room.z)) area.zLevels.push(room.z);
  const cur = area.xmaxForZ[room.z];
  if (cur === undefined || room.x > cur) area.xmaxForZ[room.z] = room.x;
  const cur2 = area.xminForZ[room.z];
  if (cur2 === undefined || room.x < cur2) area.xminForZ[room.z] = room.x;
  const cur3 = area.ymaxForZ[room.z];
  if (cur3 === undefined || room.y > cur3) area.ymaxForZ[room.z] = room.y;
  const cur4 = area.yminForZ[room.z];
  if (cur4 === undefined || room.y < cur4) area.yminForZ[room.z] = room.y;
}

function finaliseArea(area: MudletArea): void {
  area.zLevels.sort((a, b) => a - b);
  area.span = [
    area.max_x - area.min_x,
    area.max_y - area.min_y,
    area.max_z - area.min_z,
  ];
}

/**
 * Convert cMUD `DrawTbl` labels into Mudlet map labels, grouped by areaId.
 *
 * Positioned with the same per-zone scale as rooms (with y flipped). cMUD
 * labels carry no fg/bg color in this repo's dbm samples, so we fall back to
 * black-on-transparent and let the renderer handle the rest. Label size is
 * estimated from text length since `DrawTbl.Dx/Dy` is typically 0.
 */
function buildLabels(
  labels: CmudLabel[],
  zoneScales: Record<number, number>,
  fallbackScale: number,
): Record<number, MudletLabel[]> {
  const out: Record<number, MudletLabel[]> = {};
  for (const label of labels) {
    const scale = zoneScales[label.zoneId] ?? fallbackScale;
    const x = label.x / scale;
    const y = -label.y / scale;
    const z = label.z;

    // Crude size estimate: ~0.3 cells wide per character, 0.4 cells tall.
    // Overridden by explicit Dx/Dy when cMUD has them.
    const width = label.dx > 0 ? label.dx / scale : label.text.length * 0.3;
    const height = label.dy > 0 ? label.dy / scale : 0.4;

    const mudletLabel: MudletLabel = {
      id: label.id,
      areaId: label.zoneId,
      labelId: label.id,
      pos: [x, y, z],
      size: [width, height],
      text: label.text,
      fgColor: { spec: 1, alpha: 255, r: 0, g: 0, b: 0, pad: 0 },
      bgColor: { spec: 1, alpha: 0, r: 255, g: 255, b: 255, pad: 0 },
      pixMap: Buffer.alloc(0),
      noScaling: false,
      showOnTop: true,
    };
    if (!out[label.zoneId]) out[label.zoneId] = [];
    out[label.zoneId].push(mudletLabel);
  }
  return out;
}

const DEFAULT_FONT = () => ({
  family: 'Bitstream Vera Sans Mono',
  style: '',
  pointSize: 12.0,
  pixelSize: -1,
  styleHint: 5,
  styleStrategy: 1,
  weight: 50,
  fontBits: 16,
  stretch: 100,
  extendedFontBits: 0,
  letterSpacing: 0,
  wordSpacing: 0,
  hintingPreference: 0,
  capital: 0,
  styleSetting: false,
  underline: false,
  overline: false,
  strikeOut: false,
  fixedPitch: false,
  kerning: true,
  styleOblique: false,
  ignorePitch: false,
  letterSpacingIsAbsolute: false,
});
