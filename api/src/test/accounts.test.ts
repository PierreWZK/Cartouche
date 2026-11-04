import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { newDb } from 'pg-mem';
import { createApp } from '../app.js';
import type { Db } from '../db.js';
import { migrate } from '../db.js';
import { createUpstream } from '../upstream.js';
import * as store from '../store.js';

// Teste les comptes, favoris, notes et étagère partagée sur une base PostgreSQL en mémoire.

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

function cookieFrom(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  return raw.split(';')[0] ?? '';
}

async function post(base: string, path: string, body: unknown, cookie?: string, origin = ORIGIN) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

test('dix échecs de connexion bloquent l’email, même avec le bon mot de passe', async () => {
  const { base, close } = await start();
  try {
    await post(base, '/api/auth/register', { email: 'brute@example.test', password: 'motdepasse1' });
    for (let i = 0; i < 10; i++) {
      const bad = await post(base, '/api/auth/login', { email: 'brute@example.test', password: 'mauvais' });
      assert.equal(bad.status, 401);
    }
    const blocked = await post(base, '/api/auth/login', { email: 'brute@example.test', password: 'motdepasse1' });
    assert.equal(blocked.status, 429);
    assert.equal(((await blocked.json()) as { error: string }).error, 'too_many_attempts');
  } finally {
    close();
  }
});

test('inscription, session, déconnexion et connexion', async () => {
  const { base, close } = await start();
  try {
    const reg = await post(base, '/api/auth/register', { email: 'Ada@Example.test', password: 'motdepasse1' });
    assert.equal(reg.status, 201);
    const user = (await reg.json()) as { email: string; shareId: string };
    assert.equal(user.email, 'ada@example.test', 'l’email est normalisé en minuscules');
    const session = cookieFrom(reg);
    assert.match(session, /^cartouche_session=/);

    const me = await fetch(base + '/api/me', { headers: { Cookie: session } });
    assert.equal(me.status, 200);

    const dup = await post(base, '/api/auth/register', { email: 'ada@example.test', password: 'autrechose1' });
    assert.equal(dup.status, 409);

    const bad = await post(base, '/api/auth/login', { email: 'ada@example.test', password: 'mauvais' });
    assert.equal(bad.status, 401);

    const ok = await post(base, '/api/auth/login', { email: 'ada@example.test', password: 'motdepasse1' });
    assert.equal(ok.status, 200);

    const out = await post(base, '/api/auth/logout', {}, session);
    assert.equal(out.status, 200);
    const after = await fetch(base + '/api/me', { headers: { Cookie: session } });
    assert.equal(after.status, 401, 'la session supprimée n’ouvre plus rien');
  } finally {
    close();
  }
});

test('mot de passe trop court et email invalide sont refusés', async () => {
  const { base, close } = await start();
  try {
    assert.equal((await post(base, '/api/auth/register', { email: 'a@b.test', password: 'court' })).status, 400);
    assert.equal((await post(base, '/api/auth/register', { email: 'pas-un-email', password: 'motdepasse1' })).status, 400);
  } finally {
    close();
  }
});

test('favoris : ajout idempotent, liste, retrait', async () => {
  const { base, close } = await start();
  try {
    const session = cookieFrom(await post(base, '/api/auth/register', { email: 'b@x.test', password: 'motdepasse1' }));
    const put = (id: string) =>
      fetch(`${base}/api/me/favorites/${id}`, { method: 'PUT', headers: { Cookie: session, Origin: ORIGIN } });
    assert.equal((await put('phare-du-nord')).status, 200);
    assert.equal((await put('phare-du-nord')).status, 200);
    assert.equal((await put('dunes')).status, 200);

    const list = (await (await fetch(base + '/api/me/favorites', { headers: { Cookie: session } })).json()) as {
      gameIds: string[];
    };
    assert.deepEqual(list.gameIds, ['phare-du-nord', 'dunes']);

    await fetch(`${base}/api/me/favorites/dunes`, { method: 'DELETE', headers: { Cookie: session, Origin: ORIGIN } });
    const after = (await (await fetch(base + '/api/me/favorites', { headers: { Cookie: session } })).json()) as {
      gameIds: string[];
    };
    assert.deepEqual(after.gameIds, ['phare-du-nord']);
  } finally {
    close();
  }
});

test('écritures depuis une autre origine sont refusées', async () => {
  const { base, close } = await start();
  try {
    const res = await post(base, '/api/auth/register', { email: 'c@x.test', password: 'motdepasse1' }, undefined, 'https://evil.test');
    assert.equal(res.status, 403);
  } finally {
    close();
  }
});

test('étagère partagée : lecture publique par identifiant, sans email', async () => {
  const { base, close } = await start();
  try {
    const session = cookieFrom(await post(base, '/api/auth/register', { email: 'd@x.test', password: 'motdepasse1' }));
    await fetch(`${base}/api/me/favorites/neon-minuit`, { method: 'PUT', headers: { Cookie: session, Origin: ORIGIN } });
    const { shareId } = (await (await fetch(base + '/api/me/share', { headers: { Cookie: session } })).json()) as {
      shareId: string;
    };
    // Étagère privée par défaut : il faut la rendre publique pour la partager.
    await fetch(`${base}/api/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: session, Origin: ORIGIN },
      body: JSON.stringify({ shelfPublic: true }),
    });

    const shelf = await fetch(`${base}/api/shelves/${shareId}`);
    assert.equal(shelf.status, 200);
    const body = (await shelf.json()) as Record<string, unknown>;
    assert.deepEqual(body['gameIds'], ['neon-minuit']);
    assert.equal('email' in body, false);
    assert.equal((await fetch(`${base}/api/shelves/inconnu-xyz`)).status, 404);
  } finally {
    close();
  }
});

test('notes de la communauté : une note par personne et par jeu, moyenne calculée', async () => {
  const { base, db, close } = await start();
  try {
    const a = cookieFrom(await post(base, '/api/auth/register', { email: 'e@x.test', password: 'motdepasse1' }));
    const b = cookieFrom(await post(base, '/api/auth/register', { email: 'f@x.test', password: 'motdepasse1' }));
    const rate = (cookie: string, score: number) =>
      fetch(`${base}/api/games/luna-rousse/rating`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
        body: JSON.stringify({ score }),
      });
    assert.equal((await rate(a, 5)).status, 200);
    assert.equal((await rate(a, 3)).status, 200, 'une seconde note remplace la première');
    assert.equal((await rate(b, 4)).status, 200);
    assert.equal((await rate(b, 9)).status, 400);

    const ratings = await store.communityRatings(db, ['luna-rousse', 'jamais-note']);
    assert.deepEqual(ratings.get('luna-rousse'), { average: 3.5, count: 2 });
    assert.equal(ratings.has('jamais-note'), false);
  } finally {
    close();
  }
});
