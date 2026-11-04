import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { GamesService } from '../data/games.service';
import { I18n } from '../i18n/i18n';
import { ShelfGrid } from './shelf-grid';

// Sept jeux de la base de démo (demo-games.json), étagère d'exemple /e/demo.
const DEMO_SHELF = [
  'american-chopper',
  'animal-company',
  'super-metroid',
  'the-legend-of-zelda-a-link-to-the-past',
  'super-mario-world',
  'suikoden-ii',
  'the-last-of-us-remastered',
];

// Étagère partagée : lecture seule, sans compte. Page privée pour les moteurs (noindex).
@Component({
  selector: 'app-shared-shelf',
  imports: [ShelfGrid, RouterLink],
  template: `
    <header class="head">
      <h1>{{ d().shelf.sharedTitle }}</h1>
      @if (state(); as s) {
        @if (s.ok) {
          <p>{{ i18n.count(s.games.length, d().shelf.countOne, d().shelf.count) }}</p>
        }
      }
    </header>

    @if (state(); as s) {
      @if (s.ok) {
        <app-shelf-grid [games]="s.games" [base]="s.local ? '/demo' : '/ludotheque/jeu'" />

        <section class="list" aria-labelledby="shelf-list-title">
          <h2 id="shelf-list-title">{{ d().shelf.listTitle }}</h2>
          <ul>
            @for (g of s.games; track g.id) {
              <li>
                <a [routerLink]="[s.local ? '/demo' : '/ludotheque/jeu', g.id]">{{ g.name }}</a>
                <span>{{ g.platforms[0] }}{{ g.year ? ' · ' + g.year : '' }}</span>
              </li>
            }
          </ul>
        </section>

        <a class="btn btn-primary" routerLink="/ludotheque">{{ d().shelf.makeYours }}</a>
      } @else {
        <p class="notice">{{ d().shelf.sharedMissing }}</p>
        <a class="btn" routerLink="/ludotheque">{{ d().account.explore }}</a>
      }
    }
  `,
  styles: `
    .head {
      display: grid;
      gap: 6px;
      padding-bottom: 16px;
    }

    h1 {
      font-size: clamp(32px, 8vw, 52px);
      font-weight: 800;
    }

    .head p {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--brume);
    }

    .list {
      margin: 24px 0;
    }

    .list h2 {
      font-size: 20px;
      font-weight: 800;
    }

    .list ul {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }

    .list li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 4px 12px;
      min-height: 44px;
      border-bottom: 1px solid var(--ligne);
    }

    .list a {
      font-weight: 700;
      color: var(--encre);
    }

    .list span {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--brume);
    }

    .notice {
      color: color-mix(in srgb, var(--encre) 75%, transparent);
    }
  `,
})
export class SharedShelf {
  private readonly http = inject(HttpClient);
  private readonly games = inject(GamesService);
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18n);
  protected readonly d = this.i18n.dict;

  constructor() {
    // Une étagère partagée ne doit pas être indexée, mais le reste du site si : on retire la balise en sortant.
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex' });
    inject(DestroyRef).onDestroy(() => meta.removeTag("name='robots'"));
  }

  protected readonly state = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('id') ?? ''),
      switchMap((id) =>
        this.shelfIds(id).pipe(
          switchMap((r) =>
            this.games
              .byIds(r.gameIds, r.local)
              .pipe(map((list) => ({ ok: true as const, games: list, local: r.local }))),
          ),
          catchError(() => of({ ok: false as const, games: [], local: false })),
        ),
      ),
    ),
  );

  // /e/demo : l'étagère d'exemple de la vitrine, sur données locales (rien à lire en base).
  private shelfIds(id: string) {
    if (id === 'demo') return of({ gameIds: DEMO_SHELF, local: true });
    return this.http
      .get<{ gameIds: string[] }>(`/api/shelves/${encodeURIComponent(id)}`)
      .pipe(map((r) => ({ gameIds: r.gameIds, local: false })));
  }
}
