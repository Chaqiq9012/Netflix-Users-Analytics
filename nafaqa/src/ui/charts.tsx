import { useState } from 'react';
import { formatMoney, type Cents } from '../engine';
import { cx } from './kit';
import { useFinance } from '../hooks/useFinance';

export interface BarDatum { key: string; label: string; values: Cents[] }

/** Grouped bar chart built from divs (crisp text, responsive). Tap a column to read values. */
export function BarChart({ data, colors, names, height = 160, goal }: { data: BarDatum[]; colors: string[]; names: string[]; height?: number; goal?: Cents }) {
  const { data: fd } = useFinance();
  const hidden = fd.settings.hideAmounts;
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, goal ?? 0, ...data.flatMap((d) => d.values));
  const active = sel ?? data.length - 1;
  const cur = data[active];
  const labelEvery = Math.ceil(data.length / 8);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 min-h-[20px]">
        {cur && <span className="text-[12px] font-bold text-ink">{cur.label}</span>}
        {cur && names.map((n, i) => (
          <span key={n} className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[i] }} />
            {n} <b className="text-ink tnum">{hidden ? '••••' : formatMoney(cur.values[i])}</b>
          </span>
        ))}
      </div>
      <div className="relative" style={{ height }}>
        {goal !== undefined && goal > 0 && (
          <div className="absolute inset-x-0 border-t border-dashed border-accent/70 z-10" style={{ bottom: `${(goal / max) * 100}%` }}>
            <span className="absolute right-0 -top-5 text-[10px] font-bold text-accent bg-card px-1">Goal</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {data.map((d, i) => (
            <button key={d.key} onClick={() => setSel(i)} className={cx('flex-1 h-full flex items-end justify-center gap-[2px] rounded-md transition', i === active ? 'bg-mint/60' : 'hover:bg-mint/30')} aria-label={d.label}>
              {d.values.map((v, j) => (
                <span key={j} className="flex-1 max-w-[18px] rounded-t-[4px] transition-[height] duration-500" style={{ height: `${Math.max(v > 0 ? 2 : 0, (Math.max(0, v) / max) * 100)}%`, background: colors[j] }} />
              ))}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-[3px] mt-1.5">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center text-[10px] text-muted truncate">{i % labelEvery === 0 ? d.label.split(' ')[0] : ''}</span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal share bars for category breakdowns. */
export function BreakdownList({ rows, color = '#123D29' }: { rows: { key: string; label: string; value: Cents; share: number; icon?: React.ReactNode }[]; color?: string }) {
  const { data } = useFinance();
  const top = Math.max(...rows.map((r) => r.share), 0.0001);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-center gap-3 mb-1.5">
            {r.icon}
            <span className="flex-1 text-[14px] font-semibold truncate">{r.label}</span>
            <span className="text-[12px] text-muted tnum">{Math.round(r.share * 100)}%</span>
            <span className="text-[14px] font-bold tnum w-24 text-right">{data.settings.hideAmounts ? '••••' : formatMoney(r.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-mint overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.share / top) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Simple area/line chart in SVG for cumulative series. */
export function LineChart({ points, height = 120, color = '#68A77C', target }: { points: { label: string; value: Cents }[]; height?: number; color?: string; target?: Cents }) {
  if (points.length < 2) return <p className="text-[13px] text-muted py-6 text-center">Not enough data to draw a trend yet.</p>;
  const max = Math.max(1, target ?? 0, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const W = 100, H = 100;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  return (
    <div>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          <polygon points={`0,${H} ${line} ${W},${H}`} fill={color} opacity={0.14} />
          <polyline points={line} fill="none" stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {target !== undefined && <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="#EF7000" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" strokeWidth={1.5} />}
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-muted mt-1.5">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

/** Ring progress for small KPI tiles. */
export function Ring({ value, size = 64, stroke = 7, color = '#68A77C', track = '#E4EBD2', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - v)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .7s ease-out' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
