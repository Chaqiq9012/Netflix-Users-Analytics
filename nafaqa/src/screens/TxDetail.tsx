import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Trash2, History, Repeat } from 'lucide-react';
import { formatDate } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { db } from '../data/db';
import { deleteTransaction } from '../data/repo';
import { useAction, useConfirm } from '../ui/overlay';
import { Button, Card, CategoryIcon, Money, PageHeader, cx } from '../ui/kit';

export default function TxDetail() {
  const { id } = useParams();
  const { data, cat, account } = useFinance();
  const nav = useNavigate();
  const run = useAction();
  const confirm = useConfirm();
  const tx = data.transactions.find((t) => t.id === id);
  const logs = useLiveQuery(() => db.auditLogs.where('entityId').equals(id ?? '').reverse().sortBy('at'), [id]);
  if (!tx) {
    return (
      <div><PageHeader title="Transaction" back="/activity" /><Card className="p-8 text-center text-muted">This transaction no longer exists.</Card></div>
    );
  }
  const c = cat(tx.categoryId);
  const sub = tx.subscriptionId ? data.subscriptions.find((s) => s.id === tx.subscriptionId) : undefined;
  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this transaction?',
      text: sub ? 'This was a subscription payment. Deleting it re-opens that renewal and reserves the amount again.' : 'Your balance, goals and reports will be recalculated. The deletion is kept in the audit trail.',
      confirm: 'Delete', danger: true
    });
    if (ok && (await run(() => deleteTransaction(tx.id), 'Transaction deleted'))) nav(-1);
  };
  return (
    <div className="animate-fade-in">
      <PageHeader title={tx.kind === 'income' ? 'Income' : 'Expense'} back />
      <Card className="p-6 text-center">
        <CategoryIcon icon={c?.icon} kind={sub ? 'bill' : tx.kind} size={56} className="mx-auto" />
        <p className={cx('mt-4 text-[36px] font-extrabold tracking-tight', tx.kind === 'income' ? 'text-sage' : 'text-ink')}>
          <Money value={tx.kind === 'income' ? tx.amount : -tx.amount} sign />
        </p>
        <p className="text-[16px] font-semibold mt-1">{tx.description}</p>
        <p className="text-[13px] text-muted mt-1">{formatDate(tx.date, 'long')}</p>
      </Card>
      <Card className="mt-4 divide-y divide-line">
        <Detail label="Category" value={tx.isOpening ? 'Opening balance' : c?.name ?? '—'} />
        <Detail label="Account" value={account(tx.accountId)?.name ?? 'Not set'} />
        {sub && <Detail label="Subscription" value={<Link className="text-forest font-bold inline-flex items-center gap-1" to={`/subscriptions/${sub.id}`}><Repeat size={14} />{sub.name} · {tx.subscriptionPeriod}</Link>} />}
        {tx.notes && <Detail label="Notes" value={tx.notes} />}
        <Detail label="Recorded" value={new Date(tx.createdAt).toLocaleString()} />
      </Card>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Button variant="outline" icon={Pencil} onClick={() => nav(`/tx/${tx.id}/edit`)}>Edit</Button>
        <Button variant="outline" icon={Trash2} className="!text-danger" onClick={remove}>Delete</Button>
      </div>
      {logs && logs.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-extrabold mb-3 px-1 flex items-center gap-2"><History size={16} /> History</h2>
          <Card className="divide-y divide-line">
            {logs.map((l) => (
              <div key={l.id} className="px-4 py-3">
                <p className="text-[13px] font-semibold">{l.summary}</p>
                <p className="text-[11px] text-muted mt-0.5">{new Date(l.at).toLocaleString()}</p>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[14px] font-semibold text-right">{value}</span>
    </div>
  );
}
