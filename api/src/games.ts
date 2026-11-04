// Forme commune d'un jeu (identique au front), conversion RAWG et nettoyage des paramètres d'URL.
// Appelé par upstream.ts et server.ts.

export interface Game {
  id: string;
  name: string;
  year: number;
  studio: string;
  platforms: string[];
  genres: string[];
  ratingRawg: number;
  ratingCart: number | null;
  ratingCount?: number;
  description: string;
  art: string;
  band: string;
  cover: string | null;
  // Captures d'écran (adresses complètes), vide si la source n'en a pas.
  screenshots: string[];
}

export interface Facet {
  slug: string;
  name: string;
}

export type SortKey = 'name' | 'year' | 'rating';

export interface GameQuery {
  q: string;
  genre: string[];
  platform: string[];
  sort: SortKey;
  page: number;
  size: number;
  // Décennie (1980 = 1980 à 1989) et note minimale sur 5 : null si le filtre est absent.
  decade: number | null;
  minRating: number | null;
}

// Structure partielle de RAWG : on ne lit que les champs utilisés.
export interface RawgGame {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  platforms?: { platform: { name: string } }[];
  genres?: { name: string }[];
  developers?: { name: string }[];
  description_raw?: string;
}

const SORTS: readonly SortKey[] = ['name', 'year', 'rating'];
const DECADES: readonly number[] = [1970, 1980, 1990, 2000, 2010, 2020];
const SLUG = /^[a-z0-9-]{1,60}$/;
const MAX_LIST = 5;
const MAX_DESCRIPTION = 800;
// Au-delà, le catalogue s'arrête : le total renvoyé est plafonné à cette profondeur.
export const MAX_PAGE = 50;

// Trois couples (jaquette, bandeau) pour habiller les jeux sans visuel : choix stable par identifiant.
const PALETTES: readonly [string, string][] = [
  ['linear-gradient(#2b2350, #6b3f7a)', '#1f3c7a'],
  ['linear-gradient(#2c4a3c, #7fa395)', '#2f5b48'],
  ['linear-gradient(#f0a84e, #b8582f)', '#8a3f22'],
  ['linear-gradient(#3a6f9a, #1d3d5a)', '#1d3d5a'],
  ['linear-gradient(#5a2a2a, #1c1b2e)', '#8a2b2b'],
  ['linear-gradient(#2f5d4a, #d8b24a)', '#c9a23a'],
];

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// Tout ce qui vient de l'adresse est suspect : on borne, on filtre, on met une valeur sûre sinon.
export function parseQuery(raw: Record<string, unknown>): GameQuery {
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max).trim() : '');
  const list = (v: unknown) =>
    typeof v === 'string' ? v.split(',').filter((s) => SLUG.test(s)).slice(0, MAX_LIST) : [];
  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  const sort = raw['sort'];
  return {
    q: str(raw['q'], 100),
    genre: list(raw['genre']),
    platform: list(raw['platform']),
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : 'name',
    // Une page trop grande reste trop grande (au lieu de repartir à la page 1) ; app.ts la traite.
    page: Math.min(int(raw['page'], 1, Number.MAX_SAFE_INTEGER, 1), MAX_PAGE + 1),
    size: int(raw['size'], 1, 40, 12),
    decade: DECADES.includes(Number(raw['decade'])) ? Number(raw['decade']) : null,
    minRating: int(raw['minRating'], 1, 5, 0) || null,
  };
}

// Ordre demandé à RAWG pour chaque tri du front.
export function rawgOrdering(sort: SortKey): string {
  return { name: 'name', year: '-released', rating: '-rating' }[sort];
}

export function isSlug(s: string): boolean {
  return SLUG.test(s);
}

// Structure partielle d'IGDB (champs demandés dans upstream.ts, GAME_FIELDS).
export interface IgdbGame {
  id: number;
  slug: string;
  name: string;
  first_release_date?: number;
  summary?: string;
  total_rating?: number;
  cover?: { image_id: string };
  platforms?: { name: string }[];
  genres?: { name: string }[];
  involved_companies?: { developer: boolean; company: { name: string } }[];
  screenshots?: { image_id: string }[];
}

// IGDB note sur 100, Cartouche sur 5. Sans note, 0 (la fiche l'affiche tel quel).
export function mapIgdbGame(raw: IgdbGame): Game {
  const palette = PALETTES[hash(raw.slug) % PALETTES.length] ?? PALETTES[0]!;
  return {
    id: raw.slug,
    name: raw.name,
    year: raw.first_release_date ? new Date(raw.first_release_date * 1000).getUTCFullYear() : 0,
    studio: raw.involved_companies?.find((c) => c.developer)?.company.name ?? '',
    platforms: (raw.platforms ?? []).map((p) => p.name),
    genres: (raw.genres ?? []).map((g) => g.name),
    ratingRawg: raw.total_rating ? Math.round(raw.total_rating) / 20 : 0,
    ratingCart: null,
    description: (raw.summary ?? '').slice(0, MAX_DESCRIPTION),
    art: palette[0],
    band: palette[1],
    cover: raw.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${raw.cover.image_id}.jpg` : null,
    screenshots: (raw.screenshots ?? []).map(
      (s) => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`,
    ),
  };
}

export function mapGame(raw: RawgGame, igdbSummary?: string, screenshots: string[] = []): Game {
  const palette = PALETTES[hash(raw.slug) % PALETTES.length] ?? PALETTES[0]!;
  const description = (raw.description_raw ?? igdbSummary ?? '').slice(0, MAX_DESCRIPTION);
  return {
    id: raw.slug,
    name: raw.name,
    year: raw.released ? Number(raw.released.slice(0, 4)) : 0,
    studio: raw.developers?.[0]?.name ?? '',
    platforms: (raw.platforms ?? []).map((p) => p.platform.name),
    genres: (raw.genres ?? []).map((g) => g.name),
    ratingRawg: Math.round(raw.rating * 10) / 10,
    ratingCart: null,
    description,
    art: palette[0],
    band: palette[1],
    cover: raw.background_image,
    screenshots,
  };
}
