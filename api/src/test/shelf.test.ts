import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { newDb } from 'pg-mem';
import { createApp } from '../app.js';
import { type Db, migrate } from '../db.js';
import type { Game } from '../games.js';
import { createUpstream } from '../upstream.js';
import * as store from '../store.js';
import { FALLBACK_GAMES } from '../data/fallback-games.js';

const slugify = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Étagère et cache des fiches : sans aucune API configurée, les jeux déjà en base doivent rester visibles.
const ORIGIN = 'http://localhost:4200';

const orbite: Game = {
  id: 'orbite-test',
  name: 'Orbite Test',
  year: 2010,
  studio: 'Studio',
  platforms: ['PC'],
  genres: ['Puzzle'],
  ratingRawg: 4,
  ratingCart: null,
  description: 'Un résumé.',
  art: 'linear-gradient(#000, #fff)',
  band: '#222',
  cover: null,
  screenshots: [],
};

async function start(): Promise<{ base: string; db: Db; close: () => void }> {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const db = new Pool() as unknown as Db;
  await migrate(db);
  const app = createApp({
    // Aucune clé : l'API amont échoue à coup sûr, comme si RAWG et IGDB étaient coupés.
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

async function registerCookie(base: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: 'pierre@example.com', password: 'motdepasse1' }),
  });
  assert.equal(res.status, 201);
  return (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

test('l’étagère vient du cache, sans appel aux API, et ignore les favoris inconnus', async () => {
  const { base, db, close } = await start();
  try {
    const cookie = await registerCookie(base);
    const userId = (await store.findUserByEmail(db, 'pierre@example.com'))!.id;
    await store.saveGames(db, [orbite]);
    await store.addFavorite(db, userId, 'orbite-test');
    await store.addFavorite(db, userId, 'jeu-inconnu');

    const res = await fetch(`${base}/api/me/shelf`, { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { items: Game[] };
    assert.deepEqual(
      body.items.map((g) => g.name),
      ['Orbite Test'],
    );
  } finally {
    close();
  }
});

test('la fiche d’un jeu en cache reste accessible quand l’API est coupée', async () => {
  const { base, db, close } = await start();
  try {
    await store.saveGames(db, [orbite]);
    const res = await fetch(`${base}/api/games/orbite-test`);
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as Game).name, 'Orbite Test');
  } finally {
    close();
  }
});

test('hors ligne, la recherche et les fiches utilisent la base de secours', async () => {
  const { base, close } = await start();
  try {
    const sample = FALLBACK_GAMES[0]!;
    const search = (await (await fetch(`${base}/api/games?q=${encodeURIComponent(sample.name)}`)).json()) as { items: Game[]; total: number };
    assert.ok(search.items.some((g) => g.id === sample.id), 'la recherche doit trouver le jeu de secours');

    const fiche = await fetch(`${base}/api/games/${sample.id}`);
    assert.equal(fiche.status, 200);
    assert.equal(((await fiche.json()) as Game).id, sample.id);
  } finally {
    close();
  }
});

test('hors ligne, les filtres genre et décennie s’appliquent à la base de secours', async () => {
  const { base, close } = await start();
  try {
    const sample = FALLBACK_GAMES.find((g) => g.year >= 1970 && g.year < 2030)!;
    const genre = slugify(sample.genres[0]!);
    const decade = Math.floor(sample.year / 10) * 10;
    const body = (await (await fetch(`${base}/api/games?genre=${genre}&decade=${decade}`)).json()) as { items: Game[] };
    assert.ok(body.items.length > 0);
    for (const g of body.items) {
      assert.ok(g.genres.some((x) => slugify(x) === genre));
      assert.ok(g.year >= decade && g.year < decade + 10);
    }
  } finally {
    close();
  }
});

test('un jeu inconnu et hors ligne répond 502, sans erreur interne', async () => {
  const { base, close } = await start();
  try {
    const res = await fetch(`${base}/api/games/jeu-inconnu`);
    assert.notEqual(res.status, 500);
  } finally {
    close();
  }
});
