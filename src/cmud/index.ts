/**
 * Public entry point for the cMUD map reader.
 *
 * Self-contained subtree: imports nothing from the rest of the repo so it can
 * be lifted into its own package when desired.
 */

export * from './cmud-types';
export { parseCmudMap } from './parser';
export { openDatabase } from './sqlite-driver';
export type { QueryFn, CmudDbHandle } from './sqlite-driver';

import { openDatabase } from './sqlite-driver';
import { parseCmudMap } from './parser';
import type { CmudMap } from './cmud-types';

/**
 * Read a cMUD `.dbm` map file (or in-memory buffer) into a `CmudMap`.
 *
 * Opens the SQLite database via sql.js, runs the parser, and closes the
 * handle before returning. Use `openDatabase` + `parseCmudMap` directly if
 * you need to keep the connection alive for additional queries.
 */
export async function readCmudMap(
  source: string | Buffer | Uint8Array,
): Promise<CmudMap> {
  const handle = await openDatabase(source);
  try {
    return parseCmudMap(handle.query);
  } finally {
    handle.close();
  }
}
