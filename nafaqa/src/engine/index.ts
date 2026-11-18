export * from './money';
export * from './dates';
export * from './types';
export * from './ledger';
export * from './savings';
export * from './subscriptions';
export * from './recovery';
export * from './analytics';
export * from './health';

import { actualBalance, allocate, pocketLedger, type Allocation } from './ledger';
import { monthProgress, weekProgress, type MonthProgress, type WeekProgress } from './savings';
import { nextOccurrence, reservedOccurrences, totalReserved, type Occurrence } from './subscriptions';
import { pendingRecovery, type RecoverySuggestion } from './recovery';
import { firstActivityDate } from './analytics';
import type { FinanceData } from './types';
import type { ISODate } from './dates';

export interface Snapshot {
  today: ISODate;
  allocation: Allocation;
  week: WeekProgress;
  month: MonthProgress;
  reserved: Occurrence[];
  nextBill: Occurrence | null;
  recovery: RecoverySuggestion | null;
  firstActivity: ISODate | null;
}

/** Single entry point the UI uses: everything derived from stored data + today's date. */
export function computeSnapshot(data: FinanceData, today: ISODate): Snapshot {
  const balance = actualBalance(data.transactions);
  const savings = pocketLedger(data.transfers, 'savings');
  const holding = pocketLedger(data.transfers, 'holding');
  const reserved = data.subscriptions.flatMap((s) => reservedOccurrences(s, data.payments, today)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const obligations = totalReserved(data.subscriptions, data.payments, today);
  const allocation = allocate(balance, savings, holding, obligations, data.settings.emergencyReserve);
  const week = weekProgress(data, today);
  const month = monthProgress(data, today);
  const nexts = data.subscriptions.map((s) => nextOccurrence(s, data.payments, today)).filter((o): o is Occurrence => !!o).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const firstActivity = firstActivityDate(data);
  const recovery = pendingRecovery(data, today, allocation.safeToSpend, firstActivity);
  return { today, allocation, week, month, reserved, nextBill: nexts[0] ?? null, recovery, firstActivity };
}
