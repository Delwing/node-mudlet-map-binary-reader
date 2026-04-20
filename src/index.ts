import { readMap, writeMap } from './map-operations';
import readerExport from './reader-export';
import exportMap from './json-export';
import { readCmudMap } from './cmud';
import { cmudToMudletMap } from './cmud-to-mudlet';

export * from './types';
export { readerExport as readerExport, exportMap };
export { readCmudMap, cmudToMudletMap };
export type { CmudMap, CmudZone, CmudRoom, CmudExit, CmudDirection, CmudNote, CmudStyle, CmudLabel } from './cmud';

/** Convenience namespace for reading, writing, and exporting Mudlet map files. */
export const MudletMapReader = {
  read: readMap,
  write: writeMap,
  export: readerExport,
  exportJson: exportMap,
  readCmud: readCmudMap,
  cmudToMudlet: cmudToMudletMap,
};
