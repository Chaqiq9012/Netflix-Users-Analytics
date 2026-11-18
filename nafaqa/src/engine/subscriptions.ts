import { addMonths, daysInMonth, diffDays, monthKey, type ISODate } from './dates';
import type { Cents } from './money';
import type { Subscription, SubscriptionPayment } from './types';

/** Due date of a subscription in a given month; renewal day is clamped to the month length (Feb, 30-day months). */
export function dueDateFor(renewalDay: number, period: string): ISODate {
  const day = Math.min(Math.max(1, Math.floor(renewalDay)), daysInMonth(period));
  return `${period}-${String(day).padStart(2, '0')}`;
}

/** First period whose due date is on/after startDate. */
export function firstPeriod(sub: Pick<Subscription, 'renewalDay' | 'startDate'>): string {
  const p = monthKey(sub.startDate);
  return dueDateFor(sub.renewalDay, p) >= sub.startDate ? p : addMonths(p, 1);
}

export interface Occurrence {
  subscriptionId: string;
  period: string;
  dueDate: ISODate;
  amount: Cents;
  status: 'paid' | 'skipped' | 'open';
  payment?: SubscriptionPayment;
  overdue: boolean;
  daysUntil: number;
}

const MAX_SCAN = 36;

/** Occurrences from the first period up to (and including) `untilPeriod`. */
export function occurrences(
  sub: Subscription,
  payments: SubscriptionPayment[],
  today: ISODate,
  untilPeriod: string
): Occurrence[] {
  const byPeriod = new Map(payments.filter((p) => p.subscriptionId === sub.id).map((p) => [p.period, p]));
  const out: Occurrence[] = [];
  let p = firstPeriod(sub);
  // Do not scan unbounded history.
  const lowest = addMonths(untilPeriod, -MAX_SCAN);
  if (p < lowest) p = lowest;
  for (; p <= untilPeriod; p = addMonths(p, 1)) {
    const dueDate = dueDateFor(sub.renewalDay, p);
    const payment = byPeriod.get(p);
    const status = payment ? payment.status : 'open';
    out.push({
      subscriptionId: sub.id,
      period: p,
      dueDate,
      amount: payment?.amount ?? sub.amount,
      status,
      payment,
      overdue: status === 'open' && dueDate < today,
      daysUntil: diffDays(dueDate, today)
    });
  }
  return out;
}

/** The next unresolved occurrence (may be overdue). Null for inactive subscriptions. */
export function nextOccurrence(sub: Subscription, payments: SubscriptionPayment[], today: ISODate): Occurrence | null {
  if (!sub.active) return null;
  const until = addMonths(monthKey(today), 13);
  return occurrences(sub, payments, today, until).find((o) => o.status === 'open') ?? null;
}

/**
 * Open occurrences that must be reserved now: every overdue unpaid occurrence plus the
 * next upcoming one. Reservations are NOT expenses; they only reduce safe-to-spend.
 */
export function reservedOccurrences(sub: Subscription, payments: SubscriptionPayment[], today: ISODate): Occurrence[] {
  if (!sub.active) return [];
  const until = addMonths(monthKey(today), 13);
  const all = occurrences(sub, payments, today, until);
  const open = all.filter((o) => o.status === 'open');
  const overdue = open.filter((o) => o.dueDate < today);
  const upcoming = open.find((o) => o.dueDate >= today);
  return upcoming ? [...overdue, upcoming] : overdue;
}

export function totalReserved(subs: Subscription[], payments: SubscriptionPayment[], today: ISODate): Cents {
  let t = 0;
  for (const s of subs) for (const o of reservedOccurrences(s, payments, today)) t += o.amount;
  return t;
}

export function monthlyCommitment(subs: Subscription[]): Cents {
  return subs.filter((s) => s.active).reduce((a, s) => a + s.amount, 0);
}

/** All open occurrences due within [today, today+days] plus overdue ones, sorted by date. */
export function upcomingWithin(subs: Subscription[], payments: SubscriptionPayment[], today: ISODate, days: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (const s of subs) for (const o of reservedOccurrences(s, payments, today)) if (o.daysUntil <= days) out.push(o);
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Open occurrences for all active subs with due date in the given month (for calendar/forecasts). */
export function occurrencesInMonth(subs: Subscription[], payments: SubscriptionPayment[], today: ISODate, month: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const s of subs) {
    if (!s.active && !payments.some((p) => p.subscriptionId === s.id && p.period === month)) continue;
    if (firstPeriod(s) > month) continue;
    if (s.cancelledAt && s.cancelledAt < dueDateFor(s.renewalDay, month) && !payments.some((p) => p.subscriptionId === s.id && p.period === month)) continue;
    const occ = occurrences(s, payments, today, month).find((o) => o.period === month);
    if (occ) out.push(occ);
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
