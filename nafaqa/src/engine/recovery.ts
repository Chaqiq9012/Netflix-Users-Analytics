import { addDays, endOfWeek, startOfWeek, weekday, type ISODate } from './dates';
import type { Cents } from './money';
import { weekProgress, type SavingsInput } from './savings';
import type { WeeklyRecord } from './types';

export interface RecoverySuggestion {
  weekStart: ISODate;
  weekEnd: ISODate;
  goal: Cents;
  saved: Cents;
  shortfall: Cents;
  available: Cents;
  /** Suggested transfer: never more than what is safe to spend. */
  suggested: Cents;
  remainingDeficit: Cents;
  isCurrentWeek: boolean;
}

/** Shortfall suggestion for a finished (or finishing) week. Never exceeds safe-to-spend. */
export function recoveryFor(input: SavingsInput, today: ISODate, weekOf: ISODate, safeToSpend: Cents): RecoverySuggestion {
  const wp = weekProgress(input, today, weekOf);
  const shortfall = wp.effectiveRemaining;
  const suggested = Math.max(0, Math.min(shortfall, safeToSpend));
  return {
    weekStart: wp.weekStart,
    weekEnd: wp.weekEnd,
    goal: wp.goal,
    saved: wp.saved,
    shortfall,
    available: safeToSpend,
    suggested,
    remainingDeficit: shortfall - suggested,
    isCurrentWeek: today >= wp.weekStart && today <= wp.weekEnd
  };
}

/**
 * The week awaiting a decision: last week if it ended with a shortfall and no decision was recorded,
 * otherwise this week when today is Sunday (the last day).
 */
export function pendingRecovery(
  input: SavingsInput & { weeklyRecords: WeeklyRecord[] },
  today: ISODate,
  safeToSpend: Cents,
  firstActivity: ISODate | null
): RecoverySuggestion | null {
  if (!firstActivity) return null;
  const decided = new Set(input.weeklyRecords.map((r) => r.weekStart));
  const prevStart = addDays(startOfWeek(today), -7);
  const candidates: ISODate[] = [];
  if (endOfWeek(prevStart) >= firstActivity && !decided.has(prevStart)) candidates.push(prevStart);
  if (weekday(today) === 6 && !decided.has(startOfWeek(today))) candidates.push(startOfWeek(today));
  for (const ws of candidates) {
    const r = recoveryFor(input, today, ws, safeToSpend);
    if (r.shortfall > 0) return r;
  }
  return null;
}
