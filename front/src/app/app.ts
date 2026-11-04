import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from './i18n/i18n';
import { LangSwitch } from './lang-switch';

interface Cartridge {
  title: string;
  meta: string;
  art: string;
  band: string;
}

@Component({
  selector: 'app-vitrine',
  imports: [LangSwitch, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly i18n = inject(I18n);
  protected readonly d = this.i18n.dict;

  // Titres de démonstration (jeux fictifs de la maquette), non traduits.
  protected readonly heroCarts: Cartridge[] = [
    {
      title: 'Forêt de Brume',
      meta: 'Switch · 2019',
      art: 'linear-gradient(#2c4a3c, #7fa395)',
      band: '#2f5b48',
    },
    {
      title: 'Orbite Basse',
      meta: 'PC · 2024',
      art: 'linear-gradient(#2b2350, #6b3f7a)',
      band: '#1f3c7a',
    },
    {
      title: 'Néon Minuit',
      meta: 'PS5 · 2023',
      art: 'linear-gradient(#1c1b2e, #4b2a6b)',
      band: '#5b2a7a',
    },
  ];

  protected readonly shelfCarts: Cartridge[] = [
    {
      title: 'Orbite Basse',
      meta: 'PC · 2024',
      art: 'linear-gradient(#2b2350, #6b3f7a)',
      band: '#1f3c7a',
    },
    {
      title: 'Forêt de Brume',
      meta: 'Switch · 2019',
      art: 'linear-gradient(#2c4a3c, #7fa395)',
      band: '#2f5b48',
    },
    {
      title: 'Néon Minuit',
      meta: 'PS5 · 2023',
      art: 'linear-gradient(#1c1b2e, #4b2a6b)',
      band: '#5b2a7a',
    },
    {
      title: 'Dunes d’Ocre',
      meta: 'PC · 2019',
      art: 'linear-gradient(#f0a84e, #b8582f)',
      band: '#8a3f22',
    },
    {
      title: 'Phare du Nord',
      meta: 'Xbox · 2022',
      art: 'linear-gradient(#3a6f9a, #1d3d5a)',
      band: '#1d3d5a',
    },
    {
      title: 'Kaiju Express',
      meta: 'Switch · 2020',
      art: 'linear-gradient(#5a2a2a, #1c1b2e)',
      band: '#8a2b2b',
    },
    {
      title: 'Jardin Suspendu',
      meta: 'PC · 2018',
      art: 'linear-gradient(#2f5d4a, #d8b24a)',
      band: '#c9a23a',
    },
  ];
}
