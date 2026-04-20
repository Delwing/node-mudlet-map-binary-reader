import { parseCmudMap } from '../src/cmud/parser';
import type { QueryFn } from '../src/cmud/sqlite-driver';

/** Build a QueryFn that serves canned rows keyed by table name. */
function mockQuery(tables: Record<string, Record<string, unknown>[]>): QueryFn {
  return (sql: string) => {
    const masterMatch = sql.match(/FROM sqlite_master/i);
    if (masterMatch) {
      return Object.keys(tables).map((name) => ({ name }));
    }
    const selectMatch = sql.match(/FROM\s+(\w+)/i);
    if (!selectMatch) return [];
    return tables[selectMatch[1]] ?? [];
  };
}

describe('parseCmudMap', () => {
  test('materialises zones, rooms, exits, directions', () => {
    const query = mockQuery({
      ZoneTbl: [{ ZoneId: 1, Name: 'Town', DefSize: 200, DefSizeY: 200 }],
      ObjectTbl: [
        { ObjId: 10, ZoneId: 1, Name: 'Square', Desc: 'A plaza.', X: 0, Y: 0, Z: 0, Flags: 0 },
        { ObjId: 11, ZoneId: 1, Name: 'North Road', Desc: '', X: 0, Y: 200, Z: 0, Flags: 0 },
      ],
      ExitTbl: [
        { ExitId: 1, ExitIdTo: 2, FromId: 10, ToId: 11, DirType: 1, DirToType: 5 },
        { ExitId: 2, ExitIdTo: 1, FromId: 11, ToId: 10, DirType: 5, DirToType: 1 },
      ],
      DirTbl: [
        { DirId: 1, DirName: 'north', RevId: 5, Dx: 0, Dy: 200, Dz: 0 },
        { DirId: 5, DirName: 'south', RevId: 1, Dx: 0, Dy: -200, Dz: 0 },
      ],
    });
    const map = parseCmudMap(query);
    expect(map.zones[1].name).toBe('Town');
    expect(map.rooms[10].name).toBe('Square');
    expect(map.rooms[11].y).toBe(200);
    expect(map.exits).toHaveLength(2);
    expect(map.directions[1].name).toBe('north');
  });

  test('handles missing tables without throwing', () => {
    const query = mockQuery({});
    const map = parseCmudMap(query);
    expect(map.zones).toEqual({});
    expect(map.rooms).toEqual({});
    expect(map.exits).toEqual([]);
  });

  test('records unknown columns for diagnostics', () => {
    const query = mockQuery({
      ZoneTbl: [{ ZoneId: 1, Name: 'Town', DefSize: 200, DefSizeY: 200, MysteryField: 42 }],
    });
    const map = parseCmudMap(query);
    expect(map.unknownColumns.ZoneTbl).toContain('MysteryField');
  });

  test('decodes BGR color integers from StyleTbl', () => {
    const query = mockQuery({
      StyleTbl: [{ StyleId: 7, BG: 0x00abcdef }],
    });
    const map = parseCmudMap(query);
    // 0x00abcdef -> b=0xab, g=0xcd, r=0xef
    expect(map.styles[7].bg).toEqual({ r: 0xef, g: 0xcd, b: 0xab });
  });

  test('matches column names case-insensitively', () => {
    // Real cMUD schema mixes casing: FromID/ToID/ExitKindID but DirId/ObjId.
    const query = mockQuery({
      ObjectTbl: [{ ObjId: 10, ZoneID: 1, Name: 'A', X: 0, Y: 0, Z: 0 }],
      ExitTbl: [{ ExitId: 1, ExitIdTo: 2, FromID: 10, ToID: 11, DirType: 1, DirToType: 5 }],
    });
    const map = parseCmudMap(query);
    expect(map.rooms[10].zoneId).toBe(1);
    expect(map.exits[0].fromId).toBe(10);
    expect(map.exits[0].toId).toBe(11);
  });

  test('marks exit as unexplored when exitIdTo is -1', () => {
    const query = mockQuery({
      ExitTbl: [
        { ExitId: 3, ExitIdTo: -1, FromId: 10, ToId: 10, DirType: 1, DirToType: 0 },
      ],
    });
    const map = parseCmudMap(query);
    expect(map.exits[0].exitIdTo).toBe(-1);
    expect(map.exits[0].toId).toBe(10);
  });
});
