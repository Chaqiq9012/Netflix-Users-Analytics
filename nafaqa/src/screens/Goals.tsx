import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, PiggyBank, ChevronRight, CheckCircle2, XCircle, CalendarClock, Info } from 'lucide-react';
import {
  eachDay, formatDate, savingsBetween, weekdayLong, weeklyHistory, RestCalendar, addMonths, monthProgress, formatMoney, periodKeyOf, periodLabel, startDayOf
} from '../engine';
import { useFinance } from '../hooks/useFinance';
import { useActions } from '../features/actions';
import { setRestDay } from '../data/repo';
import { useAction } from '../ui/overlay';
import { Button, Card, Money, PageHeader, ProgressBar, SectionTitle, Segmented, StatusPill, cx } from '../ui/kit';
import { BarChart, Ring } from '../ui/charts';

type Tab = 'daily' | 'weekly' | 'monthly';

export default function Goals() {
  const [tab, setTab] = useState<Tab>(() => (location.hash.includes('tab=monthly') ? 'monthly' : location.hash.includes('tab=daily') ? 'daily' : 'weekly'));
  return (
    <div className="animate-fade-in">
      <PageHeader title="Goals" subtitle="Adaptive savings targets" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
      <div className="mt-5">{tab === 'daily' ? <Daily /> : tab === 'weekly' ? <Weekly /> : <Monthly />}</div>
    </div>
  );
}

function RestToggleList() {
  const { data, snap, today } = useFinance();
  const run = useAction();
  const w = snap.week;
  const cal = new RestCalendar(data.restDays, data.settings.recurringRestWeekdays);
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {eachDay(w.weekStart, w.weekEnd).map((d, i) => {
        const rest = cal.isRest(d);
        const saved = savingsBetween(data.transfers, d, d);
        const isToday = d === today;
        return (
          <div key={d} className={cx('flex items-center gap-3 px-4 py-3', isToday && 'bg-mint/30')}>
            <div className="w-12 text-center">
              <p className="text-[11px] font-bold text-muted uppercase">{weekdayLong(i).slice(0, 3)}</p>
              <p className="text-[17px] font-extrabold">{Number(d.slice(8))}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold">{rest ? 'Rest day' : 'Working day'}{isToday && <span className="text-forest"> · Today</span>}</p>
              <p className="text-[12px] text-muted">{saved !== 0 ? <>Saved <Money value={saved} className="font-bold text-ink" /></> : d < today ? (rest ? 'No savings expected' : 'Nothing saved') : 'Upcoming'}</p>
            </div>
            <button onClick={() => run(() => setRestDay(d, !rest), rest ? `${formatDate(d)} is a working day` : `${formatDate(d)} marked as rest day`)}
              className={cx('chip', rest ? 'bg-forest text-cream border-forest' : 'border-line bg-card text-forest')} aria-pressed={rest}>
              {rest ? <Moon size={14} /> : <Sun size={14} />}{rest ? 'Rest' : 'Work'}
            </button>
          </div>
        );
      })}
    </Card>
  );
}

function Daily() {
  const { snap } = useFinance();
  const { openSave } = useActions();
  const w = snap.week;
  const remainingToday = Math.max(0, w.todayTarget - Math.max(0, w.savedToday));
  return (
    <div className="space-y-5">
      <Card className="p-6 text-center">
        <Ring value={w.todayIsRest ? 1 : w.todayTarget ? w.savedToday / w.todayTarget : 1} size={132} stroke={12} color={w.todayMet || w.todayIsRest ? '#68A77C' : '#EF7000'}>
          {w.todayIsRest ? <Moon className="text-forest" size={34} /> : w.todayMet ? <CheckCircle2 className="text-sage" size={38} /> : <PiggyBank className="text-accent" size={34} />}
        </Ring>
        <p className="label mt-5">Today's target</p>
        <p className="text-[38px] font-extrabold tracking-tight">{w.todayIsRest ? 'Rest day' : <Money value={w.todayTarget} />}</p>
        <p className="text-[13px] text-muted">Saved today <Money value={Math.max(0, w.savedToday)} className="font-bold text-ink" /></p>
        {!w.todayIsRest && remainingToday > 0 && <Button variant="primary" className="mt-5" icon={PiggyBank} onClick={() => openSave(Math.min(remainingToday, snap.allocation.safeToSpend) || undefined)}>Save {formatMoney(remainingToday)}</Button>}
      </Card>
      <Card className="p-5">
        <h3 className="font-extrabold text-[15px] flex items-center gap-2"><Info size={16} className="text-forest" /> How today's target is calculated</h3>
        <div className="mt-3 rounded-2xl bg-cream border border-line p-4 text-[14px] tnum space-y-1.5">
          <Line l="Weekly goal" v={<Money value={w.goal} />} />
          <Line l="Saved before today" v={<Money value={Math.max(0, w.savedBeforeToday)} />} />
          <Line l="Working days left (incl. today)" v={w.workingDaysRemaining} />
          {w.monthlyCapApplied && <Line l="Capped by monthly goal" v="Yes" />}
          <div className="h-px bg-line my-2" />
          <Line l="Today's target (rounded up)" v={<b><Money value={w.todayTarget} /></b>} />
        </div>
        <p className="text-[13px] text-muted mt-3 leading-relaxed">
          Your daily reference is <b className="text-ink"><Money value={w.dailyReference} /></b>, but it adapts: save more on good days and the target drops; mark rest days and the remainder spreads across the days you work.
        </p>
      </Card>
      <section>
        <SectionTitle title="This week's days" />
        <RestToggleList />
      </section>
    </div>
  );
}
const Line = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="flex justify-between gap-3"><span className="text-muted">{l}</span><span className="font-semibold">{v}</span></div>;

function Weekly() {
  const { data, snap, today } = useFinance();
  const w = snap.week;
  const hist = snap.firstActivity ? weeklyHistory(data, today, snap.firstActivity).filter((h) => h.complete).slice(0, 12) : [];
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted">{formatDate(w.weekStart)} – {formatDate(w.weekEnd)}</p>
          <StatusPill status={w.status} />
        </div>
        <div className="flex items-center gap-5 mt-4">
          <Ring value={w.progress} size={96} stroke={10}><span className="text-[18px] font-extrabold">{Math.round(w.progress * 100)}%</span></Ring>
          <div className="flex-1 space-y-1.5 text-[14px]">
            <Line l="Weekly goal" v={<Money value={w.goal} />} />
            <Line l="Saved" v={<Money value={Math.max(0, w.saved)} />} />
            <Line l="Remaining" v={<Money value={w.effectiveRemaining} />} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl bg-cream border border-line p-3"><p className="label">Working days left</p><p className="text-[20px] font-extrabold mt-1">{w.workingDaysRemaining}<span className="text-[13px] text-muted font-semibold"> / {w.workingDaysTotal}</span></p></div>
          <div className="rounded-2xl bg-cream border border-line p-3"><p className="label">Required / day</p><p className="text-[20px] font-extrabold mt-1">{w.requiredPerDay === null ? '—' : <Money value={w.requiredPerDay} />}</p></div>
        </div>
        {w.status === 'catch-up' && <p className="text-[13px] text-accent font-semibold mt-4">You need more than your {formatMoney(w.dailyReference)} daily reference. A strong day or two will bring you back on track.</p>}
        {w.status === 'insufficient-days' && <p className="text-[13px] text-danger font-semibold mt-4">No working days remain this week. The shortfall will be offered for review at week's end.</p>}
        {w.monthlyCapApplied && <p className="text-[12px] text-muted mt-3">Remaining is reduced because you're close to your monthly goal.</p>}
      </Card>

      {snap.recovery && (
        <Link to="/goals/recovery" className="card p-4 flex items-center gap-3 !border-accent/40 hover:!border-accent">
          <CalendarClock className="text-accent" />
          <div className="flex-1"><p className="font-bold text-[14px]">Review week of {formatDate(snap.recovery.weekStart)}</p><p className="text-[12px] text-muted">{formatMoney(snap.recovery.shortfall)} short of the goal</p></div>
          <ChevronRight size={18} className="text-muted" />
        </Link>
      )}

      <section>
        <SectionTitle title="Rest days" />
        <p className="text-[13px] text-muted -mt-1 mb-3 px-1">Rest days are excluded from your working days and never count as missed days.</p>
        <RestToggleList />
      </section>

      <section>
        <SectionTitle title="Savings history" />
        <Card className="divide-y divide-line">
          {hist.length === 0 ? <p className="p-5 text-center text-[13px] text-muted">Completed weeks will appear here.</p> : hist.map((h) => (
            <div key={h.weekStart} className="flex items-center gap-3 px-4 py-3">
              {h.achieved ? <CheckCircle2 className="text-sage shrink-0" size={20} /> : <XCircle className="text-accent shrink-0" size={20} />}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold">{formatDate(h.weekStart)} – {formatDate(h.weekEnd)}</p>
                <p className="text-[12px] text-muted">
                  {h.achieved ? 'Goal achieved' : <>Missed by <Money value={h.shortfall} /></>}
                  {h.decision === 'transferred' && <> · recovered <Money value={h.recovered} /></>}
                  {h.decision === 'kept' && ' · kept spendable'}
                </p>
              </div>
              <div className="text-right">
                <Money value={h.saved} className="text-[14px] font-bold block" />
                <span className="text-[11px] text-muted">of <Money value={h.goal} /></span>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function Monthly() {
  const { data, snap, today } = useFinance();
  const m = snap.month;
  const sd = startDayOf(data.settings);
  const past = Array.from({ length: 6 }, (_, i) => addMonths(m.month, -(i + 1))).filter((x) => snap.firstActivity && x >= periodKeyOf(snap.firstActivity, sd)).map((x) => monthProgress(data, today, x));
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div><p className="font-extrabold">{periodLabel(m.month, sd)}</p>{sd !== 1 && <p className="text-[12px] text-muted">Your month starts on day {sd}</p>}</div>
          {m.achieved ? <span className="h-7 px-3 rounded-full bg-forest text-cream text-[12px] font-bold grid place-items-center">Achieved</span> : <span className="text-[13px] font-bold text-forest">{Math.round(m.progress * 100)}%</span>}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <p className="text-[30px] font-extrabold tracking-tight leading-none"><Money value={Math.max(0, m.saved)} /></p>
          <p className="text-[13px] text-muted">of <Money value={m.goal} className="font-bold text-ink" /></p>
        </div>
        <ProgressBar value={m.progress} className="mt-3" height={10} />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-cream border border-line p-3"><p className="label">Remaining</p><p className="text-[18px] font-extrabold mt-1"><Money value={m.remaining} /></p></div>
          <div className="rounded-2xl bg-cream border border-line p-3">
            <p className="label">{m.achieved ? 'Reached on' : 'Est. completion'}</p>
            <p className="text-[18px] font-extrabold mt-1">{m.achieved ? (m.achievedOn ? formatDate(m.achievedOn) : '—') : m.estimatedCompletion ? formatDate(m.estimatedCompletion.date) : '—'}</p>
          </div>
        </div>
        <p className="text-[12px] text-muted mt-3">
          {m.achieved ? 'Goal reached — additional contributions are optional. New income is spendable once bills and reserves are covered.'
            : m.estimatedCompletion ? <>Estimate. {m.estimateReason} {!m.estimatedCompletion.withinMonth && <b className="text-accent">That's after month end.</b>}</> : m.estimateReason}
        </p>
      </Card>
      <Card className="p-5">
        <h3 className="font-extrabold text-[15px] mb-4">Weekly breakdown</h3>
        <BarChart data={m.weeks.map((w) => ({ key: w.weekStart, label: `${formatDate(w.from)}–${Number(w.to.slice(8))}`, values: [Math.max(0, w.saved)] }))} colors={['#68A77C']} names={['Saved']} height={130} />
        <p className="text-[12px] text-muted mt-3">Each contribution counts once, on the day it was made — weeks that cross months are split by date.</p>
      </Card>
      <Link to={`/summary/${m.month}`} className="card p-4 flex items-center justify-between hover:border-forest/40"><span className="font-bold text-[14px]">Full monthly summary</span><ChevronRight size={18} className="text-muted" /></Link>
      {past.length > 0 && (
        <section>
          <SectionTitle title="Previous months" />
          <Card className="divide-y divide-line">
            {past.map((p) => (
              <Link key={p.month} to={`/summary/${p.month}`} className="flex items-center gap-3 px-4 py-3 hover:bg-mint/30">
                {p.achieved ? <CheckCircle2 className="text-sage" size={20} /> : <XCircle className="text-accent" size={20} />}
                <div className="flex-1"><p className="text-[14px] font-semibold">{periodLabel(p.month, sd)}</p><ProgressBar value={p.progress} height={5} className="mt-1.5" /></div>
                <div className="text-right"><Money value={p.saved} className="font-bold text-[14px] block" /><span className="text-[11px] text-muted">of <Money value={p.goal} /></span></div>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
