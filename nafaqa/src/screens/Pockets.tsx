import { ArrowLeftRight, PiggyBank, Receipt, ShieldCheck, Wallet, Archive, Undo2, AlertTriangle, ArrowRight } from 'lucide-react';
import { relativeDay, formatMoney, type Transfer } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { useActions } from '../features/actions';
import { deleteTransfer, POCKET_LABEL } from '../data/repo';
import { useAction, useConfirm } from '../ui/overlay';
import { Button, Card, Money, PageHeader, SectionTitle, cx, EmptyState } from '../ui/kit';

const SOURCE: Record<Transfer['source'], string> = { manual: 'Manual', 'income-allocation': 'From income', 'weekly-recovery': 'Weekly recovery', 'deficit-cover': 'Cover shortfall' };

/** Screen 11: money allocation across the four pockets (+ unallocated). */
export default function Pockets() {
  const { data, snap, today } = useFinance();
  const { openTransfer } = useActions();
  const run = useAction();
  const confirm = useConfirm();
  const a = snap.allocation;
  const total = Math.max(1, a.balance);
  const segs = [
    { k: 'savings', v: Math.min(a.savings, Math.max(0, a.balance)), c: '#68A77C' },
    { k: 'holding', v: Math.max(0, Math.min(a.holding, a.balance - a.savings)), c: '#72766D' },
    { k: 'bills', v: a.obligationsCovered, c: '#EF7000' },
    { k: 'emergency', v: a.emergencyCovered, c: '#0B2F20' },
    { k: 'spend', v: a.safeToSpend, c: '#E4EBD2' }
  ];
  const history = [...data.transfers].sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt).slice(0, 40);

  const undo = async (t: Transfer) => {
    if (await confirm({ title: 'Undo this transfer?', text: `${formatMoney(t.amount)} goes back from ${POCKET_LABEL[t.to]} to ${POCKET_LABEL[t.from]}. Savings goals recalculate.`, confirm: 'Undo transfer' }))
      run(() => deleteTransfer(t.id), 'Transfer undone');
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Money allocation" subtitle="Where every dirham belongs" back />
      <Card className="p-5">
        <p className="label">Total actual balance</p>
        <p className="text-[34px] font-extrabold tracking-tight"><Money value={a.balance} /></p>
        <div className="flex h-4 rounded-full overflow-hidden mt-3 bg-line" aria-hidden>
          {segs.map((s) => s.v > 0 && <span key={s.k} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} />)}
        </div>
        <p className="text-[12px] text-muted mt-3">Pockets are virtual — they split your real money without moving it between accounts. Each dirham is counted once.</p>
      </Card>

      {a.deficit > 0 && (
        <Card className="p-4 mt-4 !border-danger/30 !bg-danger/[0.05]">
          <div className="flex gap-3"><AlertTriangle className="text-danger shrink-0" size={20} />
            <div className="flex-1">
              <p className="font-bold text-danger text-[14px]">Shortfall: <Money value={a.deficit} /></p>
              <p className="text-[13px] text-muted mt-1">Your balance doesn't cover {a.savingsUnbacked > 0 ? 'your savings and ' : ''}your reserved bills and emergency reserve. Nothing is borrowed silently. {a.savings > 0 && 'You can choose to withdraw from savings to cover bills.'}</p>
              {a.savings > 0 && <Button size="sm" variant="outline" className="mt-3" onClick={() => openTransfer({ from: 'savings', to: 'spendable', amount: Math.min(a.savings, a.deficit), title: 'Withdraw from savings' })}>Withdraw from savings</Button>}
            </div>
          </div>
        </Card>
      )}

      <div className="mt-4 space-y-3">
        <PocketCard icon={PiggyBank} color="#68A77C" name="Savings" value={a.savings} note={a.savingsUnbacked > 0 ? <span className="text-danger">Only <Money value={a.savings - a.savingsUnbacked} /> is backed by your balance.</span> : 'Protected. Counts toward weekly and monthly goals.'}
          actions={<><Button size="sm" variant="soft" onClick={() => openTransfer({ from: 'spendable', to: 'savings', title: 'Add to savings' })}>Add</Button><Button size="sm" variant="outline" disabled={a.savings <= 0} onClick={() => openTransfer({ from: 'savings', to: 'spendable', title: 'Withdraw from savings' })}>Withdraw</Button></>} />
        <PocketCard icon={Receipt} color="#EF7000" name="Upcoming bills" value={a.obligationsRequired} note={a.obligationsRequired === 0 ? 'No subscription renewals to reserve.' : a.obligationsCovered >= a.obligationsRequired ? `Reserved automatically for ${snap.reserved.length} renewal${snap.reserved.length === 1 ? '' : 's'}.` : <>Covered <Money value={a.obligationsCovered} /> — <span className="text-accent font-semibold"><Money value={a.obligationsRequired - a.obligationsCovered} /> missing</span></>} />
        <PocketCard icon={ShieldCheck} color="#0B2F20" name="Emergency reserve" value={a.emergencyRequired} note={a.emergencyCovered >= a.emergencyRequired ? 'Fully funded. Change the amount in Settings.' : <>Funded <Money value={a.emergencyCovered} /> of <Money value={a.emergencyRequired} /></>} />
        <PocketCard icon={Wallet} color="#68A77C" name="Spendable" value={a.safeToSpend} highlight note="Safe to spend = balance − savings − unallocated − reserved bills − emergency reserve." />
        <PocketCard icon={Archive} color="#72766D" name="Unallocated" value={a.holding} note="Held aside until you decide. Not spendable, not savings."
          actions={<><Button size="sm" variant="soft" onClick={() => openTransfer({ from: 'spendable', to: 'holding', title: 'Hold money aside' })}>Hold</Button><Button size="sm" variant="outline" disabled={a.holding <= 0} onClick={() => openTransfer({ from: 'holding', to: 'savings', title: 'Assign held money' })}>Assign</Button></>} />
      </div>

      <section className="mt-6">
        <SectionTitle title="Allocation history" />
        <Card className="overflow-hidden">
          {history.length === 0 ? <EmptyState icon={ArrowLeftRight} title="No transfers yet" text="Move money into savings to start tracking your goals." action={<Button size="sm" variant="primary" onClick={() => openTransfer()}>Make a transfer</Button>} /> : (
            <ul className="divide-y divide-line">
              {history.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cx('h-10 w-10 rounded-2xl grid place-items-center shrink-0', t.to === 'savings' ? 'bg-mint text-forest' : 'bg-[#F3ECDF] text-ink')}><ArrowLeftRight size={17} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold flex items-center gap-1.5">{POCKET_LABEL[t.from]} <ArrowRight size={13} /> {POCKET_LABEL[t.to]}</p>
                    <p className="text-[12px] text-muted truncate">{relativeDay(t.date, today)} · {SOURCE[t.source]}{t.periodDate !== t.date ? ` · counts for ${relativeDay(t.periodDate, today)}` : ''}{t.note && t.note !== 'Weekly recovery' ? ` · ${t.note}` : ''}</p>
                  </div>
                  <Money value={t.amount} className="text-[14px] font-bold" />
                  <button aria-label="Undo transfer" title="Undo" onClick={() => undo(t)} className="h-9 w-9 grid place-items-center rounded-xl text-muted hover:bg-mint/60"><Undo2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function PocketCard({ icon: Icon, color, name, value, note, actions, highlight }: { icon: any; color: string; name: string; value: number; note: React.ReactNode; actions?: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={cx('p-4', highlight && '!bg-forest !border-forest text-cream')}>
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 rounded-2xl grid place-items-center shrink-0" style={{ background: highlight ? 'rgba(255,255,255,.1)' : color + '1f', color: highlight ? '#FBF5E9' : color }}><Icon size={20} /></span>
        <div className="flex-1 min-w-0">
          <p className={cx('text-[14px] font-bold', highlight && 'text-cream')}>{name}</p>
          <p className={cx('text-[12px] mt-0.5', highlight ? 'text-cream/70' : 'text-muted')}>{note}</p>
        </div>
        <Money value={value} className="text-[17px] font-extrabold" />
      </div>
      {actions && <div className="flex gap-2 mt-3 pl-14">{actions}</div>}
    </Card>
  );
}
