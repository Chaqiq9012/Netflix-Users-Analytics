import { addDays, addMonths, diffDays, minDate, startOfWeek, type ISODate } from './dates';
import { periodKeyOf, periodRange, startDayOf } from './period';
import { expensesBetween, incomeBetween, savingsBetween, savingsDelta, type Allocation } from './ledger';
import { formatMoney, type Cents } from './money';
import { RestCalendar, weeklyHistory, type WeekProgress, type MonthProgress } from './savings';
import { firstActivityDate, byCategory } from './analytics';
import type { FinanceData } from './types';

export interface HealthComponent {
  key: string;
  label: string;
  score: number | null; // 0..20, null = not enough data
  max: 20;
  detail: string;
  formula: string;
}

export interface Health {
  score: number | null;
  components: HealthComponent[];
  enoughData: boolean;
  reason: string;
}

const MIN_DAYS = 7;

/**
 * Transparent 100-point score = 5 components × 20 points.
 * The total is only shown once at least 7 days of history and one completed week exist.
 */
export function financialHealth(data: FinanceData, today: ISODate, alloc: Allocation): Health {
  const first = firstActivityDate(data);
  const historyDays = first ? diffDays(today, first) : 0;
  const cal = new RestCalendar(data.restDays, data.settings.recurringRestWeekdays);
  const comps: HealthComponent[] = [];

  // 1. Savings consistency: share of past working days (last 28, since first activity) with a positive contribution.
  {
    const from = first ? (addDays(today, -28) > first ? addDays(today, -28) : first) : today;
    const to = addDays(today, -1);
    let wd = 0, hit = 0;
    if (first && from <= to) {
      const byDay = new Map<string, number>();
      for (const t of data.transfers) byDay.set(t.periodDate, (byDay.get(t.periodDate) ?? 0) + savingsDelta(t));
      for (let d = from; d <= to; d = addDays(d, 1)) {
        if (cal.isRest(d)) continue;
        wd++;
        if ((byDay.get(d) ?? 0) > 0) hit++;
      }
    }
    comps.push({
      key: 'consistency', label: 'Savings consistency', max: 20,
      score: wd >= 5 ? Math.round((hit / wd) * 20) : null,
      detail: wd >= 5 ? `You saved on ${hit} of your last ${wd} working days.` : 'Needs at least 5 past working days.',
      formula: '20 × (working days with savings ÷ working days, last 28 days)'
    });
  }

  // 2. Weekly target completion: last up to 4 completed weeks.
  {
    const weeks = first ? weeklyHistory(data, today, first).filter((w) => w.complete).slice(0, 4) : [];
    const done = weeks.filter((w) => w.achieved).length;
    comps.push({
      key: 'weekly', label: 'Weekly target completion', max: 20,
      score: weeks.length ? Math.round((done / weeks.length) * 20) : null,
      detail: weeks.length ? `${done} of your last ${weeks.length} completed week${weeks.length > 1 ? 's' : ''} reached the goal.` : 'Available after your first full week.',
      formula: '20 × (weeks achieved ÷ last 4 completed weeks)'
    });
  }

  // 3. Spending discipline: expenses ÷ income over last 30 days. ≤60% → 20, ≥100% → 0.
  {
    const from = addDays(today, -29);
    const inc = incomeBetween(data.transactions, from, today);
    const exp = expensesBetween(data.transactions, from, today);
    let score: number | null = null;
    let detail = 'Needs income recorded in the last 30 days.';
    if (inc > 0 && historyDays >= MIN_DAYS) {
      const r = exp / inc;
      score = Math.round(Math.max(0, Math.min(1, (1 - r) / 0.4)) * 20);
      detail = `You spent ${Math.round(r * 100)}% of what you earned in the last 30 days.`;
    }
    comps.push({ key: 'discipline', label: 'Spending discipline', max: 20, score, detail, formula: '20 when expenses ≤ 60% of income, 0 at ≥ 100%, linear between' });
  }

  // 4. Upcoming bill coverage.
  {
    const req = alloc.obligationsRequired;
    const r = req === 0 ? 1 : alloc.obligationsCovered / req;
    comps.push({
      key: 'bills', label: 'Upcoming bill coverage', max: 20, score: Math.round(r * 20),
      detail: req === 0 ? 'No upcoming subscription payments to cover.' : r >= 1 ? 'Your upcoming subscriptions are fully covered.' : `${formatMoney(req - alloc.obligationsCovered)} of upcoming bills is not covered yet.`,
      formula: '20 × (covered obligations ÷ reserved obligations)'
    });
  }

  // 5. Emergency reserve coverage.
  {
    const req = alloc.emergencyRequired;
    const r = req === 0 ? 1 : alloc.emergencyCovered / req;
    comps.push({
      key: 'emergency', label: 'Emergency reserve coverage', max: 20, score: Math.round(r * 20),
      detail: req === 0 ? 'No emergency reserve configured.' : r >= 1 ? `Your ${formatMoney(req)} emergency reserve is fully funded.` : `${formatMoney(req - alloc.emergencyCovered)} missing from your emergency reserve.`,
      formula: '20 × (funded reserve ÷ reserve target)'
    });
  }

  const enoughData = historyDays >= MIN_DAYS && comps.every((c) => c.score !== null);
  return {
    score: enoughData ? comps.reduce((a, c) => a + (c.score ?? 0), 0) : null,
    components: comps,
    enoughData,
    reason: enoughData ? '' : 'Your overall score appears once you have 7+ days of history and a completed week.'
  };
}

export interface Insight { tone: 'good' | 'warn' | 'info'; text: string }

/** Actionable, factual insights. Each is only produced when the data supports it. */
export function insights(data: FinanceData, today: ISODate, alloc: Allocation, week: WeekProgress, month: MonthProgress): Insight[] {
  const out: Insight[] = [];
  const thisWeekStart = startOfWeek(today);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const first = firstActivityDate(data);
  if (!first) return out;

  // Week-over-week savings at the same point of the week.
  const elapsed = diffDays(today, thisWeekStart);
  const thisW = savingsBetween(data.transfers, thisWeekStart, today);
  const lastW = savingsBetween(data.transfers, lastWeekStart, addDays(lastWeekStart, elapsed));
  if (first <= lastWeekStart && lastW > 0 && thisW !== lastW) {
    const pct = Math.round(((thisW - lastW) / lastW) * 100);
    if (Math.abs(pct) >= 5) out.push({ tone: pct > 0 ? 'good' : 'warn', text: `Your weekly savings ${pct > 0 ? 'improved' : 'dropped'} by ${Math.abs(pct)}% compared with the same point last week.` });
  }

  // Category spending changes month over month (same number of days).
  const sd = startDayOf(data.settings);
  const curKey = periodKeyOf(today, sd);
  const mStart = periodRange(curKey, sd).start;
  const dayN = diffDays(today, mStart);
  const prev = periodRange(addMonths(curKey, -1), sd);
  const prevStart = prev.start;
  const prevEnd = minDate(addDays(prevStart, dayN), prev.end);
  if (first <= prevStart) {
    const cur = byCategory(data, 'expense', mStart, today);
    const prev = new Map(byCategory(data, 'expense', prevStart, prevEnd).map((c) => [c.categoryId, c.total]));
    const names = new Map(data.categories.map((c) => [c.id, c.name]));
    for (const c of cur.slice(0, 4)) {
      const p = prev.get(c.categoryId) ?? 0;
      if (p > 0 && c.total - p >= 5000 && c.total / p >= 1.2) {
        out.push({ tone: 'warn', text: `Your ${(names.get(c.categoryId) ?? 'other').toLowerCase()} expenses increased ${Math.round((c.total / p - 1) * 100)}% compared with this point last month.` });
      }
    }
  }

  if (alloc.obligationsRequired > 0) {
    out.push(alloc.obligationsCovered >= alloc.obligationsRequired
      ? { tone: 'good', text: 'Your upcoming subscriptions are fully covered.' }
      : { tone: 'warn', text: `${formatMoney(alloc.obligationsRequired - alloc.obligationsCovered)} of your upcoming subscriptions is not covered yet.` });
  }
  if (alloc.deficit > 0) out.push({ tone: 'warn', text: `Your protected money exceeds your balance by ${formatMoney(alloc.deficit)}. Avoid new spending until it is covered.` });

  if (month.achieved) out.push({ tone: 'good', text: 'Monthly savings goal achieved. Extra income stays available to spend once bills and reserves are covered.' });
  else if (month.estimatedCompletion) {
    out.push(month.estimatedCompletion.withinMonth
      ? { tone: 'good', text: "You're on track to achieve your monthly savings goal at your current pace." }
      : { tone: 'warn', text: `At your current pace you'd reach the monthly goal after the month ends. Aim for ${formatMoney(Math.ceil(month.remaining / 100) * 100)} more this month.` });
  }

  if (week.status === 'catch-up' && week.requiredPerDay) out.push({ tone: 'warn', text: `You need ${formatMoney(week.requiredPerDay)} per working day to finish this week's goal — above your ${formatMoney(week.dailyReference)} reference.` });
  if (week.status === 'achieved') out.push({ tone: 'good', text: "This week's savings goal is complete." });
  return out;
}

export function avgSavedPerWorkingDay(data: FinanceData, from: ISODate, to: ISODate): Cents {
  const cal = new RestCalendar(data.restDays, data.settings.recurringRestWeekdays);
  const wd = cal.workingDays(from, to);
  return wd ? Math.round(savingsBetween(data.transfers, from, to) / wd) : 0;
}
