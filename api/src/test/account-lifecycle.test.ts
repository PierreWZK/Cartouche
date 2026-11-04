import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { newDb } from 'pg-mem';
import { createApp } from '../app.js';
import { type Db, migrate } from '../db.js';
import { createUpstream } from '../upstream.js';

// Cycle de vie du compte : limite d'inscriptions par IP, suppression avec mot de passe, note relue.
// Module testé : app.ts. Les autres tests de comptes sont dans accounts.test.ts et profile.test.ts.
const ORIGIN = 'http://localhost:4200';

async function start(): Promise<{ base: string; close: () => void }> {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const db = new Pool() as unknown as Db;
  await migrate(db);
  const app = createApp({
    upstream: createUpstream({ rawgKey: '', igdbClientId: '', igdbClientSecret: '' }),
    db,
    corsOrigin: ORIGIN,
    secureCookies: false,
  });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return { base: `http://localhost:${port}`, close: () => server.close() };
}

const json = (method: string, body: unknown, cookie?: string) => ({
  method,
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});

async function register(base: string, email: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/register`, json('POST', { email, password: 'motdepasse1' }));
  assert.equal(res.status, 201);
  return (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

test('au-delà de cinq inscriptions par heure depuis la même adresse, refus 429', async () => {
  const { base, close } = await start();
  try {
    for (let i = 0; i < 5; i++) await register(base, `inscrit${i}@example.com`);
    const res = await fetch(`${base}/api/auth/register`, json('POST', { email: 'de-trop@example.com', password: 'motdepasse1' }));
    assert.equal(res.status, 429);
  } finally {
    close();
  }
});

test('la suppression du compte exige le bon mot de passe, puis tout disparaît', async () => {
  const { base, close } = await start();
  try {
    const cookie = await register(base, 'supprime@example.com');
    const wrong = await fetch(`${base}/api/me`, json('DELETE', { password: 'mauvais-mot' }, cookie));
    assert.equal(wrong.status, 403);

    const ok = await fetch(`${base}/api/me`, json('DELETE', { password: 'motdepasse1' }, cookie));
    assert.equal(ok.status, 200);

    assert.equal((await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).status, 401);
    const login = await fetch(`${base}/api/auth/login`, json('POST', { email: 'supprime@example.com', password: 'motdepasse1' }));
    assert.equal(login.status, 401);
  } finally {
    close();
  }
});

test('ma note sur un jeu se relit, et vaut null tant que je n’ai pas noté', async () => {
  const { base, close } = await start();
  try {
    const cookie = await register(base, 'note@example.com');
    const before = (await (await fetch(`${base}/api/me/ratings/orbite-test`, { headers: { Cookie: cookie } })).json()) as { score: number | null };
    assert.equal(before.score, null);

    await fetch(`${base}/api/games/orbite-test/rating`, json('PUT', { score: 4 }, cookie));
    const after = (await (await fetch(`${base}/api/me/ratings/orbite-test`, { headers: { Cookie: cookie } })).json()) as { score: number | null };
    assert.equal(after.score, 4);
  } finally {
    close();
  }
});
