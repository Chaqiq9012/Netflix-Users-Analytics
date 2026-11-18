import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/data/db';
import * as repo from '../src/data/repo';
import { computeSnapshot, todayIn, monthKey, dueDateFor, addMonths } from '../src/engine';

const today = () => todayIn('Africa/Casablanca');

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await repo.ensureSeed();
  await repo.updateSettings({ emergencyReserve: 0, onboarded: true });
});

async function snap() {
  return computeSnapshot(await repo.loadData(), today());
}

describe('repository (IndexedDB)', () => {
  it('adds, edits and deletes transactions with an audit trail', async () => {
    const id = await repo.addTransaction({ kind: 'income', amount: 50000, description: 'Job', categoryId: 'inc-daily', date: today() });
    expect((await snap()).allocation.balance).toBe(50000);
    await repo.updateTransaction(id, { kind: 'income', amount: 70000, description: 'Job', categoryId: 'inc-daily', date: today() });
    expect((await snap()).allocation.balance).toBe(70000);
    await repo.deleteTransaction(id);
    expect((await snap()).allocation.balance).toBe(0);
    const logs = await db.auditLogs.where('entityId').equals(id).toArray();
    expect(logs.map((l) => l.action)).toEqual(['create', 'update', 'delete']);
  });

  it('rejects invalid input', async () => {
    await expect(repo.addTransaction({ kind: 'income', amount: 0, description: '', categoryId: 'inc-daily', date: today() })).rejects.toThrow();
    await expect(repo.addTransaction({ kind: 'income', amount: 100, description: '', categoryId: 'exp-food', date: today() })).rejects.toThrow(/match/);
  });

  it('transfers never exceed safe-to-spend and never change the balance', async () => {
    await repo.addTransaction({ kind: 'income', amount: 30000, description: 'Job', categoryId: 'inc-daily', date: today() });
    await expect(repo.addTransfer({ from: 'spendable', to: 'savings', amount: 40000 })).rejects.toThrow(/available/);
    await repo.addTransfer({ from: 'spendable', to: 'savings', amount: 20000 });
    const s = await snap();
    expect(s.allocation.balance).toBe(30000);
    expect(s.allocation.savings).toBe(20000);
    expect(s.week.savedToday).toBe(20000);
    await expect(repo.addTransfer({ from: 'savings', to: 'spendable', amount: 25000 })).rejects.toThrow();
  });

  it('cannot undo a savings deposit that was already withdrawn', async () => {
    await repo.addTransaction({ kind: 'income', amount: 30000, description: 'Job', categoryId: 'inc-daily', date: today() });
    const dep = await repo.addTransfer({ from: 'spendable', to: 'savings', amount: 20000 });
    await repo.addTransfer({ from: 'savings', to: 'spendable', amount: 15000 });
    await expect(repo.deleteTransfer(dep)).rejects.toThrow(/already been moved/);
  });

  it('pays a subscription atomically, prevents duplicates, and deleting the expense re-reserves it', async () => {
    await repo.addTransaction({ kind: 'income', amount: 100000, description: 'Job', categoryId: 'inc-daily', date: today() });
    const subId = await repo.saveSubscription({ name: 'Internet', amount: 25000, renewalDay: 28, categoryId: 'exp-bills', active: true, reminderDays: 2 });
    const s1 = await snap();
    expect(s1.allocation.obligationsRequired).toBe(25000);
    const period = s1.nextBill!.period;
    await repo.paySubscription(subId, period);
    await expect(repo.paySubscription(subId, period)).rejects.toThrow(/already/);
    const s2 = await snap();
    expect(s2.allocation.balance).toBe(75000);
    expect(s2.nextBill!.period).toBe(addMonths(period, 1));
    const tx = (await db.transactions.toArray()).find((t) => t.subscriptionId === subId)!;
    await repo.deleteTransaction(tx.id);
    const s3 = await snap();
    expect(s3.allocation.balance).toBe(100000);
    expect(s3.nextBill!.period).toBe(period);
    expect(await db.payments.count()).toBe(0);
  });

  it('"already paid this month" starts the subscription next period', async () => {
    const t = today();
    const subId = await repo.saveSubscription({ name: 'Phone', amount: 9900, renewalDay: 28, categoryId: 'exp-bills', active: true, reminderDays: 2, alreadyPaidThisMonth: true });
    const s = await snap();
    const expected = dueDateFor(28, monthKey(t)) >= t ? addMonths(monthKey(t), 1) : addMonths(monthKey(t), 1);
    expect(s.nextBill!.subscriptionId).toBe(subId);
    expect(s.nextBill!.period).toBe(expected);
  });

  it('target changes create history rows effective today', async () => {
    await repo.updateTargets({ daily: 20000, weekly: 120000, monthly: 450000 });
    const s = await snap();
    expect(s.week.goal).toBe(120000);
    expect(s.month.goal).toBe(450000);
    expect(await db.goals.count()).toBe(2);
  });

  it('rest day toggle recalculates working days', async () => {
    const before = (await snap()).week.workingDaysRemaining;
    await repo.setRestDay(today(), true);
    const after = await snap();
    expect(after.week.workingDaysRemaining).toBe(before - 1);
    expect(after.week.todayIsRest).toBe(true);
    await repo.setRestDay(today(), false);
    expect((await snap()).week.workingDaysRemaining).toBe(before);
    expect(await db.restDays.count()).toBe(0);
  });

  it('backup round-trips', async () => {
    await repo.addTransaction({ kind: 'income', amount: 12345, description: 'Job', categoryId: 'inc-daily', date: today() });
    const json = await repo.exportBackup();
    await repo.wipeAllData();
    expect((await snap()).allocation.balance).toBe(0);
    await repo.importBackup(json);
    expect((await snap()).allocation.balance).toBe(12345);
    await expect(repo.importBackup('{"nope":1}')).rejects.toThrow(/not a Nafaqa/);
  });

  it('CSV export includes signed amounts', async () => {
    await repo.addTransaction({ kind: 'expense', amount: 4550, description: 'Lunch, with "friends"', categoryId: 'exp-food', date: today() });
    const csv = repo.transactionsToCSV(await repo.loadData());
    expect(csv).toContain('-45.50');
    expect(csv).toContain('"Lunch, with ""friends"""');
  });
});
