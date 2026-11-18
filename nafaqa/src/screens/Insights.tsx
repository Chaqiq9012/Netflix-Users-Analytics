import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Info, CheckCircle2, ChevronRight, HeartPulse, Sparkles } from 'lucide-react';
import { addDays, analyze, endOfMonth, financialHealth, forecast, formatDate, insights, startOfMonth, startOfWeek, monthKey, type DayTotal } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { Card, CategoryIcon, Money, PageHeader, ProgressBar, SectionTitle, Segmented, cx } from '../ui/kit';
import { BarChart, BreakdownList, LineChart, Ring } from '../ui/charts';

type Range = 'month' | '30d' | '90d' | 'all';

export default function Insights() {
  const { data, snap, today, cat } = useFinance();
  const [range, setRange] = useState<Range>('month');
  const [from, to] = range === 'month' ? [startOfMonth(today), endOfMonth(today)] : range === '30d' ? [addDays(today, -29), today] : range === '90d' ? [addDays(today, -89), today] : ['2000-01-01', today];
  const an = useMemo(() => analyze(data, today, from, to), [data, today, from, to]);
  const fc = useMemo(() => forecast(data, today, snap.allocation.safeToSpend), [data, today, snap]);
  const health = useMemo(() => financialHealth(data, today, snap.allocation), [data, today, snap]);
  const tips = useMemo(() => insights(data, today, snap.allocation, snap.week, snap.month), [data, today, snap]);

  const series = useMemo(() => aggregate(an.series), [an.series]);
  let cum = 0;
  const savingsLine = an.series.map((d) => ({ label: formatDate(d.date), value: (cum += d.savings) }));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Insights" subtitle="Analytics, forecasts and financial health" />
      <Segmented value={range} onChange={setRange} options={[{ value: 'month', label: 'Month' }, { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' }, { value: 'all', label: 'All' }]} />

      {/* Health */}
      <Card className="p-5 mt-5">
        <div className="flex items-center gap-4">
          <Ring value={(health.score ?? 0) / 100} size={84} stroke={9} color={health.score === null ? '#E8E0D1' : health.score >= 70 ? '#68A77C' : health.score >= 40 ? '#EF7000' : '#D94B36'}>
            <span className="text-[22px] font-extrabold">{health.score ?? '—'}</span>
          </Ring>
          <div className="flex-1">
            <p className="font-extrabold flex items-center gap-2"><HeartPulse size={18} className="text-forest" /> Financial health</p>
            <p className="text-[13px] text-muted mt-1">{health.score === null ? health.reason : 'Score out of 100 — five components worth 20 points each.'}</p>
          </div>
        </div>
        <ul className="mt-5 space-y-4">
          {health.components.map((c) => (
            <li key={c.key}>
              <div className="flex justify-between text-[14px] mb-1.5"><span className="font-semibold">{c.label}</span><span className="font-bold tnum">{c.score === null ? 'n/a' : `${c.score}/20`}</span></div>
              <ProgressBar value={(c.score ?? 0) / 20} height={6} tone={c.score !== null && c.score < 10 ? 'orange' : 'green'} />
              <p className="text-[12px] text-muted mt-1">{c.detail} <span className="opacity-70">· {c.formula}</span></p>
            </li>
          ))}
        </ul>
      </Card>

      {tips.length > 0 && (
        <section className="mt-6">
          <SectionTitle title="What to know" />
          <div className="space-y-2">
            {tips.map((t, i) => {
              const Icon = t.tone === 'good' ? CheckCircle2 : t.tone === 'warn' ? AlertTriangle : Info;
              return (
                <div key={i} className={cx('flex gap-3 rounded-2xl p-4 border', t.tone === 'good' ? 'bg-mint/60 border-sage/30' : t.tone === 'warn' ? 'bg-accent/[0.07] border-accent/25' : 'bg-card border-line')}>
                  <Icon size={18} className={cx('shrink-0 mt-0.5', t.tone === 'good' ? 'text-sage' : t.tone === 'warn' ? 'text-accent' : 'text-forest')} />
                  <p className="text-[14px] leading-relaxed">{t.text}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!an.hasData ? (
        <Card className="mt-6 p-8 text-center text-muted text-[14px]">Add some income and expenses to see your analytics.</Card>
      ) : (
        <>
          {/* Income */}
          <section className="mt-6">
            <SectionTitle title="Income" />
            <Card className="p-5">
              <div className="grid grid-cols-3 gap-3">
                <K label="Total" value={<Money value={an.income.total} />} />
                <K label="Avg / day" value={<Money value={an.income.avgDaily} />} />
                <K label="Avg / week" value={<Money value={an.income.avgWeekly} />} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-2xl bg-mint/50 p-3"><p className="label">Highest day</p><p className="font-extrabold mt-1">{an.income.highest ? <Money value={an.income.highest.income} /> : '—'}</p><p className="text-[11px] text-muted">{an.income.highest ? formatDate(an.income.highest.date, 'day') : ''}</p></div>
                <div className="rounded-2xl bg-cream border border-line p-3"><p className="label">Lowest earning day</p><p className="font-extrabold mt-1">{an.income.lowest ? <Money value={an.income.lowest.income} /> : '—'}</p><p className="text-[11px] text-muted">{an.income.lowest ? formatDate(an.income.lowest.date, 'day') : ''}</p></div>
              </div>
              <p className="text-[12px] text-muted mt-3">{an.income.earningDays} earning day{an.income.earningDays === 1 ? '' : 's'} · <Money value={an.income.avgPerWorkingDay} /> per working day</p>
              <div className="mt-5"><BarChart data={series} colors={['#68A77C', '#17251D']} names={['Income', 'Expenses']} height={150} /></div>
              {an.income.byCategory.length > 0 && <div className="mt-6"><p className="label mb-3">By category</p><BreakdownList color="#68A77C" rows={an.income.byCategory.map((c) => ({ key: c.categoryId, label: cat(c.categoryId)?.name ?? 'Other', value: c.total, share: c.share, icon: <CategoryIcon icon={cat(c.categoryId)?.icon} kind="income" size={30} /> }))} /></div>}
            </Card>
          </section>

          {/* Expenses */}
          <section className="mt-6">
            <SectionTitle title="Expenses" to={`/summary/${monthKey(today)}`} action="Month summary" />
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <K label="Total" value={<Money value={an.expense.total} />} />
                <K label="Avg / day" value={<Money value={an.expense.avgDaily} />} />
              </div>
              {an.expense.byCategory.length > 0 && <div className="mt-5"><BreakdownList rows={an.expense.byCategory.map((c) => ({ key: c.categoryId, label: cat(c.categoryId)?.name ?? 'Other', value: c.total, share: c.share, icon: <CategoryIcon icon={cat(c.categoryId)?.icon} size={30} /> }))} /></div>}
              {an.expense.largest.length > 0 && (
                <div className="mt-6">
                  <p className="label mb-2">Largest expenses</p>
                  <ul className="divide-y divide-line">
                    {an.expense.largest.map((t) => (
                      <li key={t.id}><Link to={`/tx/${t.id}`} className="flex items-center justify-between py-2.5"><span className="text-[14px] font-semibold truncate pr-3">{t.description}<span className="text-muted font-normal text-[12px]"> · {formatDate(t.date)}</span></span><Money value={t.amount} className="font-bold text-[14px]" /></Link></li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </section>

          {/* Savings */}
          <section className="mt-6">
            <SectionTitle title="Savings" to="/goals" action="Goals" />
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <K label="Saved in period" value={<Money value={an.savings.net} />} />
                <K label="Total accumulated" value={<Money value={an.savings.totalAccumulated} />} />
                <K label="Weekly completion" value={an.savings.weeklyCompletionRate === null ? '—' : `${Math.round(an.savings.weeklyCompletionRate * 100)}%`} sub={`${an.savings.completedWeeks} completed weeks`} />
                <K label="Monthly completion" value={an.savings.monthlyCompletionRate === null ? '—' : `${Math.round(an.savings.monthlyCompletionRate * 100)}%`} sub={`${an.savings.completedMonths} completed months`} />
              </div>
              <p className="text-[12px] text-muted mt-3">Average <Money value={an.savings.avgPerWorkingDay} className="font-bold text-ink" /> saved per working day.</p>
              <div className="mt-4"><LineChart points={savingsLine} /></div>
            </Card>
          </section>
        </>
      )}

      {/* Forecast */}
      <section className="mt-6">
        <SectionTitle title="Forecast" />
        <Card className="p-5">
          <p className="text-[12px] font-bold text-accent uppercase tracking-wider flex items-center gap-1.5"><Sparkles size={14} /> Estimates — not actual values</p>
          {!fc.available ? (
            <p className="text-[14px] text-muted mt-3">{fc.reason}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <K label="Month-end savings" value={<>≈ <Money value={fc.monthEndSavings} /></>} sub={fc.reachesMonthlyGoal ? 'Reaches monthly goal' : <>Goal <Money value={fc.monthGoal} /></>} />
                <K label="Bills still due" value={<Money value={fc.upcomingObligations} />} sub="Actual, this month" />
                <K label="Expected safe-to-spend" value={<>≈ <Money value={fc.expectedSafeToSpend} /></>} sub="At month end" />
                <K label="Projected income" value={<>≈ <Money value={fc.projectedIncome} /></>} sub={`${fc.remainingWorkingDays} working days left`} />
              </div>
              <div className={cx('mt-4 rounded-2xl p-4 flex gap-3', fc.incomeSufficient ? 'bg-mint/60' : 'bg-accent/[0.07]')}>
                <TrendingUp size={18} className={fc.incomeSufficient ? 'text-sage' : 'text-accent'} />
                <p className="text-[14px]">{fc.incomeSufficient ? 'At your current pace, income should be enough to reach your monthly savings goal.' : 'At your current pace, income may not cover expenses plus the remaining savings goal. Consider trimming expenses or adding a working day.'}</p>
              </div>
              <p className="text-[12px] text-muted mt-3">{fc.reason}</p>
            </>
          )}
        </Card>
      </section>
      <Link to="/calendar" className="card mt-6 p-4 flex items-center justify-between hover:border-forest/40"><span className="font-bold text-[14px]">Financial calendar</span><ChevronRight size={18} className="text-muted" /></Link>
    </div>
  );
}

function K({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-cream border border-line p-3 min-w-0">
      <p className="label leading-tight">{label}</p>
      <p className="text-[16px] font-extrabold mt-1 truncate">{value}</p>
      {sub && <p className="text-[11px] text-muted mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

/** Daily bars for ≤ 35 days; weekly bars beyond. */
function aggregate(series: DayTotal[]) {
  if (series.length <= 35) return series.map((d) => ({ key: d.date, label: formatDate(d.date), values: [d.income, d.expense] }));
  const m = new Map<string, { inc: number; exp: number }>();
  for (const d of series) {
    const k = startOfWeek(d.date);
    const r = m.get(k) ?? { inc: 0, exp: 0 };
    r.inc += d.income; r.exp += d.expense;
    m.set(k, r);
  }
  return [...m.entries()].map(([k, r]) => ({ key: k, label: 'Wk ' + formatDate(k), values: [r.inc, r.exp] }));
}
