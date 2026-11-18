import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, Check, AlertTriangle } from 'lucide-react';
import { centsToInput, formatMoney, parseMoney, isValidDate, type TxKind } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { addTransaction, updateTransaction } from '../data/repo';
import { useAction, useConfirm } from '../ui/overlay';
import { Button, Field, Input, MoneyField, Segmented, cx } from '../ui/kit';
import { iconFor } from '../lib/icons';
import { useSaveAfterIncome } from '../features/actions';

/** Screen 2: Add / edit income or expense. */
export default function TxForm() {
  const { kind: kindParam, id } = useParams();
  const { data, today, snap } = useFinance();
  const nav = useNavigate();
  const run = useAction();
  const confirm = useConfirm();
  const offerSave = useSaveAfterIncome();
  const existing = id ? data.transactions.find((t) => t.id === id) : undefined;
  const [kind, setKind] = useState<TxKind>(existing?.kind ?? (kindParam === 'expense' ? 'expense' : 'income'));
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const cats = useMemo(() => data.categories.filter((c) => c.kind === kind && (!c.archived || c.id === existing?.categoryId)).sort((a, b) => a.order - b.order), [data.categories, kind, existing]);
  const [categoryId, setCategoryId] = useState<string>(existing?.categoryId ?? '');
  const [date, setDate] = useState(existing?.date ?? today);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const catId = cats.some((c) => c.id === categoryId) ? categoryId : cats[0]?.id ?? '';
  const cents = parseMoney(amount);
  const locked = !!existing?.subscriptionId;

  if (id && !existing) {
    return <div className="py-20 text-center"><p className="font-bold">Transaction not found</p><Button className="mt-4" variant="soft" onClick={() => nav('/activity')}>Back to activity</Button></div>;
  }

  const errors = {
    amount: !cents ? 'Enter an amount greater than 0.' : null,
    date: !isValidDate(date) ? 'Choose a valid date.' : null
  };
  // Expense impact: how much beyond safe-to-spend (editing frees the old amount first).
  const freed = existing?.kind === 'expense' ? existing.amount : existing?.kind === 'income' ? -existing.amount : 0;
  const overBy = kind === 'expense' && cents ? cents - (snap.allocation.safeToSpend + freed) : 0;

  const submit = async () => {
    setTried(true);
    if (errors.amount || errors.date) return;
    if (overBy > 0) {
      const ok = await confirm({
        title: 'This is more than safe to spend',
        text: <>This expense is <b>{formatMoney(overBy)}</b> above your safe-to-spend. It will leave your savings, bills or emergency reserve under-covered. Nothing is borrowed automatically — you'll see a shortfall to fix.</>,
        confirm: 'Record anyway', danger: true
      });
      if (!ok) return;
    }
    setBusy(true);
    const input = { kind, amount: cents!, description, categoryId: catId, date, notes, accountId: accountId || undefined, isOpening: existing?.isOpening };
    const ok = await run(() => (existing ? updateTransaction(existing.id, input) : addTransaction(input)), existing ? 'Transaction updated' : kind === 'income' ? 'Income added' : 'Expense recorded');
    setBusy(false);
    if (!ok) return;
    if (existing) nav(-1);
    else {
      nav('/', { replace: true });
      if (kind === 'income' && data.settings.promptSaveOnIncome && date === today && !snap.week.todayIsRest) {
        const remaining = Math.max(0, snap.week.todayTarget - Math.max(0, snap.week.savedToday)) || snap.week.effectiveRemaining;
        setTimeout(() => offerSave(cents!, remaining), 250);
      }
    }
  };

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between pt-2 pb-4">
        <button aria-label="Close" onClick={() => nav(-1)} className="h-11 w-11 grid place-items-center rounded-2xl border border-line bg-card text-forest"><X size={20} /></button>
        <h1 className="text-[17px] font-extrabold">{existing ? 'Edit transaction' : kind === 'income' ? 'Add income' : 'Add expense'}</h1>
        <span className="w-11" />
      </header>

      {!locked && !existing?.isOpening && (
        <Segmented tone="split" value={kind} onChange={(v) => { setKind(v); setCategoryId(''); }} options={[{ value: 'income', label: 'MONEY IN' }, { value: 'expense', label: 'MONEY OUT' }]} />
      )}

      <div className="mt-5">
        <MoneyField value={amount} onChange={setAmount} large autoFocus={!existing} />
        {tried && errors.amount && <p className="text-[12px] text-danger mt-1.5 font-medium">{errors.amount}</p>}
        {overBy > 0 && (
          <p className="text-[12px] text-accent mt-2 font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> {formatMoney(overBy)} above safe-to-spend ({formatMoney(Math.max(0, snap.allocation.safeToSpend + freed))})</p>
        )}
      </div>

      <div className="mt-5 space-y-5">
        <Field label="Reason" hint="Describe it in your own words.">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === 'income' ? 'e.g. Bathroom installation – Hay Riad' : 'e.g. Lunch with team'} maxLength={120} />
        </Field>

        <div>
          <span className="block text-[13px] font-semibold mb-2">Category</span>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {cats.map((c) => {
              const Icon = iconFor(c.icon);
              const on = c.id === catId;
              return (
                <button key={c.id} disabled={locked} onClick={() => setCategoryId(c.id)} className={cx('relative flex flex-col items-center justify-center gap-1.5 h-[76px] rounded-2xl border text-[12px] font-bold transition px-1 text-center', on ? 'bg-forest text-cream border-forest' : 'bg-card border-line text-ink hover:border-forest/40', locked && !on && 'opacity-40')}>
                  <Icon size={20} />
                  <span className="leading-tight line-clamp-2">{c.name}</span>
                  {on && <Check size={12} className="absolute top-2 right-2" />}
                </button>
              );
            })}
          </div>
          <button onClick={() => nav('/settings#categories')} className="text-[12px] font-bold text-forest mt-2">Manage categories</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" error={tried ? errors.date : null}>
            <Input type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Account (optional)">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input appearance-none">
              <option value="">Not set</option>
              {data.accounts.filter((a) => !a.archived || a.id === accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        {date > today && <p className="text-[12px] text-muted -mt-3">Future-dated: it affects your balance now. Consider recording it on the day.</p>}

        <Field label="Notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300} className="input h-auto py-3 resize-none" placeholder="Anything to remember" />
        </Field>
        {locked && <p className="text-[12px] text-muted">This is a subscription payment. Amount and date changes update the payment record.</p>}
      </div>

      <div className="sticky bottom-0 pt-4 pb-safe bg-gradient-to-t from-cream via-cream to-transparent mt-6">
        <Button block size="lg" variant={kind === 'income' ? 'primary' : 'dark'} onClick={submit} loading={busy} className="mb-3">
          {existing ? 'Save changes' : kind === 'income' ? 'Save income' : 'Save expense'}
        </Button>
      </div>
    </div>
  );
}
