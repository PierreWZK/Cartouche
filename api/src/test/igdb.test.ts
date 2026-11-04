import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapIgdbGame, parseQuery, type IgdbGame } from '../games.js';
import { UpstreamError, createUpstream } from '../upstream.js';

const igdbGame: IgdbGame = {
  id: 1,
  slug: 'orbite-test',
  name: 'Orbite Test',
  first_release_date: 1262304000, // 1er janvier 2010, UTC
  summary: 'Un résumé.',
  total_rating: 80,
  cover: { image_id: 'co1abc' },
  platforms: [{ name: 'PC' }, { name: 'PlayStation 5' }],
  genres: [{ name: 'Puzzle' }],
  involved_companies: [
    { developer: false, company: { name: 'Éditeur' } },
    { developer: true, company: { name: 'Studio' } },
  ],
};

test('mapIgdbGame convertit la date, la note sur 5, le studio développeur et la jaquette', () => {
  const g = mapIgdbGame(igdbGame);
  assert.equal(g.id, 'orbite-test');
  assert.equal(g.year, 2010);
  assert.equal(g.studio, 'Studio');
  assert.equal(g.ratingRawg, 4);
  assert.deepEqual(g.platforms, ['PC', 'PlayStation 5']);
  assert.equal(g.cover, 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg');
});

test('mapIgdbGame transforme les captures en URL grand format, et liste vide sans capture', () => {
  const g = mapIgdbGame({ ...igdbGame, screenshots: [{ image_id: 'sc1' }] });
  assert.deepEqual(g.screenshots, ['https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc1.jpg']);
  assert.deepEqual(mapIgdbGame(igdbGame).screenshots, []);
});

test('mapIgdbGame gère les champs absents sans inventer de valeur', () => {
  const g = mapIgdbGame({ id: 2, slug: 'vide', name: 'Vide' });
  assert.equal(g.year, 0);
  assert.equal(g.studio, '');
  assert.equal(g.ratingRawg, 0);
  assert.equal(g.description, '');
  assert.equal(g.cover, null);
});

test('sans RAWG, la liste vient d’IGDB et le compte est lu sur /games/count', async () => {
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('https://id.twitch.tv')) {
      return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
    }
    if (u.endsWith('/games/count')) return new Response(JSON.stringify({ count: 42 }), { status: 200 });
    if (u.endsWith('/games')) {
      assert.match(String(init?.body), /where version_parent = null & cover != null/);
      return new Response(JSON.stringify([igdbGame]), { status: 200 });
    }
    return new Response('{}', { status: 500 });
  }) as typeof fetch;

  const upstream = createUpstream({ rawgKey: '', igdbClientId: 'id', igdbClientSecret: 'sec' }, fakeFetch);
  const result = await upstream.games(parseQuery({ sort: 'year', size: '6' }));
  assert.equal(result.total, 42);
  assert.equal(result.items[0]?.name, 'Orbite Test');
});

test('RAWG en panne : repli sur IGDB, puis RAWG n’est plus interrogé pendant la pause', async () => {
  let rawgCalls = 0;
  let now = 0;
  const fakeFetch = (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.startsWith('https://api.rawg.io')) {
      rawgCalls++;
      return new Response('down', { status: 522 });
    }
    if (u.startsWith('https://id.twitch.tv')) {
      return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
    }
    if (u.endsWith('/games/count')) return new Response(JSON.stringify({ count: 1 }), { status: 200 });
    return new Response(JSON.stringify([igdbGame]), { status: 200 });
  }) as typeof fetch;

  const upstream = createUpstream({ rawgKey: 'k', igdbClientId: 'id', igdbClientSecret: 'sec' }, fakeFetch, () => now);
  assert.equal((await upstream.games(parseQuery({ size: '6' }))).items.length, 1);
  assert.equal(rawgCalls, 1);

  // Deuxième appel pendant la pause : on passe directement par IGDB.
  now = 30_000;
  await upstream.games(parseQuery({ size: '7' }));
  assert.equal(rawgCalls, 1);
});

test('RAWG en panne et IGDB absent : erreur 502, pas de données inventées', async () => {
  const fakeFetch = (async () => new Response('down', { status: 522 })) as typeof fetch;
  const upstream = createUpstream({ rawgKey: 'k', igdbClientId: '', igdbClientSecret: '' }, fakeFetch);
  await assert.rejects(upstream.games(parseQuery({})), (err) => err instanceof UpstreamError && err.status === 502);
});
