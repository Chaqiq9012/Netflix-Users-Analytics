import Dexie, { type Table } from 'dexie';
import type {
  Account, AuditLog, Category, DailySnapshot, GoalTarget, MonthlyRecord, PocketDef, RestDay, Settings,
  Subscription, SubscriptionPayment, Transaction, Transfer, WeeklyRecord
} from '../engine';

export class NafaqaDB extends Dexie {
  settings!: Table<Settings, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  transfers!: Table<Transfer, string>;
  pockets!: Table<PocketDef, string>;
  subscriptions!: Table<Subscription, string>;
  payments!: Table<SubscriptionPayment, string>;
  restDays!: Table<RestDay, string>;
  goals!: Table<GoalTarget, string>;
  weeklyRecords!: Table<WeeklyRecord, string>;
  monthlyRecords!: Table<MonthlyRecord, string>;
  dailySnapshots!: Table<DailySnapshot, string>;
  auditLogs!: Table<AuditLog, number>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      settings: 'id',
      accounts: 'id',
      categories: 'id, kind',
      transactions: 'id, date, kind, categoryId, subscriptionId',
      transfers: 'id, date, periodDate',
      pockets: 'id',
      subscriptions: 'id',
      payments: 'id, subscriptionId, &[subscriptionId+period]',
      restDays: 'date',
      goals: 'id, effectiveFrom',
      weeklyRecords: 'weekStart',
      monthlyRecords: 'month',
      dailySnapshots: 'date',
      auditLogs: '++id, at, entity, entityId'
    });
  }
}

export const DEMO_FLAG = 'nafaqa:demo';
export function isDemoMode(): boolean {
  try { return localStorage.getItem(DEMO_FLAG) === '1'; } catch { return false; }
}

/** Real data and demo data live in separate databases, so demo mode never touches real records. */
export const db = new NafaqaDB(typeof localStorage !== 'undefined' && isDemoMode() ? 'nafaqa-demo' : 'nafaqa');

export const ALL_TABLES = [
  'settings', 'accounts', 'categories', 'transactions', 'transfers', 'pockets', 'subscriptions', 'payments',
  'restDays', 'goals', 'weeklyRecords', 'monthlyRecords', 'dailySnapshots', 'auditLogs'
] as const;
