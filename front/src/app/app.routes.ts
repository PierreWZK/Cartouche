import { Routes } from '@angular/router';
import { App } from './app';
import { AppLayout } from './app-layout';
import { Catalogue } from './catalogue';
import { Connexion } from './account/connexion';
import { Fiche } from './fiche';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: App },
  {
    path: '',
    component: AppLayout,
    children: [
      { path: 'ludotheque', component: Catalogue },
      { path: 'ludotheque/jeu/:id', component: Fiche },
      // Base de 200 jeux : chargée seulement sur cette page.
      { path: 'jour', loadComponent: () => import('./daily/daily-page').then((m) => m.DailyPage) },
      // Three.js n'est chargé que sur cette page, pas au démarrage.
      {
        path: 'etagere',
        loadComponent: () => import('./etagere/etagere-page').then((m) => m.EtagerePage),
      },
      { path: 'connexion', component: Connexion },
      {
        path: 'e/:id',
        loadComponent: () => import('./etagere/shared-shelf').then((m) => m.SharedShelf),
      },
      {
        path: 'u/:username',
        loadComponent: () => import('./etagere/public-shelf').then((m) => m.PublicShelf),
      },
      // Mode démo : même catalogue et même fiche, sur données locales (aucun réseau).
      { path: 'demo', component: Catalogue, data: { demo: true } },
      { path: 'demo/:id', component: Fiche, data: { demo: true } },
    ],
  },
  { path: '**', redirectTo: '' },
];
