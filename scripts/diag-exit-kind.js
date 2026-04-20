const path = require('path');
const { openDatabase } = require('../dist/cmud');

async function main() {
  const src = path.resolve(__dirname, '..', 'Arka.dbm');
  const db = await openDatabase(src);

  // Sample rows with raw columns for each category.
  console.log('=== Sample ExitKindId=1 rows (first 10) ===');
  const kind1 = db.query('SELECT * FROM ExitTbl WHERE ExitKindId=1 LIMIT 10');
  for (const r of kind1) console.log(' ', JSON.stringify(r));

  console.log('\n=== DrawRev distribution ===');
  const drawRev = db.query('SELECT DrawRev, COUNT(*) AS c FROM ExitTbl GROUP BY DrawRev');
  for (const r of drawRev) console.log('  DrawRev=' + r.DrawRev + ' count=' + r.c);

  console.log('\n=== Flags distribution (top 10) ===');
  const flags = db.query('SELECT Flags, COUNT(*) AS c FROM ExitTbl GROUP BY Flags ORDER BY c DESC LIMIT 10');
  for (const r of flags) console.log('  Flags=' + r.Flags + ' count=' + r.c);

  console.log('\n=== Sample DrawRev=0 rows (first 10) ===');
  const dr0 = db.query('SELECT * FROM ExitTbl WHERE DrawRev=0 LIMIT 10');
  for (const r of dr0) console.log(' ', JSON.stringify(r));

  console.log('\n=== DrawRev vs ExitKindId cross ===');
  const cross = db.query('SELECT DrawRev, ExitKindId, COUNT(*) AS c FROM ExitTbl GROUP BY DrawRev, ExitKindId');
  for (const r of cross) console.log('  DrawRev=' + r.DrawRev + ' ExitKindId=' + r.ExitKindId + ' count=' + r.c);

  console.log('\n=== ExitKindTbl (if present) ===');
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%ExitKind%'");
  for (const t of tables) {
    console.log('  table:', t.name);
    const rows = db.query(`SELECT * FROM ${t.name}`);
    for (const r of rows) console.log('   ', JSON.stringify(r));
  }

  db.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
