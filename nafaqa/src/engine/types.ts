import type { Cents } from './money';
import type { ISODate } from './dates';

export type TxKind = 'income' | 'expense';

export interface Transaction {
  id: string;
  kind: TxKind;
  amount: Cents; // always positive
  description: string;
  categoryId: string;
  date: ISODate;
  notes?: string;
  accountId?: string;
  /** Opening balance entries count toward balance but not income analytics. */
  isOpening?: boolean;
  subscriptionId?: string;
  subscriptionPeriod?: string;
  createdAt: number;
  updatedAt: number;
}

/** Ledger pockets that hold money through explicit transfers. */
export type PocketId = 'spendable' | 'savings' | 'holding';

export type TransferSource = 'manual' | 'income-allocation' | 'weekly-recovery' | 'deficit-cover';

export interface Transfer {
  id: string;
  from: PocketId;
  to: PocketId;
  amount: Cents;
  date: ISODate; // when the move happened
  /** Date the transfer is attributed to for weekly/monthly goals (usually = date). */
  periodDate: ISODate;
  note?: string;
  source: TransferSource;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  kind: TxKind;
  icon: string;
  builtin: boolean;
  archived?: boolean;
  order: number;
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'wallet';
  archived?: boolean;
  createdAt: number;
}

export interface Subscription {
  id: string;
  name: string;
  amount: Cents;
  renewalDay: number; // 1..31, clamped to month length
  categoryId: string;
  description?: string;
  active: boolean;
  reminderDays: number; // 0 = no reminder
  startDate: ISODate; // first occurrence is the first due date >= startDate
  cancelledAt?: ISODate;
  createdAt: number;
}

export interface SubscriptionPayment {
  id: string;
  subscriptionId: string;
  period: string; // YYYY-MM
  status: 'paid' | 'skipped';
  amount: Cents;
  date: ISODate;
  transactionId?: string;
  createdAt: number;
}

/** Explicit per-date override. "rest" marks a rest day; "work" overrides a recurring rest weekday. */
export interface RestDay {
  date: ISODate;
  type: 'rest' | 'work';
  note?: string;
  createdAt: number;
}

/** Target history: changing targets creates a new row effective from that date. */
export interface GoalTarget {
  id: string;
  effectiveFrom: ISODate;
  daily: Cents;
  weekly: Cents;
  monthly: Cents;
  createdAt: number;
}

export interface WeeklyRecord {
  weekStart: ISODate;
  goal: Cents;
  savedBefore: Cents;
  shortfall: Cents; // shortfall remaining after the decision
  decision: 'transferred' | 'kept';
  transferId?: string;
  transferred: Cents;
  decidedAt: number;
}

export interface MonthlyRecord {
  month: string;
  goal: Cents;
  saved: Cents;
  income: Cents;
  expenses: Cents;
  achieved: boolean;
  closedAt: number;
}

export interface DailySnapshot {
  date: ISODate;
  balance: Cents;
  savings: Cents;
  safeToSpend: Cents;
  reserved: Cents;
}

export interface AuditLog {
  id?: number;
  at: number;
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  summary: string;
  before?: unknown;
  after?: unknown;
}

export interface PocketDef {
  id: 'savings' | 'obligations' | 'emergency' | 'spendable' | 'holding';
  name: string;
  kind: 'ledger' | 'computed';
  description: string;
  order: number;
}

export interface Settings {
  id: 'main';
  userName: string;
  currency: 'MAD';
  timezone: string;
  weekStart: 'monday';
  emergencyReserve: Cents;
  /** Weekdays (0=Mon..6=Sun) treated as rest days unless overridden on a date. */
  recurringRestWeekdays: number[];
  /** Day of month (1–31) the financial month starts on; 1 = calendar months. */
  monthStartDay?: number;
  notifications: { bills: boolean; dailyTarget: boolean; weeklyRecovery: boolean; browser: boolean };
  hideAmounts: boolean;
  promptSaveOnIncome: boolean;
  onboarded: boolean;
}

export interface FinanceData {
  settings: Settings;
  transactions: Transaction[];
  transfers: Transfer[];
  categories: Category[];
  accounts: Account[];
  subscriptions: Subscription[];
  payments: SubscriptionPayment[];
  restDays: RestDay[];
  goals: GoalTarget[];
  weeklyRecords: WeeklyRecord[];
  monthlyRecords: MonthlyRecord[];
}
