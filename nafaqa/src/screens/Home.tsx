import { Link, useNavigate } from 'react-router-dom';
import { Bell, Settings as Cog, Plus, Minus, ArrowLeftRight, Repeat, Moon, Sun, CheckCircle2, AlertTriangle, ChevronRight, CalendarDays, Wallet, PiggyBank, Receipt } from 'lucide-react';
import { formatDate, relativeDay, weekdayShort, eachDay, savingsBetween, formatMoney } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { useActions } from '../features/actions';
import { setRestDay } from '../data/repo';
import { useAction } from '../ui/overlay';
import { Button, Card, IconButton, Money, ProgressBar, SectionTitle, StatusPill, EmptyState, CategoryIcon, cx } from '../ui/kit';
import { TxRow } from '../features/TxRow';
import { Logo } from '../App';
import { RestCalendar } from '../engine';

function greeting(h: number) {
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { data, snap, today, hour, cat } = useFinance();
  const { openTransfer, openSubscription, openNotifications, openSave, noticeCount } = useActions();
  const nav = useNavigate();
  const run = useAction();
  const a = snap.allocation;
  const w = snap.week;
  const recent = [...data.transactions].sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt).slice(0, 5);
  const subs = new Map(data.subscriptions.map((s) => [s.id, s]));
  const upcoming = snap.reserved.slice(0, 3);
  const cal = new RestCalendar(data.restDays, data.settings.recurringRestWeekdays);
  const remainingToday = Math.max(0, w.todayTarget - Math.max(0, w.savedToday));

  const toggleRest = () =>
    run(() => setRestDay(today, !w.todayIsRest), w.todayIsRest ? 'Today is a working day again' : 'Rest day marked — target recalculated');

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <header className="flex items-center gap-3">
        <span className="lg:hidden"><Logo size={42} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-muted font-medium">{formatDate(today, 'long')}</p>
          <h1 className="text-[19px] leading-tight font-extrabold tracking-tight">{greeting(hour)}{data.settings.userName ? `, ${data.settings.userName}` : ''}</h1>
        </div>
        <IconButton icon={Bell} label="Notifications" onClick={openNotifications} badge={noticeCount} />
        <IconButton icon={Cog} label="Settings" onClick={() => nav('/settings')} />
      </header>

      {/* Alerts */}
      {snap.recovery && data.settings.notifications.weeklyRecovery && (
        <Link to="/goals/recovery" className="flex items-center gap-3 rounded-3xl bg-accent/10 border border-accent/25 p-4 animate-pop">
          <span className="h-10 w-10 rounded-2xl bg-accent text-white grid place-items-center shrink-0"><PiggyBank size={20} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold">Weekly review: {formatMoney(snap.recovery.shortfall)} short</p>
            <p className="text-[12px] text-muted">{snap.recovery.isCurrentWeek ? 'Your week ends today.' : `Week of ${formatDate(snap.recovery.weekStart)}.`} Decide how to handle it.</p>
          </div>
          <ChevronRight size={18} className="text-accent" />
        </Link>
      )}
      {a.deficit > 0 && (
        <Link to="/pockets" className="flex items-center gap-3 rounded-3xl bg-danger/10 border border-danger/25 p-4">
          <AlertTriangle className="text-danger shrink-0" size={22} />
          <div className="flex-1">
            <p className="text-[14px] font-bold text-danger">Shortfall of <Money value={a.deficit} /></p>
            <p className="text-[12px] text-muted">Your savings, bills and reserve need more than you have. Nothing has been borrowed — review your pockets.</p>
          </div>
        </Link>
      )}

      {/* Balance card */}
      <section className="relative overflow-hidden rounded-[28px] bg-forest text-cream p-5 shadow-lift">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sage/15" aria-hidden />
        <div className="absolute -right-4 top-20 h-24 w-24 rounded-full bg-accent/10" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-cream/60">Safe to spend</p>
            <Link to="/pockets" className="text-[12px] font-bold text-cream/80 inline-flex items-center gap-1 hover:text-cream"><Wallet size={14} /> Pockets</Link>
          </div>
          <p className="mt-1 text-[44px] leading-[1.05] font-extrabold tracking-tight"><Money value={a.safeToSpend} /></p>
          <p className="mt-1 text-[13px] text-cream/70">Total balance <Money value={a.balance} className="font-bold text-cream" /></p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Pocket label="Savings" value={a.savings} />
            <Pocket label="Bills" value={a.obligationsRequired} warn={a.obligationsCovered < a.obligationsRequired} />
            <Pocket label="Emergency" value={a.emergencyRequired} warn={a.emergencyCovered < a.emergencyRequired} />
          </div>
          {a.holding > 0 && <p className="mt-3 text-[12px] text-cream/70">Unallocated (held aside): <Money value={a.holding} className="font-bold text-cream" /></p>}
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="primary" size="lg" icon={Plus} onClick={() => nav('/add/income')}>Add income</Button>
          <Button variant="dark" size="lg" icon={Minus} onClick={() => nav('/add/expense')}>Add expense</Button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <QuickTile icon={ArrowLeftRight} label="Transfer" onClick={() => openTransfer()} />
          <QuickTile icon={Repeat} label="Subscription" onClick={() => openSubscription()} />
          <QuickTile icon={w.todayIsRest ? Sun : Moon} label={w.todayIsRest ? 'Undo rest day' : 'Mark rest day'} onClick={toggleRest} active={w.todayIsRest} />
        </div>
      </section>

      {/* Today's target */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="label">Today's savings target</p>
            <p className="mt-1 text-[32px] font-extrabold tracking-tight leading-tight">
              {w.todayIsRest ? <span className="text-muted">Rest day</span> : <Money value={w.todayTarget} />}
            </p>
            <p className="text-[13px] text-muted mt-1 leading-relaxed">{targetExplanation()}</p>
          </div>
          <TargetBadge />
        </div>
        {!w.todayIsRest && w.todayTarget > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between text-[12px] font-semibold text-muted mb-1.5">
              <span>Saved today <Money value={Math.max(0, w.savedToday)} className="text-ink font-bold" /></span>
              <span>{Math.min(100, Math.round((Math.max(0, w.savedToday) / w.todayTarget) * 100))}%</span>
            </div>
            <ProgressBar value={w.savedToday / w.todayTarget} tone={w.todayMet ? 'green' : 'orange'} />
          </>
        )}
        {!w.todayIsRest && remainingToday > 0 && (
          <Button variant="soft" block className="mt-4" icon={PiggyBank} onClick={() => openSave(Math.min(remainingToday, a.safeToSpend) || undefined, a.safeToSpend < remainingToday ? `Only ${formatMoney(a.safeToSpend)} is safe to move right now.` : undefined)}>
            Save {formatMoney(remainingToday)} now
          </Button>
        )}
      </Card>

      {/* Weekly card */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label">This week</p>
            <p className="text-[13px] text-muted mt-0.5">{formatDate(w.weekStart)} – {formatDate(w.weekEnd)}</p>
          </div>
          <StatusPill status={w.status} />
        </div>
        <div className="mt-4 flex items-end justify-between">
          <p className="text-[28px] font-extrabold tracking-tight leading-none"><Money value={Math.max(0, w.saved)} /></p>
          <p className="text-[13px] text-muted">of <Money value={w.goal} className="font-bold text-ink" /></p>
        </div>
        <ProgressBar value={w.progress} className="mt-3" height={10} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          <MiniStat label="Remaining" value={<Money value={w.effectiveRemaining} />} />
          <MiniStat label="Working days left" value={w.workingDaysRemaining} />
          <MiniStat label="Needed / day" value={w.requiredPerDay === null ? '—' : <Money value={w.requiredPerDay} />} />
        </div>
        {/* Day strip */}
        <div className="mt-5 grid grid-cols-7 gap-1.5">
          {eachDay(w.weekStart, w.weekEnd).map((d, i) => {
            const saved = savingsBetween(data.transfers, d, d);
            const isRest = cal.isRest(d);
            const isToday = d === today;
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <span className={cx('text-[10px] font-bold', isToday ? 'text-forest' : 'text-muted')}>{weekdayShort(i)[0]}</span>
                <span className={cx('h-8 w-8 rounded-full grid place-items-center text-[11px] font-bold border',
                  saved > 0 ? 'bg-sage text-white border-sage' : isRest ? 'bg-line/60 text-muted border-transparent' : d < today ? 'bg-card text-muted border-line' : 'bg-card text-ink border-line',
                  isToday && 'ring-2 ring-forest ring-offset-2 ring-offset-card')} title={isRest ? 'Rest day' : saved > 0 ? formatMoney(saved) : undefined}>
                  {isRest ? <Moon size={12} /> : saved > 0 ? <CheckCircle2 size={14} /> : Number(d.slice(8))}
                </span>
              </div>
            );
          })}
        </div>
        <Link to="/goals" className="mt-4 flex items-center justify-between text-[13px] font-bold text-forest">
          <span>Month: <Money value={Math.max(0, snap.month.saved)} /> of <Money value={snap.month.goal} /></span>
          <ChevronRight size={16} />
        </Link>
        <ProgressBar value={snap.month.progress} className="mt-2" height={5} />
      </Card>

      {/* Upcoming obligations */}
      <section>
        <SectionTitle title="Upcoming payments" to="/subscriptions" />
        <Card className="overflow-hidden">
          {upcoming.length === 0 ? (
            <EmptyState icon={Receipt} title="No upcoming bills" text="Add subscriptions so Nafaqa can reserve money before they renew." action={<Button size="sm" variant="soft" icon={Plus} onClick={() => openSubscription()}>Add subscription</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((o) => {
                const s = subs.get(o.subscriptionId)!;
                const covered = a.obligationsCovered >= a.obligationsRequired;
                return (
                  <li key={o.subscriptionId + o.period}>
                    <Link to={`/subscriptions/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-mint/30">
                      <CategoryIcon icon={cat(s.categoryId)?.icon} kind="bill" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold truncate">{s.name}</p>
                        <p className={cx('text-[12px]', o.overdue ? 'text-danger font-semibold' : 'text-muted')}>
                          {o.overdue ? `Overdue since ${formatDate(o.dueDate)}` : `${relativeDay(o.dueDate, today)} · in ${o.daysUntil} day${o.daysUntil === 1 ? '' : 's'}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <Money value={o.amount} className="text-[15px] font-bold block" />
                        <span className={cx('text-[11px] font-bold', covered ? 'text-sage' : 'text-accent')}>{covered ? 'Reserved' : 'Partly reserved'}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Recent */}
      <section>
        <SectionTitle title="Recent activity" to="/activity" />
        <Card className="overflow-hidden">
          {recent.length === 0 ? (
            <EmptyState icon={Plus} title="No transactions yet" text="Record your first income or expense to see your money come to life." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => nav('/add/income')}>Add income</Button>} />
          ) : (
            <div className="divide-y divide-line">{recent.map((t) => <TxRow key={t.id} tx={t} />)}</div>
          )}
        </Card>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/calendar" className="card p-4 flex items-center gap-3 hover:border-forest/40"><CalendarDays className="text-forest" size={20} /><span className="text-[14px] font-bold">Calendar</span></Link>
        <Link to={`/summary/${snap.month.month}`} className="card p-4 flex items-center gap-3 hover:border-forest/40"><Receipt className="text-forest" size={20} /><span className="text-[14px] font-bold">Month summary</span></Link>
      </div>
    </div>
  );

  function targetExplanation() {
    if (w.todayIsRest) return w.effectiveRemaining > 0 ? `Enjoy your rest. ${formatMoney(w.effectiveRemaining)} is spread over your ${w.workingDaysForward} remaining working day${w.workingDaysForward === 1 ? '' : 's'}.` : 'Enjoy your rest — your weekly goal is covered.';
    if (w.status === 'monthly-achieved') return 'Your monthly goal is reached — no savings are required today.';
    if (w.status === 'achieved') return 'Weekly goal reached. Anything extra still counts toward your month.';
    if (w.todayMet && w.todayTarget > 0) return `Done for today! ${w.requiredPerDay ? `Then ${formatMoney(w.requiredPerDay)} per working day keeps you on track.` : ''}`;
    if (w.status === 'insufficient-days') return 'No working days left this week to complete the goal.';
    return `Save ${formatMoney(w.todayTarget)} today to stay on track for your weekly goal (${formatMoney(w.effectiveRemaining)} left over ${w.workingDaysRemaining} working day${w.workingDaysRemaining === 1 ? '' : 's'}).`;
  }
  function TargetBadge() {
    const done = w.todayIsRest || w.todayMet || w.status === 'achieved' || w.status === 'monthly-achieved';
    return (
      <span className={cx('h-14 w-14 rounded-2xl grid place-items-center shrink-0', done ? 'bg-sage/15 text-sage' : 'bg-accent/10 text-accent')} aria-label={done ? 'Target achieved' : 'Target pending'}>
        {w.todayIsRest ? <Moon size={26} /> : done ? <CheckCircle2 size={28} /> : <PiggyBank size={26} />}
      </span>
    );
  }
}

function Pocket({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-2.5 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-cream/60 truncate">{label}</p>
      <p className="text-[14px] font-extrabold mt-0.5 truncate flex items-center gap-1"><Money value={value} />{warn && <AlertTriangle size={12} className="text-accent" />}</p>
    </div>
  );
}
function QuickTile({ icon: Icon, label, onClick, active }: { icon: any; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={cx('card !rounded-2xl flex flex-col items-center justify-center gap-1.5 h-[76px] text-[12px] font-bold transition active:scale-[.97] hover:border-forest/40', active && '!bg-mint !border-sage/50')}>
      <Icon size={20} className="text-forest" />{label}
    </button>
  );
}
function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-cream border border-line px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted leading-tight">{label}</p>
      <p className="text-[15px] font-extrabold mt-1 tnum">{value}</p>
    </div>
  );
}
