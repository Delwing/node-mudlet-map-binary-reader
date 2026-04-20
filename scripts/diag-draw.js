const path = require('path');
const { openDatabase } = require('../dist/cmud');

async function main() {
  const src = path.resolve(__dirname, '..', 'Arka.dbm');
  const db = await openDatabase(src);

  console.log('=== DrawTbl schema ===');
  const schema = db.query("SELECT sql FROM sqlite_master WHERE name='DrawTbl'");
  for (const r of schema) console.log(r.sql);

  console.log('\n=== DrawTbl row count ===');
  const c = db.query('SELECT COUNT(*) as n FROM DrawTbl');
  console.log(c[0]);

  console.log('\n=== Sample DrawTbl rows ===');
  const rows = db.query('SELECT * FROM DrawTbl LIMIT 20');
  for (const r of rows) console.log(' ', JSON.stringify(r));

  console.log('\n=== Rows matching VARIENO / targ / kusnierz ===');
  for (const needle of ['VARIENO', 'targ', 'kusnierz']) {
    const hits = db.query(`SELECT * FROM DrawTbl WHERE CAST(Text AS TEXT) LIKE '%${needle}%' OR CAST(Label AS TEXT) LIKE '%${needle}%' LIMIT 3`);
    console.log('  search:', needle, '→', hits.length);
    for (const r of hits) console.log('   ', JSON.stringify(r));
  }

  db.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
