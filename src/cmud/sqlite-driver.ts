import { promises as fs } from 'fs';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

/** Opaque query function. Runs SQL and returns rows as plain objects. */
export type QueryFn = (sql: string) => Record<string, unknown>[];

/** Handle returned by `openDatabase`. Call `close()` when done. */
export interface CmudDbHandle {
  query: QueryFn;
  close: () => void;
}

let sqlPromise: Promise<SqlJsStatic> | null = null;

/** Lazy-init sql.js WASM. Shared across all opens in the process. */
function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs();
  }
  return sqlPromise;
}

/**
 * Open a cMUD `.dbm` (SQLite) file or in-memory buffer.
 *
 * Accepts a filesystem path or a raw `Buffer`/`Uint8Array` containing the
 * database bytes. Returns a `query` function that runs a single `SELECT` and
 * materialises all rows as plain objects.
 */
export async function openDatabase(
  source: string | Buffer | Uint8Array,
): Promise<CmudDbHandle> {
  const SQL = await getSql();
  const bytes =
    typeof source === 'string'
      ? new Uint8Array(await fs.readFile(source))
      : source instanceof Buffer
        ? new Uint8Array(source)
        : source;

  const db: Database = new SQL.Database(bytes);

  const query: QueryFn = (sql: string) => {
    const result = db.exec(sql);
    if (result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) obj[columns[i]] = row[i];
      return obj;
    });
  };

  return {
    query,
    close: () => db.close(),
  };
}
