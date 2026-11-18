import { describe, it, expect, beforeEach } from 'vitest';

// Minimal browser shims for the node test environment.
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
(globalThis as any).window = globalThis;
if (!(globalThis as any).dispatchEvent) (globalThis as any).dispatchEvent = () => true;

import { seal, open } from '../src/data/crypto';
import * as cloud from '../src/data/cloud';

describe('backup encryption', () => {
  it('round-trips and never stores plaintext', async () => {
    const secret = JSON.stringify({ transactions: [{ amount: 125000, description: 'Salary-like income' }] });
    const s = await seal(secret, 'correct horse');
    expect(JSON.stringify(s)).not.toContain('Salary');
    expect(await open(s, 'correct horse')).toBe(secret);
  });
  it('rejects a wrong password', async () => {
    const s = await seal('hello', 'pw-one-123');
    await expect(open(s, 'pw-two-123')).rejects.toThrow(/wrong password/);
  });
  it('uses a fresh salt and IV each time', async () => {
    const a = await seal('x', 'pw'), b = await seal('x', 'pw');
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
  });
});

describe('supabase client (mocked server)', () => {
  const cfg = cloud.normalizeConfig('https://demo.supabase.co/', 'anon-key-0123456789abcdef');
  let rows: Record<string, any>;
  let lastAuth: string | null;
  beforeEach(() => {
    store.clear();
    rows = {};
    cloud.setPassword(null);
    cloud.__setFetch(async (input: any, init: any = {}) => {
      const url = String(input);
      lastAuth = init.headers?.Authorization ?? null;
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
      if (url.includes('/auth/v1/token?grant_type=password')) {
        const { password } = JSON.parse(init.body);
        if (password !== 'hunter2-strong') return json({ error_description: 'Invalid login credentials' }, 400);
        return json({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } });
      }
      if (url.includes('/rest/v1/nafaqa_backups') && init.method === 'POST') {
        const row = JSON.parse(init.body);
        rows[row.user_id] = row;
        return new Response('', { status: 201 });
      }
      if (url.includes('/rest/v1/nafaqa_backups')) {
        const id = decodeURIComponent(url.split('user_id=eq.')[1]);
        return json(rows[id] ? [rows[id]] : []);
      }
      return json({ message: 'not found' }, 404);
    });
  });

  it('validates config', () => {
    expect(cfg.url).toBe('https://demo.supabase.co');
    expect(() => cloud.normalizeConfig('http://x', 'short')).toThrow();
  });
  it('reports bad credentials', async () => {
    await expect(cloud.signIn(cfg, 'a@b.c', 'nope')).rejects.toThrow(/Invalid login/);
  });
  it('pushes an encrypted backup and pulls it back', async () => {
    await cloud.signIn(cfg, 'a@b.c', 'hunter2-strong');
    await cloud.pushBackup('{"app":"nafaqa","secret":"12,000 DH"}', 'iPhone');
    expect(lastAuth).toBe('Bearer tok');
    expect(JSON.stringify(rows.u1.payload)).not.toContain('12,000');
    const got = await cloud.pullBackup();
    expect(got!.json).toContain('12,000 DH');
    expect(cloud.loadCloudState().lastRemoteAt).toBeTruthy();
  });
  it('requires the password in memory after sign-out', async () => {
    await cloud.signIn(cfg, 'a@b.c', 'hunter2-strong');
    cloud.signOut();
    await expect(cloud.pushBackup('{}', 'x')).rejects.toThrow(/Sign in/);
  });
  it('does not persist the password', async () => {
    await cloud.signIn(cfg, 'a@b.c', 'hunter2-strong');
    expect([...store.values()].join()).not.toContain('hunter2');
  });
});
