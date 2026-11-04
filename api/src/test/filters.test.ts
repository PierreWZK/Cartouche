import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery } from '../games.js';
import { createUpstream } from '../upstream.js';

test('parseQuery accepte une décennie et une note minimale valides, et écarte le reste', () => {
  const q = parseQuery({ decade: '1990', minRating: '4' });
  assert.equal(q.decade, 1990);
  assert.equal(q.minRating, 4);

  const bad = parseQuery({ decade: '1985', minRating: '9' });
  assert.equal(bad.decade, null);
  assert.equal(bad.minRating, null);
});

test('IGDB reçoit la fenêtre de dates de la décennie et la note minimale sur 100', async () => {
  let body = '';
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('https://id.twitch.tv')) {
      return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
    }
    if (u.endsWith('/games/count')) return new Response(JSON.stringify({ count: 0 }), { status: 200 });
    body = String(init?.body);
    return new Response('[]', { status: 200 });
  }) as typeof fetch;

  const upstream = createUpstream({ rawgKey: '', igdbClientId: 'id', igdbClientSecret: 'sec' }, fakeFetch);
  await upstream.games(parseQuery({ decade: '1990', minRating: '4' }));

  assert.match(body, /first_release_date >= 631152000 & first_release_date < 946684800/);
  assert.match(body, /total_rating >= 80/);
});
