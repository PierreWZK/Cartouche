// Application Express : catalogue (RAWG/IGDB), comptes, favoris, notes et étagère partagée.
// Construite par createApp() pour que les tests puissent la lancer avec une base en mémoire.
import express, { type NextFunction, type Request, type Response } from 'express';
import { hashPassword, hashToken, newId, newShareId, newToken, verifyPassword } from './auth.js';
import type { Db } from './db.js';
import { FALLBACK_GAMES } from './data/fallback-games.js';
import { type Game, type GameQuery, MAX_PAGE, isSlug, parseQuery } from './games.js';
import * as store from './store.js';
import type { createUpstream } from './upstream.js';
import { NotConfiguredError, UpstreamError } from './upstream.js';

export interface AppDeps {
  upstream: ReturnType<typeof createUpstream>;
  db?: Db;
  corsOrigin: string;
  secureCookies: boolean;
  now?: () => Date;
}

const COOKIE = 'cartouche_session';
const fallbackById = new Map(FALLBACK_GAMES.map((g) => [g.id, g]));
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const slug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const FALLBACK_SORTS: Record<GameQuery['sort'], (a: Game, b: Game) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'fr'),
  year: (a, b) => b.year - a.year,
  rating: (a, b) => b.ratingRawg - a.ratingRawg,
};

// Recherche et filtres dans la base de secours, avec les mêmes paramètres que l'API.
// shortcut: genres et plateformes comparés par nom (slug), pas par identifiant IGDB exact.
function fallbackPage(query: GameQuery) {
  const q = fold(query.q.trim());
  const matched = FALLBACK_GAMES.filter(
    (g) =>
      (!q || fold(g.name).includes(q) || fold(g.studio).includes(q)) &&
      (query.genre.length === 0 || query.genre.some((s) => g.genres.some((x) => slug(x) === s))) &&
      (query.platform.length === 0 || query.platform.some((s) => g.platforms.some((x) => slug(x) === s))) &&
      (!query.decade || (g.year >= query.decade && g.year < query.decade + 10)) &&
      (!query.minRating || g.ratingRawg >= query.minRating),
  ).sort(FALLBACK_SORTS[query.sort]);
  const start = (query.page - 1) * query.size;
  return { items: matched.slice(start, start + query.size), total: matched.length };
}
const SESSION_DAYS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 15 * 60_000;
// Pseudo : minuscules, chiffres, tirets et tirets bas. Les noms réservés gardent les adresses du site.
const USERNAME = /^[a-z0-9_-]{3,20}$/;
const RESERVED = new Set(['admin', 'api', 'u', 'e', 'demo', 'jour', 'etagere', 'ludotheque', 'connexion', 'compte', 'cartouche']);
// Inscriptions par adresse IP : au-delà de SIGNUP_MAX par heure, refus.
const SIGNUP_MAX = 5;
const SIGNUP_WINDOW_MS = 60 * 60_000;

export function createApp(deps: AppDeps) {
  const now = deps.now ?? (() => new Date());
  const app = express();
  // Un seul proxy devant l'API (Coolify) : l'adresse du client est lue dans X-Forwarded-For. Sans ça, la limite serait commune à tous.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4kb' }));

  // CORS limité à l'origine du front, et refus des écritures venues d'une autre origine.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', deps.corsOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    const origin = req.headers.origin;
    if (req.method !== 'GET' && req.method !== 'HEAD' && origin && origin !== deps.corsOrigin) {
      return res.status(403).json({ error: 'forbidden_origin' });
    }
    next();
  });

  function sendError(res: Response, err: unknown) {
    if (err instanceof NotConfiguredError) return res.status(503).json({ error: 'not_configured' });
    if (err instanceof UpstreamError) return res.status(err.status === 404 ? 404 : 502).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }

  // Sans base, les routes de compte répondent 503 : le front reste en mode démo.
  function requireDb(req: Request, res: Response, next: NextFunction) {
    if (!deps.db) return res.status(503).json({ error: 'no_database' });
    next();
  }

  function cookieValue(req: Request): string | undefined {
    const header = req.headers.cookie ?? '';
    for (const part of header.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === COOKIE) return decodeURIComponent(rest.join('='));
    }
    return undefined;
  }

  async function currentUser(req: Request) {
    const token = cookieValue(req);
    if (!token || !deps.db) return undefined;
    return store.findSessionUser(deps.db, hashToken(token), now());
  }

  // Essais de connexion ratés, par email : au-delà de LOGIN_MAX, refus jusqu'à la fin de la fenêtre.
  // shortcut: entrées expirées jamais purgées (mémoire du processus), à passer dans un TtlCache si le trafic grandit.
  const failures = new Map<string, { count: number; resetAt: number }>();
  function tooManyFailures(email: string): boolean {
    const hit = failures.get(email);
    return Boolean(hit && hit.resetAt > now().getTime() && hit.count >= LOGIN_MAX);
  }
  function recordFailure(email: string) {
    const t = now().getTime();
    const hit = failures.get(email);
    if (hit && hit.resetAt > t) hit.count++;
    else failures.set(email, { count: 1, resetAt: t + LOGIN_WINDOW_MS });
  }

  // shortcut: compteurs d'inscription jamais purgés (mémoire du processus), à passer dans un TtlCache si le trafic grandit.
  const signups = new Map<string, { count: number; resetAt: number }>();
  function signupAllowed(ip: string): boolean {
    const t = now().getTime();
    const hit = signups.get(ip);
    if (!hit || hit.resetAt <= t) {
      signups.set(ip, { count: 1, resetAt: t + SIGNUP_WINDOW_MS });
      return true;
    }
    if (hit.count >= SIGNUP_MAX) return false;
    hit.count++;
    return true;
  }

  function setSessionCookie(res: Response, token: string) {
    const attrs = [
      `${COOKIE}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${SESSION_DAYS * 24 * 3600}`,
    ];
    if (deps.secureCookies) attrs.push('Secure');
    res.setHeader('Set-Cookie', attrs.join('; '));
  }

  // Ajoute la note de la communauté Cartouche à une liste de jeux (hors cache, donc toujours à jour).
  async function withCommunity(games: Game[]): Promise<Game[]> {
    if (!deps.db) return games;
    const ratings = await store.communityRatings(
      deps.db,
      games.map((g) => g.id),
    );
    return games.map((g) => ({ ...g, ratingCart: ratings.get(g.id)?.average ?? null, ratingCount: ratings.get(g.id)?.count ?? 0 }));
  }

  // Fiche depuis l'API, puis mise en cache ; si l'API échoue, la copie en base prend le relais.
  async function fetchGame(id: string): Promise<Game> {
    try {
      const game = await deps.upstream.game(id);
      if (deps.db) await store.saveGames(deps.db, [game]);
      return game;
    } catch (err) {
      const cached = deps.db && (await store.cachedGames(deps.db, [id])).get(id);
      const game = cached || fallbackById.get(id);
      if (game) return game;
      throw err;
    }
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      rawg: deps.upstream.rawgConfigured(),
      igdb: deps.upstream.igdbConfigured(),
      accounts: Boolean(deps.db),
    });
  });

  app.get('/api/facets', async (_req, res) => {
    try {
      res.json(await deps.upstream.facets());
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get('/api/games', async (req, res) => {
    try {
      const query = parseQuery(req.query as Record<string, unknown>);
      // API muette ou sans résultat pour la recherche : on cherche dans la base de secours.
      const result = await deps.upstream.games(query).catch(() => undefined);
      const page = result && result.total > 0 ? result : fallbackPage(query);
      res.json({ items: await withCommunity(page.items), total: page.total, page: query.page, size: query.size });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get('/api/games/:id', async (req, res) => {
    const id = String(req.params['id'] ?? '');
    if (!isSlug(id)) return res.status(400).json({ error: 'bad_id' });
    try {
      const [game] = await withCommunity([await fetchGame(id)]);
      res.json(game);
    } catch (err) {
      sendError(res, err);
    }
  });

  // Comptes -------------------------------------------------------------------

  app.post('/api/auth/register', requireDb, async (req, res) => {
    if (!signupAllowed(req.ip ?? '')) return res.status(429).json({ error: 'too_many_signups' });
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!EMAIL.test(email) || email.length > 254) return res.status(400).json({ error: 'bad_email' });
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'bad_password' });
    try {
      if (await store.findUserByEmail(deps.db!, email)) return res.status(409).json({ error: 'email_taken' });
      const user = await store.createUser(deps.db!, {
        id: newId(),
        email,
        passwordHash: await hashPassword(password),
        shareId: newShareId(),
      });
      const token = newToken();
      await store.createSession(deps.db!, hashToken(token), user.id, new Date(now().getTime() + SESSION_DAYS * 864e5));
      setSessionCookie(res, token);
      res.status(201).json(user);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/auth/login', requireDb, async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (tooManyFailures(email)) return res.status(429).json({ error: 'too_many_attempts' });
    try {
      const found = await store.findUserByEmail(deps.db!, email);
      // Même réponse, que l'email existe ou non ; le temps de calcul reste proche.
      const ok = found ? await verifyPassword(password, found.passwordHash) : await verifyPassword(password, 'scrypt$AAAA$AAAA');
      if (!found || !ok) {
        recordFailure(email);
        return res.status(401).json({ error: 'bad_credentials' });
      }
      failures.delete(email);
      await store.purgeExpiredSessions(deps.db!, now());
      const token = newToken();
      await store.createSession(deps.db!, hashToken(token), found.id, new Date(now().getTime() + SESSION_DAYS * 864e5));
      setSessionCookie(res, token);
      res.json({ id: found.id, email: found.email, shareId: found.shareId });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/auth/logout', requireDb, async (req, res) => {
    const token = cookieValue(req);
    if (token) await store.deleteSession(deps.db!, hashToken(token));
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  });

  app.get('/api/me', requireDb, async (req, res) => {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    res.json(user);
  });

  // Favoris (la liste de jeux est la même que l'étagère) ---------------------

  app.get('/api/me/favorites', requireDb, async (req, res) => {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    res.json({ gameIds: await store.listFavorites(deps.db!, user.id) });
  });

  app.put('/api/me/favorites/:id', requireDb, async (req, res) => {
    const user = await currentUser(req);
    const id = String(req.params['id'] ?? '');
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    if (!isSlug(id)) return res.status(400).json({ error: 'bad_id' });
    await store.addFavorite(deps.db!, user.id, id);
    res.json({ ok: true });
  });

  app.delete('/api/me/favorites/:id', requireDb, async (req, res) => {
    const user = await currentUser(req);
    const id = String(req.params['id'] ?? '');
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    if (!isSlug(id)) return res.status(400).json({ error: 'bad_id' });
    await store.removeFavorite(deps.db!, user.id, id);
    res.json({ ok: true });
  });

  // Notes de la communauté Cartouche -------------------------------------------

  app.put('/api/games/:id/rating', requireDb, async (req, res) => {
    const user = await currentUser(req);
    const id = String(req.params['id'] ?? '');
    const score = Number(req.body?.score);
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    if (!isSlug(id)) return res.status(400).json({ error: 'bad_id' });
    if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: 'bad_score' });
    await store.setRating(deps.db!, user.id, id, score);
    res.json({ ok: true });
  });

  // Mon étagère en un seul appel : le cache d'abord, l'API seulement pour les jeux inconnus.
  // shortcut: fiches du cache jamais rafraîchies, à passer en TTL de 7 jours avec synced_at.
  app.get('/api/me/shelf', requireDb, async (req, res) => {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    try {
      const ids = await store.listFavorites(deps.db!, user.id);
      const cached = await store.cachedGames(deps.db!, ids);
      const games = await Promise.all(
        ids.map((id) => cached.get(id) ?? fetchGame(id).catch(() => undefined)),
      );
      res.json({ items: await withCommunity(games.filter((g): g is Game => g !== undefined)) });
    } catch (err) {
      sendError(res, err);
    }
  });

  // Ma note sur un jeu, relue par la fiche (null si je n'ai pas encore noté).
  app.get('/api/me/ratings/:id', requireDb, async (req, res) => {
    const user = await currentUser(req);
    const id = String(req.params['id'] ?? '');
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    if (!isSlug(id)) return res.status(400).json({ error: 'bad_id' });
    try {
      res.json({ score: await store.myRating(deps.db!, user.id, id) });
    } catch (err) {
      sendError(res, err);
    }
  });

  // Suppression du compte : il faut le mot de passe, et tout part avec le compte.
  app.delete('/api/me', requireDb, async (req, res) => {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    try {
      const found = await store.findUserByEmail(deps.db!, user.email);
      const password = String(req.body?.password ?? '');
      if (!found || !(await verifyPassword(password, found.passwordHash))) {
        return res.status(403).json({ error: 'bad_password' });
      }
      await store.deleteUser(deps.db!, user.id);
      res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  // Profil : pseudo et visibilité de l'étagère (privée par défaut).
  app.put('/api/me/profile', requireDb, async (req, res) => {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    const body = (req.body ?? {}) as { username?: unknown; shelfPublic?: unknown };
    const patch: { username?: string | null; shelfPublic?: boolean } = {};
    try {
      if (body.username !== undefined) {
        const username = body.username === null ? null : String(body.username).trim().toLowerCase();
        if (username !== null && (!USERNAME.test(username) || RESERVED.has(username))) {
          return res.status(400).json({ error: 'bad_username' });
        }
        const other = username && (await store.findUserByUsername(deps.db!, username));
        if (other && other.id !== user.id) return res.status(409).json({ error: 'username_taken' });
        patch.username = username;
      }
      if (typeof body.shelfPublic === 'boolean') patch.shelfPublic = body.shelfPublic;
      await store.updateProfile(deps.db!, user.id, patch);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  // Page publique /u/pseudo : seulement si le propriétaire a rendu son étagère publique.
  app.get('/api/u/:username', requireDb, async (req, res) => {
    const owner = await store.findUserByUsername(deps.db!, String(req.params['username'] ?? '').toLowerCase());
    if (!owner || !owner.shelfPublic) return res.status(404).json({ error: 'not_found' });
    res.json({ username: owner.username, gameIds: await store.listFavorites(deps.db!, owner.id) });
  });

  // Étagère partagée : lecture publique, sans email ni identité.
  app.get('/api/me/share', requireDb, async (req, res) => {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: 'not_logged_in' });
    res.json({ shareId: user.shareId });
  });

  app.get('/api/shelves/:shareId', requireDb, async (req, res) => {
    const shareId = String(req.params['shareId'] ?? '');
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(shareId)) return res.status(400).json({ error: 'bad_share' });
    const owner = await store.findUserByShareId(deps.db!, shareId);
    // Étagère privée : même réponse qu'une étagère inexistante.
    if (!owner || !owner.shelfPublic) return res.status(404).json({ error: 'not_found' });
    res.json({ gameIds: await store.listFavorites(deps.db!, owner.id) });
  });

  return app;
}
