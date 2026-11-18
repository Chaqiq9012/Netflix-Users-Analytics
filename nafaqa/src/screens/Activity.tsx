import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, SlidersHorizontal, ListX, X } from 'lucide-react';
import { addDays, endOfMonth, relativeDay, startOfMonth, startOfWeek, formatDate, monthName, type Transaction } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { TxRow } from '../features/TxRow';
import { Button, Card, EmptyState, Input, Money, PageHeader, Segmented, cx } from '../ui/kit';

type Kind = 'all' | 'income' | 'expense';
type Range = 'all' | 'week' | 'month' | '30d' | 'custom';
type Group = 'day' | 'week' | 'month';

export default function Activity() {
  const { data, today } = useFinance();
  const nav = useNavigate();
  const [kind, setKind] = useState<Kind>('all');
  const [range, setRange] = useState<Range>('all');
  const [from, setFrom] = useState(startOfMonth(today));
  const [to, setTo] = useState(today);
  const [q, setQ] = useState('');
  const [catIds, setCatIds] = useState<string[]>([]);
  const [group, setGroup] = useState<Group>('day');
  const [showFilters, setShowFilters] = useState(false);

  const [rFrom, rTo] = useMemo(() => {
    switch (range) {
      case 'week': return [startOfWeek(today), addDays(startOfWeek(today), 6)];
      case 'month': return [startOfMonth(today), endOfMonth(today)];
      case '30d': return [addDays(today, -29), today];
      case 'custom': return [from <= to ? from : to, from <= to ? to : from];
      default: return ['0000-01-01', '9999-12-31'];
    }
  }, [range, from, to, today]);

  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.transactions
      .filter((t) => (kind === 'all' || t.kind === kind) && t.date >= rFrom && t.date <= rTo && (!catIds.length || catIds.includes(t.categoryId)))
      .filter((t) => !needle || t.description.toLowerCase().includes(needle) || (t.notes ?? '').toLowerCase().includes(needle) || (cats.get(t.categoryId)?.name ?? '').toLowerCase().includes(needle) || (t.amount / 100).toString().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [data.transactions, kind, rFrom, rTo, catIds, q]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of list) if (!t.isOpening) t.kind === 'income' ? (inc += t.amount) : (exp += t.amount);
    return { inc, exp };
  }, [list]);

  const groups = useMemo(() => {
    const m = new Map<string, { title: string; items: Transaction[]; inc: number; exp: number }>();
    for (const t of list) {
      const key = group === 'day' ? t.date : group === 'week' ? startOfWeek(t.date) : t.date.slice(0, 7);
      const title = group === 'day' ? relativeDay(t.date, today) : group === 'week' ? `Week of ${formatDate(key)}` : monthName(key);
      const g = m.get(key) ?? { title, items: [], inc: 0, exp: 0 };
      g.items.push(t);
      if (!t.isOpening) t.kind === 'income' ? (g.inc += t.amount) : (g.exp += t.amount);
      m.set(key, g);
    }
    return [...m.entries()];
  }, [list, group, today]);

  const filterCats = data.categories.filter((c) => (kind === 'all' || c.kind === kind) && (!c.archived || catIds.includes(c.id)));
  const activeFilters = (range !== 'all' ? 1 : 0) + catIds.length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Activity" subtitle={`${list.length} transaction${list.length === 1 ? '' : 's'}`} right={<Button size="sm" variant="primary" icon={Plus} onClick={() => nav('/add/income')}>Add</Button>} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reason, note, amount…" className="pl-11" aria-label="Search transactions" />
        </div>
        <button onClick={() => setShowFilters((s) => !s)} aria-label="Filters" className={cx('relative h-12 w-12 grid place-items-center rounded-2xl border transition', showFilters ? 'bg-forest text-cream border-forest' : 'bg-card border-line text-forest')}>
          <SlidersHorizontal size={19} />
          {activeFilters > 0 && <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-accent text-white text-[10px] font-bold grid place-items-center">{activeFilters}</span>}
        </button>
      </div>
      <Segmented className="mt-3" value={kind} onChange={(v) => { setKind(v); setCatIds([]); }} options={[{ value: 'all', label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expenses' }]} />

      {showFilters && (
        <Card className="mt-3 p-4 space-y-4 animate-pop">
          <div>
            <p className="label mb-2">Date range</p>
            <div className="flex flex-wrap gap-2">
              {([['all', 'All time'], ['week', 'This week'], ['month', 'This month'], ['30d', 'Last 30 days'], ['custom', 'Custom']] as [Range, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setRange(v)} className={cx('chip', range === v ? 'bg-forest text-cream border-forest' : 'border-line bg-card')}>{l}</button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
              </div>
            )}
          </div>
          <div>
            <p className="label mb-2">Categories</p>
            <div className="flex flex-wrap gap-2">
              {filterCats.map((c) => {
                const on = catIds.includes(c.id);
                return <button key={c.id} onClick={() => setCatIds((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))} className={cx('chip', on ? 'bg-forest text-cream border-forest' : 'border-line bg-card')}>{c.name}{kind === 'all' && <span className="opacity-60 text-[11px]">{c.kind === 'income' ? 'in' : 'out'}</span>}</button>;
              })}
            </div>
          </div>
          <div>
            <p className="label mb-2">Group totals by</p>
            <Segmented value={group} onChange={setGroup} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
          </div>
          {activeFilters > 0 && <Button size="sm" variant="ghost" icon={X} onClick={() => { setRange('all'); setCatIds([]); }}>Clear filters</Button>}
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2 mt-4">
        <TotalTile label="Income" value={totals.inc} className="text-sage" />
        <TotalTile label="Expenses" value={-totals.exp} />
        <TotalTile label="Net" value={totals.inc - totals.exp} colorize />
      </div>

      <div className="mt-5 space-y-5">
        {groups.length === 0 ? (
          <Card><EmptyState icon={ListX} title={data.transactions.length ? 'No matching transactions' : 'No transactions yet'} text={data.transactions.length ? 'Try a different search or filter.' : 'Your income and expenses will appear here.'} action={!data.transactions.length && <Button size="sm" variant="primary" icon={Plus} onClick={() => nav('/add/income')}>Add income</Button>} /></Card>
        ) : groups.map(([key, g]) => (
          <section key={key}>
            <div className="flex items-center justify-between px-1 mb-2">
              <h3 className="text-[13px] font-extrabold text-ink">{g.title}</h3>
              <p className="text-[12px] text-muted tnum">
                {g.inc > 0 && <Money value={g.inc} sign className="text-sage font-bold" />}
                {g.inc > 0 && g.exp > 0 && ' · '}
                {g.exp > 0 && <Money value={-g.exp} className="font-bold text-ink" />}
              </p>
            </div>
            <Card className="overflow-hidden divide-y divide-line">
              {g.items.map((t) => <TxRow key={t.id} tx={t} showDate={group !== 'day'} />)}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}

function TotalTile({ label, value, className, colorize }: { label: string; value: number; className?: string; colorize?: boolean }) {
  return (
    <div className="card !rounded-2xl px-3 py-3">
      <p className="label">{label}</p>
      <p className={cx('text-[15px] font-extrabold mt-1 truncate', className)}><Money value={value} colorize={colorize} sign={colorize} /></p>
    </div>
  );
}
