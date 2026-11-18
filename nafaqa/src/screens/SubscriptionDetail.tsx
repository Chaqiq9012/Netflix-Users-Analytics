import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Check, SkipForward, Pause, Play, Trash2, Undo2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { addMonths, centsToInput, dueDateFor, formatDate, monthKey, nextOccurrence, occurrences, parseMoney, reservedOccurrences, type Occurrence } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { useActions } from '../features/actions';
import { deleteSubscription, paySubscription, setSubscriptionActive, skipSubscription, undoPayment } from '../data/repo';
import { Sheet, useAction, useConfirm } from '../ui/overlay';
import { Button, Card, CategoryIcon, Field, Input, Money, MoneyField, PageHeader, SectionTitle, cx } from '../ui/kit';

export default function SubscriptionDetail() {
  const { id } = useParams();
  const { data, today, snap, cat } = useFinance();
  const { openSubscription } = useActions();
  const nav = useNavigate();
  const run = useAction();
  const confirm = useConfirm();
  const [paying, setPaying] = useState<Occurrence | null>(null);
  const s = data.subscriptions.find((x) => x.id === id);
  if (!s) return <div><PageHeader title="Subscription" back="/subscriptions" /><Card className="p-8 text-center text-muted">This subscription no longer exists.</Card></div>;

  const next = nextOccurrence(s, data.payments, today);
  const reserved = reservedOccurrences(s, data.payments, today);
  const reservedAmt = reserved.reduce((t, o) => t + o.amount, 0);
  const a = snap.allocation;
  const covered = a.obligationsCovered >= a.obligationsRequired;
  const schedule = s.active ? occurrences(s, data.payments, today, addMonths(monthKey(today), 5)).filter((o) => o.dueDate >= today || o.status === 'open').slice(0, 6) : [];
  const payments = data.payments.filter((p) => p.subscriptionId === s.id).sort((x, y) => y.period.localeCompare(x.period));

  const skip = async (o: Occurrence) => {
    if (await confirm({ title: 'Skip this renewal?', text: `The ${formatDate(o.dueDate)} renewal will be marked as skipped and its reservation released. No expense is recorded.`, confirm: 'Skip renewal' }))
      run(() => skipSubscription(s.id, o.period), 'Renewal skipped');
  };
  const toggle = async () => {
    if (s.active && !(await confirm({ title: `Pause ${s.name}?`, text: 'It will stop being reserved and stop renewing. History is kept. You can reactivate any time.', confirm: 'Pause' }))) return;
    run(() => setSubscriptionActive(s.id, !s.active), s.active ? 'Subscription paused' : 'Subscription reactivated');
  };
  const remove = async () => {
    if (await confirm({ title: `Delete ${s.name}?`, text: 'The subscription and its renewal records are removed. Past expenses stay in your activity.', confirm: 'Delete', danger: true }))
      if (await run(() => deleteSubscription(s.id), 'Subscription deleted')) nav('/subscriptions', { replace: true });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title={s.name} subtitle={s.description} back="/subscriptions" right={<Button size="sm" variant="outline" icon={Pencil} onClick={() => openSubscription(s)}>Edit</Button>} />
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <CategoryIcon icon={cat(s.categoryId)?.icon} kind="bill" size={52} />
          <div className="flex-1">
            <p className="text-[28px] font-extrabold tracking-tight leading-none"><Money value={s.amount} /></p>
            <p className="text-[13px] text-muted mt-1">per month · renews on day {s.renewalDay}{s.renewalDay > 28 ? ' (or last day)' : ''}</p>
          </div>
          <span className={cx('h-7 px-3 rounded-full text-[12px] font-bold grid place-items-center', s.active ? 'bg-mint text-forest' : 'bg-line text-muted')}>{s.active ? 'Active' : 'Inactive'}</span>
        </div>
        {next && (
          <div className="mt-5 rounded-2xl bg-cream border border-line p-4">
            <p className="label">Next renewal</p>
            <p className="text-[18px] font-extrabold mt-1">{formatDate(next.dueDate, 'long')}</p>
            <p className={cx('text-[13px] mt-0.5', next.overdue ? 'text-danger font-semibold' : 'text-muted')}>{next.overdue ? `Overdue by ${-next.daysUntil} day${next.daysUntil === -1 ? '' : 's'}` : next.daysUntil === 0 ? 'Due today' : `In ${next.daysUntil} day${next.daysUntil === 1 ? '' : 's'}`}</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="primary" icon={Check} onClick={() => setPaying(next)}>Mark paid</Button>
              <Button variant="outline" icon={SkipForward} onClick={() => skip(next)}>Skip</Button>
            </div>
          </div>
        )}
        <div className="mt-4 flex items-start gap-3">
          {covered ? <ShieldCheck className="text-sage shrink-0" size={20} /> : <ShieldAlert className="text-accent shrink-0" size={20} />}
          <p className="text-[13px] text-muted leading-relaxed">
            {!s.active ? 'Inactive subscriptions are not reserved.' : <>
              <Money value={reservedAmt} className="font-bold text-ink" /> reserved for {reserved.length} renewal{reserved.length === 1 ? '' : 's'}. {covered ? 'Fully covered by your balance.' : 'Your balance does not fully cover all reserved bills yet.'} Reservations are not expenses — the expense is recorded when you mark it paid.
            </>}
          </p>
        </div>
      </Card>

      {schedule.length > 0 && (
        <section className="mt-6">
          <SectionTitle title="Renewal schedule" />
          <Card className="divide-y divide-line">
            {schedule.map((o) => (
              <div key={o.period} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[14px] font-semibold">{formatDate(o.dueDate, 'long')}</p>
                  <p className="text-[12px] text-muted">{o.status === 'paid' ? 'Paid' : o.status === 'skipped' ? 'Skipped' : reserved.some((r) => r.period === o.period) ? 'Reserved' : 'Forecast'}</p>
                </div>
                <Money value={o.amount} className="text-[14px] font-bold" />
              </div>
            ))}
          </Card>
        </section>
      )}

      <section className="mt-6">
        <SectionTitle title="Payment history" />
        <Card className="divide-y divide-line">
          {payments.length === 0 ? <p className="text-[13px] text-muted p-5 text-center">No payments recorded yet.</p> : payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="text-[14px] font-semibold">{formatDate(dueDateFor(s.renewalDay, p.period), 'long')}</p>
                <p className="text-[12px] text-muted">{p.status === 'paid' ? `Paid ${formatDate(p.date)}` : 'Skipped'}</p>
              </div>
              {p.status === 'paid' && <Money value={-p.amount} className="text-[14px] font-bold" />}
              <button aria-label="Undo" title="Undo" onClick={async () => { if (await confirm({ title: 'Undo this record?', text: p.status === 'paid' ? 'The expense is removed and the renewal is reserved again.' : 'The renewal will be reserved again.', confirm: 'Undo' })) run(() => undoPayment(p.id), 'Undone'); }} className="h-9 w-9 grid place-items-center rounded-xl text-muted hover:bg-mint/60"><Undo2 size={16} /></button>
            </div>
          ))}
        </Card>
      </section>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Button variant="outline" icon={s.active ? Pause : Play} onClick={toggle}>{s.active ? 'Pause / cancel' : 'Reactivate'}</Button>
        <Button variant="outline" icon={Trash2} className="!text-danger" onClick={remove}>Delete</Button>
      </div>

      {paying && <PaySheet occ={paying} name={s.name} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PaySheet({ occ, name, onClose }: { occ: Occurrence; name: string; onClose: () => void }) {
  const { data, today } = useFinance();
  const run = useAction();
  const [amount, setAmount] = useState(centsToInput(occ.amount));
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const cents = parseMoney(amount);
  const submit = async () => {
    if (!cents) return;
    setBusy(true);
    const ok = await run(() => paySubscription(occ.subscriptionId, occ.period, { amount: cents, date, accountId: accountId || undefined }), `${name} marked as paid`);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Pay ${name}`} footer={<Button block size="lg" variant="primary" loading={busy} disabled={!cents} onClick={submit}>Record payment</Button>}>
      <p className="text-[13px] text-muted mb-4">Renewal due {formatDate(occ.dueDate, 'long')}. This records the expense and releases the reservation.</p>
      <div className="space-y-4">
        <Field label="Amount paid"><MoneyField value={amount} onChange={setAmount} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Account">
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Not set</option>
              {data.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </Sheet>
  );
}
