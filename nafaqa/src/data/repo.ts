import { ALL_TABLES, db } from './db';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, POCKETS } from './defaults';
import {
  computeSnapshot, formatMoney, isValidDate, pocketLedger, recoveryFor, todayIn, DEFAULT_TARGETS, endOfWeek, minDate,
  RestCalendar, dueDateFor, monthKey, type Category, type Cents, type FinanceData, type GoalTarget, type ISODate, type PocketId,
  type Settings, type Subscription, type Transaction, type TransferSource, type TxKind, type Account, type RestDay,
  type DailySnapshot, type MonthlyRecord, monthProgress, incomeBetween, expensesBetween, endOfMonth, addMonths
} from '../engine';

export class ValidationError extends Error {}

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

const now = () => Date.now();

async function audit(entity: string, entityId: string, action: 'create' | 'update' | 'delete', summary: string, before?: unknown, after?: unknown) {
  await db.auditLogs.add({ at: now(), entity, entityId, action, summary, before, after });
}

export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', [db.settings, db.categories, db.accounts, db.pockets, db.goals], async () => {
    if (!(await db.settings.get('main'))) await db.settings.put({ ...DEFAULT_SETTINGS });
    if ((await db.categories.count()) === 0) await db.categories.bulkPut(DEFAULT_CATEGORIES);
    if ((await db.accounts.count()) === 0) await db.accounts.bulkPut(DEFAULT_ACCOUNTS.map((a) => ({ ...a, createdAt: now() })));
    await db.pockets.bulkPut(POCKETS);
    if ((await db.goals.count()) === 0) await db.goals.put({ id: uid(), effectiveFrom: '2000-01-01', ...DEFAULT_TARGETS, createdAt: now() });
  });
}

export async function loadData(): Promise<FinanceData> {
  const [settings, transactions, transfers, categories, accounts, subscriptions, payments, restDays, goals, weeklyRecords, monthlyRecords] = await Promise.all([
    db.settings.get('main'), db.transactions.toArray(), db.transfers.toArray(), db.categories.toArray(), db.accounts.toArray(),
    db.subscriptions.toArray(), db.payments.toArray(), db.restDays.toArray(), db.goals.toArray(), db.weeklyRecords.toArray(), db.monthlyRecords.toArray()
  ]);
  return { settings: settings ?? DEFAULT_SETTINGS, transactions, transfers, categories, accounts, subscriptions, payments, restDays, goals, weeklyRecords, monthlyRecords };
}

const todayFor = (s: Settings) => todayIn(s.timezone);

function assertAmount(a: Cents) {
  if (!Number.isSafeInteger(a) || a <= 0) throw new ValidationError('Enter an amount greater than 0.');
  if (a > 100_000_000_00) throw new ValidationError('That amount looks too large.');
}
function assertDate(d: string) {
  if (!isValidDate(d)) throw new ValidationError('Choose a valid date.');
}

// ───────────────────────── Transactions ─────────────────────────

export interface TxInput {
  kind: TxKind;
  amount: Cents;
  description: string;
  categoryId: string;
  date: ISODate;
  notes?: string;
  accountId?: string;
  isOpening?: boolean;
}

function cleanTx(input: TxInput, categories: Category[]) {
  assertAmount(input.amount);
  assertDate(input.date);
  const cat = categories.find((c) => c.id === input.categoryId);
  if (!cat) throw new ValidationError('Choose a category.');
  if (cat.kind !== input.kind) throw new ValidationError('Category does not match the transaction type.');
  const description = input.description.trim() || cat.name;
  if (description.length > 120) throw new ValidationError('Keep the reason under 120 characters.');
  return { ...input, description, notes: input.notes?.trim() || undefined, accountId: input.accountId || undefined };
}

export async function addTransaction(input: TxInput): Promise<string> {
  const categories = await db.categories.toArray();
  const t = cleanTx(input, categories);
  const id = uid();
  await db.transaction('rw', db.transactions, db.auditLogs, async () => {
    const tx: Transaction = { id, ...t, createdAt: now(), updatedAt: now() };
    await db.transactions.add(tx);
    await audit('transaction', id, 'create', `${t.kind === 'income' ? 'Income' : 'Expense'} ${formatMoney(t.amount)} — ${t.description}`, undefined, tx);
  });
  return id;
}

export async function updateTransaction(id: string, input: TxInput): Promise<void> {
  const categories = await db.categories.toArray();
  const t = cleanTx(input, categories);
  await db.transaction('rw', db.transactions, db.payments, db.auditLogs, async () => {
    const before = await db.transactions.get(id);
    if (!before) throw new ValidationError('Transaction not found.');
    if (before.subscriptionId && t.kind !== 'expense') throw new ValidationError('A subscription payment must stay an expense.');
    const after: Transaction = { ...before, ...t, updatedAt: now() };
    await db.transactions.put(after);
    // Keep linked subscription payment in sync.
    if (before.subscriptionId) {
      const pay = await db.payments.where({ subscriptionId: before.subscriptionId, period: before.subscriptionPeriod! }).first();
      if (pay) await db.payments.put({ ...pay, amount: after.amount, date: after.date });
    }
    await audit('transaction', id, 'update', `Edited: ${after.description}${before.amount !== after.amount ? ` (${formatMoney(before.amount)} → ${formatMoney(after.amount)})` : ''}`, before, after);
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transaction('rw', db.transactions, db.payments, db.auditLogs, async () => {
    const before = await db.transactions.get(id);
    if (!before) return;
    await db.transactions.delete(id);
    if (before.subscriptionId) {
      // Deleting a bill payment re-opens (re-reserves) that period.
      await db.payments.where({ subscriptionId: before.subscriptionId, period: before.subscriptionPeriod! }).delete();
    }
    await audit('transaction', id, 'delete', `Deleted ${before.kind} ${formatMoney(before.amount)} — ${before.description}`, before);
  });
}

// ───────────────────────── Transfers ─────────────────────────

export interface TransferInput {
  from: PocketId;
  to: PocketId;
  amount: Cents;
  date?: ISODate;
  periodDate?: ISODate;
  note?: string;
  source?: TransferSource;
}

export const POCKET_LABEL: Record<PocketId, string> = { spendable: 'Spendable', savings: 'Savings', holding: 'Unallocated' };

/** Available to move out of a pocket right now. Spendable is limited to safe-to-spend (never borrows reserves). */
export function availableIn(data: FinanceData, pocket: PocketId, today: ISODate): Cents {
  if (pocket === 'spendable') return computeSnapshot(data, today).allocation.safeToSpend;
  return Math.max(0, pocketLedger(data.transfers, pocket));
}

export async function addTransfer(input: TransferInput): Promise<string> {
  assertAmount(input.amount);
  if (input.from === input.to) throw new ValidationError('Choose two different pockets.');
  const id = uid();
  await db.transaction('rw', [db.transfers, db.transactions, db.subscriptions, db.payments, db.settings, db.restDays, db.goals, db.weeklyRecords, db.monthlyRecords, db.categories, db.accounts, db.auditLogs], async () => {
    const data = await loadData();
    const today = todayFor(data.settings);
    const date = input.date ?? today;
    assertDate(date);
    if (date > today) throw new ValidationError('Transfers cannot be dated in the future.');
    const available = availableIn(data, input.from, today);
    if (input.amount > available) {
      throw new ValidationError(`Only ${formatMoney(available)} is available in ${POCKET_LABEL[input.from]}.`);
    }
    const tr = { id, from: input.from, to: input.to, amount: input.amount, date, periodDate: input.periodDate ?? date, note: input.note?.trim() || undefined, source: input.source ?? 'manual', createdAt: now() } as const;
    await db.transfers.add(tr);
    await audit('transfer', id, 'create', `Moved ${formatMoney(tr.amount)} ${POCKET_LABEL[tr.from]} → ${POCKET_LABEL[tr.to]}`, undefined, tr);
  });
  return id;
}

export async function deleteTransfer(id: string): Promise<void> {
  await db.transaction('rw', db.transfers, db.weeklyRecords, db.auditLogs, async () => {
    const tr = await db.transfers.get(id);
    if (!tr) return;
    const rest = (await db.transfers.toArray()).filter((t) => t.id !== id);
    for (const p of ['savings', 'holding'] as const) {
      if (pocketLedger(rest, p) < 0) throw new ValidationError(`Can't undo: money from ${POCKET_LABEL[p]} has already been moved out.`);
    }
    await db.transfers.delete(id);
    const rec = (await db.weeklyRecords.toArray()).find((r) => r.transferId === id);
    if (rec) await db.weeklyRecords.delete(rec.weekStart);
    await audit('transfer', id, 'delete', `Undid transfer of ${formatMoney(tr.amount)} ${POCKET_LABEL[tr.from]} → ${POCKET_LABEL[tr.to]}`, tr);
  });
}

// ───────────────────────── Weekly recovery ─────────────────────────

export async function decideRecovery(weekStart: ISODate, decision: 'transfer' | 'keep', amount?: Cents): Promise<void> {
  await db.transaction('rw', [db.transfers, db.transactions, db.subscriptions, db.payments, db.settings, db.restDays, db.goals, db.weeklyRecords, db.monthlyRecords, db.categories, db.accounts, db.auditLogs], async () => {
    const data = await loadData();
    const today = todayFor(data.settings);
    if (data.weeklyRecords.some((r) => r.weekStart === weekStart)) throw new ValidationError('This week has already been reviewed.');
    const snap = computeSnapshot(data, today);
    const r = recoveryFor(data, today, weekStart, snap.allocation.safeToSpend);
    if (decision === 'transfer') {
      const amt = amount ?? r.suggested;
      assertAmount(amt);
      if (amt > r.suggested) throw new ValidationError(`You can move at most ${formatMoney(r.suggested)} safely.`);
      const id = uid();
      const periodDate = minDate(today, endOfWeek(weekStart));
      await db.transfers.add({ id, from: 'spendable', to: 'savings', amount: amt, date: today, periodDate, source: 'weekly-recovery', note: 'Weekly recovery', createdAt: now() });
      await db.weeklyRecords.put({ weekStart, goal: r.goal, savedBefore: r.saved, shortfall: r.shortfall - amt, decision: 'transferred', transferred: amt, transferId: id, decidedAt: now() });
      await audit('weekly', weekStart, 'create', `Recovered ${formatMoney(amt)} for week of ${weekStart}`);
    } else {
      await db.weeklyRecords.put({ weekStart, goal: r.goal, savedBefore: r.saved, shortfall: r.shortfall, decision: 'kept', transferred: 0, decidedAt: now() });
      await audit('weekly', weekStart, 'create', `Kept money spendable; ${formatMoney(r.shortfall)} shortfall recorded for week of ${weekStart}`);
    }
  });
}

// ───────────────────────── Rest days ─────────────────────────

export async function setRestDay(date: ISODate, isRest: boolean, note?: string): Promise<void> {
  assertDate(date);
  await db.transaction('rw', db.restDays, db.settings, db.auditLogs, async () => {
    const s = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    const recurring = new RestCalendar([], s.recurringRestWeekdays).isRest(date);
    if (recurring === isRest) await db.restDays.delete(date);
    else await db.restDays.put({ date, type: isRest ? 'rest' : 'work', note, createdAt: now() } satisfies RestDay);
    await audit('restDay', date, 'update', isRest ? `Marked ${date} as a rest day` : `Marked ${date} as a working day`);
  });
}

// ───────────────────────── Subscriptions ─────────────────────────

export interface SubInput {
  name: string;
  amount: Cents;
  renewalDay: number;
  categoryId: string;
  description?: string;
  active: boolean;
  reminderDays: number;
  /** When true, this month's renewal is considered already handled (first occurrence next month). */
  alreadyPaidThisMonth?: boolean;
}

export async function saveSubscription(input: SubInput, id?: string): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new ValidationError('Give the subscription a name.');
  assertAmount(input.amount);
  if (!Number.isInteger(input.renewalDay) || input.renewalDay < 1 || input.renewalDay > 31) throw new ValidationError('Renewal day must be between 1 and 31.');
  const settings = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
  const today = todayFor(settings);
  const subId = id ?? uid();
  await db.transaction('rw', db.subscriptions, db.auditLogs, async () => {
    const before = id ? await db.subscriptions.get(id) : undefined;
    if (id && !before) throw new ValidationError('Subscription not found.');
    let startDate = before?.startDate ?? today;
    if (!before && input.alreadyPaidThisMonth) {
      const due = dueDateFor(input.renewalDay, monthKey(today));
      startDate = due >= today ? dueDateFor(input.renewalDay, addMonths(monthKey(today), 1)) : today;
    }
    const sub: Subscription = {
      id: subId, name, amount: input.amount, renewalDay: input.renewalDay, categoryId: input.categoryId,
      description: input.description?.trim() || undefined, active: input.active, reminderDays: Math.max(0, Math.min(14, input.reminderDays)),
      startDate, createdAt: before?.createdAt ?? now(),
      cancelledAt: input.active ? undefined : before?.cancelledAt ?? today
    };
    // Re-activating: don't resurrect months that passed while it was cancelled.
    if (before && !before.active && input.active) sub.startDate = today;
    await db.subscriptions.put(sub);
    await audit('subscription', subId, before ? 'update' : 'create', `${before ? 'Updated' : 'Added'} subscription ${name} (${formatMoney(sub.amount)}, day ${sub.renewalDay})`, before, sub);
  });
  return subId;
}

export async function setSubscriptionActive(id: string, active: boolean): Promise<void> {
  const s = await db.subscriptions.get(id);
  if (!s) return;
  await saveSubscription({ ...s, active }, id);
}

export async function deleteSubscription(id: string): Promise<void> {
  await db.transaction('rw', db.subscriptions, db.payments, db.transactions, db.auditLogs, async () => {
    const s = await db.subscriptions.get(id);
    if (!s) return;
    // Keep real expenses in history, just unlink them.
    const txs = await db.transactions.where('subscriptionId').equals(id).toArray();
    for (const t of txs) await db.transactions.put({ ...t, subscriptionId: undefined, subscriptionPeriod: undefined, notes: [t.notes, `Subscription: ${s.name}`].filter(Boolean).join(' · ') });
    await db.payments.where('subscriptionId').equals(id).delete();
    await db.subscriptions.delete(id);
    await audit('subscription', id, 'delete', `Deleted subscription ${s.name}`, s);
  });
}

export async function paySubscription(subscriptionId: string, period: string, opts: { amount?: Cents; date?: ISODate; accountId?: string } = {}): Promise<void> {
  await db.transaction('rw', [db.subscriptions, db.payments, db.transactions, db.settings, db.auditLogs], async () => {
    const s = await db.subscriptions.get(subscriptionId);
    if (!s) throw new ValidationError('Subscription not found.');
    const existing = await db.payments.where({ subscriptionId, period }).first();
    if (existing) throw new ValidationError(existing.status === 'paid' ? 'This renewal is already marked as paid.' : 'This renewal was skipped.');
    const settings = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    const date = opts.date ?? todayFor(settings);
    assertDate(date);
    const amount = opts.amount ?? s.amount;
    assertAmount(amount);
    const txId = uid();
    await db.transactions.add({
      id: txId, kind: 'expense', amount, description: s.name, categoryId: s.categoryId, date, accountId: opts.accountId,
      subscriptionId, subscriptionPeriod: period, notes: `Renewal ${period}`, createdAt: now(), updatedAt: now()
    });
    await db.payments.add({ id: uid(), subscriptionId, period, status: 'paid', amount, date, transactionId: txId, createdAt: now() });
    await audit('subscription', subscriptionId, 'update', `Paid ${s.name} ${formatMoney(amount)} for ${period}`);
  });
}

export async function skipSubscription(subscriptionId: string, period: string): Promise<void> {
  await db.transaction('rw', db.subscriptions, db.payments, db.settings, db.auditLogs, async () => {
    const s = await db.subscriptions.get(subscriptionId);
    if (!s) throw new ValidationError('Subscription not found.');
    if (await db.payments.where({ subscriptionId, period }).first()) throw new ValidationError('This renewal is already resolved.');
    const settings = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    await db.payments.add({ id: uid(), subscriptionId, period, status: 'skipped', amount: s.amount, date: todayFor(settings), createdAt: now() });
    await audit('subscription', subscriptionId, 'update', `Skipped ${s.name} renewal for ${period}`);
  });
}

export async function undoPayment(paymentId: string): Promise<void> {
  await db.transaction('rw', db.payments, db.transactions, db.auditLogs, async () => {
    const p = await db.payments.get(paymentId);
    if (!p) return;
    await db.payments.delete(paymentId);
    if (p.transactionId) await db.transactions.delete(p.transactionId);
    await audit('subscription', p.subscriptionId, 'update', `Undid ${p.status} renewal for ${p.period}`, p);
  });
}

// ───────────────────────── Settings & goals ─────────────────────────

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, db.auditLogs, async () => {
    const before = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    if (patch.emergencyReserve !== undefined && (!Number.isSafeInteger(patch.emergencyReserve) || patch.emergencyReserve < 0)) throw new ValidationError('Emergency reserve cannot be negative.');
    const after = { ...before, ...patch, id: 'main' as const };
    await db.settings.put(after);
    await audit('settings', 'main', 'update', 'Updated settings: ' + Object.keys(patch).join(', '), before, after);
  });
}

/** New targets apply from today forward; earlier periods keep the targets they had. */
export async function updateTargets(t: { daily: Cents; weekly: Cents; monthly: Cents }): Promise<void> {
  for (const v of [t.daily, t.weekly, t.monthly]) if (!Number.isSafeInteger(v) || v < 0) throw new ValidationError('Targets must be 0 or more.');
  await db.transaction('rw', db.goals, db.settings, db.auditLogs, async () => {
    const settings = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    const today = todayFor(settings);
    const existing = await db.goals.where('effectiveFrom').equals(today).first();
    const row: GoalTarget = { id: existing?.id ?? uid(), effectiveFrom: today, ...t, createdAt: now() };
    await db.goals.put(row);
    await audit('goals', row.id, existing ? 'update' : 'create', `Targets from ${today}: daily ${formatMoney(t.daily)}, weekly ${formatMoney(t.weekly)}, monthly ${formatMoney(t.monthly)}`);
  });
}

// ───────────────────────── Categories & accounts ─────────────────────────

export async function saveCategory(c: Omit<Category, 'id' | 'builtin' | 'order'> & { id?: string }): Promise<void> {
  const name = c.name.trim();
  if (!name) throw new ValidationError('Category name is required.');
  const all = await db.categories.toArray();
  if (all.some((x) => x.kind === c.kind && x.name.toLowerCase() === name.toLowerCase() && x.id !== c.id && !x.archived)) throw new ValidationError('A category with that name already exists.');
  const before = c.id ? all.find((x) => x.id === c.id) : undefined;
  const row: Category = { id: c.id ?? uid(), name, kind: c.kind, icon: c.icon, archived: c.archived, builtin: before?.builtin ?? false, order: before?.order ?? all.filter((x) => x.kind === c.kind).length };
  await db.categories.put(row);
  await audit('category', row.id, before ? 'update' : 'create', `${before ? 'Updated' : 'Added'} category ${name}`);
}

/** Categories in use are archived (hidden from pickers) so history keeps its labels. */
export async function removeCategory(id: string): Promise<'deleted' | 'archived'> {
  const used = (await db.transactions.where('categoryId').equals(id).count()) + (await db.subscriptions.filter((s) => s.categoryId === id).count());
  const c = await db.categories.get(id);
  if (!c) return 'deleted';
  if (used > 0 || c.builtin) {
    await db.categories.put({ ...c, archived: true });
    await audit('category', id, 'update', `Archived category ${c.name}`);
    return 'archived';
  }
  await db.categories.delete(id);
  await audit('category', id, 'delete', `Deleted category ${c.name}`);
  return 'deleted';
}

export async function saveAccount(a: { id?: string; name: string; type: Account['type']; archived?: boolean }): Promise<void> {
  const name = a.name.trim();
  if (!name) throw new ValidationError('Account name is required.');
  const before = a.id ? await db.accounts.get(a.id) : undefined;
  await db.accounts.put({ id: a.id ?? uid(), name, type: a.type, archived: a.archived, createdAt: before?.createdAt ?? now() });
  await audit('account', a.id ?? name, before ? 'update' : 'create', `${before ? 'Updated' : 'Added'} account ${name}`);
}

// ───────────────────────── Snapshots & month close ─────────────────────────

export async function recordDailySnapshot(snap: DailySnapshot): Promise<void> {
  await db.dailySnapshots.put(snap);
}

/** Store a monthly record for each completed month that has activity but no record yet. */
export async function closeCompletedMonths(data: FinanceData, today: ISODate, firstActivity: ISODate | null): Promise<void> {
  if (!firstActivity) return;
  const have = new Set(data.monthlyRecords.map((m) => m.month));
  const rows: MonthlyRecord[] = [];
  for (let m = monthKey(firstActivity); m < monthKey(today); m = addMonths(m, 1)) {
    if (have.has(m)) continue;
    const mp = monthProgress(data, today, m);
    const s = m + '-01', e = endOfMonth(s);
    rows.push({ month: m, goal: mp.goal, saved: mp.saved, achieved: mp.achieved, income: incomeBetween(data.transactions, s, e), expenses: expensesBetween(data.transactions, s, e), closedAt: now() });
  }
  if (rows.length) await db.monthlyRecords.bulkPut(rows);
}

// ───────────────────────── Backup / export ─────────────────────────

export const BACKUP_VERSION = 1;

export async function exportBackup(): Promise<string> {
  const out: Record<string, unknown> = { app: 'nafaqa', version: BACKUP_VERSION, exportedAt: new Date().toISOString() };
  for (const t of ALL_TABLES) out[t] = await db.table(t).toArray();
  return JSON.stringify(out, null, 2);
}

export async function importBackup(json: string): Promise<void> {
  let parsed: any;
  try { parsed = JSON.parse(json); } catch { throw new ValidationError('This file is not valid JSON.'); }
  if (!parsed || parsed.app !== 'nafaqa' || typeof parsed.version !== 'number') throw new ValidationError('This is not a Nafaqa backup file.');
  if (parsed.version > BACKUP_VERSION) throw new ValidationError('This backup was made by a newer version of Nafaqa.');
  for (const t of ['transactions', 'transfers', 'subscriptions'] as const) {
    if (!Array.isArray(parsed[t])) throw new ValidationError(`Backup is missing "${t}".`);
  }
  for (const tx of parsed.transactions) {
    if (!Number.isSafeInteger(tx.amount) || !isValidDate(tx.date) || !['income', 'expense'].includes(tx.kind)) throw new ValidationError('Backup contains an invalid transaction.');
  }
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) {
      await db.table(t).clear();
      if (Array.isArray(parsed[t])) await db.table(t).bulkPut(parsed[t]);
    }
  });
  await ensureSeed();
  await audit('backup', 'import', 'create', 'Restored data from backup');
}

export function transactionsToCSV(data: FinanceData): string {
  const cats = new Map(data.categories.map((c) => [c.id, c.name]));
  const accs = new Map(data.accounts.map((a) => [a.id, a.name]));
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [['date', 'type', 'amount_dh', 'description', 'category', 'account', 'notes'].join(',')];
  for (const t of [...data.transactions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    const amt = (t.kind === 'expense' ? '-' : '') + (t.amount / 100).toFixed(2);
    rows.push([t.date, t.isOpening ? 'opening' : t.kind, amt, esc(t.description), esc(cats.get(t.categoryId) ?? ''), esc(t.accountId ? accs.get(t.accountId) ?? '' : ''), esc(t.notes ?? '')].join(','));
  }
  return rows.join('\n');
}

export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
  });
  await ensureSeed();
}
