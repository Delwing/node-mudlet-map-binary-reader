import type { QueryFn } from './sqlite-driver';
import type {
  CmudDirection,
  CmudExit,
  CmudLabel,
  CmudMap,
  CmudNote,
  CmudRoom,
  CmudStyle,
  CmudZone,
} from './cmud-types';

/**
 * Pure parser: given a `QueryFn` over a cMUD SQLite database, materialise a
 * `CmudMap`. Tolerant of missing tables and unknown columns — records what it
 * didn't recognise in `unknownColumns` for diagnostics.
 */
export function parseCmudMap(query: QueryFn): CmudMap {
  const tables = listTables(query);
  const unknownColumns: Record<string, string[]> = {};

  const zones = parseZones(query, tables, unknownColumns);
  const rooms = parseRooms(query, tables, unknownColumns);
  const exits = parseExits(query, tables, unknownColumns);
  const directions = parseDirections(query, tables, unknownColumns);
  const notes = parseNotes(query, tables, unknownColumns);
  const styles = parseStyles(query, tables, unknownColumns);
  const labels = parseLabels(query, tables, unknownColumns);

  return { zones, rooms, exits, directions, notes, styles, labels, unknownColumns };
}

function listTables(query: QueryFn): Set<string> {
  const rows = query(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  return new Set(rows.map((r) => String(r.name)));
}

/** Read all rows from `table` as plain objects; returns [] if table is absent. */
function readTable(
  query: QueryFn,
  tables: Set<string>,
  table: string,
): Record<string, unknown>[] {
  if (!tables.has(table)) return [];
  return query(`SELECT * FROM ${table}`);
}

/**
 * Pick the first column present in `row` matching any candidate, case-insensitively.
 *
 * cMUD's schema mixes casing (`FromID` vs `DirId` vs `ObjId`), so we normalise
 * both sides and return the actual column name as it appears in the row.
 */
function pick(row: Record<string, unknown>, ...candidates: string[]): string | undefined {
  const lowered = new Map<string, string>();
  for (const key of Object.keys(row)) lowered.set(key.toLowerCase(), key);
  for (const c of candidates) {
    const hit = lowered.get(c.toLowerCase());
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string' && v !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function toStr(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

/** Record columns that we didn't consume, for diagnostics. */
function recordUnused(
  unknown: Record<string, string[]>,
  table: string,
  row: Record<string, unknown>,
  consumed: Set<string>,
): void {
  if (unknown[table]) return;
  const leftover = Object.keys(row).filter((k) => !consumed.has(k));
  if (leftover.length) unknown[table] = leftover;
}

function parseZones(
  query: QueryFn,
  tables: Set<string>,
  unknown: Record<string, string[]>,
): Record<number, CmudZone> {
  const rows = readTable(query, tables, 'ZoneTbl');
  const out: Record<number, CmudZone> = {};
  for (const row of rows) {
    const idCol = pick(row, 'ZoneId', 'Id');
    const nameCol = pick(row, 'Name', 'ZoneName');
    const sizeCol = pick(row, 'DefSize');
    const sizeYCol = pick(row, 'DefSizeY');
    if (!idCol) continue;
    const id = toNum(row[idCol]);
    const zone: CmudZone = {
      id,
      name: nameCol ? toStr(row[nameCol]) : '',
      defSize: sizeCol ? toNum(row[sizeCol], 100) : 100,
      defSizeY: sizeYCol ? toNum(row[sizeYCol], 100) : 100,
    };
    out[id] = zone;
    recordUnused(
      unknown,
      'ZoneTbl',
      row,
      new Set([idCol, nameCol, sizeCol, sizeYCol].filter((c): c is string => !!c)),
    );
  }
  return out;
}

function parseRooms(
  query: QueryFn,
  tables: Set<string>,
  unknown: Record<string, string[]>,
): Record<number, CmudRoom> {
  const rows = readTable(query, tables, 'ObjectTbl');
  const out: Record<number, CmudRoom> = {};
  for (const row of rows) {
    const idCol = pick(row, 'ObjId', 'Id', 'ObjectId');
    const zoneCol = pick(row, 'ZoneId');
    const nameCol = pick(row, 'Name', 'ObjName');
    const descCol = pick(row, 'Desc', 'Description');
    const xCol = pick(row, 'X');
    const yCol = pick(row, 'Y');
    const zCol = pick(row, 'Z');
    const styleCol = pick(row, 'StyleId');
    const kindCol = pick(row, 'KindId');
    const flagsCol = pick(row, 'Flags');
    const colorCol = pick(row, 'Color');
    if (!idCol) continue;
    const id = toNum(row[idCol]);
    out[id] = {
      id,
      zoneId: zoneCol ? toNum(row[zoneCol]) : 0,
      name: nameCol ? toStr(row[nameCol]) : '',
      description: descCol ? toStr(row[descCol]) : '',
      x: xCol ? toNum(row[xCol]) : 0,
      y: yCol ? toNum(row[yCol]) : 0,
      z: zCol ? toNum(row[zCol]) : 0,
      styleId: styleCol ? toNum(row[styleCol]) : undefined,
      kindId: kindCol ? toNum(row[kindCol]) : undefined,
      flags: flagsCol ? toNum(row[flagsCol]) : 0,
      color: colorCol ? toNum(row[colorCol]) : undefined,
    };
    recordUnused(
      unknown,
      'ObjectTbl',
      row,
      new Set(
        [idCol, zoneCol, nameCol, descCol, xCol, yCol, zCol, styleCol, kindCol, flagsCol, colorCol].filter(
          (c): c is string => !!c,
        ),
      ),
    );
  }
  return out;
}

function parseExits(
  query: QueryFn,
  tables: Set<string>,
  unknown: Record<string, string[]>,
): CmudExit[] {
  const rows = readTable(query, tables, 'ExitTbl');
  const out: CmudExit[] = [];
  for (const row of rows) {
    const exitIdCol = pick(row, 'ExitId', 'Id');
    const exitIdToCol = pick(row, 'ExitIdTo');
    const fromCol = pick(row, 'FromId');
    const toCol = pick(row, 'ToId');
    const dirCol = pick(row, 'DirType');
    const dirToCol = pick(row, 'DirToType');
    const kindCol = pick(row, 'ExitKindId', 'KindId');
    const nameCol = pick(row, 'Name');
    const flagsCol = pick(row, 'Flags');
    if (!exitIdCol || !fromCol) continue;
    const nameVal = nameCol ? toStr(row[nameCol]) : '';
    out.push({
      exitId: toNum(row[exitIdCol]),
      exitIdTo: exitIdToCol ? toNum(row[exitIdToCol], -1) : -1,
      fromId: toNum(row[fromCol]),
      toId: toCol ? toNum(row[toCol]) : toNum(row[fromCol]),
      dirType: dirCol ? toNum(row[dirCol]) : 0,
      dirToType: dirToCol ? toNum(row[dirToCol]) : 0,
      exitKindId: kindCol ? toNum(row[kindCol]) : undefined,
      name: nameVal ? nameVal : undefined,
      flags: flagsCol ? toNum(row[flagsCol]) : undefined,
    });
    recordUnused(
      unknown,
      'ExitTbl',
      row,
      new Set(
        [exitIdCol, exitIdToCol, fromCol, toCol, dirCol, dirToCol, kindCol, nameCol, flagsCol].filter(
          (c): c is string => !!c,
        ),
      ),
    );
  }
  return out;
}

function parseDirections(
  query: QueryFn,
  tables: Set<string>,
  unknown: Record<string, string[]>,
): Record<number, CmudDirection> {
  const rows = readTable(query, tables, 'DirTbl');
  const out: Record<number, CmudDirection> = {};
  for (const row of rows) {
    const idCol = pick(row, 'DirId', 'Id');
    const nameCol = pick(row, 'DirName', 'Name');
    const revCol = pick(row, 'RevId');
    const dxCol = pick(row, 'Dx');
    const dyCol = pick(row, 'Dy');
    const dzCol = pick(row, 'Dz');
    if (!idCol) continue;
    const id = toNum(row[idCol]);
    out[id] = {
      id,
      name: nameCol ? toStr(row[nameCol]) : '',
      dx: dxCol ? toNum(row[dxCol]) : 0,
      dy: dyCol ? toNum(row[dyCol]) : 0,
      dz: dzCol ? toNum(row[dzCol]) : 0,
      revId: revCol ? toNum(row[revCol], -1) : -1,
    };
    recordUnused(
      unknown,
      'DirTbl',
      row,
      new Set(
        [idCol, nameCol, revCol, dxCol, dyCol, dzCol].filter((c): c is string => !!c),
      ),
    );
  }
  return out;
}

function parseNotes(
  query: QueryFn,
  tables: Set<string>,
  unknown: Record<string, string[]>,
): CmudNote[] {
  const rows = readTable(query, tables, 'NoteTbl');
  const out: CmudNote[] = [];
  for (const row of rows) {
    const objCol = pick(row, 'ObjId', 'ObjectId');
    const catCol = pick(row, 'Cat', 'Category');
    const textCol = pick(row, 'Note', 'Text');
    if (!objCol) continue;
    out.push({
      objectId: toNum(row[objCol]),
      category: catCol ? toStr(row[catCol]) : '',
      text: textCol ? toStr(row[textCol]) : '',
    });
    recordUnused(
      unknown,
      'NoteTbl',
      row,
      new Set([objCol, catCol, textCol].filter((c): c is string => !!c)),
    );
  }
  return out;
}

function parseStyles(
  query: QueryFn,
  tables: Set<string>,
  unknown: Record<string, string[]>,
): Record<number, CmudStyle> {
  const rows = readTable(query, tables, 'StyleTbl');
  const out: Record<number, CmudStyle> = {};
  for (const row of rows) {
    const idCol = pick(row, 'StyleId', 'Id');
    const fgCol = pick(row, 'FG', 'ForeColor', 'Fg');
    const bgCol = pick(row, 'BG', 'BackColor', 'Bg');
    const fontCol = pick(row, 'Font', 'FontName');
    if (!idCol) continue;
    const id = toNum(row[idCol]);
    out[id] = {
      id,
      fg: fgCol !== undefined ? decodeBgr(toNum(row[fgCol])) : undefined,
      bg: bgCol !== undefined ? decodeBgr(toNum(row[bgCol])) : undefined,
      font: fontCol ? toStr(row[fontCol]) : undefined,
    };
    recordUnused(
      unknown,
      'StyleTbl',
      row,
      new Set([idCol, fgCol, bgCol, fontCol].filter((c): c is string => !!c)),
    );
  }
  return out;
}

/**
 * cMUD stores colors as 24-bit BGR integers (Windows COLORREF convention):
 * 0x00BBGGRR. Decode to RGB channels.
 */
function decodeBgr(v: number): { r: number; g: number; b: number } {
  return {
    r: v & 0xff,
    g: (v >> 8) & 0xff,
    b: (v >> 16) & 0xff,
  };
}

function parseLabels(
  query: QueryFn,
  tables: Set<string>,
  unknown: Record<string, string[]>,
): CmudLabel[] {
  const rows = readTable(query, tables, 'DrawTbl');
  const out: CmudLabel[] = [];
  for (const row of rows) {
    const idCol = pick(row, 'DrawId', 'Id');
    const zoneCol = pick(row, 'ZoneId');
    const xCol = pick(row, 'X');
    const yCol = pick(row, 'Y');
    const zCol = pick(row, 'Z');
    const dxCol = pick(row, 'Dx');
    const dyCol = pick(row, 'Dy');
    const nameCol = pick(row, 'Name');
    const hintCol = pick(row, 'Hint');
    const styleCol = pick(row, 'StyleId');
    const flagsCol = pick(row, 'Flags');
    if (!idCol) continue;
    const text = nameCol ? toStr(row[nameCol]) : '';
    if (!text) continue; // skip marker-only draws without text
    out.push({
      id: toNum(row[idCol]),
      zoneId: zoneCol ? toNum(row[zoneCol], -1) : -1,
      x: xCol ? toNum(row[xCol]) : 0,
      y: yCol ? toNum(row[yCol]) : 0,
      z: zCol ? toNum(row[zCol]) : 0,
      dx: dxCol ? toNum(row[dxCol]) : 0,
      dy: dyCol ? toNum(row[dyCol]) : 0,
      text,
      hint: hintCol ? toStr(row[hintCol]) || undefined : undefined,
      styleId: styleCol ? toNum(row[styleCol]) : undefined,
      flags: flagsCol ? toNum(row[flagsCol]) : 0,
    });
    recordUnused(
      unknown,
      'DrawTbl',
      row,
      new Set(
        [idCol, zoneCol, xCol, yCol, zCol, dxCol, dyCol, nameCol, hintCol, styleCol, flagsCol].filter(
          (c): c is string => !!c,
        ),
      ),
    );
  }
  return out;
}
