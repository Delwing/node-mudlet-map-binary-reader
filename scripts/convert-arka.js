const path = require('path');
const { MudletMapReader } = require('../dist');

async function main() {
  const src = path.resolve(__dirname, '..', 'Arka.dbm');
  const outDir = path.resolve(__dirname, '..', 'out', 'arka');

  console.log(`Reading cMUD map: ${src}`);
  const cmud = await MudletMapReader.readCmud(src);
  console.log(
    `  zones=${Object.keys(cmud.zones).length} rooms=${Object.keys(cmud.rooms).length} exits=${cmud.exits.length} notes=${cmud.notes.length} styles=${Object.keys(cmud.styles).length}`,
  );

  const mudlet = MudletMapReader.cmudToMudlet(cmud);
  console.log(
    `Converted to Mudlet: areas=${Object.keys(mudlet.areas).length} rooms=${Object.keys(mudlet.rooms).length} customEnvColors=${Object.keys(mudlet.mCustomEnvColors).length}`,
  );

  const out = MudletMapReader.export(mudlet, outDir);
  console.log(
    `Wrote renderer export to ${outDir} (areas=${out.mapData.length} colors=${out.colors.length})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
