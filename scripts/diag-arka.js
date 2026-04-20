const path = require('path');
const { MudletMapReader } = require('../dist');

async function main() {
  const src = path.resolve(__dirname, '..', 'Arka.dbm');
  const cmud = await MudletMapReader.readCmud(src);

  console.log('=== Zones ===');
  for (const z of Object.values(cmud.zones)) console.log(`  id=${z.id} name=${z.name} defSize=${z.defSize} defSizeY=${z.defSizeY}`);

  console.log('=== Directions ===');
  for (const d of Object.values(cmud.directions)) {
    console.log(`  id=${d.id} name=${d.name} dx=${d.dx} dy=${d.dy} dz=${d.dz} revId=${d.revId}`);
  }

  console.log('=== Styles ===');
  for (const s of Object.values(cmud.styles)) {
    console.log(`  id=${s.id} fg=${JSON.stringify(s.fg)} bg=${JSON.stringify(s.bg)} font=${s.font}`);
  }

  console.log('=== Sample rooms ===');
  const rms = Object.values(cmud.rooms).slice(0, 15);
  for (const r of rms) {
    console.log(`  id=${r.id} zone=${r.zoneId} (${r.x},${r.y},${r.z}) style=${r.styleId} color=${r.color} name=${r.name}`);
  }

  console.log('=== Coord spread (per zone) ===');
  const perZone = {};
  for (const r of Object.values(cmud.rooms)) {
    const z = r.zoneId;
    if (!perZone[z]) perZone[z] = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity, count: 0, xs: new Set(), ys: new Set() };
    const p = perZone[z];
    p.count++;
    if (r.x < p.minX) p.minX = r.x;
    if (r.x > p.maxX) p.maxX = r.x;
    if (r.y < p.minY) p.minY = r.y;
    if (r.y > p.maxY) p.maxY = r.y;
    if (r.z < p.minZ) p.minZ = r.z;
    if (r.z > p.maxZ) p.maxZ = r.z;
    if (p.xs.size < 20) p.xs.add(r.x);
    if (p.ys.size < 20) p.ys.add(r.y);
  }
  for (const [z, p] of Object.entries(perZone)) {
    console.log(`  zone=${z} count=${p.count} x=[${p.minX},${p.maxX}] y=[${p.minY},${p.maxY}] z=[${p.minZ},${p.maxZ}]`);
    console.log(`    sample xs: ${[...p.xs].slice(0,10).sort((a,b)=>a-b).join(',')}`);
    console.log(`    sample ys: ${[...p.ys].slice(0,10).sort((a,b)=>a-b).join(',')}`);
  }

  console.log('=== Color distribution ===');
  const colorCounts = new Map();
  let noColor = 0;
  for (const r of Object.values(cmud.rooms)) {
    if (r.color === undefined) { noColor++; continue; }
    colorCounts.set(r.color, (colorCounts.get(r.color) || 0) + 1);
  }
  console.log(`  no color: ${noColor}`);
  const sorted = [...colorCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 15);
  for (const [c, n] of sorted) {
    const r = c & 0xff;
    const g = (c >> 8) & 0xff;
    const b = (c >> 16) & 0xff;
    console.log(`  color=0x${c.toString(16).padStart(8,'0')} rgb=(${r},${g},${b}) count=${n}`);
  }

  console.log('=== Style distribution ===');
  const styleCounts = new Map();
  for (const r of Object.values(cmud.rooms)) {
    const s = r.styleId;
    styleCounts.set(s, (styleCounts.get(s) || 0) + 1);
  }
  for (const [s, n] of styleCounts) console.log(`  styleId=${s} count=${n}`);

  console.log('=== Unknown columns ===');
  for (const [t, cols] of Object.entries(cmud.unknownColumns)) {
    console.log(`  ${t}: ${cols.join(', ')}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
