import { Component, input } from '@angular/core';
import { Game } from './data/game.model';

// Une cartouche : jaquette (couleur en attendant les visuels RAWG), titre, plateforme et année.
@Component({
  selector: 'app-cartridge',
  template: `
    <div
      class="cart"
      [class.cart-small]="size() === 's'"
      [class.cart-large]="size() === 'l'"
      [style.--art]="art()"
      [style.--band]="game().band"
      [style.--ink]="ink()"
    >
      <div class="cart-art" aria-hidden="true"></div>
      <div class="cart-label">
        <span class="cart-title">{{ game().name }}</span>
        <span class="cart-meta">{{ meta() }}</span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .cart {
      position: relative;
      width: 100%;
      max-width: 170px;
      margin: 0 auto;
      aspect-ratio: 170 / 226;
      border-radius: 6px 6px 4px 4px;
      background: linear-gradient(180deg, #c9c8c4, #9e9d99);
      box-shadow:
        inset 0 -8px 0 #6f6e6b,
        inset 2px 0 0 rgba(255, 255, 255, 0.35),
        inset -2px 0 0 rgba(0, 0, 0, 0.25),
        0 22px 26px -14px rgba(0, 0, 0, 0.8),
        0 4px 8px -4px rgba(0, 0, 0, 0.6);
      padding: 12px;
    }

    .cart-art::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(115deg, rgba(255, 255, 255, 0.28) 0%, transparent 42%);
      pointer-events: none;
    }

    .cart::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 14px;
      right: 14px;
      height: 22px;
      background: repeating-linear-gradient(90deg, #7f7e7b 0 2px, transparent 2px 6px);
      border-radius: 2px;
    }

    .cart-art {
      position: absolute;
      top: 42px;
      left: 14px;
      right: 14px;
      bottom: 66px;
      border-radius: 3px;
      background: var(--art);
      border: 2px solid #1b1b1d;
    }

    .cart-label {
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 14px;
      padding: 8px 8px 7px;
      background: var(--band);
      border: 2px solid #1b1b1d;
      border-radius: 2px;
      display: grid;
      gap: 2px;
      color: var(--ink);
    }

    .cart-title {
      font-family: var(--font-titre);
      font-weight: 800;
      font-size: 13px;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cart-meta {
      font-family: var(--font-mono);
      font-size: 10px;
      line-height: 1.3;
      opacity: 0.8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cart-small {
      max-width: 110px;
      padding: 6px;
    }

    .cart-small::before {
      top: 6px;
      left: 8px;
      right: 8px;
      height: 12px;
    }

    .cart-small .cart-art {
      top: 24px;
      left: 8px;
      right: 8px;
      bottom: 46px;
    }

    .cart-small .cart-label {
      left: 8px;
      right: 8px;
      bottom: 8px;
      padding: 4px 5px;
    }

    .cart-small .cart-title {
      font-size: 12px;
    }

    .cart-small .cart-meta {
      font-size: 10px;
    }

    .cart-large {
      max-width: 220px;
    }

    .cart-large .cart-title {
      font-size: 17px;
    }
  `,
})
export class Cartridge {
  readonly game = input.required<Game>();
  readonly size = input<'s' | 'm' | 'l'>('m');

  // Jaquette réelle si elle existe, sinon le dégradé de la maquette.
  protected art() {
    const cover = this.game().cover;
    return cover ? `url("${cover}") center / cover` : this.game().art;
  }

  // Deux plateformes au plus, le reste en « +n » : la ligne tient sur une petite cartouche.
  protected meta() {
    const platforms = this.game().platforms;
    const shown = platforms.slice(0, 2).join(' · ');
    const more = platforms.length > 2 ? ` +${platforms.length - 2}` : '';
    return `${shown}${more} · ${this.game().year}`;
  }

  // Texte sombre sur les bandeaux clairs, clair sur les sombres (contraste WCAG AA).
  protected ink() {
    return isLight(this.game().band) ? '#1a1206' : '#fff8ee';
  }
}

function isLight(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  // Luminance relative : au-delà de 0,18, le texte clair passe moins bien que le sombre.
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.18;
}
