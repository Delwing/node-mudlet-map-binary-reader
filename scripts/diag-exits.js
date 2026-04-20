const path = require('path');
const { MudletMapReader } = require('../dist');

async function main() {
  const src = path.resolve(__dirname, '..', 'Arka.dbm');
  const cmud = await MudletMapReader.readCmud(src);

  const roomIds = new Set(Object.keys(cmud.rooms).map(Number));
  const stats = {
    total: cmud.exits.length,
    unexploredMinus1: 0,
    selfLoop: 0,
    toMissing: 0,
    crossZone: 0,
    kindCounts: new Map(),
    dirTypeCounts: new Map(),
    sampleMissing: [],
    sampleCrossZone: [],
  };

  for (const e of cmud.exits) {
    if (e.exitIdTo === -1) stats.unexploredMinus1++;
    if (e.toId === e.fromId && e.exitIdTo !== -1) stats.selfLoop++;
    if (!roomIds.has(e.toId)) {
      stats.toMissing++;
      if (stats.sampleMissing.length < 5)
        stats.sampleMissing.push({ ...e, fromZone: cmud.rooms[e.fromId]?.zoneId });
    } else if (cmud.rooms[e.fromId]?.zoneId !== cmud.rooms[e.toId]?.zoneId) {
      stats.crossZone++;
      if (stats.sampleCrossZone.length < 5)
        stats.sampleCrossZone.push({
          ...e,
          fromZone: cmud.rooms[e.fromId]?.zoneId,
          toZone: cmud.rooms[e.toId]?.zoneId,
        });
    }
    const k = e.exitKindId ?? 'null';
    stats.kindCounts.set(k, (stats.kindCounts.get(k) || 0) + 1);
    stats.dirTypeCounts.set(e.dirType, (stats.dirTypeCounts.get(e.dirType) || 0) + 1);
  }

  console.log('Total exits:', stats.total);
  console.log('exitIdTo === -1 (unexplored):', stats.unexploredMinus1);
  console.log('selfLoop (toId === fromId, not -1):', stats.selfLoop);
  console.log('toId references missing room:', stats.toMissing);
  console.log('cross-zone exits:', stats.crossZone);
  console.log('exitKindId distribution:');
  for (const [k, n] of [...stats.kindCounts].sort((a, b) => b[1] - a[1]).slice(0, 10))
    console.log('  kind=' + k + ' count=' + n);
  console.log('dirType distribution (top 12):');
  for (const [d, n] of [...stats.dirTypeCounts].sort((a, b) => b[1] - a[1]).slice(0, 12))
    console.log('  dirType=' + d + ' count=' + n);

  if (stats.sampleMissing.length) {
    console.log('\nSample missing-target exits:');
    for (const e of stats.sampleMissing) console.log(' ', JSON.stringify(e));
  }
  if (stats.sampleCrossZone.length) {
    console.log('\nSample cross-zone exits:');
    for (const e of stats.sampleCrossZone) console.log(' ', JSON.stringify(e));
  }

  // Look for exitKindId in ExitTbl - also look at raw schema for what Kind means
  console.log('\nRaw schema unknowns for ExitTbl:', cmud.unknownColumns.ExitTbl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
