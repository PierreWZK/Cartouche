import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { GamesService } from '../data/games.service';
import { Game } from '../data/game.model';
import { I18n } from '../i18n/i18n';
import { ShelfGrid } from './shelf-grid';

// Page publique /u/pseudo : l'étagère d'un joueur, sans compte. Lue depuis /api/u/:pseudo (404 si privée).
@Component({
  selector: 'app-public-shelf',
  imports: [ShelfGrid],
  template: `
    <header class="head">
      <h1>{{ username() }}</h1>
      @if (state(); as s) {
        @if (s.ok) {
          <p>{{ i18n.count(s.games.length, d().shelf.countOne, d().shelf.count) }}</p>
        }
      }
    </header>

    @if (state(); as s) {
      @if (s.ok) {
        <app-shelf-grid [games]="s.games" />
      } @else {
        <p class="notice">{{ d().publicShelf.missing }}</p>
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

    .notice {
      color: color-mix(in srgb, var(--encre) 75%, transparent);
    }
  `,
})
export class PublicShelf {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly games = inject(GamesService);
  protected readonly i18n = inject(I18n);
  protected readonly d = this.i18n.dict;

  protected readonly username = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('username') ?? '')),
    { initialValue: '' },
  );

  // Pseudo introuvable ou étagère privée : même message dans les deux cas.
  protected readonly state = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('username') ?? ''),
      switchMap((name) =>
        this.http.get<{ username: string; gameIds: string[] }>(
          `/api/u/${encodeURIComponent(name)}`,
        ),
      ),
      switchMap((r) => this.games.byIds(r.gameIds)),
      map((games: Game[]) => ({ ok: true as const, games })),
      catchError(() => of({ ok: false as const, games: [] as Game[] })),
    ),
    { initialValue: null },
  );
}
