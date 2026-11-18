import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Moon, Sun, Star, Repeat } from 'lucide-react';
import {
  addDays, addMonths, daysInMonth, formatDate, monthKey, monthName, monthProgress, occurrencesInMonth, RestCalendar, savingsDelta,
  startOfWeek, weekday, weekdayShort, targetsOn, minDate, endOfWeek
} from '../engine';
import { useFinance } from '../hooks/useFinance';
import { setRestDay } from '../data/repo';
import { useAction } from '../ui/overlay';
import { Button, Card, Money, PageHeader, cx } from '../ui/kit';
import { TxRow } from '../features/TxRow';

/** Screen 10: financial calendar. */
export default function Calendar() {
  const { data, today } = useFinance();
  const run = useAction();
  const [month, setMonth] = useState(monthKey(today));
  const [sel, setSel] = useState(today);
  const cal = new RestCalendar(data.restDays, data.settings.recurringRestWeekdays);
  const subs = new Map(data.subscriptions.map((s) => [s.id, s]));

  const { byDay, bills, milestones } = useMemo(() => {
    const byDay = new Map<string, { inc: number; exp: number; sav: number }>();
    const get = (d: string) => byDay.get(d) ?? (byDay.set(d, { inc: 0, exp: 0, sav: 0 }), byDay.get(d)!);
    for (const t of data.transactions) if (t.date.startsWith(month) && !t.isOpening) t.kind === 'income' ? (get(t.date).inc += t.amount) : (get(t.date).exp += t.amount);
    for (const t of data.transfers) if (t.periodDate.startsWith(month)) get(t.periodDate).sav += savingsDelta(t);
    const bills = new Map<string, ReturnType<typeof occurrencesInMonth>>();
    for (const o of occurrencesInMonth(data.subscriptions, data.payments, today, month)) bills.set(o.dueDate, [...(bills.get(o.dueDate) ?? []), o]);
    // Savings milestones: day each week's goal was crossed, and the month goal date.
    const milestones = new Map<string, string[]>();
    const add = (d: string, l: string) => milestones.set(d, [...(milestones.get(d) ?? []), l]);
    const first = month + '-01';
    for (let ws = startOfWeek(first); ws <= addDays(first, daysInMonth(month) - 1); ws = addDays(ws, 7)) {
      const goal = targetsOn(data.goals, minDate(today, endOfWeek(ws))).weekly;
      const rel = data.transfers.filter((t) => t.periodDate >= ws && t.periodDate <= endOfWeek(ws)).sort((a, b) => a.periodDate.localeCompare(b.periodDate) || a.createdAt - b.createdAt);
      let c = 0;
      for (const t of rel) { c += savingsDelta(t); if (goal > 0 && c >= goal) { if (t.periodDate.startsWith(month)) add(t.periodDate, 'Weekly goal reached'); break; } }
    }
    const mp = monthProgress(data, today, month);
    if (mp.achievedOn) add(mp.achievedOn, 'Monthly goal reached');
    return { byDay, bills, milestones };
  }, [data, month, today]);

  const first = month + '-01';
  const lead = weekday(first);
  const n = daysInMonth(month);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const selTx = data.transactions.filter((t) => t.date === sel).sort((a, b) => b.createdAt - a.createdAt);
  const selRest = cal.isRest(sel);
  const selDay = byDay.get(sel);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Calendar" back />
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className="h-10 w-10 grid place-items-center rounded-xl hover:bg-mint/60"><ChevronLeft size={20} /></button>
          <button onClick={() => { setMonth(monthKey(today)); setSel(today); }} className="font-extrabold text-[16px]">{monthName(month)}</button>
          <button aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className="h-10 w-10 grid place-items-center rounded-xl hover:bg-mint/60"><ChevronRight size={20} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {Array.from({ length: 7 }, (_, i) => <span key={i} className="text-[11px] font-bold text-muted">{weekdayShort(i)}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const e = byDay.get(d);
            const rest = cal.isRest(d);
            const isSel = d === sel;
            return (
              <button key={d} onClick={() => setSel(d)} className={cx('relative aspect-square rounded-xl flex flex-col items-center justify-center text-[13px] font-bold transition',
                isSel ? 'bg-forest text-cream' : rest ? 'bg-line/50 text-muted' : 'hover:bg-mint/50', d === today && !isSel && 'ring-2 ring-forest')} aria-label={formatDate(d, 'long')}>
                {Number(d.slice(8))}
                <span className="flex gap-[3px] mt-0.5 h-1.5">
                  {e && e.inc > 0 && <Dot c="#68A77C" />}
                  {e && e.exp > 0 && <Dot c={isSel ? '#FBF5E9' : '#17251D'} />}
                  {bills.has(d) && <Dot c="#EF7000" />}
                </span>
                {milestones.has(d) && <Star size={10} className="absolute top-1 right-1 text-accent fill-accent" />}
                {rest && !isSel && <Moon size={9} className="absolute top-1 left-1" />}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-[11px] text-muted font-semibold">
          <span className="inline-flex items-center gap-1.5"><Dot c="#68A77C" /> Income</span>
          <span className="inline-flex items-center gap-1.5"><Dot c="#17251D" /> Expense</span>
          <span className="inline-flex items-center gap-1.5"><Dot c="#EF7000" /> Renewal</span>
          <span className="inline-flex items-center gap-1.5"><Star size={11} className="text-accent fill-accent" /> Savings milestone</span>
          <span className="inline-flex items-center gap-1.5"><Moon size={11} /> Rest day</span>
        </div>
      </Card>

      <section className="mt-5">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[16px] font-extrabold">{formatDate(sel, 'long')}</h2>
          <Button size="sm" variant={selRest ? 'dark' : 'outline'} icon={selRest ? Sun : Moon} onClick={() => run(() => setRestDay(sel, !selRest), selRest ? 'Marked as working day' : 'Marked as rest day')}>{selRest ? 'Make working day' : 'Mark rest day'}</Button>
        </div>
        {selDay && (selDay.inc || selDay.exp || selDay.sav) ? (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MiniTile label="Income" v={selDay.inc} cls="text-sage" />
            <MiniTile label="Spent" v={selDay.exp} />
            <MiniTile label="Saved" v={selDay.sav} cls="text-forest" />
          </div>
        ) : null}
        {(milestones.get(sel) ?? []).map((m) => <div key={m} className="mb-2 rounded-2xl bg-accent/10 border border-accent/20 px-4 py-3 text-[14px] font-semibold flex items-center gap-2"><Star size={16} className="text-accent fill-accent" />{m}</div>)}
        {(bills.get(sel) ?? []).map((o) => {
          const s = subs.get(o.subscriptionId);
          return s && (
            <Link key={o.subscriptionId} to={`/subscriptions/${s.id}`} className="mb-2 card !rounded-2xl px-4 py-3 flex items-center gap-3">
              <Repeat size={18} className="text-accent" />
              <span className="flex-1 text-[14px] font-semibold">{s.name} renewal <span className="text-muted font-normal">· {o.status === 'open' ? (o.overdue ? 'overdue' : 'reserved') : o.status}</span></span>
              <Money value={o.amount} className="font-bold text-[14px]" />
            </Link>
          );
        })}
        <Card className="overflow-hidden divide-y divide-line">
          {selTx.length === 0 ? <p className="p-5 text-center text-[13px] text-muted">{selRest ? 'Rest day — no income expected.' : 'No transactions on this day.'}</p> : selTx.map((t) => <TxRow key={t.id} tx={t} showDate={false} />)}
        </Card>
      </section>
    </div>
  );
}
const Dot = ({ c }: { c: string }) => <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: c }} />;
function MiniTile({ label, v, cls }: { label: string; v: number; cls?: string }) {
  return <div className="card !rounded-2xl px-3 py-2.5"><p className="label">{label}</p><p className={cx('text-[14px] font-extrabold mt-0.5', cls)}><Money value={v} /></p></div>;
}
