// Re-export via namespace + const-alias rather than `export { X } from './y'`,
// because TypeScript's CJS emit for the latter uses
// `Object.defineProperty(exports, 'X', { get: () => mod.X })` — which Vite 8's
// oxc pre-bundler does not detect as a named export, causing consumers to
// fail with "module does not provide an export named 'readMapFromBuffer'".
// Plain `exports.X = mod.X` assignments (what `const x = ns.x; export { x }`
// compiles to) are detected correctly.
import * as mapOps from './map-operations';
import readerExportFn, { convertRoom as convertRoomFn, convertLabel as convertLabelFn } from './reader-export';
import exportMapFn from './json-export';

export const readMapFromBuffer = mapOps.readMapFromBuffer;
export const writeMapToBuffer = mapOps.writeMapToBuffer;
export const streamRooms = mapOps.streamRooms;
export const readerExport = readerExportFn;
/** Per-room / per-label converters to the renderer shape (for streaming consumers). */
export const convertRoom = convertRoomFn;
export const convertLabel = convertLabelFn;
export const exportMap = exportMapFn;

export type { RendererRoom, RendererLabel } from './reader-export';
export * from './types';

/** Convenience namespace for reading, writing, and exporting Mudlet map files. */
export const MudletMapReader = {
  readBuffer: mapOps.readMapFromBuffer,
  writeBuffer: mapOps.writeMapToBuffer,
  streamRooms: mapOps.streamRooms,
  export: readerExportFn,
  exportJson: exportMapFn,
};
