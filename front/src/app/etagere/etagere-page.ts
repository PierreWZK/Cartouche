import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { AccountService } from '../account/account.service';
import { GamesService } from '../data/games.service';
import { I18n } from '../i18n/i18n';
import { ShelfGrid } from './shelf-grid';
import { ExportFormat, MAX_COVERS, renderShelfPng } from './shelf-export';

// Mon étagère : les favoris du compte, chargés depuis l'API.
@Component({
  selector: 'app-etagere-page',
  imports: [ShelfGrid, RouterLink],
  template: `
    <header class="head">
      <h1>{{ d().appnav.shelf }}</h1>
      @if (account.user()) {
        <p>{{ i18n.count(games().length, d().shelf.countOne, d().shelf.count) }}</p>
      }
    </header>

    @if (!account.enabled()) {
      <p class="notice">{{ d().shelf.offline }}</p>
    } @else if (!account.user()) {
      <p class="notice">{{ d().shelf.signinNeeded }}</p>
      <a class="btn btn-primary" routerLink="/connexion">{{ d().account.signin }}</a>
    } @else {
      @if (!loading() && games().length === 0) {
        <div class="empty">
          <p class="notice">{{ d().shelf.empty }}</p>
          <a class="btn btn-primary" routerLink="/ludotheque">{{ d().shelf.emptyCta }}</a>
        </div>
      }
      <app-shelf-grid [games]="games()" />
      @if (games().length > 0) {
        <div class="actions export" role="group" [attr.aria-label]="d().exportPng.title">
          <span class="export-title">{{ d().exportPng.title }}</span>
          <button type="button" class="btn" [disabled]="loading()" (click)="exportShelf('square')">
            {{ d().exportPng.square }}
          </button>
          <button
            type="button"
            class="btn"
            [disabled]="loading()"
            (click)="exportShelf('portrait')"
          >
            {{ d().exportPng.portrait }}
          </button>
          <button
            type="button"
            class="btn"
            [disabled]="loading()"
            (click)="exportShelf('landscape')"
          >
            {{ d().exportPng.landscape }}
          </button>
          <p aria-live="polite">{{ exportMessage() }}</p>
        </div>
      }
      @if (account.user()?.shelfPublic) {
        <div class="actions">
          <button type="button" class="btn" (click)="copyLink()">{{ d().shelf.copyLink }}</button>
          @if (account.user()?.username) {
            <a class="btn" [routerLink]="['/u', account.user()?.username]">{{
              d().profile.pageLink
            }}</a>
          }
          <p aria-live="polite">{{ message() }}</p>
        </div>
      }

      <section class="profile" aria-labelledby="profile-title">
        <h2 id="profile-title">{{ d().profile.title }}</h2>
        <label class="field">
          <span>{{ d().profile.username }}</span>
          <input
            type="text"
            maxlength="20"
            autocomplete="off"
            [value]="draftName()"
            (input)="draftName.set($any($event.target).value)"
          />
          <small>{{ d().profile.usernameHint }}</small>
        </label>
        <label class="toggle">
          <input
            type="checkbox"
            [checked]="draftPublic()"
            (change)="draftPublic.set($any($event.target).checked)"
          />
          <span>{{ d().profile.public }}</span>
        </label>
        <p class="hint">{{ draftPublic() ? d().profile.publicOn : d().profile.publicOff }}</p>
        <div class="actions">
          <button type="button" class="btn btn-primary" (click)="saveProfile()">
            {{ d().profile.save }}
          </button>
          <p aria-live="polite">{{ profileMessage() }}</p>
        </div>

        <details class="danger">
          <summary>{{ d().profile.deleteTitle }}</summary>
          <p class="hint">{{ d().profile.deleteHint }}</p>
          <input
            type="password"
            autocomplete="current-password"
            [value]="deletePassword()"
            (input)="deletePassword.set($any($event.target).value)"
            aria-label="Mot de passe"
          />
          <button type="button" class="btn" (click)="deleteAccount()">
            {{ d().profile.deleteButton }}
          </button>
          <p aria-live="polite">{{ deleteMessage() }}</p>
        </details>
      </section>
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

    .head p,
    .actions p {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--brume);
    }

    .empty {
      display: grid;
      justify-items: start;
      gap: 14px;
      padding: 28px 0;
    }

    .notice {
      color: color-mix(in srgb, var(--encre) 75%, transparent);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
    }

    .profile {
      display: grid;
      gap: 12px;
      max-width: 420px;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid var(--ligne);
    }

    .profile h2 {
      font-size: 22px;
      font-weight: 800;
    }

    .field {
      display: grid;
      gap: 6px;
      font-weight: 700;
    }

    .field input {
      min-height: 48px;
      padding: 0 14px;
      border-radius: 10px;
      border: 1px solid var(--ligne);
      background: var(--surface);
      color: var(--encre);
      font: inherit;
    }

    .field small,
    .hint {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 400;
      color: var(--brume);
    }

    .toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      font-weight: 700;
    }

    .toggle input {
      width: 22px;
      height: 22px;
      accent-color: var(--ambre);
    }
  `,
})
export class EtagerePage {
  protected readonly account = inject(AccountService);
  private readonly games$ = inject(GamesService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18n);
  protected readonly d = this.i18n.dict;

  constructor() {
    this.account.ensureStarted();
    // Les brouillons suivent le compte : au chargement, puis après chaque enregistrement.
    effect(() => {
      const u = this.account.user();
      if (!u) return;
      this.draftName.set(u.username ?? '');
      this.draftPublic.set(u.shelfPublic === true);
    });
  }
  protected readonly message = signal('');
  protected readonly draftName = signal('');
  protected readonly draftPublic = signal(false);
  protected readonly profileMessage = signal('');

  protected readonly exportMessage = signal('');

  // Image composée et téléchargée. Le nom est le pseudo (jamais l'email, qui ne doit pas sortir du compte).
  protected async exportShelf(format: ExportFormat) {
    this.exportMessage.set('');
    const user = this.account.user();
    try {
      const blob = await renderShelfPng({
        games: this.games(),
        name: user?.username || this.d().exportPng.defaultName,
        countLabel: this.i18n.count(
          this.games().length,
          this.d().shelf.countOne,
          this.d().shelf.count,
        ),
        dateLabel: new Date().toLocaleDateString(this.i18n.lang()),
        brand: 'CARTOUCHE',
        moreLabel: this.d().exportPng.more.replace('{n}', String(this.games().length - MAX_COVERS)),
        format,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cartouche-${format}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.exportMessage.set(this.d().exportPng.failed);
    }
  }

  protected readonly deletePassword = signal('');
  protected readonly deleteMessage = signal('');

  protected deleteAccount() {
    this.deleteMessage.set('');
    this.account.deleteAccount(this.deletePassword()).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) =>
        this.deleteMessage.set(
          AccountService.errorCode(err) === 'bad_password'
            ? this.d().profile.errors.bad_password
            : this.d().profile.errors.network,
        ),
    });
  }

  protected saveProfile() {
    this.profileMessage.set('');
    const name = this.draftName().trim();
    this.account
      .saveProfile({ username: name || null, shelfPublic: this.draftPublic() })
      .subscribe({
        next: () => this.profileMessage.set(this.d().profile.saved),
        error: (err) => {
          const code = AccountService.errorCode(err);
          const errors = this.d().profile.errors;
          this.profileMessage.set(
            code === 'bad_username'
              ? errors.bad_username
              : code === 'username_taken'
                ? errors.username_taken
                : errors.network,
          );
        },
      });
  }

  // Les favoris changent à chaque clic sur une fiche : on recharge les jeux à chaque changement.
  // Vrai tant que la liste se recharge : l'export attend alors la liste complète.
  protected readonly loading = signal(true);
  protected readonly games = toSignal(
    toObservable(computed(() => [...this.account.favouriteIds()])).pipe(
      switchMap(() => {
        this.loading.set(true);
        return this.games$.shelf().pipe(tap(() => this.loading.set(false)));
      }),
    ),
    { initialValue: [] },
  );

  protected copyLink() {
    this.message.set('');
    this.account.shareId().subscribe({
      next: async (id) => {
        const url = `${location.origin}/e/${id}`;
        try {
          await navigator.clipboard.writeText(url);
          this.message.set(this.d().shelf.copied);
        } catch {
          this.message.set(url);
        }
      },
      error: () => this.message.set(this.d().shelf.error),
    });
  }
}
