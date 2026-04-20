const path = require('path');
const { openDatabase } = require('../dist/cmud');

async function main() {
  const src = path.resolve(__dirname, '..', 'Arka.dbm');
  const db = await openDatabase(src);

  console.log('=== Flags bitwise distribution ===');
  const all = db.query('SELECT Flags, COUNT(*) as c FROM ExitTbl GROUP BY Flags');
  for (const r of all) console.log('  Flags=' + r.Flags + ' count=' + r.c);

  console.log('\n=== Sample Flags=2 exits (should be "stub-only", no connection line) ===');
  const f2 = db.query('SELECT ExitId, FromID, ToID, DirType, Flags, ExitIdTo FROM ExitTbl WHERE Flags=2 LIMIT 10');
  for (const r of f2) console.log(' ', JSON.stringify(r));

  console.log('\n=== Sample Flags=3 exits ===');
  const f3 = db.query('SELECT ExitId, FromID, ToID, DirType, Flags, ExitIdTo FROM ExitTbl WHERE Flags=3 LIMIT 10');
  for (const r of f3) console.log(' ', JSON.stringify(r));

  console.log('\n=== Sample Flags=0 exits ===');
  const f0 = db.query('SELECT ExitId, FromID, ToID, DirType, Flags, ExitIdTo FROM ExitTbl WHERE Flags=0 LIMIT 10');
  for (const r of f0) console.log(' ', JSON.stringify(r));

  // Check if paired exits share the same Flags & 2 state
  console.log('\n=== Are paired exits consistent on Flags & 2? ===');
  const pairs = db.query(`
    SELECT a.ExitId AS aId, a.Flags AS aF, b.ExitId AS bId, b.Flags AS bF
    FROM ExitTbl a JOIN ExitTbl b ON a.ExitIdTo = b.ExitId
    WHERE (a.Flags & 2) != (b.Flags & 2) LIMIT 10
  `);
  console.log('  mismatched pairs:', pairs.length);
  for (const r of pairs) console.log(' ', JSON.stringify(r));

  db.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
