/**
 * Financial month ("period"). A user may start their month on any day, e.g. the 20th:
 * the period keyed "2026-11" then runs 20 Nov – 19 Dec. Day 1 gives ordinary calendar months.
 * Start days beyond a month's length clamp to its last day (31 → 28 Feb).
 */
import { addDays, addMonths, daysInMonth, formatDate, monthKey, monthName, type ISODate } from './dates';

export const normalizeStartDay = (d: unknown): number => {
  const n = Math.floor(Number(d));
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : 1;
};

export const startDayOf = (s?: { monthStartDay?: number } | null): number => normalizeStartDay(s?.monthStartDay ?? 1);

export function periodStart(key: string, startDay: number): ISODate {
  const d = Math.min(normalizeStartDay(startDay), daysInMonth(key));
  return `${key}-${String(d).padStart(2, '0')}`;
}

export const periodEnd = (key: string, startDay: number): ISODate => addDays(periodStart(addMonths(key, 1), startDay), -1);

export function periodRange(key: string, startDay: number): { start: ISODate; end: ISODate } {
  return { start: periodStart(key, startDay), end: periodEnd(key, startDay) };
}

/** Key ("YYYY-MM", the month the period starts in) of the period containing `date`. */
export function periodKeyOf(date: ISODate, startDay: number): string {
  const k = monthKey(date);
  return date >= periodStart(k, startDay) ? k : addMonths(k, -1);
}

export const addPeriods = (key: string, n: number) => addMonths(key, n);

/** "November 2026" for calendar months; "20 Nov – 19 Dec" otherwise. */
export function periodLabel(key: string, startDay: number, long = true): string {
  if (normalizeStartDay(startDay) === 1) return monthName(key, long);
  const { start, end } = periodRange(key, startDay);
  return `${formatDate(start)} – ${formatDate(end)}${long && start.slice(0, 4) !== end.slice(0, 4) ? ' ' + end.slice(0, 4) : ''}`;
}

/** Short label for charts: "Nov" or "20 Nov". */
export function periodShort(key: string, startDay: number): string {
  return normalizeStartDay(startDay) === 1 ? monthName(key, false).split(' ')[0] : formatDate(periodStart(key, startDay));
}
