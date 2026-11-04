// Accès à PostgreSQL : pool en production (DATABASE_URL), schéma et migration au démarrage.
// Appelé par server.ts et par les tests (qui fournissent une base en mémoire). Schéma : users, sessions, favorites, ratings.
import pg from 'pg';

// Le strict minimum utilisé par le code : une requête paramétrée qui renvoie des lignes.
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export const SCHEMA = [
  `create table if not exists users (
     id text primary key,
     email text not null unique,
     password_hash text not null,
     share_id text not null unique,
     created_at timestamp not null
   )`,
  `create table if not exists sessions (
     token_hash text primary key,
     user_id text not null references users(id) on delete cascade,
     expires_at timestamp not null
   )`,
  `create table if not exists favorites (
     user_id text not null references users(id) on delete cascade,
     game_id text not null,
     added_at timestamp not null,
     primary key (user_id, game_id)
   )`,
  `create table if not exists ratings (
     user_id text not null references users(id) on delete cascade,
     game_id text not null,
     score integer not null check (score between 1 and 5),
     primary key (user_id, game_id)
   )`,
  // Pseudo (page publique /u/pseudo) et visibilité de l'étagère : privée par défaut.
  `alter table users add column if not exists username text unique`,
  `alter table users add column if not exists shelf_public boolean not null default false`,
  // Fiches reçues de RAWG ou IGDB, gardées pour ne pas rappeler les API et pour rester utilisable hors ligne.
  `create table if not exists games (
     id text primary key,
     data text not null,
     synced_at timestamp not null
   )`,
];

export function createPool(connectionString: string): Db {
  return new pg.Pool({ connectionString }) as unknown as Db;
}

export async function migrate(db: Db): Promise<void> {
  for (const statement of SCHEMA) await db.query(statement);
}
