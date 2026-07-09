import { useCallback, useState } from 'react';
import { readMapFromBuffer } from '../../src/index';
import { computeStats, type MapStats } from './stats';
import { Stat, BarList, formatBytes } from './ui';
import StreamingPanel from './StreamingPanel';

interface Loaded {
  fileName: string;
  fileSize: number;
  stats: MapStats;
}

type Mode = 'full' | 'streaming';

export default function App() {
  const [mode, setMode] = useState<Mode>('full');

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            mudlet-map-binary-reader <span className="text-slate-500">demo</span>
          </h1>
          <p className="mt-1 text-slate-400">
            Drop a Mudlet binary map file to read its statistics — fully in your browser.
          </p>
        </header>

        <div className="mb-6 flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode('full')}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
              mode === 'full' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Full read
          </button>
          <button
            type="button"
            onClick={() => setMode('streaming')}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
              mode === 'streaming' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Streaming (large maps)
          </button>
        </div>

        {mode === 'streaming' ? <StreamingPanel /> : <FullReadPanel />}
      </div>
    </div>
  );
}

function FullReadPanel() {
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
    <>
      <p className="mb-4 text-sm text-slate-500">
        Reads the whole map into memory at once (v20, with read-only support for v16–v19).
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
                  <span key={z} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                    {z}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
