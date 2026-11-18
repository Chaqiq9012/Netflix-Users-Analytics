import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { Home as HomeIcon, ListOrdered, Repeat, Target, BarChart3, CalendarDays, Wallet, Settings as Cog, FlaskConical } from 'lucide-react';
import { FinanceProvider, useFinance } from './hooks/useFinance';
import { ToastProvider, ConfirmProvider } from './ui/overlay';
import { ActionsProvider } from './features/actions';
import { CloudAutoSync } from './features/CloudBackup';
import { cx } from './ui/kit';
import { isDemoMode, DEMO_FLAG } from './data/db';
import Home from './screens/Home';
import Onboarding from './screens/Onboarding';

const Activity = lazy(() => import('./screens/Activity'));
const TxForm = lazy(() => import('./screens/TxForm'));
const TxDetail = lazy(() => import('./screens/TxDetail'));
const Subscriptions = lazy(() => import('./screens/Subscriptions'));
const SubscriptionDetail = lazy(() => import('./screens/SubscriptionDetail'));
const Goals = lazy(() => import('./screens/Goals'));
const Recovery = lazy(() => import('./screens/Recovery'));
const MonthSummary = lazy(() => import('./screens/MonthSummary'));
const Insights = lazy(() => import('./screens/Insights'));
const Calendar = lazy(() => import('./screens/Calendar'));
const Pockets = lazy(() => import('./screens/Pockets'));
const Settings = lazy(() => import('./screens/Settings'));

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/activity', label: 'Activity', icon: ListOrdered },
  { to: '/subscriptions', label: 'Bills', icon: Repeat },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/insights', label: 'Insights', icon: BarChart3 }
];
const EXTRA = [
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/pockets', label: 'Money allocation', icon: Wallet },
  { to: '/settings', label: 'Settings', icon: Cog }
];

function Splash() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <Logo size={56} />
        <span className="h-5 w-5 rounded-full border-2 border-forest border-t-transparent animate-spin" />
      </div>
    </div>
  );
}

export function Logo({ size = 36, withText }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
        <rect width="512" height="512" rx="128" fill="#123D29" />
        <path d="M160 360V152h34l124 150V152h34v208h-34L194 210v150z" fill="#FBF5E9" />
        <circle cx="372" cy="140" r="30" fill="#EF7000" />
      </svg>
      {withText && <span className="text-[20px] font-extrabold tracking-tight text-forest">Nafaqa</span>}
    </span>
  );
}

function DemoBanner() {
  if (!isDemoMode()) return null;
  const exit = () => { localStorage.removeItem(DEMO_FLAG); location.hash = '#/'; location.reload(); };
  return (
    <div className="sticky top-0 z-40 bg-accent text-white text-[12px] font-semibold pt-safe">
      <div className="flex items-center justify-center gap-2 py-1.5 px-4">
        <FlaskConical size={14} /> Demo mode — sample data, your real data is untouched.
        <button onClick={exit} className="underline font-bold ml-1">Exit demo</button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const fullscreen = /^\/(add|tx\/[^/]+\/edit)/.test(loc.pathname);
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-dvh sticky top-0 border-r border-line bg-card/60 px-4 py-6">
        <div className="px-2 mb-8"><Logo withText /></div>
        <nav className="space-y-1">
          {[...NAV, ...EXTRA].map((n, i) => (
            <div key={n.to}>
              {i === NAV.length && <div className="h-px bg-line my-4 mx-2" />}
              <NavLink to={n.to} end={(n as any).end} className={({ isActive }) => cx('flex items-center gap-3 h-11 px-3 rounded-xl text-[14px] font-semibold transition', isActive ? 'bg-forest text-cream' : 'text-ink hover:bg-mint/60')}>
                <n.icon size={19} /> {n.label === 'Bills' ? 'Subscriptions' : n.label}
              </NavLink>
            </div>
          ))}
        </nav>
        <p className="mt-auto px-2 text-[11px] text-muted">Data stays on this device.</p>
      </aside>
      <main className={cx('flex-1 min-w-0 mx-auto w-full max-w-lg lg:max-w-3xl px-4 pt-safe', fullscreen ? 'pb-8' : 'pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-10')}>
        <div className="pt-3 lg:pt-8">{children}</div>
      </main>
      {!fullscreen && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-line pb-safe" aria-label="Main">
          <div className="max-w-lg mx-auto grid grid-cols-5 px-2">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex flex-col items-center justify-center gap-1 h-[64px] text-[11px] font-bold transition', isActive ? 'text-forest' : 'text-muted')}>
                {({ isActive }) => (
                  <>
                    <span className={cx('h-8 w-12 grid place-items-center rounded-full transition', isActive && 'bg-mint')}><n.icon size={21} strokeWidth={isActive ? 2.4 : 2} /></span>
                    {n.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function Gate() {
  const { data } = useFinance();
  if (!data.settings.onboarded) return <Onboarding />;
  return (
    <ActionsProvider>
      <CloudAutoSync />
      <Shell>
        <Suspense fallback={<div className="py-20 grid place-items-center"><span className="h-5 w-5 rounded-full border-2 border-forest border-t-transparent animate-spin" /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/add/:kind" element={<TxForm />} />
            <Route path="/tx/:id" element={<TxDetail />} />
            <Route path="/tx/:id/edit" element={<TxForm />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/subscriptions/:id" element={<SubscriptionDetail />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/goals/recovery" element={<Recovery />} />
            <Route path="/summary/:month?" element={<MonthSummary />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/pockets" element={<Pockets />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Shell>
    </ActionsProvider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ConfirmProvider>
          <DemoBanner />
          <FinanceProvider fallback={<Splash />}>
            <Gate />
          </FinanceProvider>
        </ConfirmProvider>
      </ToastProvider>
    </HashRouter>
  );
}
