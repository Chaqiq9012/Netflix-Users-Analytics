import { Link } from 'react-router-dom';
import { Plus, Repeat, ChevronRight, Check } from 'lucide-react';
import { formatDate, monthlyCommitment, nextOccurrence, relativeDay, upcomingWithin, type Occurrence } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { useActions } from '../features/actions';
import { paySubscription } from '../data/repo';
import { useAction, useConfirm } from '../ui/overlay';
import { Button, Card, CategoryIcon, EmptyState, Money, PageHeader, SectionTitle, cx } from '../ui/kit';

export default function Subscriptions() {
  const { data, snap, today, cat } = useFinance();
  const { openSubscription } = useActions();
  const run = useAction();
  const confirm = useConfirm();
  const subs = data.subscriptions;
  const active = subs.filter((s) => s.active);
  const inactive = subs.filter((s) => !s.active);
  const next = snap.nextBill;
  const nextSub = next && subs.find((s) => s.id === next.subscriptionId);
  const soon = upcomingWithin(subs, data.payments, today, 7);
  const byId = new Map(subs.map((s) => [s.id, s]));
  const history = [...data.payments].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 8);
  const a = snap.allocation;

  const pay = async (o: Occurrence) => {
    const s = byId.get(o.subscriptionId)!;
    const ok = await confirm({ title: `Mark ${s.name} as paid?`, text: <>This records a <b>{(o.amount / 100).toLocaleString()} DH</b> expense today and releases the reservation for {formatDate(o.dueDate)}.</>, confirm: 'Mark paid' });
    if (ok) run(() => paySubscription(o.subscriptionId, o.period), `${s.name} paid`);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Subscriptions" subtitle="Recurring monthly obligations" right={<Button size="sm" variant="primary" icon={Plus} onClick={() => openSubscription()}>New</Button>} />

      <section className="rounded-[28px] bg-forest text-cream p-5 shadow-lift">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-cream/60">Monthly commitments</p>
        <p className="text-[36px] font-extrabold tracking-tight mt-1"><Money value={monthlyCommitment(subs)} /></p>
        <p className="text-[13px] text-cream/70">{active.length} active subscription{active.length === 1 ? '' : 's'}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-cream/60">Reserved now</p>
            <p className="text-[16px] font-extrabold mt-0.5"><Money value={a.obligationsRequired} /></p>
            <p className={cx('text-[11px] font-semibold mt-0.5', a.obligationsCovered >= a.obligationsRequired ? 'text-sage' : 'text-accent')}>{a.obligationsCovered >= a.obligationsRequired ? 'Fully covered' : <>Covered <Money value={a.obligationsCovered} /></>}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-cream/60">Next payment</p>
            {next && nextSub ? (
              <>
                <p className="text-[16px] font-extrabold mt-0.5 truncate">{nextSub.name}</p>
                <p className="text-[11px] text-cream/70 mt-0.5">{next.overdue ? 'Overdue' : next.daysUntil === 0 ? 'Today' : `In ${next.daysUntil} day${next.daysUntil === 1 ? '' : 's'}`} · <Money value={next.amount} /></p>
              </>
            ) : <p className="text-[14px] font-bold mt-1 text-cream/70">None</p>}
          </div>
        </div>
      </section>

      {soon.length > 0 && (
        <section className="mt-6">
          <SectionTitle title="Due in the next 7 days" />
          <Card className="divide-y divide-line overflow-hidden">
            {soon.map((o) => {
              const s = byId.get(o.subscriptionId)!;
              return (
                <div key={o.subscriptionId + o.period} className="flex items-center gap-3 px-4 py-3">
                  <Link to={`/subscriptions/${s.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <CategoryIcon icon={cat(s.categoryId)?.icon} kind="bill" />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold truncate">{s.name}</p>
                      <p className={cx('text-[12px]', o.overdue ? 'text-danger font-semibold' : 'text-muted')}>{o.overdue ? `Overdue · ${formatDate(o.dueDate)}` : relativeDay(o.dueDate, today)} · <Money value={o.amount} /></p>
                    </div>
                  </Link>
                  <Button size="sm" variant="soft" icon={Check} onClick={() => pay(o)}>Paid</Button>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      <section className="mt-6">
        <SectionTitle title="Active" />
        <Card className="overflow-hidden">
          {active.length === 0 ? (
            <EmptyState icon={Repeat} title="No subscriptions yet" text="Add internet, phone, music or any monthly bill. Nafaqa reserves the money before each renewal." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => openSubscription()}>Add subscription</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {active.sort((x, y) => (nextOccurrence(x, data.payments, today)?.dueDate ?? '').localeCompare(nextOccurrence(y, data.payments, today)?.dueDate ?? '')).map((s) => <SubRow key={s.id} id={s.id} />)}
            </ul>
          )}
        </Card>
      </section>

      {inactive.length > 0 && (
        <section className="mt-6">
          <SectionTitle title="Paused or cancelled" />
          <Card className="divide-y divide-line overflow-hidden opacity-80">{inactive.map((s) => <SubRow key={s.id} id={s.id} />)}</Card>
        </section>
      )}

      <section className="mt-6">
        <SectionTitle title="Payment history" />
        <Card className="overflow-hidden">
          {history.length === 0 ? <p className="text-[13px] text-muted p-5 text-center">Paid and skipped renewals will appear here.</p> : (
            <ul className="divide-y divide-line">
              {history.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[14px] font-semibold">{byId.get(p.subscriptionId)?.name ?? 'Deleted subscription'}</p>
                    <p className="text-[12px] text-muted">{p.status === 'paid' ? 'Paid' : 'Skipped'} · {formatDate(p.date)} · period {p.period}</p>
                  </div>
                  <Money value={p.status === 'paid' ? -p.amount : 0} className={cx('text-[14px] font-bold', p.status === 'skipped' && 'text-muted')} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function SubRow({ id }: { id: string }) {
  const { data, today, cat } = useFinance();
  const s = data.subscriptions.find((x) => x.id === id)!;
  const n = nextOccurrence(s, data.payments, today);
  return (
    <li>
      <Link to={`/subscriptions/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-mint/30">
        <CategoryIcon icon={cat(s.categoryId)?.icon} kind="bill" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold truncate">{s.name}</p>
          <p className="text-[12px] text-muted">{s.active ? (n ? `Renews ${formatDate(n.dueDate)} · ${n.overdue ? 'overdue' : `in ${n.daysUntil}d`}` : '—') : 'Inactive — not reserved'}</p>
        </div>
        <Money value={s.amount} className="text-[15px] font-bold" />
        <ChevronRight size={18} className="text-muted" />
      </Link>
    </li>
  );
}
