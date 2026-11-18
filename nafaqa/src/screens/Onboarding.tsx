import { useState } from 'react';
import { ShieldCheck, PiggyBank, Repeat, FlaskConical } from 'lucide-react';
import { formatMoney, parseMoney, todayIn, periodKeyOf, periodLabel } from '../engine';
import { addTransaction, updateSettings } from '../data/repo';
import { DEMO_FLAG } from '../data/db';
import { useAction } from '../ui/overlay';
import { Button, Field, Input, MoneyField, cx } from '../ui/kit';
import { Logo } from '../App';

export default function Onboarding() {
  const run = useAction();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [reserve, setReserve] = useState('500');
  const [startDay, setStartDay] = useState(1);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    const b = balance.trim() ? parseMoney(balance) : 0;
    const r = parseMoney(reserve);
    if (b === null || r === null) return;
    setBusy(true);
    await run(async () => {
      if (b > 0) await addTransaction({ kind: 'income', amount: b, description: 'Opening balance', categoryId: 'inc-other', date: todayIn('Africa/Casablanca'), isOpening: true });
      await updateSettings({ userName: name.trim(), emergencyReserve: r, monthStartDay: startDay, onboarded: true });
    }, 'Welcome to Nafaqa');
    setBusy(false);
  };
  const demo = () => { localStorage.setItem(DEMO_FLAG, '1'); location.hash = '#/'; location.reload(); };

  return (
    <div className="min-h-dvh max-w-md mx-auto px-5 pt-safe flex flex-col">
      <div className="pt-10 flex-1 animate-fade-in">
        <Logo size={56} />
        {step === 0 ? (
          <>
            <h1 className="text-[32px] leading-tight font-extrabold tracking-tight mt-8">Money that adapts to how you earn.</h1>
            <p className="text-[15px] text-muted mt-3 leading-relaxed">Nafaqa is built for irregular, daily income. It tells you what's safe to spend, what to save today, and what's coming next.</p>
            <ul className="mt-8 space-y-4">
              {[
                [PiggyBank, 'Adaptive savings targets', 'Your daily target adjusts to what you saved and the days you work.'],
                [Repeat, 'Bills reserved in advance', 'Subscriptions are set aside before they renew.'],
                [ShieldCheck, 'Private & offline', 'Everything stays on this device.']
              ].map(([I, t, d]: any) => (
                <li key={t} className="flex gap-4"><span className="h-11 w-11 rounded-2xl bg-mint text-forest grid place-items-center shrink-0"><I size={20} /></span><div><p className="font-bold text-[15px]">{t}</p><p className="text-[13px] text-muted">{d}</p></div></li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h1 className="text-[26px] font-extrabold tracking-tight mt-8">Let's set you up</h1>
            <p className="text-[14px] text-muted mt-1">You can change all of this later in Settings.</p>
            <div className="space-y-5 mt-6">
              <Field label="What should we call you?"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={30} autoFocus /></Field>
              <Field label="How much money do you have right now?" hint="Recorded as an opening balance (not counted as income)."><MoneyField value={balance} onChange={setBalance} /></Field>
              <Field label="Emergency reserve" hint="Always protected and never counted as safe to spend."><MoneyField value={reserve} onChange={setReserve} /></Field>
              <MonthStartPicker value={startDay} onChange={setStartDay} />
              <div className="rounded-2xl bg-card border border-line p-4 text-[13px] text-muted">
                Default goals: <b className="text-ink">{formatMoney(15000)}</b> daily reference · <b className="text-ink">{formatMoney(100000)}</b> weekly · <b className="text-ink">{formatMoney(400000)}</b> per month. Weeks run Monday to Sunday, Africa/Casablanca time.
              </div>
            </div>
          </>
        )}
      </div>
      <div className="py-6 pb-safe space-y-3">
        {step === 0 ? (
          <>
            <Button block size="lg" variant="primary" onClick={() => setStep(1)}>Get started</Button>
            <Button block variant="ghost" icon={FlaskConical} onClick={demo}>Explore with demo data</Button>
          </>
        ) : (
          <>
            <Button block size="lg" variant="primary" onClick={finish} loading={busy} disabled={(balance.trim() !== '' && parseMoney(balance) === null) || parseMoney(reserve) === null}>Start using Nafaqa</Button>
            <Button block variant="ghost" onClick={() => setStep(0)}>Back</Button>
          </>
        )}
      </div>
    </div>
  );
}

const PRESETS = [1, 5, 10, 15, 20, 25];

/** "When does your month start?" — e.g. payday or rent day. Shared with Settings. */
export function MonthStartPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  const today = todayIn('Africa/Casablanca');
  const custom = !PRESETS.includes(value);
  return (
    <div>
      <span className="block text-[13px] font-semibold text-ink mb-1.5">When does your month start?</span>
      <div className="grid grid-cols-6 gap-1.5">
        {PRESETS.map((d) => (
          <button key={d} type="button" onClick={() => onChange(d)} aria-pressed={value === d}
            className={cx('h-11 rounded-xl text-[13px] font-bold border transition', value === d ? 'bg-forest text-cream border-forest' : 'bg-card border-line')}>
            {d === 1 ? '1st' : d + 'th'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[13px] text-muted">Other day:</span>
        <select aria-label="Month start day" value={value} onChange={(e) => onChange(Number(e.target.value))}
          className={cx('input !h-10 !w-24 !px-3', custom && '!border-forest')}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <span className="block text-[12px] text-muted mt-1.5">
        Your monthly savings goal and reports run from this day — e.g. your payday. Current month: <b className="text-ink">{periodLabel(periodKeyOf(today, value), value)}</b>
        {value > 28 && '. In shorter months it starts on the last day.'}
      </span>
    </div>
  );
}
