import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiggyBank, Wallet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { centsToInput, formatDate, formatMoney, parseMoney } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { decideRecovery } from '../data/repo';
import { useAction } from '../ui/overlay';
import { Button, Card, EmptyState, Field, Money, MoneyField, PageHeader, ProgressBar } from '../ui/kit';

/** Screen 7: end-of-week savings recovery. Never transfers automatically. */
export default function Recovery() {
  const { snap } = useFinance();
  const nav = useNavigate();
  const run = useAction();
  const r = snap.recovery;
  const [amount, setAmount] = useState(r ? centsToInput(r.suggested) : '');
  const [busy, setBusy] = useState<'t' | 'k' | null>(null);
  if (!r) {
    return (
      <div><PageHeader title="Weekly recovery" back="/goals" />
        <Card><EmptyState icon={CheckCircle2} title="Nothing to review" text="When a week ends short of its savings goal, you'll be able to decide how to recover it here." action={<Button variant="soft" onClick={() => nav('/goals')}>Back to goals</Button>} /></Card>
      </div>
    );
  }
  const cents = parseMoney(amount);
  const err = cents !== null && cents > r.suggested ? `At most ${formatMoney(r.suggested)} can be moved safely.` : null;
  const confirmT = async () => {
    if (!cents || err) return;
    setBusy('t');
    const ok = await run(() => decideRecovery(r.weekStart, 'transfer', cents), `${formatMoney(cents)} moved to savings`);
    setBusy(null);
    if (ok) nav('/goals', { replace: true });
  };
  const keep = async () => {
    setBusy('k');
    const ok = await run(() => decideRecovery(r.weekStart, 'keep'), 'Shortfall recorded — money stays spendable');
    setBusy(null);
    if (ok) nav('/goals', { replace: true });
  };
  return (
    <div className="animate-fade-in">
      <PageHeader title="Weekly recovery" subtitle={`${formatDate(r.weekStart)} – ${formatDate(r.weekEnd)}${r.isCurrentWeek ? ' · ends today' : ''}`} back="/goals" />
      <Card className="p-5">
        <p className="label">Savings shortfall</p>
        <p className="text-[38px] font-extrabold tracking-tight text-accent"><Money value={r.shortfall} /></p>
        <div className="flex justify-between text-[13px] text-muted mt-1 mb-2"><span>Saved <Money value={Math.max(0, r.saved)} className="font-bold text-ink" /></span><span>Goal <Money value={r.goal} className="font-bold text-ink" /></span></div>
        <ProgressBar value={r.goal ? r.saved / r.goal : 0} tone="orange" />
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Card className="p-4"><Wallet size={18} className="text-forest" /><p className="label mt-2">Safe to spend</p><p className="text-[18px] font-extrabold mt-0.5"><Money value={r.available} /></p></Card>
        <Card className="p-4"><PiggyBank size={18} className="text-forest" /><p className="label mt-2">Suggested transfer</p><p className="text-[18px] font-extrabold mt-0.5"><Money value={r.suggested} /></p></Card>
      </div>

      <Card className="p-5 mt-4">
        {r.suggested > 0 ? (
          <p className="text-[15px] leading-relaxed">
            You're <b>{formatMoney(r.shortfall)}</b> short of your weekly goal. We recommend transferring <b>{formatMoney(r.suggested)}</b> from spendable money into savings.
          </p>
        ) : (
          <p className="text-[15px] leading-relaxed">You're <b>{formatMoney(r.shortfall)}</b> short, but there is no spendable money available to move right now.</p>
        )}
        {r.remainingDeficit > 0 && r.suggested > 0 && (
          <p className="text-[13px] text-accent font-semibold mt-3 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> Only {formatMoney(r.suggested)} is safely available. {formatMoney(r.remainingDeficit)} will remain as a recorded shortfall.</p>
        )}
        {r.suggested > 0 && (
          <Field label="Amount to transfer" className="mt-4" error={err}>
            <MoneyField value={amount} onChange={setAmount} />
          </Field>
        )}
        <p className="text-[12px] text-muted mt-3">The transfer counts toward this week's goal. Your total balance does not change. Nothing moves until you confirm.</p>
      </Card>

      <div className="space-y-3 mt-5">
        {r.suggested > 0 && <Button block size="lg" variant="primary" icon={PiggyBank} onClick={confirmT} loading={busy === 't'} disabled={!cents || !!err}>Confirm transfer</Button>}
        <Button block size="lg" variant="outline" onClick={keep} loading={busy === 'k'}>Keep money spendable</Button>
      </div>
    </div>
  );
}
