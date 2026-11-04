// Client des API externes. RAWG est la source principale (catalogue, fiches, facettes) ; IGDB la remplace
// quand RAWG est absent ou en panne, et complète la description RAWG quand elle manque.
// Les réponses sont mises en cache pour rester dans les quotas.
import { TtlCache } from './cache.js';
import {
  type Facet,
  type Game,
  type GameQuery,
  type IgdbGame,
  type RawgGame,
  mapGame,
  mapIgdbGame,
  rawgOrdering,
} from './games.js';

const RAWG = 'https://api.rawg.io/api';
const TWITCH_TOKEN = 'https://id.twitch.tv/oauth2/token';
const IGDB = 'https://api.igdb.com/v4';

export interface Keys {
  rawgKey: string;
  igdbClientId: string;
  igdbClientSecret: string;
}

export class NotConfiguredError extends Error {}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

const MIN = 60_000;
// Court : le front abandonne au bout de 6 s, il faut laisser le temps au repli IGDB de répondre.
const TIMEOUT_MS = 3000;
// Après une panne de RAWG, on ne le réinterroge pas pendant ce temps : sinon chaque clic attend 5 s.
const RAWG_DOWN_MS = 2 * MIN;

// Champs demandés à IGDB : seuls ceux que mapIgdbGame lit.
const GAME_FIELDS =
  'fields name,slug,first_release_date,summary,total_rating,cover.image_id,platforms.name,genres.name,involved_companies.developer,involved_companies.company.name,screenshots.image_id;';
// Un catalogue ne liste que les jeux qui ont une jaquette et assez de notes pour être connus.
const IGDB_WHERE = 'version_parent = null & cover != null & total_rating_count >= 50';
const IGDB_SORT: Record<GameQuery['sort'], string> = {
  name: 'name asc',
  year: 'first_release_date desc',
  rating: 'total_rating desc',
};
const FACET_LIMIT = 40;

// Les genres ou plateformes les plus fréquents parmi les jeux, par ordre alphabétique.
function topFacets(lists: ({ name: string; slug: string }[] | undefined)[], limit: number): Facet[] {
  const counts = new Map<string, { facet: Facet; n: number }>();
  for (const list of lists) {
    for (const x of list ?? []) {
      const hit = counts.get(x.slug) ?? { facet: { slug: x.slug, name: x.name }, n: 0 };
      hit.n++;
      counts.set(x.slug, hit);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((h) => h.facet)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function createUpstream(keys: Keys, fetchImpl: Fetch = fetch, now: () => number = Date.now) {
  // Caches séparés par source : RAWG et IGDB n'ont pas les mêmes identifiants de genres ni de plateformes.
  const listCache = new TtlCache<{ items: Game[]; total: number }>(10 * MIN, now);
  const gameCache = new TtlCache<Game>(60 * MIN, now);
  const facetCache = new TtlCache<Facet[]>(24 * 60 * MIN, now);
  let igdbToken: { value: string; expires: number } | undefined;
  let rawgDownUntil = 0;

  const igdbConfigured = () => Boolean(keys.igdbClientId && keys.igdbClientSecret);

  async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      // Délai maximal : sans lui, une panne de RAWG fait attendre le visiteur une vingtaine de secondes.
      res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new UpstreamError('upstream_unreachable', 502);
    }
    if (res.status === 404) throw new UpstreamError('not_found', 404);
    if (!res.ok) throw new UpstreamError(`upstream ${res.status}`, 502);
    return (await res.json()) as T;
  }

  async function igdbAccessToken(): Promise<string> {
    if (!igdbConfigured()) throw new NotConfiguredError('IGDB non configuré');
    if (igdbToken && igdbToken.expires > now()) return igdbToken.value;
    const url = new URL(TWITCH_TOKEN);
    url.searchParams.set('client_id', keys.igdbClientId);
    url.searchParams.set('client_secret', keys.igdbClientSecret);
    url.searchParams.set('grant_type', 'client_credentials');
    const data = await getJson<{ access_token: string; expires_in: number }>(url.toString(), { method: 'POST' });
    igdbToken = { value: data.access_token, expires: now() + (data.expires_in - 60) * 1000 };
    return igdbToken.value;
  }

  async function igdbQuery<T>(endpoint: string, body: string): Promise<T> {
    const token = await igdbAccessToken();
    return getJson<T>(`${IGDB}/${endpoint}`, {
      method: 'POST',
      headers: { 'Client-ID': keys.igdbClientId, Authorization: `Bearer ${token}` },
      body,
    });
  }

  // Résumé IGDB d'un jeu dont le nom correspond exactement : sert de repli à la description RAWG.
  async function igdbSummary(name: string): Promise<string | undefined> {
    if (!igdbConfigured()) return undefined;
    const safe = name.replace(/["\\;]/g, '');
    const found = await igdbQuery<{ name: string; summary?: string }[]>(
      'games',
      `search "${safe}"; fields name,summary; limit 5;`,
    );
    const exact = found.find((g) => g.name.toLowerCase() === name.toLowerCase());
    return exact?.summary;
  }

  // RAWG d'abord ; en cas de panne (ou de clé absente), IGDB. Une réponse 404 de RAWG n'est pas une panne.
  async function withFallback<T>(rawg: () => Promise<T>, igdb: () => Promise<T>): Promise<T> {
    if (keys.rawgKey && now() >= rawgDownUntil) {
      try {
        return await rawg();
      } catch (err) {
        if (!(err instanceof UpstreamError)) throw err;
        if (err.status !== 404) rawgDownUntil = now() + RAWG_DOWN_MS;
        if (!igdbConfigured()) throw err;
      }
    }
    if (igdbConfigured()) return igdb();
    if (!keys.rawgKey) throw new NotConfiguredError('Aucune source configurée (RAWG ou IGDB)');
    throw new UpstreamError('rawg_down', 502);
  }

  // ---- RAWG ----

  async function rawgGames(query: GameQuery): Promise<{ items: Game[]; total: number }> {
    const key = `rawg:${JSON.stringify(query)}`;
    const cached = listCache.get(key);
    if (cached) return cached;

    const url = new URL(`${RAWG}/games`);
    url.searchParams.set('key', keys.rawgKey);
    url.searchParams.set('ordering', rawgOrdering(query.sort));
    url.searchParams.set('page', String(query.page));
    url.searchParams.set('page_size', String(query.size));
    if (query.q) url.searchParams.set('search', query.q);
    if (query.genre.length) url.searchParams.set('genres', query.genre.join(','));
    if (query.platform.length) url.searchParams.set('platforms', query.platform.join(','));
    if (query.decade) url.searchParams.set('dates', `${query.decade}-01-01,${query.decade + 9}-12-31`);

    const data = await getJson<{ count: number; results: RawgGame[] }>(url.toString());
    // shortcut: RAWG ne filtre pas par note ; on filtre après la pagination, donc une page peut être plus courte. À remplacer si RAWG l'accepte.
    const items = data.results.map((g) => mapGame(g)).filter((g) => !query.minRating || g.ratingRawg >= query.minRating);
    const result = { items, total: data.count };
    listCache.set(key, result);
    return result;
  }

  async function rawgGame(slug: string): Promise<Game> {
    const cached = gameCache.get(`rawg:${slug}`);
    if (cached) return cached;

    const url = new URL(`${RAWG}/games/${encodeURIComponent(slug)}`);
    url.searchParams.set('key', keys.rawgKey);
    const raw = await getJson<RawgGame>(url.toString());
    const summary = raw.description_raw ? undefined : await igdbSummary(raw.name).catch(() => undefined);
    // Les captures sont optionnelles : si RAWG ne répond pas pour elles, la fiche s'affiche sans.
    const shots = await getJson<{ results: { image: string }[] }>(
      `${RAWG}/games/${encodeURIComponent(slug)}/screenshots?key=${keys.rawgKey}`,
    )
      .then((r) => r.results.map((s) => s.image).slice(0, 6))
      .catch(() => []);
    const result = mapGame(raw, summary, shots);
    gameCache.set(`rawg:${slug}`, result);
    return result;
  }

  async function rawgFacets(): Promise<{ genres: Facet[]; platforms: Facet[] }> {
    const cached = facetCache.get('rawg:genres');
    const cachedPlatforms = facetCache.get('rawg:platforms');
    if (cached && cachedPlatforms) return { genres: cached, platforms: cachedPlatforms };

    const toFacets = (r: { results: { slug: string; name: string }[] }) =>
      r.results.map((x) => ({ slug: x.slug, name: x.name }));
    const genres = toFacets(await getJson(`${RAWG}/genres?key=${keys.rawgKey}&page_size=40`));
    const platforms = toFacets(await getJson(`${RAWG}/platforms?key=${keys.rawgKey}&page_size=40`));
    facetCache.set('rawg:genres', genres);
    facetCache.set('rawg:platforms', platforms);
    return { genres, platforms };
  }

  // ---- IGDB ----

  function igdbWhere(query: GameQuery): string {
    const conds = [IGDB_WHERE];
    const list = (slugs: string[]) => `(${slugs.map((s) => `"${s}"`).join(',')})`;
    if (query.genre.length) conds.push(`genres.slug = ${list(query.genre)}`);
    if (query.platform.length) conds.push(`platforms.slug = ${list(query.platform)}`);
    if (query.decade) {
      const unix = (year: number) => Date.UTC(year, 0, 1) / 1000;
      conds.push(`first_release_date >= ${unix(query.decade)} & first_release_date < ${unix(query.decade + 10)}`);
    }
    if (query.minRating) conds.push(`total_rating >= ${query.minRating * 20}`);
    return `where ${conds.join(' & ')};`;
  }

  // Le texte de recherche part dans une requête IGDB : on retire les caractères qui la casseraient.
  const igdbSearch = (q: string) => (q ? `search "${q.replace(/["\\;]/g, '')}";` : '');

  async function igdbGames(query: GameQuery): Promise<{ items: Game[]; total: number }> {
    const key = `igdb:${JSON.stringify(query)}`;
    const cached = listCache.get(key);
    if (cached) return cached;

    const search = igdbSearch(query.q);
    const where = igdbWhere(query);
    const [raws, count] = await Promise.all([
      igdbQuery<IgdbGame[]>(
        'games',
        `${search}${GAME_FIELDS} ${where} sort ${IGDB_SORT[query.sort]}; limit ${query.size}; offset ${(query.page - 1) * query.size};`,
      ),
      igdbQuery<{ count: number }>('games/count', `${search}${where}`),
    ]);
    const result = { items: raws.map(mapIgdbGame), total: count.count };
    listCache.set(key, result);
    return result;
  }

  async function igdbGame(slug: string): Promise<Game> {
    const cached = gameCache.get(`igdb:${slug}`);
    if (cached) return cached;

    const safe = slug.replace(/[^a-z0-9-]/g, '');
    const [raw] = await igdbQuery<IgdbGame[]>('games', `${GAME_FIELDS} where slug = "${safe}"; limit 1;`);
    if (!raw) throw new UpstreamError('not_found', 404);
    const result = mapIgdbGame(raw);
    gameCache.set(`igdb:${slug}`, result);
    return result;
  }

  // Facettes calculées sur le catalogue lui-même : seuls les genres et plateformes qui ont des jeux sont proposés.
  async function igdbFacets(): Promise<{ genres: Facet[]; platforms: Facet[] }> {
    const cached = facetCache.get('igdb:genres');
    const cachedPlatforms = facetCache.get('igdb:platforms');
    if (cached && cachedPlatforms) return { genres: cached, platforms: cachedPlatforms };

    type Named = { name: string; slug: string }[] | undefined;
    const raws = await igdbQuery<{ genres?: Named; platforms?: Named }[]>(
      'games',
      `fields genres.name,genres.slug,platforms.name,platforms.slug; where ${IGDB_WHERE}; sort total_rating desc; limit 200;`,
    );
    const genres = topFacets(raws.map((g) => g.genres), FACET_LIMIT);
    const platforms = topFacets(raws.map((g) => g.platforms), FACET_LIMIT);
    facetCache.set('igdb:genres', genres);
    facetCache.set('igdb:platforms', platforms);
    return { genres, platforms };
  }

  // ---- Interface publique : RAWG puis IGDB ----

  function games(query: GameQuery) {
    return withFallback(
      () => rawgGames(query),
      () => igdbGames(query),
    );
  }

  function game(slug: string) {
    return withFallback(
      () => rawgGame(slug),
      () => igdbGame(slug),
    );
  }

  function facets() {
    return withFallback(rawgFacets, igdbFacets);
  }

  return {
    games,
    game,
    facets,
    igdbConfigured,
    rawgConfigured: () => Boolean(keys.rawgKey),
  };
}
