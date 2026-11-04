import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { Cartridge } from './cartridge';
import { GameFilters, Game, SortKey } from './data/game.model';
import { GamesService } from './data/games.service';
import { I18n } from './i18n/i18n';

const SORTS: SortKey[] = ['name', 'year', 'rating'];
const DECADES = [1970, 1980, 1990, 2000, 2010, 2020];
const MIN_RATINGS = [3, 4];

// Les filtres vivent dans l'adresse : une recherche se partage et survit au rechargement.
function parseFilters(params: ParamMap): GameFilters {
  const csv = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
  const sort = params.get('sort') as SortKey;
  const decade = Number(params.get('decade'));
  const minRating = Number(params.get('minRating'));
  return {
    q: params.get('q') ?? '',
    genres: csv(params.get('genre')),
    platforms: csv(params.get('platform')),
    sort: SORTS.includes(sort) ? sort : 'name',
    decade: DECADES.includes(decade) ? decade : null,
    minRating: MIN_RATINGS.includes(minRating) ? minRating : null,
  };
}

@Component({
  selector: 'app-catalogue',
  imports: [RouterLink, Cartridge],
  template: `
    <header class="head">
      <h1>{{ d().catalogue.title }}</h1>
      <label class="search">
        <span class="visually-hidden">{{ d().catalogue.searchLabel }}</span>
        <input
          type="search"
          autocomplete="off"
          [placeholder]="d().catalogue.searchPlaceholder"
          [value]="filters().q"
          (input)="search$.next($any($event.target).value)"
        />
      </label>
    </header>

    <div class="tags" role="group" [attr.aria-label]="d().catalogue.genres">
      @for (g of facets().genres; track g.slug) {
        <button
          type="button"
          class="tag"
          [attr.aria-pressed]="filters().genres.includes(g.slug)"
          (click)="toggle('genre', g.slug)"
        >
          {{ g.name }}
        </button>
      }
    </div>

    <div class="tags" role="group" [attr.aria-label]="d().catalogue.platforms">
      @for (p of facets().platforms; track p.slug) {
        <button
          type="button"
          class="tag"
          [attr.aria-pressed]="filters().platforms.includes(p.slug)"
          (click)="toggle('platform', p.slug)"
        >
          {{ p.name }}
        </button>
      }
    </div>

    <div class="tags" role="group" [attr.aria-label]="d().catalogue.decades">
      @for (dec of decades; track dec) {
        <button
          type="button"
          class="tag"
          [attr.aria-pressed]="filters().decade === dec"
          (click)="pick('decade', dec)"
        >
          {{ dec }}s
        </button>
      }
    </div>

    <div class="tags" role="group" [attr.aria-label]="d().catalogue.rating">
      @for (n of minRatings; track n) {
        <button
          type="button"
          class="tag"
          [attr.aria-pressed]="filters().minRating === n"
          (click)="pick('minRating', n)"
        >
          {{ d().catalogue.ratingFrom.replace('{n}', '' + n) }}
        </button>
      }
    </div>

    <div class="status">
      <div class="sorts" role="group" [attr.aria-label]="d().catalogue.sortLabel">
        @for (s of sorts; track s) {
          <button
            type="button"
            class="sort"
            [attr.aria-pressed]="filters().sort === s"
            (click)="update({ sort: s })"
          >
            {{ d().catalogue.sort[s] }}
          </button>
        }
      </div>
      <!-- Pas de « 0 jeux » pendant le chargement. -->
      <p aria-live="polite">
        @if (!loading()) {
          {{ i18n.count(total(), d().catalogue.countOne, d().catalogue.count) }}
        }
      </p>
    </div>

    <ul class="grid">
      @for (g of items(); track g.id) {
        <li>
          <a class="card" [routerLink]="[demo ? '/demo' : '/ludotheque/jeu', g.id]">
            <app-cartridge [game]="g" size="s" />
            <span class="ratings">
              <span
                ><span>{{ d().catalogue.ratingRawg }}</span
                ><b>{{ g.ratingRawg.toFixed(1) }}</b></span
              >
              <span
                ><span>{{ d().catalogue.ratingCart }}</span
                ><b>{{ g.ratingCart?.toFixed(1) ?? '—' }}</b></span
              >
            </span>
          </a>
        </li>
      }
      @if (loading() && items().length === 0) {
        @for (n of skeletons; track n) {
          <li class="skel" aria-hidden="true"></li>
        }
      }
    </ul>

    @if (!loading() && items().length === 0) {
      <p class="empty">{{ d().catalogue.empty }}</p>
    }

    <div #sentinel class="sentinel" aria-hidden="true"></div>
    @if (loading()) {
      <p class="loading">{{ d().catalogue.loading }}</p>
    }
  `,
  styles: `
    .head {
      display: grid;
      gap: 12px;
    }

    h1 {
      font-size: clamp(32px, 8vw, 52px);
      font-weight: 800;
    }

    .search input {
      width: 100%;
      min-height: 48px;
      padding: 12px 14px;
      border: 1px solid var(--ligne);
      border-radius: 10px;
      background: var(--surface);
      color: var(--encre);
      font: inherit;
      font-size: 16px;
    }

    .tags {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 12px 0 0;
      scrollbar-width: none;
    }

    .tag,
    .sort {
      flex: 0 0 auto;
      min-height: 44px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid var(--ligne);
      background: var(--surface);
      color: var(--encre);
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }

    .tag[aria-pressed='true'],
    .sort[aria-pressed='true'] {
      background: var(--ambre);
      border-color: var(--ambre);
      color: var(--ambre-texte);
      font-weight: 700;
    }

    .status {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 16px 0;
    }

    .sorts {
      display: flex;
      gap: 6px;
    }

    .status p {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--brume);
    }

    .grid {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 16px;
    }

    /* La carte a la largeur de sa cartouche : les notes restent collées dessous. */
    .card {
      display: grid;
      gap: 6px;
      width: min(100%, 110px);
      margin: 0 auto;
      text-decoration: none;
    }

    .ratings {
      display: grid;
      gap: 2px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: color-mix(in srgb, var(--encre) 70%, transparent);
    }

    .ratings > span {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }

    .ratings b {
      color: var(--encre);
      font-weight: 700;
    }

    .skel {
      width: min(100%, 110px);
      margin: 0 auto;
      aspect-ratio: 170 / 226;
      border-radius: 6px;
      background: linear-gradient(
        90deg,
        var(--surface) 0%,
        var(--surface-haute) 50%,
        var(--surface) 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite linear;
    }

    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }

    .empty,
    .loading {
      color: var(--brume);
      text-align: center;
      padding: 24px 0;
    }

    .sentinel {
      height: 1px;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }

    @media (min-width: 768px) {
      .grid {
        gap: 24px;
      }
    }
  `,
})
export class Catalogue {
  private readonly games = inject(GamesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly i18n = inject(I18n);
  protected readonly d = this.i18n.dict;
  // Route /demo : données locales uniquement, et les fiches restent dans /demo.
  protected readonly demo = this.route.snapshot.data['demo'] === true;

  protected readonly facets = toSignal(this.games.facets(this.demo), {
    initialValue: { genres: [], platforms: [] },
  });
  protected readonly sorts = SORTS;
  protected readonly decades = DECADES;
  protected readonly minRatings = MIN_RATINGS;
  protected readonly skeletons = [1, 2, 3, 4, 5, 6];

  protected readonly filters = toSignal(this.route.queryParamMap.pipe(map(parseFilters)), {
    requireSync: true,
  });
  protected readonly items = signal<Game[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly search$ = new Subject<string>();

  private readonly sentinel = viewChild.required<ElementRef<HTMLElement>>('sentinel');
  private page = 1;
  // Change à chaque nouveau filtre : une page chargée pour un ancien filtre est ignorée.
  private generation = 0;
  private observer?: IntersectionObserver;

  constructor() {
    // Chaque nouveau filtre annule la requête en cours (switchMap).
    toObservable(this.filters)
      .pipe(
        tap(() => {
          this.page = 1;
          this.generation++;
          this.loading.set(true);
        }),
        switchMap((f) => this.games.list(f, 1, this.demo)),
        takeUntilDestroyed(),
      )
      .subscribe((p) => {
        this.items.set(p.items);
        this.total.set(p.total);
        this.loading.set(false);
        this.recheckSentinel();
      });

    // La frappe attend une courte pause avant de mettre l'adresse à jour.
    this.search$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.update({ q: q.trim() || null }));

    afterNextRender(() => {
      this.observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) this.loadMore();
      });
      this.observer.observe(this.sentinel().nativeElement);
      this.destroyRef.onDestroy(() => this.observer?.disconnect());
    });
  }

  protected toggle(key: 'genre' | 'platform', value: string) {
    const current = key === 'genre' ? this.filters().genres : this.filters().platforms;
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    this.update({ [key]: next.join(',') || null });
  }

  // Un second clic sur une étiquette déjà choisie la retire.
  protected pick(key: 'decade' | 'minRating', value: number) {
    this.update({ [key]: this.filters()[key] === value ? null : String(value) });
  }

  protected update(params: Record<string, string | null>) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }

  // Le sentinelle reste visible quand la page est courte : il faut le réobserver pour que le navigateur re-notifie.
  private recheckSentinel() {
    if (!this.observer) return;
    const el = this.sentinel().nativeElement;
    this.observer.unobserve(el);
    this.observer.observe(el);
  }

  protected loadMore() {
    if (this.loading() || this.items().length >= this.total()) return;
    const gen = this.generation;
    this.loading.set(true);
    this.games
      .list(this.filters(), this.page + 1, this.demo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        if (gen !== this.generation) return;
        this.page = p.page;
        this.items.update((list) => [...list, ...p.items]);
        this.loading.set(false);
        this.recheckSentinel();
      });
  }
}
