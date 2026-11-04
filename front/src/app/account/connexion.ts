import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18n } from '../i18n/i18n';
import { AccountService } from './account.service';

// Page de connexion : un onglet pour se connecter, un pour créer un compte.
@Component({
  selector: 'app-connexion',
  imports: [RouterLink],
  template: `
    <section class="panel">
      <h1>{{ d().account.title }}</h1>

      @if (!account.enabled()) {
        <p class="notice">{{ d().account.off }}</p>
        <a class="btn" routerLink="/ludotheque">{{ d().account.explore }}</a>
      } @else if (account.user(); as u) {
        <p class="notice">
          {{ d().account.signedAs }} <strong>{{ u.email }}</strong>
        </p>
        <div class="actions">
          <a class="btn btn-primary" routerLink="/etagere">{{ d().account.myShelf }}</a>
          <button type="button" class="btn" (click)="logout()">{{ d().account.logout }}</button>
        </div>
      } @else {
        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mode() === 'login'"
            (click)="mode.set('login')"
          >
            {{ d().account.signin }}
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mode() === 'register'"
            (click)="mode.set('register')"
          >
            {{ d().account.create }}
          </button>
        </div>

        <form class="form" (submit)="submit($event)">
          <label>
            <span>{{ d().account.email }}</span>
            <input
              name="email"
              type="email"
              autocomplete="email"
              required
              [value]="email()"
              (input)="email.set(val($event))"
            />
          </label>
          <label>
            <span>{{ d().account.password }}</span>
            <input
              name="password"
              type="password"
              required
              minlength="8"
              [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
              [value]="password()"
              (input)="password.set(val($event))"
            />
          </label>

          @if (error(); as code) {
            <p class="error" role="alert">{{ errorText(code) }}</p>
          }

          <button type="submit" class="btn btn-primary" [disabled]="busy()">
            {{ mode() === 'login' ? d().account.signin : d().account.create }}
          </button>
          <p class="hint">{{ d().account.hint }}</p>
        </form>
      }
    </section>
  `,
  styles: `
    .panel {
      display: grid;
      gap: 16px;
      max-width: 440px;
      padding-top: 16px;
    }

    h1 {
      font-size: clamp(32px, 8vw, 48px);
      font-weight: 800;
    }

    .notice,
    .hint {
      margin: 0;
      color: color-mix(in srgb, var(--encre) 75%, transparent);
    }

    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 1px solid var(--ligne);
      border-radius: 10px;
      overflow: hidden;
    }

    .tabs button {
      min-height: 44px;
      border: 0;
      background: transparent;
      color: var(--encre);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .tabs button[aria-selected='true'] {
      background: var(--encre);
      color: var(--fond);
    }

    .form {
      display: grid;
      gap: 14px;
    }

    label {
      display: grid;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--brume);
    }

    input {
      min-height: 48px;
      padding: 12px 14px;
      border: 1px solid var(--ligne);
      border-radius: 10px;
      background: var(--surface);
      color: var(--encre);
      font: inherit;
      font-size: 16px;
    }

    .error {
      margin: 0;
      color: #ff9a8a;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
  `,
})
export class Connexion {
  protected readonly account = inject(AccountService);
  private readonly router = inject(Router);
  protected readonly d = inject(I18n).dict;

  constructor() {
    this.account.ensureStarted();
  }

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected errorText(code: string): string {
    const messages = this.d().account.errors as Record<string, string>;
    return messages[code] ?? messages['network'] ?? '';
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected submit(e: Event) {
    e.preventDefault();
    this.error.set(null);
    this.busy.set(true);
    const email = this.email().trim();
    const password = this.password();
    const call =
      this.mode() === 'login'
        ? this.account.login(email, password)
        : this.account.register(email, password);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.router.navigateByUrl('/etagere');
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(AccountService.errorCode(err));
      },
    });
  }

  protected logout() {
    this.account.logout().subscribe();
  }
}
