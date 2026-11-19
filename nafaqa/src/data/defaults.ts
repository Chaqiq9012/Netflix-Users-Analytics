import type { Account, Category, PocketDef, Settings } from '../engine';

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  userName: '',
  currency: 'MAD',
  timezone: 'Africa/Casablanca',
  weekStart: 'monday',
  emergencyReserve: 50000,
  recurringRestWeekdays: [],
  monthStartDay: 1,
  notifications: { bills: true, dailyTarget: true, weeklyRecovery: true, browser: false },
  hideAmounts: false,
  promptSaveOnIncome: true,
  onboarded: false
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'inc-daily', name: 'Daily work', kind: 'income', icon: 'hammer', builtin: true, order: 0 },
  { id: 'inc-install', name: 'Installation work', kind: 'income', icon: 'wrench', builtin: true, order: 1 },
  { id: 'inc-freelance', name: 'Freelance', kind: 'income', icon: 'laptop', builtin: true, order: 2 },
  { id: 'inc-business', name: 'Business', kind: 'income', icon: 'briefcase', builtin: true, order: 3 },
  { id: 'inc-other', name: 'Other', kind: 'income', icon: 'coins', builtin: true, order: 4 },
  { id: 'exp-food', name: 'Food', kind: 'expense', icon: 'utensils', builtin: true, order: 0 },
  { id: 'exp-transport', name: 'Transportation', kind: 'expense', icon: 'car', builtin: true, order: 1 },
  { id: 'exp-groceries', name: 'Groceries', kind: 'expense', icon: 'basket', builtin: true, order: 2 },
  { id: 'exp-bills', name: 'Bills', kind: 'expense', icon: 'receipt', builtin: true, order: 3 },
  { id: 'exp-shopping', name: 'Shopping', kind: 'expense', icon: 'bag', builtin: true, order: 4 },
  { id: 'exp-personal', name: 'Personal', kind: 'expense', icon: 'user', builtin: true, order: 5 },
  { id: 'exp-other', name: 'Other', kind: 'expense', icon: 'dots', builtin: true, order: 6 }
];

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-cash', name: 'Cash', type: 'cash', createdAt: 0 },
  { id: 'acc-bank', name: 'Bank account', type: 'bank', createdAt: 0 }
];

export const POCKETS: PocketDef[] = [
  { id: 'savings', name: 'Savings', kind: 'ledger', description: 'Protected money moved into savings. Counts toward weekly and monthly goals.', order: 0 },
  { id: 'obligations', name: 'Upcoming bills', kind: 'computed', description: 'Automatically reserved for your next subscription payments.', order: 1 },
  { id: 'emergency', name: 'Emergency reserve', kind: 'computed', description: 'A fixed safety buffer, never included in safe-to-spend.', order: 2 },
  { id: 'spendable', name: 'Spendable', kind: 'computed', description: 'What remains after everything above is covered — safe to spend.', order: 3 },
  { id: 'holding', name: 'Unallocated', kind: 'ledger', description: 'Money parked here until you decide. Not spendable, not savings.', order: 4 }
];
