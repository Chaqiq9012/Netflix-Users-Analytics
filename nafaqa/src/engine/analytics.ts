import { addDays, addMonths, diffDays, eachDay, minDate, monthKey, startOfWeek, type ISODate } from './dates';
import { periodKeyOf, periodRange, startDayOf } from './period';
import { expensesBetween, incomeBetween, savingsBetween, savingsDelta } from './ledger';
import type { Cents } from './money';
import { RestCalendar, targetsOn, weeklyHistory } from './savings';
import { occurrencesInMonth } from './subscriptions';
import type { FinanceData } from './types';

/** Averages are shown rounded to whole dirhams. */
const wholeAvg = (c: number) => Math.round(c / 100) * 100;

export interface DayTotal { date: ISODate; income: Cents; expense: Cents; savings: Cents }
export interface CategoryTotal { categoryId: string; total: Cents; count: number; share: number }

export function firstActivityDate(data: Pick<FinanceData, 'transactions' | 'transfers'>): ISODate | null {
  let f: ISODate | null = null;
  for (const t of data.transactions) if (!f || t.date < f) f = t.date;
  for (const t of data.transfers) if (!f || t.date < f) f = t.date;
  return f;
}

export function dailyTotals(data: Pick<FinanceData, 'transactions' | 'transfers'>, from: ISODate, to: ISODate): DayTotal[] {
  const map = new Map<ISODate, DayTotal>();
  for (const d of eachDay(from, to)) map.set(d, { date: d, income: 0, expense: 0, savings: 0 });
  for (const t of data.transactions) {
    const row = map.get(t.date);
    if (!row || t.isOpening) continue;
    if (t.kind === 'income') row.income += t.amount;
    else row.expense += t.amount;
  }
  for (const t of data.transfers) {
    const row = map.get(t.periodDate);
    if (row) row.savings += savingsDelta(t);
  }
  return [...map.values()];
}

export function byCategory(data: Pick<FinanceData, 'transactions'>, kind: 'income' | 'expense', from: ISODate, to: ISODate): CategoryTotal[] {
  const m = new Map<string, { total: number; count: number }>();
  let all = 0;
  for (const t of data.transactions) {
    if (t.kind !== kind || t.isOpening || t.date < from || t.date > to) continue;
    const r = m.get(t.categoryId) ?? { total: 0, count: 0 };
    r.total += t.amount; r.count++;
    m.set(t.categoryId, r);
    all += t.amount;
  }
  return [...m.entries()].map(([categoryId, r]) => ({ categoryId, ...r, share: all ? r.total / all : 0 })).sort((a, b) => b.total - a.total);
}

export interface Analytics {
  from: ISODate;
  to: ISODate;
  days: number;
  hasData: boolean;
  income: { total: Cents; avgDaily: Cents; avgWeekly: Cents; avgPerWorkingDay: Cents; highest: DayTotal | null; lowest: DayTotal | null; earningDays: number; byCategory: CategoryTotal[] };
  expense: { total: Cents; avgDaily: Cents; byCategory: CategoryTotal[]; largest: FinanceData['transactions'] };
  savings: { net: Cents; avgPerWorkingDay: Cents; weeklyCompletionRate: number | null; completedWeeks: number; monthlyCompletionRate: number | null; completedMonths: number; totalAccumulated: Cents };
  series: DayTotal[];
}

export function analyze(data: FinanceData, today: ISODate, from: ISODate, to: ISODate): Analytics {
  const end = minDate(to, today);
  const first = firstActivityDate(data);
  const start = first && first > from ? first : from;
  const days = Math.max(1, diffDays(end, start) + 1);
  const cal = new RestCalendar(data.restDays, data.settings.recurringRestWeekdays);
  const working = Math.max(1, cal.workingDays(start, end));
  const series = start <= end ? dailyTotals(data, start, end) : [];
  const incomeTotal = incomeBetween(data.transactions, start, end);
  const expenseTotal = expensesBetween(data.transactions, start, end);
  const earning = series.filter((d) => d.income > 0);
  const highest = earning.reduce<typeof earning[number] | null>((a, d) => (!a || d.income > a.income ? d : a), null);
  const lowest = earning.reduce<typeof earning[number] | null>((a, d) => (!a || d.income < a.income ? d : a), null);

  const hist = first ? weeklyHistory(data, today, first).filter((w) => w.complete && w.weekEnd >= start && w.weekStart <= end) : [];
  const months: { achieved: boolean }[] = [];
  if (first) {
    const sd = startDayOf(data.settings);
    for (let m = periodKeyOf(first, sd); m < periodKeyOf(today, sd); m = addMonths(m, 1)) {
      const { start: mStart, end: mEnd } = periodRange(m, sd);
      if (mEnd < start || mStart > end) continue;
      const goal = targetsOn(data.goals, mEnd).monthly;
      months.push({ achieved: savingsBetween(data.transfers, mStart, mEnd) >= goal });
    }
  }
  const net = savingsBetween(data.transfers, start, end);
  let totalAcc = 0;
  for (const t of data.transfers) totalAcc += savingsDelta(t);

  return {
    from: start, to: end, days, hasData: !!first && start <= end,
    income: {
      total: incomeTotal,
      avgDaily: wholeAvg(incomeTotal / days),
      avgWeekly: wholeAvg((incomeTotal / days) * 7),
      avgPerWorkingDay: wholeAvg(incomeTotal / working),
      highest, lowest, earningDays: earning.length,
      byCategory: byCategory(data, 'income', start, end)
    },
    expense: {
      total: expenseTotal,
      avgDaily: wholeAvg(expenseTotal / days),
      byCategory: byCategory(data, 'expense', start, end),
      largest: data.transactions.filter((t) => t.kind === 'expense' && t.date >= start && t.date <= end).sort((a, b) => b.amount - a.amount).slice(0, 5)
    },
    savings: {
      net,
      avgPerWorkingDay: wholeAvg(net / working),
      weeklyCompletionRate: hist.length ? hist.filter((w) => w.achieved).length / hist.length : null,
      completedWeeks: hist.length,
      monthlyCompletionRate: months.length ? months.filter((m) => m.achieved).length / months.length : null,
      completedMonths: months.length,
      totalAccumulated: totalAcc
    },
    series
  };
}

export interface MonthSummary { month: string; income: Cents; expenses: Cents; savings: Cents; net: Cents; goal: Cents }
export function monthSummaries(data: FinanceData, today: ISODate, count = 6): MonthSummary[] {
  const out: MonthSummary[] = [];
  const sd = startDayOf(data.settings);
  const cur = periodKeyOf(today, sd);
  for (let i = count - 1; i >= 0; i--) {
    const m = addMonths(cur, -i);
    const { start: s, end: e } = periodRange(m, sd);
    const income = incomeBetween(data.transactions, s, e);
    const expenses = expensesBetween(data.transactions, s, e);
    out.push({ month: m, income, expenses, savings: savingsBetween(data.transfers, s, e), net: income - expenses, goal: targetsOn(data.goals, minDate(today, e)).monthly });
  }
  return out;
}

export interface Forecast {
  available: boolean;
  reason: string;
  historyDays: number;
  monthEndSavings: Cents;
  monthGoal: Cents;
  reachesMonthlyGoal: boolean;
  upcomingObligations: Cents;
  expectedSafeToSpend: Cents;
  projectedIncome: Cents;
  projectedExpenses: Cents;
  remainingWorkingDays: number;
  incomeSufficient: boolean;
}

const MIN_HISTORY_DAYS = 14;
/** Estimates are shown in whole dirhams. */
const wholeDH = (c: number) => Math.round(c / 100) * 100;

/** Estimates based on the last 28 days. Returns available=false when history is insufficient. */
export function forecast(data: FinanceData, today: ISODate, safeToSpendNow: Cents): Forecast {
  const first = firstActivityDate(data);
  const historyDays = first ? diffDays(today, first) : 0;
  const sd = startDayOf(data.settings);
  const { start: mStart, end: mEnd } = periodRange(periodKeyOf(today, sd), sd);
  const monthGoal = targetsOn(data.goals, today).monthly;
  const monthSaved = savingsBetween(data.transfers, mStart, mEnd);
  // Bills due between tomorrow and the end of the financial month (may span two calendar months).
  const occ = [monthKey(mStart), monthKey(mEnd)].filter((m, i, a) => a.indexOf(m) === i)
    .flatMap((m) => occurrencesInMonth(data.subscriptions, data.payments, today, m))
    .filter((o) => o.status === 'open' && o.dueDate > today && o.dueDate <= mEnd);
  const upcomingObligations = occ.reduce((a, o) => a + o.amount, 0);
  const cal = new RestCalendar(data.restDays, data.settings.recurringRestWeekdays);
  const remainingWorkingDays = cal.workingDays(addDays(today, 1), mEnd);
  const base: Forecast = {
    available: false, reason: '', historyDays, monthEndSavings: monthSaved, monthGoal, reachesMonthlyGoal: monthSaved >= monthGoal,
    upcomingObligations, expectedSafeToSpend: safeToSpendNow, projectedIncome: 0, projectedExpenses: 0, remainingWorkingDays, incomeSufficient: false
  };
  if (!first || historyDays < MIN_HISTORY_DAYS) {
    return { ...base, reason: `Forecasts need at least ${MIN_HISTORY_DAYS} days of history (you have ${Math.max(0, historyDays)}).` };
  }
  const winStart = addDays(today, -28) > first ? addDays(today, -28) : first;
  const winEnd = addDays(today, -1);
  const winWorking = Math.max(1, cal.workingDays(winStart, winEnd));
  const winDays = Math.max(1, diffDays(winEnd, winStart) + 1);
  const incPerWork = incomeBetween(data.transactions, winStart, winEnd) / winWorking;
  const expPerDay = expensesBetween(data.transactions, winStart, winEnd) / winDays;
  const savPerWork = Math.max(0, savingsBetween(data.transfers, winStart, winEnd)) / winWorking;
  const remainingDays = diffDays(mEnd, today);
  const projectedIncome = wholeDH(incPerWork * remainingWorkingDays);
  const projectedExpenses = wholeDH(expPerDay * remainingDays);
  const remainingGoal = Math.max(0, monthGoal - monthSaved);
  const projSavings = Math.min(wholeDH(savPerWork * remainingWorkingDays), Math.max(0, remainingGoal));
  const monthEndSavings = monthSaved + projSavings;
  const expectedSafeToSpend = Math.max(0, safeToSpendNow + projectedIncome - projectedExpenses - projSavings);
  return {
    ...base,
    available: true,
    reason: 'Estimated from your last ' + winDays + ' days of activity.',
    monthEndSavings,
    reachesMonthlyGoal: monthEndSavings >= monthGoal,
    expectedSafeToSpend,
    projectedIncome,
    projectedExpenses,
    incomeSufficient: projectedIncome - projectedExpenses >= remainingGoal
  };
}

export function weekStartsBetween(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let w = startOfWeek(from); w <= to; w = addDays(w, 7)) out.push(w);
  return out;
}
