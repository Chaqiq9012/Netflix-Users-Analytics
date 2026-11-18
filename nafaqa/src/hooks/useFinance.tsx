import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { closeCompletedMonths, ensureSeed, recordDailySnapshot } from '../data/repo';
import { computeSnapshot, todayIn, hourIn, type FinanceData, type Snapshot, type Category, type Account } from '../engine';

interface FinanceCtx {
  data: FinanceData;
  snap: Snapshot;
  today: string;
  hour: number;
  cat: (id: string) => Category | undefined;
  account: (id?: string) => Account | undefined;
}

const Ctx = createContext<FinanceCtx | null>(null);

/** Re-evaluates the calendar date every 30s and on focus, so targets roll over at local midnight. */
function useClock(tz: string) {
  const [state, setState] = useState(() => ({ today: todayIn(tz), hour: hourIn(tz) }));
  useEffect(() => {
    const tick = () => {
      const t = todayIn(tz);
      const h = hourIn(tz);
      setState((s) => (s.today === t && s.hour === h ? s : { today: t, hour: h }));
    };
    tick();
    const iv = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [tz]);
  return state;
}

async function loadAll(): Promise<FinanceData | null> {
  const settings = await db.settings.get('main');
  if (!settings) return null;
  const [transactions, transfers, categories, accounts, subscriptions, payments, restDays, goals, weeklyRecords, monthlyRecords] = await Promise.all([
    db.transactions.toArray(), db.transfers.toArray(), db.categories.toArray(), db.accounts.toArray(), db.subscriptions.toArray(),
    db.payments.toArray(), db.restDays.toArray(), db.goals.toArray(), db.weeklyRecords.toArray(), db.monthlyRecords.toArray()
  ]);
  return { settings, transactions, transfers, categories, accounts, subscriptions, payments, restDays, goals, weeklyRecords, monthlyRecords };
}

export function FinanceProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ensureSeed().then(() => setSeeded(true)).catch((e) => setError(String(e?.message ?? e)));
  }, []);
  const data = useLiveQuery(() => (seeded ? loadAll() : Promise.resolve(null)), [seeded]);
  const { today, hour } = useClock(data?.settings.timezone ?? 'Africa/Casablanca');
  const snap = useMemo(() => (data ? computeSnapshot(data, today) : null), [data, today]);

  // Persist a daily snapshot and close finished months (idempotent).
  useEffect(() => {
    if (!data || !snap) return;
    const a = snap.allocation;
    const t = setTimeout(() => {
      recordDailySnapshot({ date: today, balance: a.balance, savings: a.savings, safeToSpend: a.safeToSpend, reserved: a.obligationsRequired }).catch(() => {});
      closeCompletedMonths(data, today, snap.firstActivity).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [data, snap, today]);

  const value = useMemo<FinanceCtx | null>(() => {
    if (!data || !snap) return null;
    const cats = new Map(data.categories.map((c) => [c.id, c]));
    const accs = new Map(data.accounts.map((a) => [a.id, a]));
    return { data, snap, today, hour, cat: (id) => cats.get(id), account: (id) => (id ? accs.get(id) : undefined) };
  }, [data, snap, today, hour]);

  if (error) {
    return (
      <div className="min-h-dvh grid place-items-center p-8 text-center">
        <div>
          <p className="font-bold text-lg">Nafaqa couldn't open its local database.</p>
          <p className="text-muted mt-2 text-sm">{error}</p>
          <p className="text-muted mt-2 text-sm">Private browsing modes may block storage. Try a normal window.</p>
        </div>
      </div>
    );
  }
  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinance(): FinanceCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFinance outside provider');
  return v;
}
