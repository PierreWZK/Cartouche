import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Cartridge } from '../cartridge';
import { Game } from '../data/game.model';

// Une section par tranche de 30 jeux : la taille des cartouches reste lisible, même avec 100 jeux.
const SECTION = 30;

// Étagère en rangées : les cartouches grandissent quand il y en a peu, et se compactent quand la collection grandit.
// Remplace la scène 3D : même rendu pour les favoris et l'étagère partagée.
@Component({
  selector: 'app-shelf-grid',
  imports: [Cartridge, RouterLink],
  template: `
    @for (s of sections(); track s.from) {
      @if (sections().length > 1) {
        <h3 class="section-title">{{ s.from }} – {{ s.from + s.games.length - 1 }}</h3>
      }
      <ul class="shelf" [attr.data-density]="density()">
        @for (g of s.games; track g.id) {
          <li animate.enter="slot-in" animate.leave="slot-out">
            <a class="slot" [routerLink]="[base(), g.id]">
              <app-cartridge [game]="g" [size]="size()" />
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .shelf {
      list-style: none;
      margin: 0;
      padding: 16px 0 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--min), 1fr));
      row-gap: 18px;
    }

    .shelf[data-density='xl'] {
      --min: 200px;
    }

    .shelf[data-density='l'] {
      --min: 150px;
    }

    .shelf[data-density='m'] {
      --min: 118px;
    }

    .section-title {
      margin: 28px 0 0;
      font-family: var(--font-mono);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--brume);
    }

    li {
      position: relative;
      padding: 0 10px 16px;
    }

    /* Planche sous chaque rangée : les planches s'alignent d'une cartouche à l'autre. */
    li::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 12px;
      border-radius: 2px;
      background: linear-gradient(180deg, #8a5a33, #5a3a1f);
      box-shadow: 0 8px 12px -6px rgba(0, 0, 0, 0.7);
    }

    .slot {
      display: block;
      border-radius: 8px;
      text-decoration: none;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .slot:hover {
      transform: translateY(-6px);
    }

    /* Ajout : la cartouche tombe sur la planche. Retrait : elle s'efface avant de disparaître. */
    .slot-in {
      animation: slot-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }

    .slot-out {
      animation: slot-out 0.25s ease-in both;
    }

    @keyframes slot-in {
      from {
        opacity: 0;
        transform: translateY(-18px) scale(0.94);
      }
    }

    @keyframes slot-out {
      to {
        opacity: 0;
        transform: scale(0.9);
      }
    }
  `,
})
export class ShelfGrid {
  readonly games = input.required<Game[]>();
  // Préfixe des fiches : /ludotheque/jeu en live, /demo en démo.
  readonly base = input('/ludotheque/jeu');

  // Ordre d'ajout conservé ; les sections sont découpées dans cet ordre.
  protected readonly sections = computed(() => {
    const all = this.games();
    const out: { from: number; games: Game[] }[] = [];
    for (let i = 0; i < all.length; i += SECTION)
      out.push({ from: i + 1, games: all.slice(i, i + SECTION) });
    return out;
  });

  // Taille uniforme sur toute l'étagère, fixée par le nombre total de jeux : 4 ou moins en grand, au-delà en moyen.
  protected readonly density = computed<'xl' | 'l' | 'm'>(() => {
    const n = this.games().length;
    return n <= 4 ? 'xl' : n <= 12 ? 'l' : 'm';
  });

  protected readonly size = computed<'l' | 'm'>(() => (this.density() === 'xl' ? 'l' : 'm'));
}
