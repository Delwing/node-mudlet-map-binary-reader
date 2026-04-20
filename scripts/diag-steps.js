const { openDatabase } = require('../dist/cmud');

async function main() {
  const db = await openDatabase('./Arka.dbm');
  const objRows = db.query('SELECT ObjID, X, Y, ZoneID FROM ObjectTbl');
  console.log('objects loaded:', objRows.length);
  const rooms = {};
  for (const r of objRows) rooms[r.ObjId] = r;

  const exits = db.query('SELECT FromID, ToID, DirType FROM ExitTbl WHERE DirType IN (0,2,4,6) AND ExitIdTo != -1');
  console.log('cardinal exits:', exits.length);
  console.log('sample exit keys:', Object.keys(exits[0]));
  const perZone = {};
  let skipped = 0, kept = 0;
  for (const e of exits) {
    const f = rooms[e.FromID], t = rooms[e.ToID];
    if (!f || !t) { skipped++; continue; }
    if (f.ZoneID !== t.ZoneID) { skipped++; continue; }
    kept++;
    const delta = (e.DirType === 2 || e.DirType === 6) ? Math.abs(t.X - f.X) : Math.abs(t.Y - f.Y);
    if (!delta) continue;
    if (!perZone[f.ZoneID]) perZone[f.ZoneID] = {};
    perZone[f.ZoneID][delta] = (perZone[f.ZoneID][delta] || 0) + 1;
  }
  console.log('kept=' + kept + ' skipped=' + skipped);
  console.log('zones:', Object.keys(perZone));
  for (const z of Object.keys(perZone)) {
    const top = Object.entries(perZone[z]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const total = Object.values(perZone[z]).reduce((a, b) => a + b, 0);
    const keys = Object.keys(perZone[z]).map(Number).sort((a, b) => a - b);
    console.log('zone=' + z + ' total=' + total + ' min=' + keys[0] + ' top: ' + top.map(([d, n]) => d + 'x' + n).join(', '));
  }
  db.close();
}
main();
