import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, PiggyBank, Bell, BellOff, ChevronRight } from 'lucide-react';
import {
  centsToInput, dueDateFor, formatMoney, monthKey, parseMoney, addMonths, formatDate, type Cents, type PocketId, type Subscription
} from '../engine';
import { addTransfer, availableIn, saveSubscription, POCKET_LABEL } from '../data/repo';
import { useFinance } from '../hooks/useFinance';
import { Sheet, useAction } from '../ui/overlay';
import { Button, Field, Input, Money, MoneyField, Toggle, cx, CategoryIcon } from '../ui/kit';
import { buildNotices, pushBrowserNotices } from './notifications';

interface Actions {
  openTransfer: (preset?: { from?: PocketId; to?: PocketId; amount?: Cents; title?: string }) => void;
  openSave: (suggested?: Cents, context?: string) => void;
  openSubscription: (sub?: Subscription) => void;
  openNotifications: () => void;
  noticeCount: number;
}
const Ctx = createContext<Actions | null>(null);
export const useActions = () => useContext(Ctx)!;

export function ActionsProvider({ children }: { children: ReactNode }) {
  const { data, snap, hour } = useFinance();
  const [transfer, setTransfer] = useState<null | { from: PocketId; to: PocketId; amount?: Cents; title?: string; context?: string }>(null);
  const [sub, setSub] = useState<null | { sub?: Subscription }>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const notices = useMemo(() => buildNotices(data, snap, hour), [data, snap, hour]);

  useEffect(() => {
    if (data.settings.notifications.browser) pushBrowserNotices(notices);
  }, [notices, data.settings.notifications.browser]);

  const value = useMemo<Actions>(() => ({
    openTransfer: (p) => setTransfer({ from: p?.from ?? 'spendable', to: p?.to ?? 'savings', amount: p?.amount, title: p?.title }),
    openSave: (s, context) => setTransfer({ from: 'spendable', to: 'savings', amount: s, title: 'Add to savings', context }),
    openSubscription: (s) => setSub({ sub: s }),
    openNotifications: () => setNotesOpen(true),
    noticeCount: notices.length
  }), [notices.length]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {transfer && <TransferSheet {...transfer} onClose={() => setTransfer(null)} />}
      {sub && <SubscriptionSheet sub={sub.sub} onClose={() => setSub(null)} />}
      <NotificationsSheet open={notesOpen} onClose={() => setNotesOpen(false)} notices={notices} />
    </Ctx.Provider>
  );
}

const POCKET_OPTIONS: { value: PocketId; label: string }[] = [
  { value: 'spendable', label: 'Spendable' },
  { value: 'savings', label: 'Savings' },
  { value: 'holding', label: 'Unallocated' }
];

function TransferSheet({ from: f0, to: t0, amount, title, context, onClose }: { from: PocketId; to: PocketId; amount?: Cents; title?: string; context?: string; onClose: () => void }) {
  const { data, today, snap } = useFinance();
  const run = useAction();
  const [from, setFrom] = useState<PocketId>(f0);
  const [to, setTo] = useState<PocketId>(t0);
  const [value, setValue] = useState(amount ? centsToInput(amount) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const available = availableIn(data, from, today);
  const cents = parseMoney(value);
  const err = value && cents === null ? 'Enter a valid amount.' : cents !== null && cents > available ? `Only ${formatMoney(available)} available.` : from === to ? 'Choose two different pockets.' : null;
  const remainingToday = Math.max(0, snap.week.todayTarget - Math.max(0, snap.week.savedToday));

  const submit = async () => {
    if (!cents || err) return;
    setBusy(true);
    const ok = await run(() => addTransfer({ from, to, amount: cents, note, source: to === 'savings' && context ? 'income-allocation' : 'manual' }), to === 'savings' ? `${formatMoney(cents)} saved` : `${formatMoney(cents)} moved to ${POCKET_LABEL[to]}`);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet open onClose={onClose} title={title ?? 'Move money'} footer={<Button block size="lg" variant={to === 'savings' ? 'primary' : 'dark'} onClick={submit} loading={busy} disabled={!cents || !!err}>{to === 'savings' ? 'Save money' : 'Confirm transfer'}</Button>}>
      {context && <p className="text-[14px] text-muted mb-4 leading-relaxed">{context}</p>}
      <div className="space-y-2">
        <PocketPicker label="From" value={from} onChange={setFrom} exclude={to} data-available={available} />
        <div className="flex justify-center -my-1"><span className="h-8 w-8 rounded-full bg-mint text-forest grid place-items-center"><ArrowDown size={16} /></span></div>
        <PocketPicker label="To" value={to} onChange={setTo} exclude={from} />
      </div>
      <p className="text-[12px] text-muted mt-3">Available in {POCKET_LABEL[from]}: <Money value={available} className="font-bold text-ink" />{from === 'spendable' && ' (after savings, bills and emergency reserve)'}</p>
      <div className="mt-4">
        <MoneyField value={value} onChange={setValue} large autoFocus />
        {err && <p className="text-[12px] text-danger mt-1.5 font-medium">{err}</p>}
      </div>
      {to === 'savings' && from === 'spendable' && (
        <div className="flex flex-wrap gap-2 mt-3">
          {remainingToday > 0 && <QuickChip onClick={() => setValue(centsToInput(Math.min(remainingToday, available)))}>Today's target · {formatMoney(Math.min(remainingToday, available))}</QuickChip>}
          {snap.week.effectiveRemaining > 0 && <QuickChip onClick={() => setValue(centsToInput(Math.min(snap.week.effectiveRemaining, available)))}>Finish week · {formatMoney(Math.min(snap.week.effectiveRemaining, available))}</QuickChip>}
        </div>
      )}
      <Field label="Note (optional)" className="mt-4">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Set aside from today's job" maxLength={80} />
      </Field>
      <p className="text-[12px] text-muted mt-3">Transfers move money between pockets. Your total balance stays the same.</p>
    </Sheet>
  );
}

function QuickChip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="chip border-line bg-card text-forest hover:border-forest/40">{children}</button>;
}

function PocketPicker({ label, value, onChange, exclude }: { label: string; value: PocketId; onChange: (p: PocketId) => void; exclude: PocketId; [k: string]: any }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card border border-line p-2 pl-4">
      <span className="text-[12px] font-bold text-muted w-10">{label}</span>
      <div className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar">
        {POCKET_OPTIONS.map((o) => (
          <button key={o.value} disabled={o.value === exclude} onClick={() => onChange(o.value)} className={cx('chip', value === o.value ? 'bg-forest text-cream border-forest' : 'border-line text-ink disabled:opacity-35')}>
            {o.value === 'savings' && <PiggyBank size={14} />}{o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SubscriptionSheet({ sub, onClose }: { sub?: Subscription; onClose: () => void }) {
  const { data, today } = useFinance();
  const run = useAction();
  const nav = useNavigate();
  const cats = data.categories.filter((c) => c.kind === 'expense' && (!c.archived || c.id === sub?.categoryId));
  const [name, setName] = useState(sub?.name ?? '');
  const [amount, setAmount] = useState(sub ? centsToInput(sub.amount) : '');
  const [day, setDay] = useState(String(sub?.renewalDay ?? Number(today.slice(8, 10))));
  const [categoryId, setCategoryId] = useState(sub?.categoryId ?? 'exp-bills');
  const [description, setDescription] = useState(sub?.description ?? '');
  const [active, setActive] = useState(sub?.active ?? true);
  const [reminderDays, setReminderDays] = useState(sub?.reminderDays ?? 2);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const cents = parseMoney(amount);
  const dayN = Number(day);
  const errs = {
    name: !name.trim() ? 'Name is required.' : null,
    amount: !cents ? 'Enter an amount.' : null,
    day: !Number.isInteger(dayN) || dayN < 1 || dayN > 31 ? 'Choose a day between 1 and 31.' : null
  };
  const thisDue = !errs.day ? dueDateFor(dayN, monthKey(today)) : null;
  const firstDue = thisDue && (paid || thisDue < today) ? dueDateFor(dayN, addMonths(monthKey(today), 1)) : thisDue;

  const submit = async () => {
    setTried(true);
    if (errs.name || errs.amount || errs.day) return;
    setBusy(true);
    let id = '';
    const ok = await run(async () => { id = await saveSubscription({ name, amount: cents!, renewalDay: dayN, categoryId, description, active, reminderDays, alreadyPaidThisMonth: paid }, sub?.id); }, sub ? 'Subscription updated' : 'Subscription added — amount reserved');
    setBusy(false);
    if (ok) { onClose(); if (!sub) nav(`/subscriptions/${id}`); }
  };

  return (
    <Sheet open onClose={onClose} title={sub ? 'Edit subscription' : 'New subscription'} footer={<Button block size="lg" variant="primary" onClick={submit} loading={busy}>{sub ? 'Save changes' : 'Add subscription'}</Button>}>
      <div className="space-y-4">
        <Field label="Name" error={tried ? errs.name : null}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Internet, Phone, Music…" maxLength={40} autoFocus={!sub} /></Field>
        <Field label="Monthly amount" error={tried ? errs.amount : null}><MoneyField value={amount} onChange={setAmount} /></Field>
        <Field label="Renewal day of month" error={tried ? errs.day : null} hint={dayN > 28 && !errs.day ? 'In shorter months it renews on the last day.' : firstDue && !sub ? `First renewal: ${formatDate(firstDue, 'long')}` : undefined}>
          <Input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </Field>
        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c.id} onClick={() => setCategoryId(c.id)} className={cx('chip', categoryId === c.id ? 'bg-forest text-cream border-forest' : 'border-line bg-card')}>{c.name}</button>
            ))}
          </div>
        </Field>
        <Field label="Description (optional)"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Plan, provider, account…" maxLength={80} /></Field>
        <Field label="Reminder">
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 7].map((d) => (
              <button key={d} onClick={() => setReminderDays(d)} className={cx('chip', reminderDays === d ? 'bg-forest text-cream border-forest' : 'border-line bg-card')}>{d === 0 ? 'None' : d === 1 ? '1 day before' : `${d} days before`}</button>
            ))}
          </div>
        </Field>
        {!sub && thisDue && thisDue >= today && (
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-card border border-line p-4">
            <div><p className="text-[14px] font-semibold">Already paid this month</p><p className="text-[12px] text-muted">Start reserving from next month’s renewal.</p></div>
            <Toggle checked={paid} onChange={setPaid} label="Already paid this month" />
          </div>
        )}
        {sub && (
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-card border border-line p-4">
            <div><p className="text-[14px] font-semibold">Active</p><p className="text-[12px] text-muted">Inactive subscriptions are not reserved.</p></div>
            <Toggle checked={active} onChange={setActive} label="Active" />
          </div>
        )}
      </div>
    </Sheet>
  );
}

function NotificationsSheet({ open, onClose, notices }: { open: boolean; onClose: () => void; notices: ReturnType<typeof buildNotices> }) {
  const nav = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      {notices.length === 0 ? (
        <div className="text-center py-10">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-mint text-forest grid place-items-center mb-3"><BellOff size={22} /></div>
          <p className="font-bold">You're all caught up</p>
          <p className="text-[13px] text-muted mt-1">Bill reminders and savings alerts will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-2 pb-4">
          {notices.map((n) => (
            <li key={n.key}>
              <button onClick={() => { onClose(); nav(n.to); }} className="w-full flex items-start gap-3 text-left rounded-2xl bg-card border border-line p-4 hover:border-forest/40">
                <CategoryIcon icon={n.key.startsWith('bill') ? 'receipt' : n.key.startsWith('target') ? 'piggy' : 'dots'} kind={n.tone === 'warn' ? 'bill' : 'income'} size={36} />
                <div className="flex-1"><p className="text-[14px] font-bold">{n.title}</p><p className="text-[13px] text-muted mt-0.5">{n.text}</p></div>
                <ChevronRight size={18} className="text-muted mt-2" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] text-muted pb-4 flex items-center gap-1.5"><Bell size={13} /> Manage alerts in Settings → Notifications.</p>
    </Sheet>
  );
}

export function useSaveAfterIncome() {
  const { openSave } = useActions();
  return useCallback((income: Cents, remaining: Cents) => {
    const suggested = Math.min(income, remaining);
    openSave(suggested > 0 ? suggested : undefined, suggested > 0
      ? `Income recorded. Save ${formatMoney(suggested)} now to stay on track for this week's goal?`
      : 'Income recorded. Your savings goal is covered — you can still set something aside.');
  }, [openSave]);
}
