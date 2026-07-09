import { streamRooms } from '../../src/index';
import { generateColors } from '../../src/reader-export';
import { StreamingMapStats, type MapStats } from './stats';

/** A room's minimal position + environment, kept for the mini-map render — not the full MudletRoom. */
export interface RoomPoint {
  id: number;
  x: number;
  y: number;
  z: number;
  env: number;
}

export type WorkerMsg =
  | { type: 'phase'; phase: string }
  | { type: 'progress'; rooms: number; elapsedMs: number }
  | {
      type: 'done';
      stats: MapStats;
      areaRooms: Record<number, RoomPoint[]>;
      areaNames: Record<number, string>;
      /** envId -> [r, g, b], the same palette `readerExport` colors rooms with. */
      envColors: Record<number, [number, number, number]>;
      elapsedMs: number;
      bytes: number;
    }
  | { type: 'error'; message: string };

function post(msg: WorkerMsg): void {
  (self as unknown as { postMessage: (m: WorkerMsg) => void }).postMessage(msg);
}

self.onmessage = (e: MessageEvent<{ file: File }>) => {
  void run(e.data.file);
};

async function run(file: File): Promise<void> {
  const start = performance.now();
  try {
    post({ type: 'phase', phase: `Reading ${file.name}…` });
    const buf = new Uint8Array(await file.arrayBuffer());

    post({ type: 'phase', phase: 'Streaming rooms…' });
    const stats = new StreamingMapStats();
    // Only the fields the mini-map needs (id/x/y/z/env) are retained per room —
    // this is the point of streaming: never hold the full room graph at once.
    const areaRooms: Record<number, RoomPoint[]> = {};
    let lastReport = performance.now();

    const header = streamRooms(buf, (id, room) => {
      stats.addRoom(room);
      (areaRooms[room.area] ??= []).push({ id, x: room.x, y: room.y, z: room.z, env: room.environment });

      const now = performance.now();
      if (now - lastReport > 150) {
        lastReport = now;
        post({ type: 'progress', rooms: stats.count, elapsedMs: now - start });
      }
    });

    const envColors: Record<number, [number, number, number]> = {};
    for (const { envId, colors } of generateColors(header)) {
      envColors[envId] = [colors[0], colors[1], colors[2]];
    }

    post({
      type: 'done',
      stats: stats.finish(header),
      areaRooms,
      areaNames: header.areaNames,
      envColors,
      elapsedMs: performance.now() - start,
      bytes: buf.length,
    });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}
