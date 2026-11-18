import type { FinanceData, Transaction, Transfer, Subscription, Settings, RestDay, GoalTarget } from '../src/engine';

let n = 0;
const id = () => 'id' + ++n;

export const settings = (over: Partial<Settings> = {}): Settings => ({
  id: 'main', userName: 'Test', currency: 'MAD', timezone: 'Africa/Casablanca', weekStart: 'monday',
  emergencyReserve: 50000, recurringRestWeekdays: [], notifications: { bills: true, dailyTarget: true, weeklyRecovery: true, browser: false },
  hideAmounts: false, promptSaveOnIncome: true, onboarded: true, ...over
});

export const goal = (effectiveFrom = '2020-01-01', daily = 15000, weekly = 100000, monthly = 400000): GoalTarget => ({ id: id(), effectiveFrom, daily, weekly, monthly, createdAt: n });

export function data(over: Partial<FinanceData> = {}): FinanceData {
  return {
    settings: settings(), transactions: [], transfers: [], categories: [], accounts: [], subscriptions: [], payments: [],
    restDays: [], goals: [goal()], weeklyRecords: [], monthlyRecords: [], ...over
  };
}

export const income = (amount: number, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: id(), kind: 'income', amount, description: 'work', categoryId: 'inc-daily', date, createdAt: n, updatedAt: n, ...extra
});
export const expense = (amount: number, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: id(), kind: 'expense', amount, description: 'spend', categoryId: 'exp-food', date, createdAt: n, updatedAt: n, ...extra
});
export const save = (amount: number, date: string, periodDate = date): Transfer => ({
  id: id(), from: 'spendable', to: 'savings', amount, date, periodDate, source: 'manual', createdAt: ++n
});
export const withdraw = (amount: number, date: string): Transfer => ({
  id: id(), from: 'savings', to: 'spendable', amount, date, periodDate: date, source: 'manual', createdAt: ++n
});
export const rest = (date: string): RestDay => ({ date, type: 'rest', createdAt: 0 });
export const sub = (amount: number, renewalDay: number, startDate: string, extra: Partial<Subscription> = {}): Subscription => ({
  id: id(), name: 'Sub', amount, renewalDay, categoryId: 'exp-bills', active: true, reminderDays: 2, startDate, createdAt: 0, ...extra
});
