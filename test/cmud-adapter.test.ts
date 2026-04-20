import { cmudToMudletMap } from '../src/cmud-to-mudlet';
import type { CmudMap } from '../src/cmud/cmud-types';

function emptyCmud(): CmudMap {
  return {
    zones: {},
    rooms: {},
    exits: [],
    directions: {},
    notes: [],
    styles: {},
    labels: [],
    unknownColumns: {},
  };
}

describe('cmudToMudletMap', () => {
  test('maps zones to areaNames and creates area entries', () => {
    const cmud = emptyCmud();
    cmud.zones[1] = { id: 1, name: 'Town', defSize: 200, defSizeY: 200 };
    const m = cmudToMudletMap(cmud);
    expect(m.areaNames[1]).toBe('Town');
    expect(m.areas[1]).toBeDefined();
  });

  test('scales room coords using zone defSize when no exit data is available', () => {
    const cmud = emptyCmud();
    cmud.zones[1] = { id: 1, name: 'T', defSize: 200, defSizeY: 200 };
    cmud.directions[3] = { id: 3, name: 'east', dx: 200, dy: 0, dz: 0, revId: 7 };
    cmud.rooms[10] = { id: 10, zoneId: 1, name: 'A', description: '', x: 0, y: 0, z: 0, flags: 0 };
    cmud.rooms[11] = { id: 11, zoneId: 1, name: 'B', description: '', x: 200, y: 0, z: 0, flags: 0 };
    const m = cmudToMudletMap(cmud);
    expect(m.rooms[10].x).toBe(0);
    expect(m.rooms[11].x).toBe(1);
  });

  test('fills cardinal exit slots and leaves non-cardinals as special exits', () => {
    const cmud = emptyCmud();
    cmud.zones[1] = { id: 1, name: 'T', defSize: 200, defSizeY: 200 };
    cmud.directions[1] = { id: 1, name: 'north', dx: 0, dy: 200, dz: 0, revId: 5 };
    cmud.directions[99] = { id: 99, name: 'climb', dx: 0, dy: 0, dz: 100, revId: 99 };
    cmud.rooms[10] = { id: 10, zoneId: 1, name: 'A', description: '', x: 0, y: 0, z: 0, flags: 0 };
    cmud.rooms[11] = { id: 11, zoneId: 1, name: 'B', description: '', x: 0, y: 200, z: 0, flags: 0 };
    // DB DirType = DirId - 1: north (DirId 1) → DirType 0; climb (DirId 99) → DirType 98.
    cmud.exits = [
      { exitId: 1, exitIdTo: 2, fromId: 10, toId: 11, dirType: 0, dirToType: 4 },
      { exitId: 3, exitIdTo: 4, fromId: 10, toId: 11, dirType: 98, dirToType: 98 },
    ];
    const m = cmudToMudletMap(cmud);
    expect(m.rooms[10].north).toBe(11);
    expect(m.rooms[10].mSpecialExits['climb']).toBe(11);
  });

  test('converts unexplored exit into matching stub id', () => {
    const cmud = emptyCmud();
    cmud.zones[1] = { id: 1, name: 'T', defSize: 200, defSizeY: 200 };
    cmud.directions[1] = { id: 1, name: 'north', dx: 0, dy: 200, dz: 0, revId: 5 };
    cmud.rooms[10] = { id: 10, zoneId: 1, name: 'A', description: '', x: 0, y: 0, z: 0, flags: 0 };
    cmud.exits = [
      { exitId: 1, exitIdTo: -1, fromId: 10, toId: 10, dirType: 0, dirToType: -1 },
    ];
    const m = cmudToMudletMap(cmud);
    expect(m.rooms[10].stubs).toContain(1);
    expect(m.rooms[10].north).toBe(-1);
  });

  test('folds notes into userData under cmud.note.<category>', () => {
    const cmud = emptyCmud();
    cmud.zones[1] = { id: 1, name: 'T', defSize: 200, defSizeY: 200 };
    cmud.rooms[10] = { id: 10, zoneId: 1, name: 'A', description: '', x: 0, y: 0, z: 0, flags: 0 };
    cmud.notes = [
      { objectId: 10, category: 'quest', text: 'Talk to mayor' },
      { objectId: 10, category: 'quest', text: 'Get the key' },
    ];
    const m = cmudToMudletMap(cmud);
    expect(m.rooms[10].userData['cmud.note.quest']).toBe('Talk to mayor\nGet the key');
  });

  test('synthesises custom env colors from styles and assigns to rooms', () => {
    const cmud = emptyCmud();
    cmud.zones[1] = { id: 1, name: 'T', defSize: 200, defSizeY: 200 };
    cmud.styles[5] = { id: 5, bg: { r: 10, g: 20, b: 30 } };
    cmud.styles[6] = { id: 6, bg: { r: 10, g: 20, b: 30 } }; // same color → same env
    cmud.styles[7] = { id: 7, bg: { r: 99, g: 0, b: 0 } };
    cmud.rooms[10] = { id: 10, zoneId: 1, name: 'A', description: '', x: 0, y: 0, z: 0, flags: 0, styleId: 5 };
    cmud.rooms[11] = { id: 11, zoneId: 1, name: 'B', description: '', x: 0, y: 0, z: 0, flags: 0, styleId: 6 };
    cmud.rooms[12] = { id: 12, zoneId: 1, name: 'C', description: '', x: 0, y: 0, z: 0, flags: 0, styleId: 7 };
    const m = cmudToMudletMap(cmud);
    expect(Object.keys(m.mCustomEnvColors)).toHaveLength(2); // deduped
    expect(m.rooms[10].environment).toBe(m.rooms[11].environment);
    expect(m.rooms[10].environment).not.toBe(m.rooms[12].environment);
  });

  test('computes area bounds and zLevels from rooms', () => {
    const cmud = emptyCmud();
    cmud.zones[1] = { id: 1, name: 'T', defSize: 200, defSizeY: 200 };
    cmud.directions[3] = { id: 3, name: 'east', dx: 200, dy: 0, dz: 0, revId: 7 };
    cmud.rooms[10] = { id: 10, zoneId: 1, name: 'A', description: '', x: 0, y: 0, z: 0, flags: 0 };
    cmud.rooms[11] = { id: 11, zoneId: 1, name: 'B', description: '', x: 600, y: 400, z: 1, flags: 0 };
    const m = cmudToMudletMap(cmud);
    const area = m.areas[1];
    expect(area.min_x).toBe(0);
    expect(area.max_x).toBe(3);
    // Y flips on read: cmud y=400 → mudlet y=-2. (max can be -0 due to Math.round(-0).)
    expect(area.min_y).toBe(-2);
    expect(Math.abs(area.max_y)).toBe(0);
    expect(area.zLevels).toEqual([0, 1]);
    expect(area.span).toEqual([3, 2, 1]);
  });

  test('stores cMUD description as userData', () => {
    const cmud = emptyCmud();
    cmud.zones[1] = { id: 1, name: 'T', defSize: 200, defSizeY: 200 };
    cmud.rooms[10] = {
      id: 10,
      zoneId: 1,
      name: 'A',
      description: 'A dusty road.',
      x: 0,
      y: 0,
      z: 0,
      flags: 0,
    };
    const m = cmudToMudletMap(cmud);
    expect(m.rooms[10].userData['cmud.description']).toBe('A dusty road.');
  });
});
