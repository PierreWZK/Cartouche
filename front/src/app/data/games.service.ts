import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap, timeout } from 'rxjs';
import demo from './demo-games.json';
import { Facet, Game, GameFilters, GamePage, SortKey } from './game.model';

// Multiple de 2, 3, 4, 6 et 8 : chaque page remplit des lignes entières, quel que soit le nombre de colonnes.
export const PAGE_SIZE = 24;
// Au-delà, le serveur est considéré comme en panne et on passe aux données locales.
const TIMEOUT_MS = 6000;

// Insensible aux accents et à la casse : « foret » trouve « Forêt ».
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

// Identifiant stable d'un genre ou d'une plateforme en mode démo (l'API fournit ses propres slugs).
export const slugify = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const SORTS: Record<SortKey, (a: Game, b: Game) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'fr'),
  year: (a, b) => b.year - a.year,
  rating: (a, b) => b.ratingRawg - a.ratingRawg,
};

// API d'abord (RAWG via le serveur) ; si elle n'est pas configurée ou ne répond pas, mode démo local.
@Injectable({ providedIn: 'root' })
export class GamesService {
  private readonly http = inject(HttpClient);
  private readonly demo = demo as Game[];

  // Vérifié une seule fois : le serveur a-t-il les clés RAWG ?
  private readonly live$ = this.http.get<{ rawg: boolean }>('/api/health').pipe(
    timeout(TIMEOUT_MS),
    map((h) => h.rawg),
    catchError(() => of(false)),
    shareReplay(1),
  );

  // Passe à true au premier échec du serveur : le reste de la visite reste sur les données locales.
  private down = false;

  // local = true pour le mode démo (/demo) : aucune requête réseau.
  list(filters: GameFilters, page: number, local = false): Observable<GamePage> {
    return this.live(local).pipe(
      switchMap((live) =>
        live
          ? this.remoteList(filters, page).pipe(this.fallback(() => this.localList(filters, page)))
          : this.localList(filters, page),
      ),
    );
  }

  get(id: string, local = false): Observable<Game | undefined> {
    return this.live(local).pipe(
      switchMap((live) =>
        live
          ? this.http
              .get<Game>(`/api/games/${encodeURIComponent(id)}`)
              .pipe(this.fallback(() => this.localGet(id)))
          : this.localGet(id),
      ),
    );
  }

  facets(local = false): Observable<{ genres: Facet[]; platforms: Facet[] }> {
    return this.live(local).pipe(
      switchMap((live) =>
        live
          ? this.http
              .get<{ genres: Facet[]; platforms: Facet[] }>('/api/facets')
              .pipe(this.fallback(() => of(this.localFacets())))
          : of(this.localFacets()),
      ),
    );
  }

  private live(local: boolean): Observable<boolean> {
    return local || this.down ? of(false) : this.live$;
  }

  // Délai maximal, puis repli local. Une erreur 4xx (jeu introuvable) ne coupe pas le serveur.
  private fallback<T>(local: () => Observable<T>) {
    return (source: Observable<T>) =>
      source.pipe(
        timeout(TIMEOUT_MS),
        catchError((err) => {
          if (!(err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500))
            this.down = true;
          return local();
        }),
      );
  }

  // Mon étagère en un seul appel ; si l'API ne répond pas, l'étagère reste vide au lieu de planter.
  shelf(): Observable<Game[]> {
    return this.http.get<{ items: Game[] }>('/api/me/shelf').pipe(
      map((r) => r.items),
      catchError(() => of([])),
    );
  }

  // Fiches de plusieurs jeux, dans l'ordre demandé (les jeux introuvables sont ignorés).
  byIds(ids: string[], local = false): Observable<Game[]> {
    if (ids.length === 0) return of([]);
    return forkJoin(ids.map((id) => this.get(id, local))).pipe(
      map((games) => games.filter((g): g is Game => g !== undefined)),
    );
  }

  private remoteList(f: GameFilters, page: number): Observable<GamePage> {
    let params = new HttpParams().set('page', page).set('size', PAGE_SIZE).set('sort', f.sort);
    if (f.q) params = params.set('q', f.q);
    if (f.genres.length) params = params.set('genre', f.genres.join(','));
    if (f.platforms.length) params = params.set('platform', f.platforms.join(','));
    if (f.decade) params = params.set('decade', f.decade);
    if (f.minRating) params = params.set('minRating', f.minRating);
    return this.http.get<GamePage>('/api/games', { params });
  }

  private localList(f: GameFilters, page: number): Observable<GamePage> {
    const q = fold(f.q.trim());
    const matched = this.demo
      .filter(
        (g) =>
          (!q || fold(g.name).includes(q) || fold(g.studio).includes(q)) &&
          (f.genres.length === 0 ||
            f.genres.some((slug) => g.genres.some((x) => slugify(x) === slug))) &&
          (f.platforms.length === 0 ||
            f.platforms.some((slug) => g.platforms.some((x) => slugify(x) === slug))) &&
          (!f.decade || (g.year >= f.decade && g.year < f.decade + 10)) &&
          (!f.minRating || g.ratingRawg >= f.minRating),
      )
      .sort(SORTS[f.sort]);

    const items = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return of({ items, total: matched.length, page, size: PAGE_SIZE });
  }

  private localGet(id: string): Observable<Game | undefined> {
    return of(this.demo.find((g) => g.id === id));
  }

  private localFacets(): { genres: Facet[]; platforms: Facet[] } {
    const uniq = (values: string[]): Facet[] =>
      [...new Set(values)]
        .map((name) => ({ slug: slugify(name), name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return {
      genres: uniq(this.demo.flatMap((g) => g.genres)),
      platforms: uniq(this.demo.flatMap((g) => g.platforms)),
    };
  }
}
