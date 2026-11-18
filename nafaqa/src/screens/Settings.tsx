import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, FileSpreadsheet, Trash2, Plus, Eye, EyeOff, FlaskConical, Archive, RotateCcw, Pencil, History, Lock } from 'lucide-react';
import { actualBalance, centsToInput, parseMoney, targetsOn, weekdayShort, type Category, type Account } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { db, DEMO_FLAG, isDemoMode } from '../data/db';
import {
  exportBackup, importBackup, removeCategory, saveAccount, saveCategory, transactionsToCSV, updateSettings, updateTargets, wipeAllData
} from '../data/repo';
import { downloadText } from '../lib/download';
import { CATEGORY_ICONS, iconFor } from '../lib/icons';
import { CloudBackupSection } from '../features/CloudBackup';
import { Sheet, useAction, useConfirm, useToast } from '../ui/overlay';
import { Button, Card, Field, Input, Money, MoneyField, PageHeader, Segmented, Toggle, cx, CategoryIcon } from '../ui/kit';

export default function Settings() {
  const { data, today } = useFinance();
  const s = data.settings;
  const run = useAction();
  const confirm = useConfirm();
  const toast = useToast();
  const t = targetsOn(data.goals, today);
  const [name, setName] = useState(s.userName);
  const [daily, setDaily] = useState(centsToInput(t.daily));
  const [weekly, setWeekly] = useState(centsToInput(t.weekly));
  const [monthly, setMonthly] = useState(centsToInput(t.monthly));
  const [reserve, setReserve] = useState(centsToInput(s.emergencyReserve));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (location.hash.includes('categories')) setTimeout(() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' }), 100); }, []);

  const saveTargets = async () => {
    const d = parseMoney(daily), w = parseMoney(weekly), m = parseMoney(monthly), r = parseMoney(reserve);
    if (d === null || w === null || m === null || r === null) return toast('Enter valid amounts.', 'error');
    await run(async () => {
      if (d !== t.daily || w !== t.weekly || m !== t.monthly) await updateTargets({ daily: d, weekly: w, monthly: m });
      if (r !== s.emergencyReserve) await updateSettings({ emergencyReserve: r });
    }, 'Targets saved — they apply from today, history is unchanged');
  };
  const setNotif = (k: keyof typeof s.notifications, v: boolean) => run(() => updateSettings({ notifications: { ...s.notifications, [k]: v } }));
  const enableBrowser = async (v: boolean) => {
    if (v && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return toast('Notifications are blocked in your browser settings.', 'error');
    }
    if (v && typeof Notification === 'undefined') return toast('This browser does not support notifications.', 'error');
    setNotif('browser', v);
  };
  const toggleRestWeekday = (i: number) => {
    const cur = s.recurringRestWeekdays;
    run(() => updateSettings({ recurringRestWeekdays: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort() }), 'Rest day preference updated');
  };

  const doExport = async () => { downloadText(`nafaqa-backup-${today}.json`, await exportBackup(), 'application/json'); toast('Backup downloaded'); };
  const doCSV = () => { downloadText(`nafaqa-transactions-${today}.csv`, transactionsToCSV(data), 'text/csv'); toast('Transactions exported'); };
  const doImport = async (f: File) => {
    const text = await f.text();
    if (await confirm({ title: 'Restore this backup?', text: 'All current data on this device will be replaced by the backup.', confirm: 'Restore', danger: true }))
      run(() => importBackup(text), 'Backup restored');
  };
  const wipe = async () => {
    if (await confirm({ title: 'Erase all data?', text: 'This permanently deletes every transaction, subscription and setting on this device. Export a backup first if you might need it.', confirm: 'Erase everything', danger: true }))
      run(() => wipeAllData(), 'All data erased');
  };
  const toggleDemo = async () => {
    if (isDemoMode()) { localStorage.removeItem(DEMO_FLAG); location.hash = '#/'; location.reload(); return; }
    if (await confirm({ title: 'Open demo mode?', text: 'Demo mode uses a separate sample database. Your real data is not touched. You can exit at any time.', confirm: 'Open demo' })) {
      localStorage.setItem(DEMO_FLAG, '1');
      const { NafaqaDB } = await import('../data/db');
      const demo = new NafaqaDB('nafaqa-demo');
      await demo.delete();
      location.hash = '#/';
      location.reload();
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Settings" back />

      <Group title="Profile">
        <div className="p-4 flex gap-3 items-end">
          <Field label="Your name" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Name" /></Field>
          <Button variant="soft" disabled={name === s.userName} onClick={() => run(() => updateSettings({ userName: name.trim() }), 'Name saved')}>Save</Button>
        </div>
      </Group>

      <Group title="Savings targets & reserve" note="Changes apply from today. Past weeks and months keep the targets they had.">
        <div className="p-4 grid grid-cols-2 gap-3">
          <Field label="Daily reference"><MoneyField value={daily} onChange={setDaily} /></Field>
          <Field label="Weekly goal"><MoneyField value={weekly} onChange={setWeekly} /></Field>
          <Field label="Monthly goal"><MoneyField value={monthly} onChange={setMonthly} /></Field>
          <Field label="Emergency reserve"><MoneyField value={reserve} onChange={setReserve} /></Field>
        </div>
        <div className="px-4 pb-4"><Button block variant="dark" onClick={saveTargets}>Save targets</Button></div>
      </Group>

      <Group title="Region">
        <Line label="Currency" value="Moroccan dirham (MAD · DH)" />
        <Line label="Timezone" value="Africa/Casablanca" />
        <Line label="Week starts" value="Monday" />
      </Group>

      <Group title="Rest days" note="Weekdays you usually don't work. You can still override any single date from Goals or Calendar.">
        <div className="p-4 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <button key={i} onClick={() => toggleRestWeekday(i)} aria-pressed={s.recurringRestWeekdays.includes(i)} className={cx('h-11 rounded-xl text-[12px] font-bold border transition', s.recurringRestWeekdays.includes(i) ? 'bg-forest text-cream border-forest' : 'bg-card border-line')}>{weekdayShort(i)}</button>
          ))}
        </div>
      </Group>

      <Group title="Notifications">
        <ToggleLine label="Bill reminders" sub="Before each subscription renews" checked={s.notifications.bills} onChange={(v) => setNotif('bills', v)} />
        <ToggleLine label="Daily target reminder" sub="Evening nudge if today's target isn't met" checked={s.notifications.dailyTarget} onChange={(v) => setNotif('dailyTarget', v)} />
        <ToggleLine label="Weekly recovery" sub="Review shortfalls at the end of each week" checked={s.notifications.weeklyRecovery} onChange={(v) => setNotif('weeklyRecovery', v)} />
        <ToggleLine label="Device notifications" sub="Show alerts as system notifications when the app opens" checked={s.notifications.browser} onChange={enableBrowser} />
        <ToggleLine label="Offer to save after income" sub="Suggest moving today's target into savings" checked={s.promptSaveOnIncome} onChange={(v) => run(() => updateSettings({ promptSaveOnIncome: v }))} />
      </Group>

      <Categories />
      <Accounts />

      <Group title="Privacy">
        <ToggleLine label="Hide amounts" sub="Mask balances on screen (e.g. in public)" checked={s.hideAmounts} onChange={(v) => run(() => updateSettings({ hideAmounts: v }))} icon={s.hideAmounts ? EyeOff : Eye} />
        <div className="px-4 py-3.5 flex gap-3 items-start text-[13px] text-muted"><Lock size={16} className="shrink-0 mt-0.5" /> Your data is stored on this device (IndexedDB). Nothing leaves it unless you turn on encrypted cloud backup below.</div>
      </Group>

      <Group title="Backup & export">
        <ActionLine icon={Download} label="Download backup (JSON)" onClick={doExport} />
        <ActionLine icon={Upload} label="Restore from backup" onClick={() => fileRef.current?.click()} />
        <ActionLine icon={FileSpreadsheet} label="Export transactions (CSV)" onClick={doCSV} />
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
      </Group>

      <CloudBackupSection />

      <AuditLog />

      <Group title="Account">
        <ActionLine icon={FlaskConical} label={isDemoMode() ? 'Exit demo mode' : 'Explore demo mode'} onClick={toggleDemo} />
        <ActionLine icon={Trash2} label="Erase all data on this device" danger onClick={wipe} />
      </Group>
      <p className="text-center text-[12px] text-muted pb-4">Nafaqa 1.0 · offline-first · {data.transactions.length} transactions stored</p>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-muted px-1 mb-2">{title}</h2>
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
      {note && <p className="text-[12px] text-muted px-1 mt-2">{note}</p>}
    </section>
  );
}
const Line = ({ label, value }: { label: string; value: string }) => <div className="flex justify-between px-4 py-3.5 text-[14px]"><span>{label}</span><span className="text-muted font-semibold">{value}</span></div>;
function ToggleLine({ label, sub, checked, onChange, icon: Icon }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; icon?: any }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {Icon && <Icon size={18} className="text-forest" />}
      <div className="flex-1"><p className="text-[14px] font-semibold">{label}</p>{sub && <p className="text-[12px] text-muted">{sub}</p>}</div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
function ActionLine({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={cx('w-full flex items-center gap-3 px-4 py-3.5 text-[14px] font-semibold hover:bg-mint/30', danger && 'text-danger')}><Icon size={18} className={danger ? '' : 'text-forest'} />{label}</button>;
}

function Categories() {
  const { data } = useFinance();
  const run = useAction();
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const list = data.categories.filter((c) => c.kind === kind).sort((a, b) => Number(!!a.archived) - Number(!!b.archived) || a.order - b.order);
  return (
    <section id="categories">
      <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-muted px-1 mb-2">Categories</h2>
      <Card className="overflow-hidden">
        <div className="p-3"><Segmented value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} /></div>
        <ul className="divide-y divide-line border-t border-line">
          {list.map((c) => (
            <li key={c.id} className={cx('flex items-center gap-3 px-4 py-2.5', c.archived && 'opacity-50')}>
              <CategoryIcon icon={c.icon} kind={kind} size={34} />
              <span className="flex-1 text-[14px] font-semibold">{c.name}{c.archived && <span className="text-muted font-normal"> · archived</span>}</span>
              {c.archived ? (
                <button aria-label="Restore" onClick={() => run(() => saveCategory({ ...c, archived: false }), 'Category restored')} className="h-9 w-9 grid place-items-center rounded-xl text-forest hover:bg-mint/60"><RotateCcw size={16} /></button>
              ) : (
                <>
                  <button aria-label="Edit" onClick={() => setEdit(c)} className="h-9 w-9 grid place-items-center rounded-xl text-forest hover:bg-mint/60"><Pencil size={16} /></button>
                  <button aria-label="Remove" onClick={() => run(async () => { const r = await removeCategory(c.id); return r; }, c.builtin ? 'Category archived' : 'Category removed')} className="h-9 w-9 grid place-items-center rounded-xl text-muted hover:bg-mint/60"><Archive size={16} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="p-3 border-t border-line"><Button block variant="soft" icon={Plus} onClick={() => setEdit({ kind, icon: 'dots', name: '' })}>Add category</Button></div>
      </Card>
      <p className="text-[12px] text-muted px-1 mt-2">Categories already used are archived instead of deleted, so history keeps its labels.</p>
      {edit && <CategorySheet initial={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function CategorySheet({ initial, onClose }: { initial: Partial<Category>; onClose: () => void }) {
  const run = useAction();
  const [name, setName] = useState(initial.name ?? '');
  const [icon, setIcon] = useState(initial.icon ?? 'dots');
  const submit = async () => { if (await run(() => saveCategory({ id: initial.id, name, icon, kind: initial.kind!, archived: false }), initial.id ? 'Category updated' : 'Category added')) onClose(); };
  return (
    <Sheet open onClose={onClose} title={initial.id ? 'Edit category' : 'New category'} footer={<Button block size="lg" variant="primary" onClick={submit} disabled={!name.trim()}>Save</Button>}>
      <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={30} /></Field>
      <p className="text-[13px] font-semibold mt-4 mb-2">Icon</p>
      <div className="grid grid-cols-6 gap-2">
        {Object.keys(CATEGORY_ICONS).map((k) => { const I = iconFor(k); return <button key={k} aria-label={k} onClick={() => setIcon(k)} className={cx('h-12 rounded-xl grid place-items-center border', icon === k ? 'bg-forest text-cream border-forest' : 'bg-card border-line')}><I size={20} /></button>; })}
      </div>
    </Sheet>
  );
}

function Accounts() {
  const { data } = useFinance();
  const run = useAction();
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const unassigned = actualBalance(data.transactions.filter((t) => !t.accountId));
  return (
    <section>
      <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-muted px-1 mb-2">Accounts & payment methods</h2>
      <Card className="divide-y divide-line overflow-hidden">
        {data.accounts.map((a) => (
          <div key={a.id} className={cx('flex items-center gap-3 px-4 py-3', a.archived && 'opacity-50')}>
            <div className="flex-1"><p className="text-[14px] font-semibold">{a.name}</p><p className="text-[12px] text-muted capitalize">{a.type}{a.archived ? ' · archived' : ''}</p></div>
            <Money value={actualBalance(data.transactions.filter((t) => t.accountId === a.id))} className="text-[14px] font-bold" />
            <button aria-label="Edit account" onClick={() => setEdit(a)} className="h-9 w-9 grid place-items-center rounded-xl text-forest hover:bg-mint/60"><Pencil size={16} /></button>
          </div>
        ))}
        {unassigned !== 0 && <div className="flex justify-between px-4 py-3 text-[13px] text-muted"><span>Not assigned to an account</span><Money value={unassigned} /></div>}
        <div className="p-3"><Button block variant="soft" icon={Plus} onClick={() => setEdit({ name: '', type: 'cash' })}>Add account</Button></div>
      </Card>
      {edit && <AccountSheet initial={edit} onClose={() => setEdit(null)} run={run} />}
    </section>
  );
}
function AccountSheet({ initial, onClose, run }: { initial: Partial<Account>; onClose: () => void; run: ReturnType<typeof useAction> }) {
  const [name, setName] = useState(initial.name ?? '');
  const [type, setType] = useState<Account['type']>(initial.type ?? 'cash');
  const [archived, setArchived] = useState(!!initial.archived);
  const submit = async () => { if (await run(() => saveAccount({ id: initial.id, name, type, archived }), 'Account saved')) onClose(); };
  return (
    <Sheet open onClose={onClose} title={initial.id ? 'Edit account' : 'New account'} footer={<Button block size="lg" variant="primary" onClick={submit} disabled={!name.trim()}>Save</Button>}>
      <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={30} /></Field>
      <p className="text-[13px] font-semibold mt-4 mb-2">Type</p>
      <Segmented value={type} onChange={setType} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }, { value: 'card', label: 'Card' }, { value: 'wallet', label: 'Wallet' }]} />
      {initial.id && <div className="flex items-center justify-between mt-5"><span className="text-[14px] font-semibold">Archived</span><Toggle checked={archived} onChange={setArchived} label="Archived" /></div>}
    </Sheet>
  );
}

function AuditLog() {
  const [open, setOpen] = useState(false);
  const logs = useLiveQuery(() => (open ? db.auditLogs.orderBy('at').reverse().limit(60).toArray() : Promise.resolve([] as import('../engine').AuditLog[])), [open]);
  return (
    <section>
      <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-muted px-1 mb-2">Audit trail</h2>
      <Card className="overflow-hidden">
        <ActionLine icon={History} label={open ? 'Hide recent changes' : 'Show recent changes'} onClick={() => setOpen((o) => !o)} />
        {open && (
          <ul className="divide-y divide-line border-t border-line max-h-96 overflow-y-auto">
            {(logs ?? []).map((l) => <li key={l.id} className="px-4 py-2.5"><p className="text-[13px] font-semibold">{l.summary}</p><p className="text-[11px] text-muted">{new Date(l.at).toLocaleString()} · {l.entity} · {l.action}</p></li>)}
            {logs && logs.length === 0 && <li className="px-4 py-4 text-[13px] text-muted">No changes recorded yet.</li>}
          </ul>
        )}
      </Card>
    </section>
  );
}

