import {
  addDays, eachDay, endOfMonth, endOfWeek, minDate, monthKey, startOfMonth, startOfWeek, weekday, type ISODate
} from './dates';
import { savingsBetween, savingsDelta } from './ledger';
import { ceilDirham, type Cents } from './money';
import type { GoalTarget, RestDay, Settings, Transfer, WeeklyRecord } from './types';

export const DEFAULT_TARGETS = { daily: 15000, weekly: 100000, monthly: 400000 };

/** Target in effect on a given date (latest row with effectiveFrom <= date; earliest row otherwise). */
export function targetsOn(goals: GoalTarget[], date: ISODate): { daily: Cents; weekly: Cents; monthly: Cents } {
  if (!goals.length) return DEFAULT_TARGETS;
  const sorted = [...goals].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.createdAt - b.createdAt);
  let cur = sorted[0];
  for (const g of sorted) if (g.effectiveFrom <= date) cur = g;
  return { daily: cur.daily, weekly: cur.weekly, monthly: cur.monthly };
}

export class RestCalendar {
  private map: Map<ISODate, RestDay['type']>;
  constructor(restDays: RestDay[], private recurring: number[] = []) {
    this.map = new Map(restDays.map((r) => [r.date, r.type]));
  }
  isRest(d: ISODate): boolean {
    const o = this.map.get(d);
    if (o) return o === 'rest';
    return this.recurring.includes(weekday(d));
  }
  /** Explicit marker only (for UI). */
  override(d: ISODate) {
    return this.map.get(d);
  }
  workingDays(from: ISODate, to: ISODate): number {
    if (from > to) return 0;
    let n = 0;
    for (const d of eachDay(from, to)) if (!this.isRest(d)) n++;
    return n;
  }
}

export type WeekStatus = 'comfortable' | 'on-track' | 'catch-up' | 'achieved' | 'monthly-achieved' | 'insufficient-days';

export interface WeekProgress {
  weekStart: ISODate;
  weekEnd: ISODate;
  goal: Cents;
  dailyReference: Cents;
  saved: Cents;
  savedBeforeToday: Cents;
  savedToday: Cents;
  remaining: Cents; // weekly goal − saved (≥0)
  /** Remaining that is still required after applying the monthly cap. */
  effectiveRemaining: Cents;
  progress: number; // 0..1
  workingDaysTotal: number;
  /** Working days from today (inclusive) through Sunday. */
  workingDaysRemaining: number;
  /** Working days still available for the remaining amount (excludes today once today's target is met). */
  workingDaysForward: number;
  todayIsRest: boolean;
  todayTarget: Cents;
  todayMet: boolean;
  /** Required per remaining working day, rounded up to whole dirhams. null when no working days remain. */
  requiredPerDay: Cents | null;
  monthlyCapApplied: boolean;
  status: WeekStatus;
}

export interface SavingsInput {
  transfers: Transfer[];
  goals: GoalTarget[];
  restDays: RestDay[];
  settings: Pick<Settings, 'recurringRestWeekdays'>;
}

/**
 * Dynamic daily target.
 *   today's target = ceil( remaining-at-start-of-today / working days from today ) — fixed for the day
 *   required per day = ceil( live remaining / working days still available )
 * The monthly goal caps what is still required (no forced contributions once it is reached).
 */
export function weekProgress(input: SavingsInput, today: ISODate, weekOf: ISODate = today): WeekProgress {
  const cal = new RestCalendar(input.restDays, input.settings.recurringRestWeekdays);
  const weekStart = startOfWeek(weekOf);
  const weekEnd = endOfWeek(weekOf);
  const evalDate = minDate(today, weekEnd);
  const t = targetsOn(input.goals, evalDate);
  const goal = t.weekly;

  const inWeek = today >= weekStart && today <= weekEnd;
  const isPast = today > weekEnd;
  const saved = savingsBetween(input.transfers, weekStart, weekEnd);
  const savedToday = inWeek ? savingsBetween(input.transfers, today, today) : 0;
  const savedBeforeToday = inWeek ? savingsBetween(input.transfers, weekStart, addDays(today, -1)) : saved;

  // Monthly cap (month of the evaluation date).
  const mStart = startOfMonth(evalDate);
  const mEnd = endOfMonth(evalDate);
  const monthGoal = targetsOn(input.goals, minDate(today, mEnd)).monthly;
  const monthSaved = savingsBetween(input.transfers, mStart, mEnd);
  const monthSavedBefore = inWeek ? savingsBetween(input.transfers, mStart, addDays(today, -1)) : monthSaved;
  const monthRemaining = Math.max(0, monthGoal - monthSaved);
  const monthRemainingStart = Math.max(0, monthGoal - monthSavedBefore);

  const remaining = Math.max(0, goal - saved);
  const effectiveRemaining = Math.min(remaining, monthRemaining);
  const monthlyCapApplied = effectiveRemaining < remaining;

  const workingDaysTotal = cal.workingDays(weekStart, weekEnd);
  const workingDaysRemaining = isPast ? 0 : cal.workingDays(inWeek ? today : weekStart, weekEnd);
  const todayIsRest = inWeek && cal.isRest(today);

  let todayTarget = 0;
  if (inWeek && !todayIsRest && workingDaysRemaining > 0) {
    const startRem = Math.min(Math.max(0, goal - savedBeforeToday), monthRemainingStart);
    todayTarget = ceilDirham(Math.ceil(startRem / workingDaysRemaining));
  }
  const todayMet = inWeek && !todayIsRest && savedToday >= todayTarget;

  let workingDaysForward = workingDaysRemaining;
  if (inWeek && !todayIsRest && todayMet) workingDaysForward = Math.max(0, workingDaysRemaining - 1);

  let requiredPerDay: Cents | null;
  if (effectiveRemaining === 0) requiredPerDay = 0;
  else if (workingDaysForward > 0) requiredPerDay = ceilDirham(Math.ceil(effectiveRemaining / workingDaysForward));
  else requiredPerDay = null;

  let status: WeekStatus;
  if (goal > 0 && saved >= goal) status = 'achieved';
  else if (monthGoal > 0 && monthRemaining === 0) status = 'monthly-achieved';
  else if (effectiveRemaining === 0) status = 'achieved';
  else if (requiredPerDay === null) status = 'insufficient-days';
  else if (requiredPerDay > t.daily) status = 'catch-up';
  else if (todayMet && todayTarget > 0) status = 'on-track';
  else status = 'comfortable';

  return {
    weekStart, weekEnd, goal, dailyReference: t.daily, saved, savedBeforeToday, savedToday,
    remaining, effectiveRemaining, progress: goal > 0 ? Math.min(1, Math.max(0, saved) / goal) : 1,
    workingDaysTotal, workingDaysRemaining, workingDaysForward, todayIsRest, todayTarget, todayMet,
    requiredPerDay, monthlyCapApplied, status
  };
}

export interface MonthProgress {
  month: string;
  goal: Cents;
  saved: Cents;
  remaining: Cents;
  progress: number;
  achieved: boolean;
  achievedOn: ISODate | null;
  weeks: { weekStart: ISODate; from: ISODate; to: ISODate; saved: Cents }[];
  /** Estimate; null when there isn't enough data. */
  estimatedCompletion: { date: ISODate; withinMonth: boolean } | null;
  estimateReason: string;
}

export function monthProgress(input: SavingsInput, today: ISODate, month: string = monthKey(today)): MonthProgress {
  const cal = new RestCalendar(input.restDays, input.settings.recurringRestWeekdays);
  const mStart = `${month}-01`;
  const mEnd = endOfMonth(mStart);
  const goal = targetsOn(input.goals, minDate(today, mEnd)).monthly;
  const saved = savingsBetween(input.transfers, mStart, mEnd);
  const remaining = Math.max(0, goal - saved);

  // Weekly breakdown: contributions in the month, grouped by week (no double counting — split by date).
  const weeks: MonthProgress['weeks'] = [];
  for (let ws = startOfWeek(mStart); ws <= mEnd; ws = addDays(ws, 7)) {
    const from = ws < mStart ? mStart : ws;
    const to = minDate(addDays(ws, 6), mEnd);
    weeks.push({ weekStart: ws, from, to, saved: savingsBetween(input.transfers, from, to) });
  }

  // Date the goal was crossed (cumulative, in date order).
  let achievedOn: ISODate | null = null;
  if (goal > 0 && saved >= goal) {
    const rel = input.transfers.filter((t) => t.periodDate >= mStart && t.periodDate <= mEnd).sort((a, b) => a.periodDate.localeCompare(b.periodDate) || a.createdAt - b.createdAt);
    let cum = 0;
    for (const t of rel) {
      cum += savingsDelta(t);
      if (cum >= goal) { achievedOn = t.periodDate; break; }
    }
  }

  let estimatedCompletion: MonthProgress['estimatedCompletion'] = null;
  let estimateReason = '';
  if (remaining > 0 && today >= mStart && today <= mEnd) {
    const elapsedEnd = addDays(today, -1);
    const elapsedWorking = cal.workingDays(mStart, elapsedEnd);
    const savedElapsed = savingsBetween(input.transfers, mStart, elapsedEnd);
    if (elapsedWorking < 3 || savedElapsed <= 0) {
      estimateReason = 'Not enough savings history this month to estimate a completion date yet.';
    } else {
      const pace = savedElapsed / elapsedWorking; // centimes per working day (estimate only)
      const need = remaining;
      let daysNeeded = Math.max(1, Math.ceil(need / pace - 1e-9));
      let d = addDays(today, -1);
      let guard = 0;
      while (daysNeeded > 0 && guard < 400) {
        d = addDays(d, 1);
        if (!cal.isRest(d)) daysNeeded--;
        guard++;
      }
      estimatedCompletion = { date: d, withinMonth: d <= mEnd };
      estimateReason = 'Based on your average of ' + Math.round(pace / 100) + ' DH saved per working day this month.';
    }
  }

  return { month, goal, saved, remaining, progress: goal > 0 ? Math.min(1, Math.max(0, saved) / goal) : 1, achieved: goal > 0 && saved >= goal, achievedOn, weeks, estimatedCompletion, estimateReason };
}

export interface WeekHistoryRow {
  weekStart: ISODate;
  weekEnd: ISODate;
  goal: Cents;
  saved: Cents;
  achieved: boolean;
  shortfall: Cents;
  decision: WeeklyRecord['decision'] | null;
  recovered: Cents;
  complete: boolean;
}

/** Week-by-week history from `firstDate` until the current week. */
export function weeklyHistory(input: SavingsInput & { weeklyRecords: WeeklyRecord[] }, today: ISODate, firstDate: ISODate): WeekHistoryRow[] {
  const recs = new Map(input.weeklyRecords.map((r) => [r.weekStart, r]));
  const rows: WeekHistoryRow[] = [];
  for (let ws = startOfWeek(firstDate); ws <= today; ws = addDays(ws, 7)) {
    const we = addDays(ws, 6);
    const rec = recs.get(ws);
    const goal = rec?.goal ?? targetsOn(input.goals, minDate(today, we)).weekly;
    const saved = savingsBetween(input.transfers, ws, we);
    rows.push({
      weekStart: ws, weekEnd: we, goal, saved,
      achieved: saved >= goal,
      shortfall: Math.max(0, goal - saved),
      decision: rec?.decision ?? null,
      recovered: rec?.transferred ?? 0,
      complete: we < today
    });
  }
  return rows.reverse();
}
