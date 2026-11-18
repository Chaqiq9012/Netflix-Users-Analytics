/**
 * Calendar dates are stored as ISO strings "YYYY-MM-DD" in the Africa/Casablanca
 * local calendar. All arithmetic here is pure calendar math (UTC-based), so it is
 * independent of the device timezone.
 */
export type ISODate = string;
export const APP_TIMEZONE = 'Africa/Casablanca';

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Today's calendar date in the given timezone. */
export function todayIn(tz = APP_TIMEZONE, now: Date = new Date()): ISODate {
  const parts = fmt(tz).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Hour of day (0-23) in the given timezone. */
export function hourIn(tz = APP_TIMEZONE, now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now);
  return parseInt(h, 10);
}

function toUTC(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}
function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function isValidDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return fromUTC(toUTC(d)) === d;
}

export const addDays = (d: ISODate, n: number): ISODate => fromUTC(toUTC(d) + n * 86400000);
export const diffDays = (a: ISODate, b: ISODate): number => Math.round((toUTC(a) - toUTC(b)) / 86400000);
/** 0 = Monday … 6 = Sunday */
export const weekday = (d: ISODate): number => (new Date(toUTC(d)).getUTCDay() + 6) % 7;
export const startOfWeek = (d: ISODate): ISODate => addDays(d, -weekday(d));
export const endOfWeek = (d: ISODate): ISODate => addDays(startOfWeek(d), 6);

export const monthKey = (d: ISODate): string => d.slice(0, 7);
export const startOfMonth = (d: ISODate): ISODate => d.slice(0, 7) + '-01';
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export const endOfMonth = (d: ISODate): ISODate => `${d.slice(0, 7)}-${String(daysInMonth(d.slice(0, 7))).padStart(2, '0')}`;
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b);
export const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WD_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const weekdayShort = (i: number) => WD[i];
export const weekdayLong = (i: number) => WD_LONG[i];
export const monthName = (month: string, long = true) => (long ? MONTHS_LONG : MONTHS)[Number(month.slice(5, 7)) - 1] + ' ' + month.slice(0, 4);

export function formatDate(d: ISODate, style: 'short' | 'long' | 'day' = 'short'): string {
  const [, m, day] = d.split('-').map(Number);
  if (style === 'day') return `${WD[weekday(d)]} ${day}`;
  if (style === 'long') return `${WD_LONG[weekday(d)]}, ${day} ${MONTHS_LONG[m - 1]} ${d.slice(0, 4)}`;
  return `${day} ${MONTHS[m - 1]}`;
}

/** "Today", "Yesterday", or "Mon 12 Nov" */
export function relativeDay(d: ISODate, today: ISODate): string {
  const diff = diffDays(d, today);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  const [, m, day] = d.split('-').map(Number);
  const yr = d.slice(0, 4) !== today.slice(0, 4) ? ' ' + d.slice(0, 4) : '';
  return `${WD[weekday(d)]} ${day} ${MONTHS[m - 1]}${yr}`;
}
