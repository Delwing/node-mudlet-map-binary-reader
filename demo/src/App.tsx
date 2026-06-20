import { useCallback, useState } from 'react';
import { readMapFromBuffer } from '../../src/index';
import { computeStats, type MapStats, type NamedCount } from './stats';

interface Loaded {
  fileName: string;
  fileSize: number;
  stats: MapStats;
}

export default function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const map = readMapFromBuffer(buf);
      setLoaded({ fileName: file.name, fileSize: file.size, stats: computeStats(map) });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setLoaded(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            mudlet-map-binary-reader <span className="text-slate-500">demo</span>
          </h1>
          <p className="mt-1 text-slate-400">
            Drop a Mudlet binary map file (v20) to read its statistics — fully in your browser.
          </p>
        </header>

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
              if (file) void handleFile(file);
            }}
          />
          <div className="text-lg font-medium">
            {busy ? 'Reading map…' : 'Drop a map file here or click to browse'}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Usually a <code className="rounded bg-slate-800 px-1">.dat</code> file
          </div>
        </label>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
            <span className="font-semibold">Failed to read map:</span> {error}
          </div>
        )}

        {loaded && (
          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">{loaded.fileName}</h2>
              <span className="text-sm text-slate-400">
                {formatBytes(loaded.fileSize)} · format v{loaded.stats.version}
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
              <Stat label="Env colors" value={loaded.stats.envColorCount} />
              <Stat label="Custom env colors" value={loaded.stats.customEnvColorCount} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <BarList title="Largest areas by rooms" items={loaded.stats.topAreasByRooms} />
              <BarList title="Most common environments" items={loaded.stats.topEnvironments} />
            </div>

            {loaded.stats.zLevels.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-300">Z levels present</h3>
                <div className="flex flex-wrap gap-1.5">
                  {loaded.stats.zLevels.map((z) => (
                    <span
                      key={z}
                      className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                    >
                      {z}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function BarList({ title, items }: { title: string; items: NamedCount[] }) {
  const max = items.reduce((m, i) => Math.max(m, i.count), 0) || 1;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No data.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <div className="flex justify-between text-sm">
                <span className="truncate pr-2 text-slate-300">{item.name}</span>
                <span className="tabular-nums text-slate-400">{item.count.toLocaleString()}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full rounded bg-indigo-500"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
