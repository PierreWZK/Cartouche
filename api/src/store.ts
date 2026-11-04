// Requêtes métier : comptes, sessions, favoris, notes communautaires, étagère partagée.
// Appelé par app.ts. Toutes les requêtes sont paramétrées.
import type { Db } from './db.js';
import type { Game } from './games.js';

export interface User {
  id: string;
  email: string;
  shareId: string;
  username: string | null;
  shelfPublic: boolean;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  share_id: string;
  username: string | null;
  shelf_public: boolean;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  shareId: r.share_id,
  username: r.username,
  shelfPublic: r.shelf_public,
});

export async function createUser(
  db: Db,
  input: { id: string; email: string; passwordHash: string; shareId: string },
): Promise<User> {
  await db.query(
    'insert into users (id, email, password_hash, share_id, created_at) values ($1, $2, $3, $4, $5)',
    [input.id, input.email, input.passwordHash, input.shareId, new Date()],
  );
  return { id: input.id, email: input.email, shareId: input.shareId, username: null, shelfPublic: false };
}

export async function findUserByEmail(db: Db, email: string): Promise<(User & { passwordHash: string }) | undefined> {
  const { rows } = await db.query<UserRow>('select * from users where email = $1', [email]);
  const row = rows[0];
  return row ? { ...toUser(row), passwordHash: row.password_hash } : undefined;
}

export async function createSession(db: Db, tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
  await db.query('insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)', [
    tokenHash,
    userId,
    expiresAt,
  ]);
}

export async function findSessionUser(db: Db, tokenHash: string, now: Date): Promise<User | undefined> {
  const { rows } = await db.query<UserRow>(
    `select u.* from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > $2`,
    [tokenHash, now],
  );
  const row = rows[0];
  return row ? toUser(row) : undefined;
}

export async function deleteSession(db: Db, tokenHash: string): Promise<void> {
  await db.query('delete from sessions where token_hash = $1', [tokenHash]);
}

export async function listFavorites(db: Db, userId: string): Promise<string[]> {
  const { rows } = await db.query<{ game_id: string }>(
    'select game_id from favorites where user_id = $1 order by added_at asc',
    [userId],
  );
  return rows.map((r) => r.game_id);
}

// Ajout idempotent : un favori déjà présent ne fait rien.
export async function addFavorite(db: Db, userId: string, gameId: string): Promise<void> {
  const { rows } = await db.query('select 1 from favorites where user_id = $1 and game_id = $2', [userId, gameId]);
  if (rows.length === 0) {
    await db.query('insert into favorites (user_id, game_id, added_at) values ($1, $2, $3)', [
      userId,
      gameId,
      new Date(),
    ]);
  }
}

export async function removeFavorite(db: Db, userId: string, gameId: string): Promise<void> {
  await db.query('delete from favorites where user_id = $1 and game_id = $2', [userId, gameId]);
}

export async function setRating(db: Db, userId: string, gameId: string, score: number): Promise<void> {
  const { rows } = await db.query('select 1 from ratings where user_id = $1 and game_id = $2', [userId, gameId]);
  if (rows.length > 0) {
    await db.query('update ratings set score = $3 where user_id = $1 and game_id = $2', [userId, gameId, score]);
  } else {
    await db.query('insert into ratings (user_id, game_id, score) values ($1, $2, $3)', [userId, gameId, score]);
  }
}

// Moyenne et nombre de notes de la communauté Cartouche, pour une liste de jeux.
export async function communityRatings(
  db: Db,
  gameIds: string[],
): Promise<Map<string, { average: number; count: number }>> {
  const result = new Map<string, { average: number; count: number }>();
  if (gameIds.length === 0) return result;
  const placeholders = gameIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await db.query<{ game_id: string; score: number }>(
    `select game_id, score from ratings where game_id in (${placeholders})`,
    gameIds,
  );
  for (const id of gameIds) {
    const scores = rows.filter((r) => r.game_id === id).map((r) => Number(r.score));
    if (scores.length > 0) {
      const sum = scores.reduce((a, b) => a + b, 0);
      result.set(id, { average: Math.round((sum / scores.length) * 10) / 10, count: scores.length });
    }
  }
  return result;
}

// Fiches de jeux en cache (upsert). Les données restent telles que reçues de l'API.
export async function saveGames(db: Db, games: Game[]): Promise<void> {
  for (const game of games) {
    const data = JSON.stringify(game);
    const { rows } = await db.query('select 1 from games where id = $1', [game.id]);
    if (rows.length > 0) await db.query('update games set data = $2, synced_at = $3 where id = $1', [game.id, data, new Date()]);
    else await db.query('insert into games (id, data, synced_at) values ($1, $2, $3)', [game.id, data, new Date()]);
  }
}

export async function cachedGames(db: Db, gameIds: string[]): Promise<Map<string, Game>> {
  const found = new Map<string, Game>();
  if (gameIds.length === 0) return found;
  const placeholders = gameIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await db.query<{ id: string; data: string }>(
    `select id, data from games where id in (${placeholders})`,
    gameIds,
  );
  for (const row of rows) found.set(row.id, JSON.parse(row.data) as Game);
  return found;
}

// Suppression du compte : favoris, notes, sessions puis utilisateur (sans compter sur le cascade de la base).
export async function deleteUser(db: Db, userId: string): Promise<void> {
  await db.query('delete from favorites where user_id = $1', [userId]);
  await db.query('delete from ratings where user_id = $1', [userId]);
  await db.query('delete from sessions where user_id = $1', [userId]);
  await db.query('delete from users where id = $1', [userId]);
}

// Sessions dont la date de fin est passée : supprimées à chaque connexion pour que la table ne grossisse pas.
export async function purgeExpiredSessions(db: Db, now: Date): Promise<void> {
  await db.query('delete from sessions where expires_at <= $1', [now]);
}

export async function myRating(db: Db, userId: string, gameId: string): Promise<number | null> {
  const { rows } = await db.query<{ score: number }>('select score from ratings where user_id = $1 and game_id = $2', [
    userId,
    gameId,
  ]);
  return rows[0] ? Number(rows[0].score) : null;
}

// Pseudo et visibilité de l'étagère. Le pseudo est déjà validé et en minuscules (voir app.ts).
export async function updateProfile(
  db: Db,
  userId: string,
  patch: { username?: string | null; shelfPublic?: boolean },
): Promise<void> {
  if (patch.username !== undefined) await db.query('update users set username = $2 where id = $1', [userId, patch.username]);
  if (patch.shelfPublic !== undefined) await db.query('update users set shelf_public = $2 where id = $1', [userId, patch.shelfPublic]);
}

export async function findUserByUsername(db: Db, username: string): Promise<User | undefined> {
  const { rows } = await db.query<UserRow>('select * from users where username = $1', [username]);
  const row = rows[0];
  return row ? toUser(row) : undefined;
}

export async function findUserByShareId(db: Db, shareId: string): Promise<User | undefined> {
  const { rows } = await db.query<UserRow>('select * from users where share_id = $1', [shareId]);
  const row = rows[0];
  return row ? toUser(row) : undefined;
}
