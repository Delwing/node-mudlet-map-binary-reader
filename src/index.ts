import { readMap, writeMap } from './map-operations';
import readerExport from './reader-export';
import exportMap from './json-export';

export * from './types';
export { readerExport as readerExport, exportMap };

/** Convenience namespace for reading, writing, and exporting Mudlet map files. */
export const MudletMapReader = {
  read: readMap,
  write: writeMap,
  export: readerExport,
  exportJson: exportMap,
};
