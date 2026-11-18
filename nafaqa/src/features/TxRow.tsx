import { Link } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import { relativeDay, type Transaction } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { CategoryIcon, Money, cx } from '../ui/kit';

export function TxRow({ tx, showDate = true }: { tx: Transaction; showDate?: boolean }) {
  const { cat, today, account } = useFinance();
  const c = cat(tx.categoryId);
  const acc = account(tx.accountId);
  return (
    <Link to={`/tx/${tx.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-mint/30 active:bg-mint/50 transition">
      <CategoryIcon icon={c?.icon} kind={tx.subscriptionId ? 'bill' : tx.kind} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold truncate flex items-center gap-1.5">
          {tx.description}
          {tx.subscriptionId && <Repeat size={13} className="text-accent shrink-0" />}
        </p>
        <p className="text-[12px] text-muted truncate">
          {[showDate && relativeDay(tx.date, today), tx.isOpening ? 'Opening balance' : c?.name, acc?.name].filter(Boolean).join(' · ')}
        </p>
      </div>
      <Money value={tx.kind === 'income' ? tx.amount : -tx.amount} sign className={cx('text-[15px] font-bold', tx.kind === 'income' ? 'text-sage' : 'text-ink')} />
    </Link>
  );
}
