import { describe, it, expect } from 'vitest';
import {
  actualBalance, computeSnapshot, weekProgress, monthProgress, recoveryFor, dueDateFor, reservedOccurrences, nextOccurrence,
  parseMoney, ceilDirham, formatMoney, startOfWeek, addDays, weekday, todayIn, analyze, monthSummaries, savingsBetween,
  financialHealth, forecast, weeklyHistory, pendingRecovery, firstPeriod, type SubscriptionPayment
} from '../src/engine';
import { data, income, expense, save, withdraw, rest, sub, settings, goal } from './helpers';

// Week of Mon 2026-11-16 … Sun 2026-11-22
const MON = '2026-11-16';
const THU = '2026-11-19';
const FRI = '2026-11-20';
const SUN = '2026-11-22';

describe('money & dates', () => {
  it('parses money to integer centimes without floating point', () => {
    expect(parseMoney('1250')).toBe(125000);
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney('0.1')).toBe(10);
    expect(parseMoney('1 250,75')).toBe(125075);
    expect(parseMoney('1,250')).toBe(125000);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
  it('rounds up to whole dirhams', () => {
    expect(ceilDirham(10001)).toBe(10100);
    expect(ceilDirham(10000)).toBe(10000);
    expect(ceilDirham(0)).toBe(0);
  });
  it('formats', () => {
    expect(formatMoney(1200000)).toBe('12,000 DH');
    expect(formatMoney(-5050)).toBe('−50.50 DH');
  });
  it('weeks start Monday and end Sunday', () => {
    expect(startOfWeek(SUN)).toBe(MON);
    expect(startOfWeek(MON)).toBe(MON);
    expect(weekday(MON)).toBe(0);
    expect(weekday(SUN)).toBe(6);
  });
  it('computes today in Africa/Casablanca regardless of device timezone', () => {
    // Uses the IANA database for the configured zone, not the device zone.
    expect(todayIn('Asia/Tokyo', new Date('2026-11-18T16:00:00Z'))).toBe('2026-11-19');
    expect(todayIn('Africa/Casablanca', new Date('2026-11-18T12:00:00Z'))).toBe('2026-11-18');
    expect(todayIn('Africa/Casablanca')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('1-3, 15: balances, transfers, safe-to-spend', () => {
  it('1. income increases the actual balance', () => {
    const d = data({ transactions: [income(50000, MON)] });
    expect(actualBalance(d.transactions)).toBe(50000);
  });
  it('2. expenses decrease the actual balance', () => {
    const d = data({ transactions: [income(50000, MON), expense(12000, MON)] });
    expect(actualBalance(d.transactions)).toBe(38000);
  });
  it('3. transfers do not change the actual balance', () => {
    const base = data({ transactions: [income(200000, MON)], settings: settings({ emergencyReserve: 0 }) });
    const before = computeSnapshot(base, MON).allocation;
    const after = computeSnapshot({ ...base, transfers: [save(50000, MON)] }, MON).allocation;
    expect(after.balance).toBe(before.balance);
    expect(after.savings).toBe(50000);
    expect(after.safeToSpend).toBe(before.safeToSpend - 50000);
  });
  it('15. emergency reserve is excluded from safe-to-spend', () => {
    const d = data({ transactions: [income(200000, MON)], settings: settings({ emergencyReserve: 50000 }) });
    const a = computeSnapshot(d, MON).allocation;
    expect(a.emergencyCovered).toBe(50000);
    expect(a.safeToSpend).toBe(150000);
  });
  it('safe-to-spend = balance − savings − reserved bills − emergency; never double counts', () => {
    const d = data({
      transactions: [income(1200000, MON)],
      transfers: [save(400000, MON)],
      subscriptions: [sub(100000, 25, MON)],
      settings: settings({ emergencyReserve: 50000 })
    });
    const a = computeSnapshot(d, MON).allocation;
    expect(a.safeToSpend).toBe(1200000 - 400000 - 100000 - 50000);
    expect(a.savings + a.obligationsCovered + a.emergencyCovered + a.safeToSpend).toBe(a.balance);
  });
  it('reports a deficit instead of negative pockets or borrowing from savings', () => {
    const d = data({ transactions: [income(100000, MON), expense(60000, MON)], transfers: [save(30000, MON)], subscriptions: [sub(20000, 25, MON)], settings: settings({ emergencyReserve: 50000 }) });
    const a = computeSnapshot(d, MON).allocation;
    expect(a.safeToSpend).toBe(0);
    expect(a.savings).toBe(30000);
    expect(a.obligationsCovered).toBe(10000);
    expect(a.emergencyCovered).toBe(0);
    expect(a.deficit).toBe(30000 + 20000 + 50000 - 40000);
  });
});

describe('4-7: dynamic savings engine', () => {
  it('4. a contribution counts toward weekly and monthly goals exactly once', () => {
    const d = data({ transactions: [income(500000, MON)], transfers: [save(30000, THU)] });
    const s = computeSnapshot(d, THU);
    expect(s.week.saved).toBe(30000);
    expect(s.month.saved).toBe(30000);
    // weekly breakdown inside the month sums to the month total (no double counting)
    expect(s.month.weeks.reduce((a, w) => a + w.saved, 0)).toBe(s.month.saved);
  });
  it('4b. a week spanning two months splits contributions by date', () => {
    // Week Mon 2026-11-30 … Sun 2026-12-06
    const d = data({ transfers: [save(20000, '2026-11-30'), save(30000, '2026-12-02')] });
    const w = weekProgress(d, '2026-12-03');
    expect(w.saved).toBe(50000);
    expect(monthProgress(d, '2026-12-03', '2026-11').saved).toBe(20000);
    expect(monthProgress(d, '2026-12-03', '2026-12').saved).toBe(30000);
  });
  it('5. spec example: 700 saved, 3 working days left → 100 DH/day', () => {
    // Today FRI; Fri, Sat, Sun remain = 3 working days.
    const d = data({ transfers: [save(70000, MON)] });
    const w = weekProgress(d, FRI);
    expect(w.remaining).toBe(30000);
    expect(w.workingDaysRemaining).toBe(3);
    expect(w.todayTarget).toBe(10000);
    expect(w.requiredPerDay).toBe(10000);
    expect(w.status).toBe('comfortable');
  });
  it('5b. spec example: 400 saved, 2 working days left → 300 DH/day (catch-up)', () => {
    const d = data({ transfers: [save(40000, MON)] });
    const w = weekProgress(d, '2026-11-21');
    expect(w.workingDaysRemaining).toBe(2);
    expect(w.requiredPerDay).toBe(30000);
    expect(w.status).toBe('catch-up');
  });
  it('5c. rounds required savings up to the nearest whole dirham', () => {
    const d = data({ transfers: [save(0 + 100, MON)] }); // 999 DH remaining over 7 → 142.71 → 143
    const w = weekProgress(d, MON);
    expect(w.todayTarget).toBe(14300);
  });
  it("5d. today's target stays fixed after saving and the forward requirement recalculates", () => {
    const d = data({ transfers: [save(70000, MON), save(10000, FRI)] });
    const w = weekProgress(d, FRI);
    expect(w.todayTarget).toBe(10000);
    expect(w.todayMet).toBe(true);
    expect(w.workingDaysForward).toBe(2);
    expect(w.requiredPerDay).toBe(10000);
    expect(w.status).toBe('on-track');
  });
  it('6. rest days are excluded from remaining working days', () => {
    const d = data({ transfers: [save(70000, MON)], restDays: [rest('2026-11-21')] });
    const w = weekProgress(d, FRI);
    expect(w.workingDaysRemaining).toBe(2);
    expect(w.requiredPerDay).toBe(15000);
  });
  it('6b. marking today as a rest day sets today target to 0 and does not count as failed', () => {
    const d = data({ transfers: [save(70000, MON)], restDays: [rest(FRI)] });
    const w = weekProgress(d, FRI);
    expect(w.todayIsRest).toBe(true);
    expect(w.todayTarget).toBe(0);
    expect(w.requiredPerDay).toBe(15000);
  });
  it('6c. recurring rest weekday can be overridden to a working day', () => {
    const d = data({ transfers: [save(70000, MON)], settings: settings({ recurringRestWeekdays: [6] }) });
    expect(weekProgress(d, FRI).workingDaysRemaining).toBe(2);
    const d2 = { ...d, restDays: [{ date: SUN, type: 'work' as const, createdAt: 0 }] };
    expect(weekProgress(d2, FRI).workingDaysRemaining).toBe(3);
  });
  it('7. weekly target achievement is detected (and not claimed falsely)', () => {
    expect(weekProgress(data({ transfers: [save(99900, MON)] }), FRI).status).not.toBe('achieved');
    expect(weekProgress(data({ transfers: [save(100000, MON)] }), FRI).status).toBe('achieved');
  });
  it('7b. withdrawals reduce weekly progress', () => {
    const w = weekProgress(data({ transfers: [save(100000, MON), withdraw(20000, THU)] }), FRI);
    expect(w.saved).toBe(80000);
    expect(w.status).not.toBe('achieved');
  });
  it('insufficient working days when nothing left but goal incomplete', () => {
    const d = data({ transfers: [save(50000, MON)], restDays: [rest(SUN)] });
    const w = weekProgress(d, SUN);
    expect(w.workingDaysRemaining).toBe(0);
    expect(w.status).toBe('insufficient-days');
    expect(w.requiredPerDay).toBeNull();
  });
});

describe('8: weekly recovery', () => {
  it('8. shortfall suggestion never exceeds safe-to-spend', () => {
    const d = data({ transfers: [save(80000, MON)] });
    const full = recoveryFor(d, '2026-11-23', MON, 500000);
    expect(full.shortfall).toBe(20000);
    expect(full.suggested).toBe(20000);
    const partial = recoveryFor(d, '2026-11-23', MON, 5000);
    expect(partial.suggested).toBe(5000);
    expect(partial.remainingDeficit).toBe(15000);
  });
  it('8b. pending recovery appears for last week and disappears once decided', () => {
    const d = data({ transactions: [income(300000, MON)], transfers: [save(80000, MON)], settings: settings({ emergencyReserve: 0 }) });
    const s = computeSnapshot(d, '2026-11-24');
    expect(s.recovery?.weekStart).toBe(MON);
    expect(s.recovery?.suggested).toBe(20000);
    const decided = { ...d, weeklyRecords: [{ weekStart: MON, goal: 100000, savedBefore: 80000, shortfall: 20000, decision: 'kept' as const, transferred: 0, decidedAt: 0 }] };
    expect(computeSnapshot(decided, '2026-11-24').recovery).toBeNull();
  });
  it('8c. confirming a recovery transfer preserves balance and completes the week', () => {
    const d = data({ transactions: [income(300000, MON)], transfers: [save(80000, MON)], settings: settings({ emergencyReserve: 0 }) });
    const before = computeSnapshot(d, '2026-11-24');
    // transfer made on Tuesday but attributed to last Sunday
    const after = computeSnapshot({ ...d, transfers: [...d.transfers, save(20000, '2026-11-24', SUN)] }, '2026-11-24');
    expect(after.allocation.balance).toBe(before.allocation.balance);
    expect(after.allocation.safeToSpend).toBe(before.allocation.safeToSpend - 20000);
    expect(weekProgress({ ...d, transfers: [...d.transfers, save(20000, '2026-11-24', SUN)] }, '2026-11-24', MON).status).toBe('achieved');
  });
});

describe('9: monthly goal', () => {
  it('9. once the monthly goal is reached, nothing more is required and surplus is spendable', () => {
    const d = data({
      transactions: [income(1000000, '2026-11-02')],
      transfers: [save(400000, '2026-11-10')],
      settings: settings({ emergencyReserve: 0 })
    });
    const s = computeSnapshot(d, THU);
    expect(s.month.achieved).toBe(true);
    expect(s.week.status).toBe('monthly-achieved');
    expect(s.week.todayTarget).toBe(0);
    expect(s.week.requiredPerDay).toBe(0);
    expect(recoveryFor(d, '2026-11-23', MON, s.allocation.safeToSpend).suggested).toBe(0);
    // New surplus income goes fully to safe-to-spend
    const s2 = computeSnapshot({ ...d, transactions: [...d.transactions, income(50000, THU)] }, THU);
    expect(s2.allocation.safeToSpend - s.allocation.safeToSpend).toBe(50000);
  });
  it('9b. monthly cap reduces the weekly requirement near the goal', () => {
    const d = data({ transfers: [save(370000, '2026-11-03')] }); // previous week; 300 DH left for the month
    const w = weekProgress(d, MON);
    expect(w.effectiveRemaining).toBe(30000);
    expect(w.monthlyCapApplied).toBe(true);
  });
  it('estimated completion requires enough data', () => {
    const d = data({ transfers: [save(15000, '2026-11-02')] });
    expect(monthProgress(d, '2026-11-03').estimatedCompletion).toBeNull();
    const d2 = data({ transfers: ['02', '03', '04', '05', '06'].map((x) => save(20000, '2026-11-' + x)) });
    const e = monthProgress(d2, '2026-11-07').estimatedCompletion;
    expect(e).not.toBeNull();
    // 1000 DH saved over 6 elapsed working days (Nov 1–6) → 166.67/day → 3000 left → 18 working days from Nov 7 → Nov 24
    expect(e!.date).toBe('2026-11-24');
    expect(e!.withinMonth).toBe(true);
  });
});

describe('10-12: subscriptions', () => {
  it('10. reservations do not become expenses prematurely', () => {
    const d = data({ transactions: [income(100000, MON)], subscriptions: [sub(25000, 22, MON)], settings: settings({ emergencyReserve: 0 }) });
    const a = computeSnapshot(d, MON).allocation;
    expect(a.balance).toBe(100000);
    expect(a.obligationsRequired).toBe(25000);
    expect(a.safeToSpend).toBe(75000);
    expect(d.transactions.filter((t) => t.kind === 'expense')).toHaveLength(0);
  });
  it('11. paying a subscription records the expense and releases the reservation', () => {
    const s = sub(25000, 22, MON);
    const base = data({ transactions: [income(100000, MON)], subscriptions: [s], settings: settings({ emergencyReserve: 0 }) });
    const before = computeSnapshot(base, '2026-11-22').allocation;
    const tx = expense(25000, '2026-11-22', { subscriptionId: s.id, subscriptionPeriod: '2026-11' });
    const pay: SubscriptionPayment = { id: 'p1', subscriptionId: s.id, period: '2026-11', status: 'paid', amount: 25000, date: '2026-11-22', transactionId: tx.id, createdAt: 0 };
    const paid = data({ ...base, transactions: [...base.transactions, tx], payments: [pay] });
    const after = computeSnapshot(paid, '2026-11-22');
    expect(after.allocation.balance).toBe(75000);
    // Next month's occurrence is now reserved instead of this one.
    expect(after.reserved.map((o) => o.period)).toEqual(['2026-12']);
    expect(before.safeToSpend).toBe(75000);
    expect(after.allocation.safeToSpend).toBe(50000);
  });
  it('11b. a paid period is never reserved or paid twice; skipped periods are released', () => {
    const s = sub(9900, 27, '2026-11-01');
    const payments: SubscriptionPayment[] = [{ id: 'p', subscriptionId: s.id, period: '2026-11', status: 'skipped', amount: 9900, date: THU, createdAt: 0 }];
    expect(nextOccurrence(s, payments, THU)!.period).toBe('2026-12');
  });
  it('11c. overdue unpaid occurrences stay reserved', () => {
    const s = sub(6000, 3, '2026-10-01');
    const r = reservedOccurrences(s, [], THU);
    expect(r.map((o) => o.period)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(r[0].overdue).toBe(true);
  });
  it('12. February and short months are clamped', () => {
    expect(dueDateFor(31, '2026-02')).toBe('2026-02-28');
    expect(dueDateFor(31, '2028-02')).toBe('2028-02-29');
    expect(dueDateFor(31, '2026-04')).toBe('2026-04-30');
    expect(dueDateFor(30, '2026-02')).toBe('2026-02-28');
    const s = sub(10000, 31, '2026-02-01');
    expect(nextOccurrence(s, [], '2026-02-10')!.dueDate).toBe('2026-02-28');
    expect(firstPeriod({ renewalDay: 31, startDate: '2026-03-31' })).toBe('2026-03');
  });
  it('inactive subscriptions reserve nothing', () => {
    const s = sub(25000, 22, MON, { active: false });
    expect(computeSnapshot(data({ subscriptions: [s] }), MON).allocation.obligationsRequired).toBe(0);
  });
});

describe('13-14: corrections and history', () => {
  it('13. editing and deleting transactions recalculates reports', () => {
    const t = income(50000, MON);
    const d = data({ transactions: [t, expense(10000, MON)] });
    const a1 = analyze(d, THU, '2026-11-01', '2026-11-30');
    expect(a1.income.total).toBe(50000);
    const edited = data({ ...d, transactions: [{ ...t, amount: 70000 }, d.transactions[1]] });
    expect(analyze(edited, THU, '2026-11-01', '2026-11-30').income.total).toBe(70000);
    expect(actualBalance(edited.transactions)).toBe(60000);
    const deleted = data({ ...d, transactions: [d.transactions[1]] });
    expect(analyze(deleted, THU, '2026-11-01', '2026-11-30').income.total).toBe(0);
    expect(actualBalance(deleted.transactions)).toBe(-10000);
    // moving a transaction to another month moves it in monthly summaries
    const moved = data({ ...d, transactions: [{ ...t, date: '2026-10-30' }, d.transactions[1]] });
    const ms = monthSummaries(moved, THU, 2);
    expect(ms[0].income).toBe(50000);
    expect(ms[1].income).toBe(0);
  });
  it('14. historical records stay correct when a new month begins', () => {
    const d = data({ transactions: [income(600000, '2026-11-05')], transfers: [save(250000, '2026-11-10')] });
    const dec = computeSnapshot(d, '2026-12-01');
    expect(dec.month.saved).toBe(0); // new month starts at 0
    expect(dec.month.goal).toBe(400000);
    expect(dec.allocation.balance).toBe(600000); // balance not reset
    expect(dec.allocation.savings).toBe(250000); // savings preserved
    expect(monthProgress(d, '2026-12-01', '2026-11').saved).toBe(250000);
    expect(monthProgress(d, '2026-12-01', '2026-11').achieved).toBe(false);
  });
  it('14b. changing targets does not rewrite history', () => {
    const goals = [goal('2020-01-01', 15000, 100000, 400000), goal('2026-12-01', 20000, 150000, 500000)];
    const d = data({ goals, transfers: [save(100000, '2026-11-10')] });
    expect(monthProgress(d, '2026-12-05', '2026-11').goal).toBe(400000);
    expect(monthProgress(d, '2026-12-05', '2026-12').goal).toBe(500000);
    const hist = weeklyHistory(d, '2026-12-05', '2026-11-10');
    expect(hist.find((w) => w.weekStart === '2026-11-09')!.goal).toBe(100000);
    expect(hist.find((w) => w.weekStart === '2026-11-09')!.achieved).toBe(true);
  });
});

describe('analytics, forecast, health', () => {
  it('opening balance is excluded from income analytics but included in balance', () => {
    const d = data({ transactions: [income(500000, '2026-11-01', { isOpening: true }), income(20000, MON)] });
    expect(actualBalance(d.transactions)).toBe(520000);
    expect(analyze(d, THU, '2026-11-01', '2026-11-30').income.total).toBe(20000);
  });
  it('does not forecast with insufficient history', () => {
    const d = data({ transactions: [income(20000, MON)] });
    expect(forecast(d, THU, 0).available).toBe(false);
  });
  it('forecasts with enough history', () => {
    const txs = Array.from({ length: 20 }, (_, i) => income(30000, addDays('2026-10-28', i)));
    const f = forecast(data({ transactions: txs }), THU, 100000);
    expect(f.available).toBe(true);
    expect(f.projectedIncome).toBeGreaterThan(0);
  });
  it('health score is withheld without enough data', () => {
    const d = data({ transactions: [income(20000, MON)] });
    const h = financialHealth(d, THU, computeSnapshot(d, THU).allocation);
    expect(h.score).toBeNull();
  });
  it('pending recovery ignores weeks before the user started', () => {
    const d = data({ transactions: [income(20000, '2026-11-24')] });
    expect(pendingRecovery(d, '2026-11-24', 0, '2026-11-24')).toBeNull();
  });
  it('savingsBetween uses the attribution date', () => {
    expect(savingsBetween([save(100, '2026-11-24', SUN)], MON, SUN)).toBe(100);
  });
});
