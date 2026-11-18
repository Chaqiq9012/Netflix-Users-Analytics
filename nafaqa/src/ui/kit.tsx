import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { formatMoney, type Cents, type WeekStatus } from '../engine';
import { useFinance } from '../hooks/useFinance';
import { iconFor } from '../lib/icons';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Renders an amount; respects the privacy "hide amounts" setting. */
export function Money({ value, sign, className, unit = true, colorize, compact }: { value: Cents; sign?: boolean; className?: string; unit?: boolean; colorize?: boolean; compact?: boolean }) {
  const { data } = useFinance();
  const hidden = data.settings.hideAmounts;
  const color = colorize ? (value > 0 ? 'text-sage' : value < 0 ? 'text-danger' : '') : '';
  return (
    <span className={cx('tnum', color, className)} aria-label={hidden ? 'hidden amount' : undefined}>
      {hidden ? '•••• ' + (unit ? 'DH' : '') : formatMoney(value, { sign, unit, compact })}
    </span>
  );
}

export function Card({ children, className, as: As = 'div', ...rest }: { children: ReactNode; className?: string; as?: any; [k: string]: any }) {
  return <As className={cx('card', className)} {...rest}>{children}</As>;
}

type Variant = 'primary' | 'dark' | 'soft' | 'ghost' | 'outline' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-[0_8px_20px_-8px_rgba(239,112,0,.6)] hover:brightness-105 active:brightness-95',
  dark: 'bg-forest text-cream hover:bg-deep',
  soft: 'bg-mint text-forest hover:bg-[#d9e3c3]',
  ghost: 'text-forest hover:bg-mint/60',
  outline: 'border border-line bg-card text-ink hover:border-forest/40',
  danger: 'bg-danger text-white hover:brightness-105'
};
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; block?: boolean; loading?: boolean }>(
  function Button({ variant = 'dark', size = 'md', icon: Icon, block, loading, className, children, disabled, ...rest }, ref) {
    const sz = size === 'sm' ? 'h-9 px-3.5 text-[13px] rounded-xl' : size === 'lg' ? 'h-14 px-6 text-[16px] rounded-2xl' : 'h-12 px-5 text-[15px] rounded-2xl';
    return (
      <button ref={ref} disabled={disabled || loading} className={cx('inline-flex items-center justify-center gap-2 font-bold whitespace-nowrap transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none select-none', sz, VARIANTS[variant], block && 'w-full', className)} {...rest}>
        {loading ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : Icon && <Icon size={size === 'sm' ? 16 : 18} strokeWidth={2.4} />}
        {children}
      </button>
    );
  }
);

export function IconButton({ icon: Icon, label, onClick, className, badge }: { icon: LucideIcon; label: string; onClick?: () => void; className?: string; badge?: number }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className={cx('relative h-11 w-11 grid place-items-center rounded-2xl border border-line bg-card text-forest hover:border-forest/40 transition active:scale-95', className)}>
      <Icon size={20} strokeWidth={2} />
      {!!badge && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold grid place-items-center">{badge > 9 ? '9+' : badge}</span>}
    </button>
  );
}

export function ProgressBar({ value, tone = 'green', className, height = 8 }: { value: number; tone?: 'green' | 'orange' | 'cream' | 'danger'; className?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill = tone === 'orange' ? 'bg-accent' : tone === 'cream' ? 'bg-cream' : tone === 'danger' ? 'bg-danger' : 'bg-sage';
  const track = tone === 'cream' ? 'bg-white/15' : 'bg-mint';
  return (
    <div className={cx('w-full rounded-full overflow-hidden', track, className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-700 ease-out', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className, tone = 'forest' }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string; tone?: 'forest' | 'split' }) {
  return (
    <div className={cx('flex p-1 rounded-2xl bg-mint/70 border border-line', className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        const activeCls = tone === 'split' ? (o.value === 'expense' ? 'bg-ink text-cream' : 'bg-forest text-cream') : 'bg-card text-forest shadow-soft';
        return (
          <button key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)} className={cx('flex-1 h-10 rounded-xl text-[13px] font-bold transition', active ? activeCls : 'text-muted hover:text-ink')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="block text-[13px] font-semibold text-ink mb-1.5">{label}</span>
      {children}
      {error ? <span className="block text-[12px] text-danger mt-1.5 font-medium">{error}</span> : hint ? <span className="block text-[12px] text-muted mt-1.5">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx('input', className)} {...rest} />;
});

export function MoneyField({ value, onChange, autoFocus, large, placeholder = '0', id }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; large?: boolean; placeholder?: string; id?: string }) {
  return (
    <div className={cx('flex items-baseline gap-2 rounded-2xl bg-white border border-line focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/10 transition', large ? 'px-5 py-4' : 'px-4 h-12 items-center')}>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ''))}
        className={cx('flex-1 min-w-0 bg-transparent outline-none tnum font-extrabold text-ink placeholder:text-muted/40', large ? 'text-[40px] leading-none tracking-tight' : 'text-[16px]')}
      />
      <span className={cx('font-bold text-muted', large ? 'text-xl' : 'text-sm')}>DH</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-6">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-mint text-forest grid place-items-center mb-4"><Icon size={24} /></div>
      <p className="font-bold text-ink">{title}</p>
      {text && <p className="text-[13px] text-muted mt-1 max-w-[280px] mx-auto">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const STATUS: Record<WeekStatus, { label: string; cls: string }> = {
  comfortable: { label: 'Comfortable', cls: 'bg-mint text-forest' },
  'on-track': { label: 'On track', cls: 'bg-sage/20 text-forest' },
  'catch-up': { label: 'Catch-up required', cls: 'bg-accent/15 text-accent' },
  achieved: { label: 'Goal achieved', cls: 'bg-forest text-cream' },
  'monthly-achieved': { label: 'Monthly goal achieved', cls: 'bg-forest text-cream' },
  'insufficient-days': { label: 'Not enough working days', cls: 'bg-danger/10 text-danger' }
};
export function StatusPill({ status, className }: { status: WeekStatus; className?: string }) {
  const s = STATUS[status];
  return <span className={cx('inline-flex items-center h-7 px-3 rounded-full text-[12px] font-bold', s.cls, className)}>{s.label}</span>;
}
export const statusLabel = (s: WeekStatus) => STATUS[s].label;

export function CategoryIcon({ icon, kind, size = 40, className }: { icon?: string; kind?: 'income' | 'expense' | 'transfer' | 'bill'; size?: number; className?: string }) {
  const Icon = iconFor(icon);
  const tone = kind === 'income' ? 'bg-mint text-forest' : kind === 'transfer' ? 'bg-forest/10 text-forest' : kind === 'bill' ? 'bg-accent/10 text-accent' : 'bg-[#F3ECDF] text-ink';
  return (
    <span className={cx('grid place-items-center rounded-2xl shrink-0', tone, className)} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.46)} strokeWidth={2} />
    </span>
  );
}

export function SectionTitle({ title, to, action, className }: { title: string; to?: string; action?: string; className?: string }) {
  return (
    <div className={cx('flex items-center justify-between mb-3 px-1', className)}>
      <h2 className="text-[16px] font-extrabold text-ink tracking-tight">{title}</h2>
      {to && (
        <Link to={to} className="text-[13px] font-bold text-forest inline-flex items-center gap-0.5 hover:underline">
          {action ?? 'See all'} <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="flex items-center gap-3 pt-2 pb-5">
      {back && (
        <button aria-label="Back" onClick={() => (typeof back === 'string' ? nav(back) : window.history.length > 1 ? nav(-1) : nav('/'))} className="h-11 w-11 grid place-items-center rounded-2xl border border-line bg-card text-forest active:scale-95">
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-[24px] leading-tight font-extrabold tracking-tight text-ink truncate">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted mt-0.5 truncate">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Stat({ label, value, sub, className, tone }: { label: string; value: ReactNode; sub?: ReactNode; className?: string; tone?: 'dark' }) {
  return (
    <div className={className}>
      <p className={cx('label', tone === 'dark' && '!text-cream/60')}>{label}</p>
      <p className={cx('mt-1 text-[17px] font-extrabold tracking-tight', tone === 'dark' ? 'text-cream' : 'text-ink')}>{value}</p>
      {sub && <p className={cx('text-[12px] mt-0.5', tone === 'dark' ? 'text-cream/60' : 'text-muted')}>{sub}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx('relative h-7 w-12 rounded-full transition shrink-0', checked ? 'bg-forest' : 'bg-line')}>
      <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Row({ children, onClick, to, className }: { children: ReactNode; onClick?: () => void; to?: string; className?: string }) {
  const cls = cx('flex items-center gap-3 px-4 py-3.5 w-full text-left transition hover:bg-mint/30 active:bg-mint/50', className);
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{children}</button>;
  return <div className={cx(cls, 'hover:bg-transparent active:bg-transparent')}>{children}</div>;
}
