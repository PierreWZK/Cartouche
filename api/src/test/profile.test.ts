import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { newDb } from 'pg-mem';
import { createApp } from '../app.js';
import { type Db, migrate } from '../db.js';
import { createUpstream } from '../upstream.js';

// Pseudo, page publique /u/pseudo et étagère privée par défaut. Module testé : app.ts (profil et partage).
// Le seul autre test de comptes est accounts.test.ts ; il ne couvre pas le pseudo.
const ORIGIN = 'http://localhost:4200';

async function start(): Promise<{ base: string; db: Db; close: () => void }> {
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
  return { base: `http://localhost:${port}`, db, close: () => server.close() };
}

async function register(base: string, email: string): Promise<{ cookie: string; shareId: string }> {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password: 'motdepasse1' }),
  });
  assert.equal(res.status, 201);
  const user = (await res.json()) as { shareId: string };
  return { cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '', shareId: user.shareId };
}

const putProfile = (base: string, cookie: string, body: unknown) =>
  fetch(`${base}/api/me/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify(body),
  });

test('l’étagère est privée par défaut : le lien partagé répond 404', async () => {
  const { base, close } = await start();
  try {
    const { shareId } = await register(base, 'a@example.com');
    assert.equal((await fetch(`${base}/api/shelves/${shareId}`)).status, 404);
  } finally {
    close();
  }
});

test('avec un pseudo et une étagère publique, la page /u/pseudo et le lien partagé s’ouvrent', async () => {
  const { base, close } = await start();
  try {
    const { cookie, shareId } = await register(base, 'b@example.com');
    assert.equal((await putProfile(base, cookie, { username: 'Pierre_R', shelfPublic: true })).status, 200);

    const page = await fetch(`${base}/api/u/pierre_r`);
    assert.equal(page.status, 200);
    assert.equal(((await page.json()) as { username: string }).username, 'pierre_r');
    assert.equal((await fetch(`${base}/api/shelves/${shareId}`)).status, 200);

    // Repasser en privé ferme la page /u/ comme le lien partagé.
    await putProfile(base, cookie, { shelfPublic: false });
    assert.equal((await fetch(`${base}/api/u/pierre_r`)).status, 404);
  } finally {
    close();
  }
});

test('les pseudos invalides ou réservés sont refusés, et un pseudo pris renvoie 409', async () => {
  const { base, close } = await start();
  try {
    const first = await register(base, 'c@example.com');
    const second = await register(base, 'd@example.com');
    assert.equal((await putProfile(base, first.cookie, { username: 'admin' })).status, 400);
    assert.equal((await putProfile(base, first.cookie, { username: 'ab' })).status, 400);
    assert.equal((await putProfile(base, first.cookie, { username: 'un pseudo' })).status, 400);
    assert.equal((await putProfile(base, first.cookie, { username: 'partage' })).status, 200);
    assert.equal((await putProfile(base, second.cookie, { username: 'partage' })).status, 409);
  } finally {
    close();
  }
});

test('sans connexion, on ne modifie pas le profil', async () => {
  const { base, close } = await start();
  try {
    const res = await fetch(`${base}/api/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ shelfPublic: true }),
    });
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});
