import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Button, cx } from './kit';

export function Sheet({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    setTimeout(() => panel.current?.querySelector<HTMLElement>('[autofocus],input,button')?.focus(), 50);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-deep/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div ref={panel} className={cx('relative w-full bg-cream rounded-t-[28px] md:rounded-[28px] shadow-lift animate-sheet-up md:animate-pop flex flex-col max-h-[92dvh]', size === 'lg' ? 'md:max-w-xl' : 'md:max-w-md')}>
        <div className="md:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" />
        {title !== undefined && (
          <div className="flex items-center justify-between px-5 pt-3 md:pt-5 pb-2">
            <h3 className="text-[18px] font-extrabold tracking-tight">{title}</h3>
            <button aria-label="Close" onClick={onClose} className="h-9 w-9 grid place-items-center rounded-xl text-muted hover:bg-mint/60"><X size={20} /></button>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-4 flex-1">{children}</div>
        {footer && <div className="px-5 pt-2 pb-5 pb-safe border-t border-line/60 bg-cream rounded-b-[28px]"><div className="pb-2">{footer}</div></div>}
      </div>
    </div>,
    document.body
  );
}

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem { id: number; text: string; tone: ToastTone; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(text: string, tone?: ToastTone, action?: ToastItem['action']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: ToastTone = 'success', action?: ToastItem['action']) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, text, tone, action }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), action ? 5000 : 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="fixed top-0 inset-x-0 z-[60] pt-safe flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
          {items.map((t) => {
            const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
            return (
              <div key={t.id} className={cx('pointer-events-auto mt-3 max-w-md w-full flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lift animate-toast text-[14px] font-semibold', t.tone === 'error' ? 'bg-danger text-white' : 'bg-forest text-cream')}>
                <Icon size={18} className={t.tone === 'success' ? 'text-sage' : ''} />
                <span className="flex-1">{t.text}</span>
                {t.action && <button className="font-bold text-accent" onClick={() => { t.action!.run(); setItems((s) => s.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

interface ConfirmOpts { title: string; text?: ReactNode; confirm?: string; cancel?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Sheet open={!!state} onClose={() => close(false)}>
        {state && (
          <div className="pt-4 pb-2">
            <div className={cx('h-12 w-12 rounded-2xl grid place-items-center mb-4', state.danger ? 'bg-danger/10 text-danger' : 'bg-mint text-forest')}>
              {state.danger ? <AlertTriangle size={22} /> : <Info size={22} />}
            </div>
            <h3 className="text-[19px] font-extrabold tracking-tight">{state.title}</h3>
            {state.text && <div className="text-[14px] text-muted mt-2 leading-relaxed">{state.text}</div>}
            <div className="grid grid-cols-2 gap-3 mt-6 pb-safe">
              <Button variant="outline" onClick={() => close(false)}>{state.cancel ?? 'Cancel'}</Button>
              <Button variant={state.danger ? 'danger' : 'dark'} onClick={() => close(true)} autoFocus>{state.confirm ?? 'Confirm'}</Button>
            </div>
          </div>
        )}
      </Sheet>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

/** Run a repo action with toast feedback; returns true on success. */
export function useAction() {
  const toast = useToast();
  return useCallback(async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast(success, 'success');
      return true;
    } catch (e: any) {
      toast(e?.message ?? 'Something went wrong.', 'error');
      return false;
    }
  }, [toast]);
}
