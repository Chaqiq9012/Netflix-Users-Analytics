import type { ISODate } from './dates';
import type { Cents } from './money';
import type { PocketId, Transaction, Transfer } from './types';

/** Actual money: income increases, expenses decrease. Transfers never change it. */
export function actualBalance(txs: Transaction[], asOf?: ISODate): Cents {
  let b = 0;
  for (const t of txs) {
    if (asOf && t.date > asOf) continue;
    b += t.kind === 'income' ? t.amount : -t.amount;
  }
  return b;
}

/** Balance of a ledger pocket (savings / holding) from transfers. Spendable is derived, not ledgered. */
export function pocketLedger(transfers: Transfer[], pocket: PocketId, asOf?: ISODate): Cents {
  let b = 0;
  for (const t of transfers) {
    if (asOf && t.date > asOf) continue;
    if (t.to === pocket) b += t.amount;
    if (t.from === pocket) b -= t.amount;
  }
  return b;
}

export interface Allocation {
  balance: Cents;
  savings: Cents; // protected savings (ledger)
  holding: Cents; // unallocated holding (ledger)
  obligationsRequired: Cents;
  obligationsCovered: Cents;
  emergencyRequired: Cents;
  emergencyCovered: Cents;
  /** Safe to spend = balance − savings − holding − reserved obligations − emergency reserve (never negative). */
  safeToSpend: Cents;
  /** Money missing to cover every protected amount (0 when fully covered). */
  deficit: Cents;
  /** Portion of protected savings no longer backed by actual money. */
  savingsUnbacked: Cents;
}

/**
 * Waterfall allocation of actual money. Priority: savings → holding → obligations → emergency → spendable.
 * Each centime is counted exactly once; shortages are reported as a deficit, never as negative pockets.
 */
export function allocate(balance: Cents, savings: Cents, holding: Cents, obligations: Cents, emergency: Cents): Allocation {
  let rem = balance;
  const savingsBacked = Math.min(savings, Math.max(0, rem));
  rem -= savings;
  rem -= holding;
  const obligationsCovered = Math.min(obligations, Math.max(0, rem));
  rem -= obligations;
  const emergencyCovered = Math.min(emergency, Math.max(0, rem));
  rem -= emergency;
  return {
    balance,
    savings,
    holding,
    obligationsRequired: obligations,
    obligationsCovered,
    emergencyRequired: emergency,
    emergencyCovered,
    safeToSpend: Math.max(0, rem),
    deficit: Math.max(0, -rem),
    savingsUnbacked: savings - savingsBacked
  };
}

/** Net savings contribution of a transfer (+ into savings, − out of savings, 0 otherwise). */
export function savingsDelta(t: Transfer): Cents {
  if (t.to === 'savings' && t.from !== 'savings') return t.amount;
  if (t.from === 'savings' && t.to !== 'savings') return -t.amount;
  return 0;
}

/** Net savings contributions attributed to [from, to] (by periodDate). Each transfer belongs to exactly one day. */
export function savingsBetween(transfers: Transfer[], from: ISODate, to: ISODate): Cents {
  let s = 0;
  for (const t of transfers) if (t.periodDate >= from && t.periodDate <= to) s += savingsDelta(t);
  return s;
}

export function incomeBetween(txs: Transaction[], from: ISODate, to: ISODate, includeOpening = false): Cents {
  let s = 0;
  for (const t of txs) if (t.kind === 'income' && t.date >= from && t.date <= to && (includeOpening || !t.isOpening)) s += t.amount;
  return s;
}

export function expensesBetween(txs: Transaction[], from: ISODate, to: ISODate): Cents {
  let s = 0;
  for (const t of txs) if (t.kind === 'expense' && t.date >= from && t.date <= to) s += t.amount;
  return s;
}
