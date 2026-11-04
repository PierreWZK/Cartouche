import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../cache.js';
import { MAX_PAGE, mapGame, parseQuery, rawgOrdering, type RawgGame } from '../games.js';
import { NotConfiguredError, UpstreamError, createUpstream } from '../upstream.js';

// Teste games.ts, cache.ts et upstream.ts. Aucun test existant ; ta consigne : « t'arrêtes pas avant l'étape 5 ».

test('parseQuery borne et filtre les paramètres d’adresse', () => {
  const q = parseQuery({
    q: 'x'.repeat(500),
    genre: 'rpg,../../etc,action',
    platform: 'pc',
    sort: 'pire',
    page: '999',
    size: '-3',
  });
  assert.equal(q.q.length, 100);
  assert.deepEqual(q.genre, ['rpg', 'action']);
  assert.deepEqual(q.platform, ['pc']);
  assert.equal(q.sort, 'name');
  // Une page hors bornes ne revient plus à la page 1 : elle est juste au-delà de MAX_PAGE.
  assert.equal(q.page, MAX_PAGE + 1);
  assert.equal(q.size, 12);
});

test('parseQuery accepte un tri valide et une page dans les bornes', () => {
  const q = parseQuery({ sort: 'rating', page: '3', size: '20' });
  assert.equal(q.sort, 'rating');
  assert.equal(q.page, 3);
  assert.equal(q.size, 20);
});

test('rawgOrdering traduit chaque tri', () => {
  assert.equal(rawgOrdering('name'), 'name');
  assert.equal(rawgOrdering('year'), '-released');
  assert.equal(rawgOrdering('rating'), '-rating');
});

const raw: RawgGame = {
  id: 1,
  slug: 'orbite-test',
  name: 'Orbite Test',
  released: '2024-03-01',
  background_image: 'https://example.test/cover.jpg',
  rating: 4.27,
  platforms: [{ platform: { name: 'PC' } }],
  genres: [{ name: 'Exploration' }],
  developers: [{ name: 'Studio Halo' }],
};

test('mapGame convertit un jeu RAWG en forme commune', () => {
  const g = mapGame(raw);
  assert.equal(g.id, 'orbite-test');
  assert.equal(g.year, 2024);
  assert.equal(g.studio, 'Studio Halo');
  assert.deepEqual(g.platforms, ['PC']);
  assert.equal(g.ratingRawg, 4.3);
  assert.equal(g.ratingCart, null);
  assert.equal(g.cover, 'https://example.test/cover.jpg');
  assert.match(g.art, /linear-gradient/);
});

test('mapGame utilise le résumé IGDB quand RAWG n’a pas de description', () => {
  assert.equal(mapGame(raw, 'Résumé IGDB').description, 'Résumé IGDB');
  assert.equal(mapGame({ ...raw, description_raw: 'RAWG' }, 'IGDB').description, 'RAWG');
});

test('TtlCache expire après sa durée de vie', () => {
  let t = 0;
  const cache = new TtlCache<string>(1000, () => t);
  cache.set('a', 'valeur');
  assert.equal(cache.get('a'), 'valeur');
  t = 1000;
  assert.equal(cache.get('a'), undefined);
});

test('sans clé RAWG, le client refuse sans appeler le réseau', async () => {
  let calls = 0;
  const upstream = createUpstream(
    { rawgKey: '', igdbClientId: '', igdbClientSecret: '' },
    (async () => {
      calls++;
      return new Response('{}');
    }) as typeof fetch,
  );
  await assert.rejects(upstream.games(parseQuery({})), NotConfiguredError);
  assert.equal(calls, 0);
});

test('RAWG injoignable ou trop lent : erreur 502 propre, avec un délai maximal sur la requête', async () => {
  let signal: AbortSignal | null | undefined;
  const fakeFetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    signal = init?.signal;
    throw new DOMException('délai dépassé', 'TimeoutError');
  }) as typeof fetch;
  const upstream = createUpstream({ rawgKey: 'k', igdbClientId: '', igdbClientSecret: '' }, fakeFetch);

  await assert.rejects(upstream.games(parseQuery({})), (err) => err instanceof UpstreamError && err.status === 502);
  assert.ok(signal, 'la requête doit porter un signal de délai');
});

test('games() appelle RAWG avec les paramètres et met la réponse en cache', async () => {
  const urls: string[] = [];
  const fakeFetch = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ count: 1, results: [raw] }), { status: 200 });
  }) as typeof fetch;
  const upstream = createUpstream({ rawgKey: 'k', igdbClientId: '', igdbClientSecret: '' }, fakeFetch);

  const query = parseQuery({ q: 'orbite', genre: 'exploration', sort: 'year' });
  const first = await upstream.games(query);
  const second = await upstream.games(query);

  assert.equal(first.total, 1);
  assert.equal(second.items[0]?.id, 'orbite-test');
  assert.equal(urls.length, 1, 'la deuxième requête doit venir du cache');
  const url = new URL(urls[0]!);
  assert.equal(url.searchParams.get('key'), 'k');
  assert.equal(url.searchParams.get('search'), 'orbite');
  assert.equal(url.searchParams.get('genres'), 'exploration');
  assert.equal(url.searchParams.get('ordering'), '-released');
});
