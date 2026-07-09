import type { NamedCount } from './stats';

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

export function BarList({ title, items }: { title: string; items: NamedCount[] }) {
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

export function formatBytes(bytes: number): string {
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
