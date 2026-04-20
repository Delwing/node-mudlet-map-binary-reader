const path = require('path');
const { openDatabase } = require('../dist/cmud');

async function main() {
  const src = path.resolve(__dirname, '..', 'Arka.dbm');
  const db = await openDatabase(src);

  for (const id of [90224, 90132]) {
    console.log(`\n=== Room ${id} ===`);
    const rows = db.query(`SELECT * FROM ObjectTbl WHERE ObjID=${id}`);
    for (const r of rows) console.log(' ', JSON.stringify(r));
    console.log(`  exits FROM ${id}:`);
    const exits = db.query(`SELECT * FROM ExitTbl WHERE FromID=${id}`);
    for (const e of exits) console.log('   ', JSON.stringify(e));
    console.log(`  exits TO ${id}:`);
    const back = db.query(`SELECT * FROM ExitTbl WHERE ToID=${id}`);
    for (const e of back) console.log('   ', JSON.stringify(e));
  }

  db.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
