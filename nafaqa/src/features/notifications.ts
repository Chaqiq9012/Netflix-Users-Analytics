import { formatMoney, formatDate, type FinanceData, type Snapshot, upcomingWithin } from '../engine';

export interface AppNotice { key: string; tone: 'warn' | 'info' | 'good'; title: string; text: string; to: string }

export function buildNotices(data: FinanceData, snap: Snapshot, hour: number): AppNotice[] {
  const out: AppNotice[] = [];
  const n = data.settings.notifications;
  const today = snap.today;
  if (snap.allocation.deficit > 0) {
    out.push({ key: `deficit-${today}`, tone: 'warn', title: 'Money shortfall', text: `Your protected money is ${formatMoney(snap.allocation.deficit)} more than your balance.`, to: '/pockets' });
  }
  if (n.weeklyRecovery && snap.recovery) {
    out.push({ key: `recovery-${snap.recovery.weekStart}`, tone: 'warn', title: 'Weekly savings review', text: `You're ${formatMoney(snap.recovery.shortfall)} short for the week of ${formatDate(snap.recovery.weekStart)}.`, to: '/goals/recovery' });
  }
  if (n.bills) {
    const subs = new Map(data.subscriptions.map((s) => [s.id, s]));
    for (const o of upcomingWithin(data.subscriptions, data.payments, today, 14)) {
      const s = subs.get(o.subscriptionId)!;
      if (!o.overdue && o.daysUntil > s.reminderDays) continue;
      out.push({
        key: `bill-${o.subscriptionId}-${o.period}`, tone: o.overdue || o.daysUntil === 0 ? 'warn' : 'info',
        title: o.overdue ? `${s.name} is overdue` : o.daysUntil === 0 ? `${s.name} renews today` : `${s.name} renews in ${o.daysUntil} day${o.daysUntil > 1 ? 's' : ''}`,
        text: `${formatMoney(o.amount)} due ${formatDate(o.dueDate)}. Already reserved from your balance.`, to: `/subscriptions/${s.id}`
      });
    }
  }
  if (n.dailyTarget && hour >= 17 && !snap.week.todayIsRest && !snap.week.todayMet && snap.week.todayTarget > 0) {
    out.push({ key: `target-${today}`, tone: 'info', title: "Today's savings target", text: `Save ${formatMoney(snap.week.todayTarget - Math.max(0, snap.week.savedToday))} more today to stay on track.`, to: '/goals' });
  }
  return out;
}

/** Fire OS notifications once per key when the user opted in and granted permission. */
export function pushBrowserNotices(notices: AppNotice[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  let seen: string[] = [];
  try { seen = JSON.parse(localStorage.getItem('nafaqa:notified') ?? '[]'); } catch { /* ignore */ }
  const fresh = notices.filter((n) => !seen.includes(n.key));
  for (const n of fresh) {
    try { new Notification(n.title, { body: n.text, icon: './icon-192.png', tag: n.key }); } catch { /* some browsers need SW notifications */ }
  }
  try { localStorage.setItem('nafaqa:notified', JSON.stringify([...seen, ...fresh.map((f) => f.key)].slice(-100))); } catch { /* ignore */ }
}
