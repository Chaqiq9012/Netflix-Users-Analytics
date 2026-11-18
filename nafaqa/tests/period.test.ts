import { describe, it, expect } from 'vitest';
import { periodKeyOf, periodRange, periodLabel, monthProgress, weekProgress, computeSnapshot, monthSummaries, forecast } from '../src/engine';
import { data, save, income, settings, sub } from './helpers';

const S20 = settings({ monthStartDay: 20 });

describe('custom month start day', () => {
  it('day 20: period runs 20th → 19th of next month', () => {
    expect(periodRange('2026-11', 20)).toEqual({ start: '2026-11-20', end: '2026-12-19' });
    expect(periodKeyOf('2026-11-19', 20)).toBe('2026-10');
    expect(periodKeyOf('2026-11-20', 20)).toBe('2026-11');
    expect(periodKeyOf('2027-01-05', 20)).toBe('2026-12'); // crosses the year
    expect(periodLabel('2026-11', 20)).toBe('20 Nov – 19 Dec');
    expect(periodLabel('2026-12', 20)).toBe('20 Dec – 19 Jan 2027');
  });
  it('day 1 keeps calendar months', () => {
    expect(periodRange('2026-02', 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(periodLabel('2026-11', 1)).toBe('November 2026');
  });
  it('start day beyond month length clamps (31 → end of Feb)', () => {
    expect(periodRange('2026-01', 31)).toEqual({ start: '2026-01-31', end: '2026-02-27' });
    expect(periodRange('2026-02', 31)).toEqual({ start: '2026-02-28', end: '2026-03-30' });
    expect(periodKeyOf('2026-02-28', 31)).toBe('2026-02');
  });
  it('monthly savings follow the custom period, each contribution counted once', () => {
    const d = data({ settings: S20, transfers: [save(10000, '2026-11-19'), save(20000, '2026-11-20'), save(30000, '2026-12-19'), save(40000, '2026-12-20')] });
    expect(monthProgress(d, '2026-12-01').saved).toBe(50000); // 20 Nov – 19 Dec
    expect(monthProgress(d, '2026-12-01', '2026-10').saved).toBe(10000);
    expect(monthProgress(d, '2026-12-25').saved).toBe(40000);
    const mp = monthProgress(d, '2026-12-01');
    expect(mp.start).toBe('2026-11-20');
    expect(mp.weeks.reduce((a, w) => a + w.saved, 0)).toBe(mp.saved);
  });
  it('a new financial month starts fresh on the 20th, history and balance preserved', () => {
    const d = data({ settings: S20, transactions: [income(600000, '2026-11-01')], transfers: [save(400000, '2026-11-05')] });
    expect(computeSnapshot(d, '2026-11-19').month.achieved).toBe(true);
    const next = computeSnapshot(d, '2026-11-20');
    expect(next.month.saved).toBe(0);
    expect(next.month.achieved).toBe(false);
    expect(next.allocation.balance).toBe(600000);
    expect(next.allocation.savings).toBe(400000);
  });
  it('the weekly monthly-cap uses the financial month', () => {
    // 3,700 saved since Oct 20 → only 300 left in the Oct 20 – Nov 19 period
    const d = data({ settings: S20, transfers: [save(370000, '2026-11-03')] });
    expect(weekProgress(d, '2026-11-16').effectiveRemaining).toBe(30000);
    // After Nov 20 a new period starts: the full weekly goal applies again
    expect(weekProgress(d, '2026-11-23').effectiveRemaining).toBe(100000);
  });
  it('monthly summaries are grouped by financial month', () => {
    const d = data({ settings: S20, transactions: [income(10000, '2026-11-19'), income(20000, '2026-11-20')] });
    const ms = monthSummaries(d, '2026-11-25', 2);
    expect(ms.map((m) => [m.month, m.income])).toEqual([['2026-10', 10000], ['2026-11', 20000]]);
  });
  it('forecast counts bills due before the period ends, across calendar months', () => {
    const txs = Array.from({ length: 20 }, (_, i) => income(30000, `2026-11-${String(i + 1).padStart(2, '0')}`));
    const d = data({ settings: S20, transactions: txs, subscriptions: [sub(25000, 5, '2026-11-01'), sub(9900, 25, '2026-11-01')] });
    // Period 20 Nov – 19 Dec, today 22 Nov: Nov 25 (9900) and Dec 5 (25000) are both still due
    expect(forecast(d, '2026-11-22', 0).upcomingObligations).toBe(34900);
  });
});
