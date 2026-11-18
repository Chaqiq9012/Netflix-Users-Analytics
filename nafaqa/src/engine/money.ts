/**
 * Money is always stored and computed as integer centimes (1 DH = 100 centimes).
 * Never use floats for arithmetic; only parsing/formatting touch strings.
 */
export type Cents = number;

export const DH = (dirhams: number): Cents => Math.round(dirhams * 100);

/** Parse user input like "1 250,50", "1250.5", "1,250" into centimes. Returns null when invalid. */
export function parseMoney(input: string): Cents | null {
  if (input == null) return null;
  let s = String(input).trim().replace(/\s|DH|MAD/gi, '');
  if (!s) return null;
  // Decide decimal separator: the last of "," or "." followed by 1-2 digits at the end.
  const m = s.match(/^(.*?)[.,](\d{1,2})$/);
  let intPart: string;
  let frac = '';
  if (m) {
    intPart = m[1];
    frac = m[2];
  } else {
    intPart = s;
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || (frac && !/^\d+$/.test(frac))) return null;
  if (intPart.length > 12) return null;
  const cents = parseInt(intPart, 10) * 100 + (frac ? parseInt(frac.padEnd(2, '0'), 10) : 0);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Round UP to the nearest whole dirham (positive amounts). */
export function ceilDirham(c: Cents): Cents {
  if (c <= 0) return 0;
  const r = c % 100;
  return r === 0 ? c : c - r + 100;
}

export function sum(values: Cents[]): Cents {
  let t = 0;
  for (const v of values) t += v;
  return t;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Format centimes: "12,000 DH" or "12,000.50 DH". */
export function formatMoney(c: Cents, opts: { sign?: boolean; unit?: boolean; compact?: boolean } = {}): string {
  const { sign = false, unit = true, compact = false } = opts;
  const neg = c < 0;
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  let body: string;
  if (compact && whole >= 10000) {
    const k = whole / 1000;
    body = (k >= 100 ? Math.round(k).toString() : (Math.round(k * 10) / 10).toString()) + 'k';
  } else {
    body = whole.toLocaleString('en-US') + (frac ? '.' + String(frac).padStart(2, '0') : '');
  }
  const prefix = neg ? '−' : sign && c > 0 ? '+' : '';
  return prefix + body + (unit ? ' DH' : '');
}

/** Centimes -> editable input string. */
export function centsToInput(c: Cents): string {
  const whole = Math.floor(Math.abs(c) / 100);
  const frac = Math.abs(c) % 100;
  return (c < 0 ? '-' : '') + whole + (frac ? '.' + String(frac).padStart(2, '0') : '');
}
