import { useEffect, useState } from 'react';
import { Cloud, CloudUpload, CloudDownload, LogOut, Lock, Copy, KeyRound } from 'lucide-react';
import * as cloud from '../data/cloud';
import { exportBackup, importBackup } from '../data/repo';
import { isDemoMode } from '../data/db';
import { useFinance } from '../hooks/useFinance';
import { useAction, useConfirm, useToast } from '../ui/overlay';
import { Button, Card, Field, Input, Toggle } from '../ui/kit';

export function useCloudState() {
  const [s, setS] = useState(cloud.loadCloudState());
  const [unlocked, setUnlocked] = useState(cloud.hasPassword());
  useEffect(() => {
    const on = () => { setS(cloud.loadCloudState()); setUnlocked(cloud.hasPassword()); };
    window.addEventListener('nafaqa:cloud', on);
    return () => window.removeEventListener('nafaqa:cloud', on);
  }, []);
  return { ...s, unlocked, refresh: () => { setS(cloud.loadCloudState()); setUnlocked(cloud.hasPassword()); } };
}

const deviceName = () => (/iPhone|iPad/.test(navigator.userAgent) ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'Browser');

/** Debounced background upload after local changes, when signed in, unlocked and online. */
export function CloudAutoSync() {
  const { data } = useFinance();
  const st = useCloudState();
  useEffect(() => {
    if (isDemoMode() || !st.autoSync || !st.session || !st.unlocked) return;
    const t = setTimeout(async () => {
      if (!navigator.onLine) return;
      try { await cloud.pushBackup(await exportBackup(), deviceName()); } catch { /* retried on next change */ }
    }, 15000);
    return () => clearTimeout(t);
  }, [data, st.autoSync, st.session, st.unlocked]);
  return null;
}

export function CloudBackupSection() {
  const st = useCloudState();
  const run = useAction();
  const toast = useToast();
  const confirm = useConfirm();
  const [url, setUrl] = useState(st.config?.url ?? '');
  const [key, setKey] = useState(st.config?.anonKey ?? '');
  const [email, setEmail] = useState(st.session?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  if (isDemoMode()) {
    return <Wrap><p className="p-4 text-[13px] text-muted">Cloud backup is disabled in demo mode.</p></Wrap>;
  }

  const go = async (label: string, fn: () => Promise<unknown>, ok?: string) => { setBusy(label); await run(fn, ok); setBusy(null); st.refresh(); };

  const auth = (mode: 'in' | 'up') => go(mode, async () => {
    const cfg = cloud.normalizeConfig(url, key);
    if (mode === 'up') {
      const s = await cloud.signUp(cfg, email, password);
      if (!s) { toast('Account created — confirm your email, then sign in.', 'info'); return; }
    } else await cloud.signIn(cfg, email, password);
    setPassword('');
    const remote = await cloud.remoteInfo();
    if (remote && (await confirm({ title: 'Cloud backup found', text: `A backup from ${new Date(remote.updatedAt).toLocaleString()}${remote.device ? ` (${remote.device})` : ''} exists. Restore it onto this device? This replaces local data.`, confirm: 'Restore', cancel: 'Keep local' }))) {
      const r = await cloud.pullBackup();
      if (r) await importBackup(r.json);
      toast('Cloud backup restored');
    } else toast('Signed in to cloud backup');
  });

  const unlock = () => go('unlock', async () => {
    if (!st.config || !st.session) return;
    await cloud.signIn(st.config, st.session.email, password); // verifies password with the server
    setPassword('');
  }, 'Cloud backup unlocked');

  const push = () => go('push', async () => cloud.pushBackup(await exportBackup(), deviceName()), 'Encrypted backup uploaded');
  const pull = async () => {
    if (!(await confirm({ title: 'Restore from cloud?', text: 'Your data on this device will be replaced by the cloud backup.', confirm: 'Restore', danger: true }))) return;
    go('pull', async () => {
      const r = await cloud.pullBackup();
      if (!r) throw new Error('No cloud backup exists yet.');
      await importBackup(r.json);
    }, 'Restored from cloud');
  };

  if (!st.session) {
    return (
      <Wrap note="Optional. Your data is encrypted on this device with your password before upload — the server only stores ciphertext. If you forget the password, the cloud copy cannot be recovered.">
        <div className="p-4 space-y-3">
          <Field label="Supabase project URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" inputMode="url" autoCapitalize="off" /></Field>
          <Field label="Public anon key"><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" autoCapitalize="off" /></Field>
          <button onClick={() => setShowSql((v) => !v)} className="text-[12px] font-bold text-forest">{showSql ? 'Hide' : 'Show'} one-time database setup</button>
          {showSql && (
            <div className="rounded-2xl bg-ink text-cream p-3 text-[11px] font-mono whitespace-pre-wrap break-all relative">
              {cloud.SETUP_SQL}
              <button aria-label="Copy SQL" onClick={() => navigator.clipboard?.writeText(cloud.SETUP_SQL).then(() => toast('SQL copied'))} className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-lg bg-white/10"><Copy size={14} /></button>
              <p className="font-sans text-cream/70 mt-2">Run this once in Supabase → SQL editor.</p>
            </div>
          )}
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
          <Field label="Password" hint="Also used as your encryption key."><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="dark" icon={Cloud} loading={busy === 'in'} disabled={!url || !key || !email || !password} onClick={() => auth('in')}>Sign in</Button>
            <Button variant="outline" loading={busy === 'up'} disabled={!url || !key || !email || password.length < 8} onClick={() => auth('up')}>Create account</Button>
          </div>
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap note="Backups are end-to-end encrypted. Restoring replaces this device's data.">
      <div className="px-4 py-3.5 flex items-center gap-3">
        <Cloud size={18} className="text-forest" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold truncate">{st.session.email}</p>
          <p className="text-[12px] text-muted">{st.lastSyncAt ? `Last synced ${new Date(st.lastSyncAt).toLocaleString()}` : 'Not synced yet'}</p>
        </div>
      </div>
      {!st.unlocked ? (
        <div className="p-4 flex gap-2 items-end">
          <Field label="Password to unlock" className="flex-1"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button variant="dark" icon={KeyRound} loading={busy === 'unlock'} disabled={!password} onClick={unlock}>Unlock</Button>
        </div>
      ) : (
        <>
          <div className="p-4 grid grid-cols-2 gap-2">
            <Button variant="soft" icon={CloudUpload} loading={busy === 'push'} onClick={push}>Back up now</Button>
            <Button variant="outline" icon={CloudDownload} loading={busy === 'pull'} onClick={pull}>Restore</Button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1"><p className="text-[14px] font-semibold">Automatic backup</p><p className="text-[12px] text-muted">Upload shortly after each change while online</p></div>
            <Toggle checked={st.autoSync} onChange={(v) => { cloud.updateCloudState({ autoSync: v }); st.refresh(); }} label="Automatic backup" />
          </div>
        </>
      )}
      <button onClick={() => { cloud.signOut(); st.refresh(); toast('Signed out of cloud backup'); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-[14px] font-semibold hover:bg-mint/30">
        <LogOut size={18} className="text-forest" /> Sign out {!st.unlocked && <Lock size={14} className="text-muted" />}
      </button>
    </Wrap>
  );
}

function Wrap({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <section>
      <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-muted px-1 mb-2">Cloud backup & sync</h2>
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
      {note && <p className="text-[12px] text-muted px-1 mt-2">{note}</p>}
    </section>
  );
}
