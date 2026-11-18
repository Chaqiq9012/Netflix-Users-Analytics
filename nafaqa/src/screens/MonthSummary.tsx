import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, endOfMonth, expensesBetween, incomeBetween, monthKey, monthName, monthProgress, monthSummaries, byCategory, formatDate, isValidDate } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { Card, CategoryIcon, Money, PageHeader, ProgressBar, SectionTitle, cx } from '../ui/kit';
import { BarChart, BreakdownList, LineChart } from '../ui/charts';

/** Screen 8: monthly summary with comparison. */
export default function MonthSummary() {
  const { month: param } = useParams();
  const { data, today, cat } = useFinance();
  const nav = useNavigate();
  const month = param && isValidDate(param + '-01') ? param : monthKey(today);
  const s = month + '-01', e = endOfMonth(s);
  const income = incomeBetween(data.transactions, s, e);
  const expenses = expensesBetween(data.transactions, s, e);
  const mp = monthProgress(data, today, month);
  const net = income - expenses;
  const unsaved = net - mp.saved;
  const prev = addMonths(month, -1);
  const pIncome = incomeBetween(data.transactions, prev + '-01', endOfMonth(prev + '-01'));
  const pExp = expensesBetween(data.transactions, prev + '-01', endOfMonth(prev + '-01'));
  const comps = monthSummaries(data, endOfMonth(s) < today ? endOfMonth(s) : today, 6);
  const cats = byCategory(data, 'expense', s, e);
  // cumulative savings progression
  let cum = 0;
  const days: { label: string; value: number }[] = [];
  const last = e < today ? e : today;
  const deltas = new Map<string, number>();
  for (const t of data.transfers) if (t.periodDate >= s && t.periodDate <= e) deltas.set(t.periodDate, (deltas.get(t.periodDate) ?? 0) + (t.to === 'savings' ? t.amount : t.from === 'savings' ? -t.amount : 0));
  for (let d = s; d <= last; d = addDay(d)) { cum += deltas.get(d) ?? 0; days.push({ label: formatDate(d), value: cum }); }
  const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Monthly summary" back right={
        <div className="flex gap-1">
          <button aria-label="Previous month" onClick={() => nav(`/summary/${prev}`)} className="h-11 w-11 grid place-items-center rounded-2xl border border-line bg-card"><ChevronLeft size={20} /></button>
          <button aria-label="Next month" disabled={month >= monthKey(today)} onClick={() => nav(`/summary/${addMonths(month, 1)}`)} className="h-11 w-11 grid place-items-center rounded-2xl border border-line bg-card disabled:opacity-30"><ChevronRight size={20} /></button>
        </div>
      } />
      <p className="text-[20px] font-extrabold -mt-2 mb-4">{monthName(month)}</p>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Income" value={income} delta={pct(income, pIncome)} good="up" />
        <Tile label="Expenses" value={expenses} delta={pct(expenses, pExp)} good="down" />
        <Tile label="Saved" value={mp.saved} sub={<>of <Money value={mp.goal} /></>} />
        <Tile label="Net surplus" value={net} sub={<>Unsaved: <Money value={unsaved} /></>} colorize />
      </div>
      <Card className="p-5 mt-4">
        <div className="flex items-center justify-between mb-2"><h3 className="font-extrabold text-[15px]">Savings progress</h3><span className="text-[13px] font-bold text-forest">{Math.round(mp.progress * 100)}%</span></div>
        <ProgressBar value={mp.progress} height={8} />
        <div className="mt-4"><LineChart points={days} target={mp.goal} /></div>
        <p className="text-[12px] text-muted mt-2">Dashed line: monthly goal. {mp.achieved ? `Achieved on ${mp.achievedOn ? formatDate(mp.achievedOn) : '—'}.` : ''}</p>
      </Card>
      <Card className="p-5 mt-4">
        <h3 className="font-extrabold text-[15px] mb-4">Monthly comparison</h3>
        <BarChart data={comps.map((c) => ({ key: c.month, label: monthName(c.month, false), values: [c.income, c.expenses, Math.max(0, c.savings)] }))} colors={['#68A77C', '#17251D', '#EF7000']} names={['Income', 'Expenses', 'Saved']} height={150} />
      </Card>
      <section className="mt-6">
        <SectionTitle title="Where the money went" />
        <Card className="p-5">
          {cats.length === 0 ? <p className="text-[13px] text-muted text-center">No expenses this month.</p> :
            <BreakdownList rows={cats.map((c) => ({ key: c.categoryId, label: cat(c.categoryId)?.name ?? 'Other', value: c.total, share: c.share, icon: <CategoryIcon icon={cat(c.categoryId)?.icon} size={30} /> }))} />}
        </Card>
      </section>
    </div>
  );
}
const addDay = (d: string) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

function Tile({ label, value, delta, good, sub, colorize }: { label: string; value: number; delta?: number | null; good?: 'up' | 'down'; sub?: React.ReactNode; colorize?: boolean }) {
  const positive = delta != null && (good === 'up' ? delta >= 0 : delta <= 0);
  return (
    <Card className="p-4">
      <p className="label">{label}</p>
      <p className="text-[19px] font-extrabold mt-1 truncate"><Money value={value} colorize={colorize} /></p>
      {delta != null ? <p className={cx('text-[11px] font-bold mt-0.5', positive ? 'text-sage' : 'text-accent')}>{delta > 0 ? '+' : ''}{delta}% vs last month</p> : sub ? <p className="text-[11px] text-muted mt-0.5">{sub}</p> : <p className="text-[11px] text-muted mt-0.5">No previous data</p>}
    </Card>
  );
}
