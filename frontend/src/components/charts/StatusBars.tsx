export interface Bar {
  label: string;
  value: number;
  color: string;
}

/** Barras horizontales accesibles: cada barra tiene su valor en texto. */
export function StatusBars({ bars, label }: { bars: Bar[]; label: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul className="space-y-3" aria-label={label}>
      {bars.map((bar) => (
        <li key={bar.label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-xs">
          <span className="font-semibold text-muted">{bar.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-line/60" aria-hidden="true">
            <span className="chart-bar block h-full rounded-full" style={{ width: `${(bar.value / max) * 100}%`, background: bar.color }} />
          </span>
          <span className="kpi-number text-right text-sm font-bold">{bar.value}</span>
        </li>
      ))}
    </ul>
  );
}
