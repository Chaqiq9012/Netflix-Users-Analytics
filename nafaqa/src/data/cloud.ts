/**
 * Optional Supabase cloud backup & sync.
 *  - Auth: Supabase email/password (GoTrue REST).
 *  - Storage: one row per user in table `nafaqa_backups` protected by row-level security.
 *  - Privacy: the payload is encrypted on-device (see crypto.ts) before upload.
 * Nothing here runs unless the user configures a project and signs in.
 */
import { seal, open, type Sealed } from './crypto';

export interface CloudConfig { url: string; anonKey: string }
export interface CloudSession { accessToken: string; refreshToken: string; expiresAt: number; userId: string; email: string }
export interface CloudState { config: CloudConfig | null; session: CloudSession | null; autoSync: boolean; lastSyncAt: number | null; lastRemoteAt: string | null }

const KEY = 'nafaqa:cloud';
/** The password is kept only in memory (needed to encrypt/decrypt); it is never stored. */
let memoryPassword: string | null = null;

export class CloudError extends Error {}

export function loadCloudState(): CloudState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && typeof s === 'object') return { config: s.config ?? null, session: s.session ?? null, autoSync: !!s.autoSync, lastSyncAt: s.lastSyncAt ?? null, lastRemoteAt: s.lastRemoteAt ?? null };
  } catch { /* ignore */ }
  return { config: null, session: null, autoSync: false, lastSyncAt: null, lastRemoteAt: null };
}
function saveCloudState(s: CloudState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  window.dispatchEvent(new Event('nafaqa:cloud'));
}
export function updateCloudState(patch: Partial<CloudState>): CloudState {
  const next = { ...loadCloudState(), ...patch };
  saveCloudState(next);
  return next;
}

export const hasPassword = () => memoryPassword !== null;
export const setPassword = (p: string | null) => { memoryPassword = p; };

export function normalizeConfig(url: string, anonKey: string): CloudConfig {
  let u = url.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u)) throw new CloudError('Enter your Supabase project URL, e.g. https://abcd.supabase.co');
  const k = anonKey.trim();
  if (k.length < 20) throw new CloudError('Enter the project’s public anon key.');
  return { url: u, anonKey: k };
}

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);
export const __setFetch = (f: Fetch) => { fetchImpl = f; };

async function call(cfg: CloudConfig, path: string, init: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = { apikey: cfg.anonKey, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  headers.Authorization = `Bearer ${init.token ?? cfg.anonKey}`;
  let res: Response;
  try {
    res = await fetchImpl(cfg.url + path, { ...init, headers });
  } catch {
    throw new CloudError('Could not reach the cloud. Check your connection.');
  }
  const text = await res.text();
  const body = text ? safeJSON(text) : null;
  if (!res.ok) {
    const msg = body?.error_description || body?.msg || body?.message || body?.error || `Cloud request failed (${res.status}).`;
    throw new CloudError(String(msg));
  }
  return body;
}
const safeJSON = (t: string) => { try { return JSON.parse(t); } catch { return null; } };

function toSession(body: any): CloudSession {
  if (!body?.access_token) throw new CloudError('Check your email to confirm the account, then sign in.');
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + (Number(body.expires_in ?? 3600) - 60) * 1000,
    userId: body.user?.id,
    email: body.user?.email
  };
}

export async function signIn(cfg: CloudConfig, email: string, password: string): Promise<CloudSession> {
  const body = await call(cfg, '/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
  const session = toSession(body);
  memoryPassword = password;
  updateCloudState({ config: cfg, session });
  return session;
}

export async function signUp(cfg: CloudConfig, email: string, password: string): Promise<CloudSession | null> {
  if (password.length < 8) throw new CloudError('Use a password of at least 8 characters.');
  const body = await call(cfg, '/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
  if (!body?.access_token) { updateCloudState({ config: cfg }); return null; } // email confirmation required
  const session = toSession(body);
  memoryPassword = password;
  updateCloudState({ config: cfg, session });
  return session;
}

export function signOut() {
  memoryPassword = null;
  updateCloudState({ session: null, autoSync: false });
}

async function validSession(): Promise<{ cfg: CloudConfig; s: CloudSession }> {
  const st = loadCloudState();
  if (!st.config || !st.session) throw new CloudError('Sign in to cloud backup first.');
  if (Date.now() < st.session.expiresAt) return { cfg: st.config, s: st.session };
  const body = await call(st.config, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: st.session.refreshToken }) });
  const s = toSession(body);
  updateCloudState({ session: s });
  return { cfg: st.config, s };
}

function requirePassword(): string {
  if (!memoryPassword) throw new CloudError('Enter your password to unlock cloud backup on this device.');
  return memoryPassword;
}

export interface RemoteInfo { updatedAt: string; device: string; bytes: number }

/** Encrypt the local backup and upsert it as this user's single row. */
export async function pushBackup(json: string, device: string): Promise<RemoteInfo> {
  const { cfg, s } = await validSession();
  const sealed = await seal(json, requirePassword());
  const updatedAt = new Date().toISOString();
  const row = { user_id: s.userId, payload: sealed, device, updated_at: updatedAt };
  await call(cfg, '/rest/v1/nafaqa_backups?on_conflict=user_id', { method: 'POST', token: s.accessToken, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
  updateCloudState({ lastSyncAt: Date.now(), lastRemoteAt: updatedAt });
  return { updatedAt, device, bytes: JSON.stringify(sealed).length };
}

export async function remoteInfo(): Promise<RemoteInfo | null> {
  const { cfg, s } = await validSession();
  const rows = await call(cfg, `/rest/v1/nafaqa_backups?select=updated_at,device&user_id=eq.${encodeURIComponent(s.userId)}`, { token: s.accessToken });
  const r = Array.isArray(rows) ? rows[0] : null;
  return r ? { updatedAt: r.updated_at, device: r.device ?? '', bytes: 0 } : null;
}

/** Download and decrypt this user's backup JSON. */
export async function pullBackup(): Promise<{ json: string; updatedAt: string } | null> {
  const { cfg, s } = await validSession();
  const rows = await call(cfg, `/rest/v1/nafaqa_backups?select=payload,updated_at&user_id=eq.${encodeURIComponent(s.userId)}`, { token: s.accessToken });
  const r = Array.isArray(rows) ? rows[0] : null;
  if (!r) return null;
  const json = await open(r.payload as Sealed, requirePassword());
  updateCloudState({ lastSyncAt: Date.now(), lastRemoteAt: r.updated_at });
  return { json, updatedAt: r.updated_at };
}

export const SETUP_SQL = `create table if not exists public.nafaqa_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  device text,
  updated_at timestamptz not null default now()
);
alter table public.nafaqa_backups enable row level security;
create policy "own backup" on public.nafaqa_backups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`;
