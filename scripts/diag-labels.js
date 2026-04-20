const path = require('path');
const { openDatabase } = require('../dist/cmud');

async function main() {
  const src = path.resolve(__dirname, '..', 'Arka.dbm');
  const db = await openDatabase(src);

  console.log('=== All tables ===');
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  for (const t of tables) console.log(' ', t.name);

  // Labels in cMUD are commonly ObjectTbl rows with KindID pointing to a "Label" kind.
  console.log('\n=== KindTbl (if present) ===');
  const kt = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%Kind%'");
  for (const t of kt) {
    console.log('  table:', t.name);
    const rows = db.query(`SELECT * FROM ${t.name} LIMIT 40`);
    for (const r of rows) console.log('   ', JSON.stringify(r));
  }

  // See what KindIDs ObjectTbl rows use.
  console.log('\n=== ObjectTbl KindID distribution ===');
  const kinds = db.query('SELECT KindID, COUNT(*) as c FROM ObjectTbl GROUP BY KindID ORDER BY c DESC');
  for (const r of kinds) console.log('  KindID=' + r.KindID + ' count=' + r.c);

  // Look for rows where Name text matches VARIENO/targ/kusnierz
  console.log('\n=== Rows by ObjectTbl.Name sample texts ===');
  for (const needle of ['VARIENO', 'targ', 'kusnierz']) {
    const rows = db.query(`SELECT ObjID, ZoneID, KindID, Name, IDName, Hint, Desc, X, Y, Z FROM ObjectTbl WHERE Name LIKE '%${needle}%' OR IDName LIKE '%${needle}%' OR Hint LIKE '%${needle}%' LIMIT 3`);
    console.log('  search:', needle, '→', rows.length, 'row(s)');
    for (const r of rows) console.log('   ', JSON.stringify(r));
  }

  db.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
