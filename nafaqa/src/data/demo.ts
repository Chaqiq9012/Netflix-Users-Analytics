import { db } from './db';
import { ensureSeed, uid } from './repo';
import { addDays, todayIn, weekday, startOfWeek, monthKey, addMonths, dueDateFor, type Transaction, type Transfer } from '../engine';

/** Deterministic pseudo-random so the demo looks the same each time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function seedDemoData(): Promise<void> {
  await ensureSeed();
  const today = todayIn('Africa/Casablanca');
  const r = rng(42);
  const start = addDays(startOfWeek(today), -42);
  const txs: Transaction[] = [];
  const trs: Transfer[] = [];
  const t0 = Date.now();
  let n = 0;
  const tx = (kind: Transaction['kind'], amount: number, description: string, categoryId: string, date: string, extra: Partial<Transaction> = {}) =>
    txs.push({ id: uid(), kind, amount, description, categoryId, date, accountId: 'acc-cash', createdAt: t0 + n++, updatedAt: t0 + n, ...extra });

  tx('income', 350000, 'Opening balance', 'inc-other', addDays(start, -1), { isOpening: true, accountId: 'acc-bank' });
  const rest: string[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const wd = weekday(d);
    if (wd === 6 && r() < 0.7) { rest.push(d); continue; }
    if (d === today) {
      tx('income', 32000, 'Kitchen tiling job', 'inc-install', d);
      tx('expense', 4500, 'Lunch', 'exp-food', d);
      continue;
    }
    const roll = r();
    if (roll < 0.12) {
      // slow day
    } else if (roll < 0.3) {
      tx('income', Math.round((600 + r() * 900)) * 100, 'Installation — client', 'inc-install', d);
    } else if (roll < 0.4) {
      tx('income', Math.round((250 + r() * 400)) * 100, 'Freelance design', 'inc-freelance', d, { accountId: 'acc-bank' });
    } else {
      tx('income', Math.round((120 + r() * 260)) * 100, 'Daily work', 'inc-daily', d);
    }
    tx('expense', Math.round(25 + r() * 45) * 100, ['Lunch', 'Café & snack', 'Dinner'][Math.floor(r() * 3)], 'exp-food', d);
    if (r() < 0.6) tx('expense', Math.round(10 + r() * 30) * 100, ['Taxi', 'Bus', 'Fuel'][Math.floor(r() * 3)], 'exp-transport', d);
    if (wd === 2 || wd === 5) tx('expense', Math.round(120 + r() * 160) * 100, 'Weekly groceries', 'exp-groceries', d);
    if (r() < 0.08) tx('expense', Math.round(150 + r() * 350) * 100, ['Work boots', 'Phone case', 'Clothes'][Math.floor(r() * 3)], 'exp-shopping', d);
    // Savings: most working days set something aside.
    if (r() < 0.75) {
      const amt = Math.round(100 + r() * 120) * 100;
      trs.push({ id: uid(), from: 'spendable', to: 'savings', amount: amt, date: d, periodDate: d, source: 'income-allocation', createdAt: t0 + n++ });
    }
  }
  // Subscriptions with paid history.
  const subs = [
    { name: 'Internet', amount: 25000, renewalDay: 22, categoryId: 'exp-bills' },
    { name: 'Phone', amount: 9900, renewalDay: 27, categoryId: 'exp-bills' },
    { name: 'Music', amount: 6000, renewalDay: 3, categoryId: 'exp-personal' }
  ];
  const subStart = addDays(start, -1);
  for (const s of subs) {
    const id = uid();
    await db.subscriptions.put({ id, ...s, description: undefined, active: true, reminderDays: 2, startDate: subStart, createdAt: t0 });
    for (let p = monthKey(subStart); ; p = addMonths(p, 1)) {
      const due = dueDateFor(s.renewalDay, p);
      if (due < subStart) continue;
      if (due >= today) break;
      const txId = uid();
      tx('expense', s.amount, s.name, s.categoryId, due, { id: txId, subscriptionId: id, subscriptionPeriod: p, notes: `Renewal ${p}`, accountId: 'acc-bank' });
      await db.payments.put({ id: uid(), subscriptionId: id, period: p, status: 'paid', amount: s.amount, date: due, transactionId: txId, createdAt: t0 });
    }
  }
  await db.transactions.bulkPut(txs);
  await db.transfers.bulkPut(trs);
  await db.restDays.bulkPut(rest.map((d) => ({ date: d, type: 'rest' as const, createdAt: t0 })));
  await db.settings.update('main', { userName: 'Youssef', onboarded: true });
}
