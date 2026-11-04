import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AccountService } from './account/account.service';
import { I18n } from './i18n/i18n';
import { LangSwitch } from './lang-switch';

// Cadre des pages de l'application. Une seule navigation : dans l'en-tête sur ordinateur,
// en barre d'onglets en bas de l'écran sur téléphone (à portée de pouce).
@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LangSwitch],
  template: `
    <header class="app-header">
      <div class="brand-wrap">
        <a class="brand" routerLink="/" [attr.aria-label]="d().appnav.home">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-name">Cartouche</span>
        </a>
        @if (demo()) {
          <span class="demo-pill">{{ d().appnav.demo }}</span>
        }
      </div>

      <nav class="tabs" [attr.aria-label]="d().appnav.aria">
        <a
          [routerLink]="demo() ? '/demo' : '/ludotheque'"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
          </svg>
          {{ d().appnav.explore }}
        </a>
        <a routerLink="/jour" routerLinkActive="active" ariaCurrentWhenActive="page">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 6h14v14H5zM5 10h14M9 3v5M15 3v5" />
          </svg>
          {{ d().appnav.daily }}
        </a>
        <a routerLink="/etagere" routerLinkActive="active" ariaCurrentWhenActive="page">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 20h18M3 13h18M6 13V5h3v8M11 13V7h3v6M16 20v-5h3v5M6 20v-5h3v5" />
          </svg>
          {{ d().appnav.shelf }}
        </a>
      </nav>

      <!-- Langue dans l'en-tête : en pied de page, le défilement infini du catalogue la repoussait hors d'atteinte. -->
      <div class="header-end">
        <app-lang-switch />
        @if (showAccount()) {
          <a
            class="account"
            routerLink="/connexion"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
          >
            <span class="account-dot" [class.on]="account.user()" aria-hidden="true"></span>
            {{ account.user() ? d().account.title : d().account.signin }}
          </a>
        }
      </div>
    </header>

    <main class="app-main">
      <router-outlet />
    </main>

    <footer class="app-footer">
      <span
        >{{ d().footer.project }} · <a href="https://projectp.fr/">{{ d().footer.parent }}</a></span
      >
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }

    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 60px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--ligne);
      background: var(--surface);
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      text-decoration: none;
    }

    .brand-mark {
      width: 20px;
      height: 26px;
      border-radius: 3px;
      background: linear-gradient(var(--encre) 0 30%, var(--ambre) 30% 100%);
      border: 2px solid var(--encre);
    }

    .brand-name {
      font-family: var(--font-titre);
      font-weight: 800;
      font-size: 18px;
    }

    /* Petit téléphone : le logo seul laisse la place à la langue et au compte (le lien garde son aria-label). */
    @media (max-width: 479px) {
      .brand-name {
        display: none;
      }
    }

    .demo-pill {
      padding: 3px 8px;
      border: 1px solid var(--ambre);
      border-radius: 999px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--ambre);
    }

    .header-end {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .account {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid var(--ligne);
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
      color: var(--encre);
    }

    .account.active {
      border-color: var(--ambre);
    }

    .account-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1px solid var(--brume);
    }

    .account-dot.on {
      border-color: var(--ambre);
      background: var(--ambre);
    }

    /* Téléphone : barre d'onglets fixée en bas. */
    .tabs {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--surface);
      border-top: 1px solid var(--ligne);
    }

    .tabs a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 60px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      color: color-mix(in srgb, var(--encre) 70%, transparent);
      box-shadow: inset 0 3px 0 transparent;
    }

    .tabs svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linejoin: round;
    }

    .tabs a.active {
      color: var(--ambre);
      box-shadow: inset 0 3px 0 var(--ambre);
    }

    .app-main {
      flex: 1;
      padding: 16px;
    }

    /* Le pied de page reste au-dessus de la barre d'onglets fixe. */
    .app-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 16px calc(76px + env(safe-area-inset-bottom));
      border-top: 1px solid var(--ligne);
      font-size: 13px;
      color: var(--brume);
    }

    .app-footer a {
      display: inline-block;
      padding: 12px 0;
      color: var(--encre);
    }

    /* Ordinateur : la navigation rejoint l'en-tête, une seule barre. */
    @media (min-width: 768px) {
      .app-header {
        padding: 0 40px;
        min-height: 68px;
      }

      .tabs {
        position: static;
        display: flex;
        gap: 4px;
        padding: 0;
        border: 0;
        background: none;
      }

      .tabs a {
        flex-direction: row;
        gap: 8px;
        min-height: 68px;
        padding: 0 16px;
        font-size: 15px;
        box-shadow: inset 0 -3px 0 transparent;
      }

      .tabs svg {
        width: 18px;
        height: 18px;
      }

      .tabs a.active {
        box-shadow: inset 0 -3px 0 var(--ambre);
      }

      .tabs a:hover {
        color: var(--encre);
      }

      .app-main {
        padding: 32px 40px 48px;
      }

      .app-footer {
        padding: 20px 40px;
      }
    }
  `,
})
export class AppLayout {
  private readonly router = inject(Router);
  protected readonly account = inject(AccountService);
  protected readonly d = inject(I18n).dict;

  // null tant que la première navigation n'est pas terminée : router.url n'est pas encore fiable.
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: null },
  );

  protected readonly demo = computed(() => this.url()?.startsWith('/demo') ?? false);

  // Pas de compte en démo, ni quand le serveur n'en propose pas ; rien avant la réponse du serveur.
  protected readonly showAccount = computed(
    () => !this.demo() && this.account.ready() && this.account.enabled(),
  );

  constructor() {
    // Le compte ne se charge que hors démo : la démo ne fait aucun appel réseau.
    effect(() => {
      const url = this.url();
      if (url !== null && !url.startsWith('/demo')) this.account.ensureStarted();
    });
  }
}
