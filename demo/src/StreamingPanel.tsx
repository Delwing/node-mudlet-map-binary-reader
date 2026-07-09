import { useCallback, useMemo, useRef, useState } from 'react';
import type { MapStats } from './stats';
import { Stat, BarList, formatBytes } from './ui';
import RoomMiniMap from './RoomMiniMap';
import type { RoomPoint, WorkerMsg } from './stream-worker';

interface Loaded {
  fileName: string;
  fileSize: number;
  stats: MapStats;
  areaRooms: Record<number, RoomPoint[]>;
  areaNames: Record<number, string>;
  envColors: Record<number, [number, number, number]>;
  elapsedMs: number;
}

/**
 * Streaming counterpart to the "Full read" tab: reads the map via
 * `streamRooms` inside a Worker, so peak memory is `buffer + one room`
 * instead of the fully-materialised object graph — meant for maps too large
 * to comfortably parse on the main thread in one pass.
 */
export default function StreamingPanel() {
  const [phase, setPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ rooms: number; elapsedMs: number } | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [selectedZ, setSelectedZ] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const run = useCallback((file: File) => {
    setError(null);
    setLoaded(null);
    setProgress(null);
    setPhase(`Loading ${file.name} (${formatBytes(file.size)})…`);
    setSelectedArea(null);
    setSelectedZ(null);

    workerRef.current?.terminate();
    const worker = new Worker(new URL('./stream-worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerMsg>) => {
      const msg = e.data;
      if (msg.type === 'phase') {
        setPhase(msg.phase);
      } else if (msg.type === 'progress') {
        setProgress({ rooms: msg.rooms, elapsedMs: msg.elapsedMs });
      } else if (msg.type === 'error') {
        setError(msg.message);
        setPhase(null);
      } else if (msg.type === 'done') {
        setPhase(null);
        setProgress(null);
        setLoaded({
          fileName: file.name,
          fileSize: file.size,
          stats: msg.stats,
          areaRooms: msg.areaRooms,
          areaNames: msg.areaNames,
          envColors: msg.envColors,
          elapsedMs: msg.elapsedMs,
        });
        const firstArea = Object.keys(msg.areaRooms).map(Number).sort((a, b) => a - b)[0];
        setSelectedArea(firstArea ?? null);
      }
    };
    worker.onerror = (e) => {
      setError(e.message);
      setPhase(null);
    };
    worker.postMessage({ file });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) run(file);
    },
    [run],
  );

  const areaRoomsForSelection = selectedArea !== null ? loaded?.areaRooms[selectedArea] ?? [] : [];
  const zLevels = useMemo(
    () => [...new Set(areaRoomsForSelection.map((r) => r.z))].sort((a, b) => a - b),
    [areaRoomsForSelection],
  );
  const roomsForZ = useMemo(
    () => (selectedZ !== null ? areaRoomsForSelection.filter((r) => r.z === selectedZ) : areaRoomsForSelection),
    [areaRoomsForSelection, selectedZ],
  );

  return (
    <>
      <p className="mb-4 text-sm text-slate-500">
        Streams rooms one at a time (never holds the full room graph in memory) — for maps too
        large to comfortably read whole.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
          dragging
            ? 'border-indigo-400 bg-indigo-500/10'
            : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
        }`}
      >
        <input
          type="file"
          accept=".dat"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) run(file);
          }}
        />
        <div className="text-lg font-medium">
          {phase ?? 'Drop a map file here or click to browse'}
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Usually a <code className="rounded bg-slate-800 px-1">.dat</code> file
        </div>
      </label>

      {progress && (
        <div className="mt-4 text-sm text-slate-400">
          Streamed {progress.rooms.toLocaleString()} rooms ·{' '}
          {(progress.elapsedMs / 1000).toFixed(1)}s ·{' '}
          {Math.round(progress.rooms / (progress.elapsedMs / 1000)).toLocaleString()} rooms/s
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
          <span className="font-semibold">Failed to stream map:</span> {error}
        </div>
      )}

      {loaded && (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">{loaded.fileName}</h2>
            <span className="text-sm text-slate-400">
              {formatBytes(loaded.fileSize)} · format v{loaded.stats.version} ·{' '}
              {(loaded.elapsedMs / 1000).toFixed(1)}s streamed
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Areas" value={loaded.stats.areaCount} />
            <Stat label="Rooms" value={loaded.stats.roomCount} />
            <Stat label="Labels" value={loaded.stats.labelCount} />
            <Stat label="Z levels" value={loaded.stats.zLevelCount} />
            <Stat label="Normal exits" value={loaded.stats.normalExits} />
            <Stat label="Special exits" value={loaded.stats.specialExits} />
            <Stat label="Exit stubs" value={loaded.stats.stubs} />
            <Stat label="Doors" value={loaded.stats.doors} />
            <Stat label="Locked rooms" value={loaded.stats.lockedRooms} />
            <Stat label="Rooms w/ symbol" value={loaded.stats.roomsWithSymbol} />
            <Stat label="Distinct symbols" value={loaded.stats.distinctSymbols} />
            <Stat label="Rooms w/ userdata" value={loaded.stats.roomsWithUserData} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <BarList title="Largest areas by rooms" items={loaded.stats.topAreasByRooms} />
            <BarList title="Most common environments" items={loaded.stats.topEnvironments} />
          </div>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-300">
                Room map (colored by environment, rendered from the streamed id/x/y/z/env index —
                scroll to zoom, drag to pan)
              </h3>
              <div className="flex gap-2">
                <select
                  value={selectedArea ?? ''}
                  onChange={(e) => {
                    setSelectedArea(Number(e.target.value));
                    setSelectedZ(null);
                  }}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                >
                  {Object.keys(loaded.areaRooms)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((id) => (
                      <option key={id} value={id}>
                        {loaded.areaNames[id] ?? `Area ${id}`}
                      </option>
                    ))}
                </select>
                <select
                  value={selectedZ ?? ''}
                  onChange={(e) => setSelectedZ(e.target.value === '' ? null : Number(e.target.value))}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                >
                  <option value="">All Z levels</option>
                  {zLevels.map((z) => (
                    <option key={z} value={z}>
                      z={z}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <RoomMiniMap rooms={roomsForZ} envColors={loaded.envColors} />
          </div>
        </section>
      )}
    </>
  );
}
