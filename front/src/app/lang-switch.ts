import { Component, inject } from '@angular/core';
import { I18n, Lang } from './i18n/i18n';

@Component({
  selector: 'app-lang-switch',
  template: `
    <div class="lang" role="group" [attr.aria-label]="d().footer.language">
      @for (l of langs; track l) {
        <button
          type="button"
          class="lang-btn"
          [attr.aria-pressed]="i18n.lang() === l"
          [attr.lang]="l"
          (click)="i18n.setLang(l)"
        >
          {{ l === 'fr' ? 'FR' : 'EN' }}
        </button>
      }
    </div>
  `,
  styles: `
    .lang {
      display: inline-flex;
      gap: 4px;
    }

    .lang-btn {
      min-width: 44px;
      min-height: 44px;
      padding: 0 10px;
      border-radius: 8px;
      border: 1px solid var(--ligne);
      background: transparent;
      color: var(--encre);
      font-family: var(--font-mono);
      cursor: pointer;
    }

    .lang-btn[aria-pressed='true'] {
      background: var(--ambre);
      border-color: var(--ambre);
      color: var(--ambre-texte);
      font-weight: 700;
    }
  `,
})
export class LangSwitch {
  protected readonly i18n = inject(I18n);
  protected readonly d = this.i18n.dict;
  protected readonly langs: Lang[] = ['fr', 'en'];
}
