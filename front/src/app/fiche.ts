import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AccountService } from './account/account.service';
import { Cartridge } from './cartridge';
import { GamesService } from './data/games.service';
import { I18n } from './i18n/i18n';

@Component({
  selector: 'app-fiche',
  imports: [RouterLink, Cartridge],
  template: `
    @let game = current();
    <a class="back" [attr.href]="demo ? '/demo' : '/ludotheque'" (click)="backToList($event)">
      ← {{ d().fiche.back }}
    </a>

    @if (game === undefined) {
      <p class="missing">{{ d().fiche.notFound }}</p>
    } @else if (game) {
      <article class="fiche">
        <div class="cover">
          <app-cartridge [game]="game" size="l" />
        </div>

        <div class="info">
          <h1>{{ game.name }}</h1>
          <p class="meta">{{ game.year }} · {{ game.studio }}</p>

          <ul class="tags" [attr.aria-label]="d().fiche.platforms">
            @for (p of game.platforms; track p) {
              <li class="tag">{{ p }}</li>
            }
            @for (g of game.genres; track g) {
              <li class="tag tag-genre">{{ g }}</li>
            }
          </ul>

          <div class="ratings">
            <div class="rating rating-global">
              <span class="label">{{ d().fiche.ratingRawg }}</span>
              <span class="score">{{ game.ratingRawg.toFixed(1) }}<small> / 5</small></span>
            </div>
            <div class="rating rating-cart">
              <span class="label">{{ d().fiche.ratingCart }}</span>
              <span class="score">{{ game.ratingCart?.toFixed(1) ?? '—' }}<small> / 5</small></span>
            </div>
          </div>

          <p class="description">{{ game.description }}</p>

          @if (game.screenshots?.length) {
            <h2 class="shots-title">{{ d().fiche.screenshots }}</h2>
            <ul class="shots">
              @for (src of game.screenshots; track src; let i = $index) {
                <li>
                  <img
                    [src]="src"
                    [alt]="
                      d()
                        .fiche.shotAlt.replace('{n}', '' + (i + 1))
                        .replace('{name}', game.name)
                    "
                    loading="lazy"
                  />
                </li>
              }
            </ul>
          }

          @if (demo) {
            <p class="soon">{{ d().fiche.shelfSoon }}</p>
          } @else if (account.enabled() && account.user()) {
            <button
              type="button"
              class="shelf-btn"
              [attr.aria-pressed]="isFavourite(game.id)"
              (click)="toggleFavourite(game.id)"
            >
              {{ isFavourite(game.id) ? d().fiche.removeShelf : d().fiche.addShelf }}
            </button>

            <div class="rate" role="group" [attr.aria-label]="d().fiche.yourRating">
              @for (n of [1, 2, 3, 4, 5]; track n) {
                <button
                  type="button"
                  class="star"
                  [attr.aria-pressed]="myScore() === n"
                  (click)="rate(game.id, n)"
                >
                  {{ n }}
                </button>
              }
            </div>
            <p class="soon" aria-live="polite">{{ message() }}</p>
          } @else if (account.enabled()) {
            <a class="shelf-btn link" routerLink="/connexion">{{ d().fiche.signinToAdd }}</a>
          } @else {
            <button type="button" class="shelf-btn" disabled>{{ d().fiche.addShelf }}</button>
            <p class="soon">{{ d().fiche.shelfSoon }}</p>
          }
        </div>
      </article>
    } @else {
      <div class="fiche-skel" aria-hidden="true">
        <div class="skel skel-cover"></div>
        <div class="skel skel-line"></div>
        <div class="skel skel-line short"></div>
      </div>
    }
  `,
  styles: `
    .fiche-skel {
      display: grid;
      gap: 14px;
      padding-top: 8px;
    }

    .skel {
      border-radius: 8px;
      background: linear-gradient(
        90deg,
        var(--surface) 0%,
        var(--surface-haute) 50%,
        var(--surface) 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite linear;
    }

    .skel-cover {
      aspect-ratio: 170 / 226;
      width: 100%;
      max-width: 220px;
      justify-self: center;
    }

    .skel-line {
      height: 18px;
    }

    .skel-line.short {
      width: 60%;
    }

    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }

    .back {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--encre);
      font-family: var(--font-mono);
      font-size: 14px;
    }

    .fiche {
      display: grid;
      gap: 24px;
      padding-top: 8px;
    }

    .cover {
      display: flex;
      justify-content: center;
    }

    h1 {
      font-size: clamp(32px, 8vw, 56px);
      font-weight: 800;
    }

    .meta {
      margin: 6px 0 0;
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--brume);
    }

    .tags {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0;
      margin: 16px 0 0;
    }

    .tag {
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--ligne);
      font-size: 13px;
    }

    .tag-genre {
      color: var(--ciel);
      border-color: color-mix(in srgb, var(--ciel) 50%, transparent);
    }

    .ratings {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 20px;
    }

    .rating {
      display: grid;
      gap: 4px;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid var(--ligne);
      background: var(--surface);
    }

    .rating-global .score {
      color: var(--ciel);
    }

    .rating-cart .score {
      color: var(--ambre);
    }

    .label {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--brume);
    }

    .score {
      font-family: var(--font-titre);
      font-size: 32px;
      font-weight: 800;
    }

    .score small {
      font-size: 14px;
      color: var(--brume);
      font-weight: 400;
    }

    .description {
      margin: 20px 0 0;
      color: color-mix(in srgb, var(--encre) 80%, transparent);
    }

    .shots {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 10px;
    }

    .shots img {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid var(--ligne);
      background: var(--surface);
    }

    .shots-title {
      margin: 28px 0 10px;
      font-family: var(--font-mono);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--brume);
    }

    .shelf-btn {
      width: 100%;
      min-height: 48px;
      margin-top: 24px;
      border-radius: 10px;
      border: 1px solid var(--ligne);
      background: var(--surface-haute);
      color: var(--brume);
      font: inherit;
      font-weight: 700;
    }

    .shelf-btn.link {
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      color: var(--ambre-texte);
      background: linear-gradient(180deg, #f6c07a, var(--ambre));
      border-color: transparent;
    }

    .shelf-btn[aria-pressed='true'] {
      background: var(--surface);
      color: var(--ambre);
      border-color: var(--ambre);
    }

    .rate {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    .star {
      flex: 1;
      min-height: 44px;
      border-radius: 10px;
      border: 1px solid var(--ligne);
      background: var(--surface);
      color: var(--encre);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .star[aria-pressed='true'] {
      background: var(--ambre);
      border-color: var(--ambre);
      color: var(--ambre-texte);
    }

    .soon,
    .missing {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--brume);
    }

    @media (min-width: 768px) {
      .fiche {
        grid-template-columns: 300px 1fr;
        align-items: start;
        gap: 48px;
      }
    }
  `,
})
export class Fiche {
  private readonly games = inject(GamesService);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  // Identifiant du jeu courant, lu depuis l'adresse (le composant peut être réutilisé d'un jeu à l'autre).
  private readonly gameId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });
  protected readonly account = inject(AccountService);
  protected readonly d = inject(I18n).dict;
  // Route /demo/:id : données locales uniquement, et le retour reste dans /demo.
  protected readonly demo = this.route.snapshot.data['demo'] === true;

  constructor() {
    if (!this.demo) this.account.ensureStarted();
    // Ma note enregistrée est relue dès que le compte et le jeu sont connus.
    effect(() => {
      const id = this.gameId();
      if (this.demo || !id || !this.account.user()) return;
      this.http
        .get<{ score: number | null }>(`/api/me/ratings/${encodeURIComponent(id)}`)
        .subscribe({
          next: (r) => this.myScore.set(r.score),
          error: () => this.myScore.set(null),
        });
    });
  }

  // Revenir par l'historique garde les filtres de la liste (?genre=…) ; sans historique, le lien suit son adresse.
  protected backToList(event: Event) {
    if ((history.state?.navigationId ?? 0) <= 1) return;
    event.preventDefault();
    history.back();
  }

  // Note donnée par cette personne pendant la visite (l'API n'expose pas encore la note relue).
  protected readonly myScore = signal<number | null>(null);
  protected readonly message = signal('');

  protected isFavourite(id: string): boolean {
    return this.account.favouriteIds().has(id);
  }

  protected toggleFavourite(id: string) {
    this.message.set('');
    this.account.toggleFavourite(id).subscribe({
      error: () => this.message.set(this.d().fiche.error),
    });
  }

  protected rate(id: string, score: number) {
    this.message.set('');
    this.account.rate(id, score).subscribe({
      next: () => {
        this.myScore.set(score);
        this.message.set(this.d().fiche.rated);
      },
      error: () => this.message.set(this.d().fiche.error),
    });
  }

  // undefined = jeu introuvable ; null = chargement en cours.
  protected readonly current = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('id') ?? ''),
      switchMap((id) => this.games.get(id, this.demo)),
    ),
    { initialValue: null },
  );
}
