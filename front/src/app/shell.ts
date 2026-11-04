import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Racine de l'application : seul le routeur est affiché, chaque page gère son propre cadre.
// Le compte n'est pas chargé ici : une page qui en a besoin le demande, la démo n'appelle jamais le serveur.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class Shell {}
