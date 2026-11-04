// Forme commune d'un jeu, utilisée par le mode démo (données locales) et par l'API (étape 5).
export interface Game {
  id: string;
  name: string;
  year: number;
  studio: string;
  platforms: string[];
  genres: string[];
  ratingRawg: number;
  ratingCart: number | null;
  description: string;
  art: string;
  band: string;
  // Jaquette réelle (RAWG) ; absente en mode démo.
  cover?: string | null;
  // Captures d'écran ; absentes si la source n'en a pas.
  screenshots?: string[];
}

// Genre ou plateforme : slug pour l'API, nom affiché.
export interface Facet {
  slug: string;
  name: string;
}

export type SortKey = 'name' | 'year' | 'rating';

export interface GameFilters {
  q: string;
  genres: string[];
  platforms: string[];
  sort: SortKey;
  // Décennie (1990 = 1990 à 1999) et note minimale sur 5 ; null si absent.
  decade: number | null;
  minRating: number | null;
}

export interface GamePage {
  items: Game[];
  total: number;
  page: number;
  size: number;
}
