# Jour 20/30 — Cartouche, la ludothèque qui se feuillette

> Stack : **Angular**, **TypeScript** · hébergement **Coolify**, sous-domaine `cartouche.projectp.fr`.
> Durée visée : **2 h 45** pour le MVP, les bonus ensuite.
> **Mobile first** : on conçoit d'abord pour un téléphone, puis on élargit.

Ce document est notre contrat : on le suit étape par étape, et toute décision qui s'en écarte est d'abord notée ici. Il s'ajuste au début de la journée.

Révision du 2 novembre 2026 : ajout de l'étagère 3D, du partage, des notes communautaires et des pistes « à faire si possible ».

## 1. L'idée

Une ludothèque de jeux vidéo en **Angular**, pensée comme une vieille boîte de cartouches qu'on fouille sur son téléphone. Les jeux sont des **cartouches** : on les parcourt, on les filtre à l'aide d'étiquettes, on les met en favoris, et les favoris s'empilent sur une **étagère 3D** qu'on peut exporter en image et partager avec ses amis.

**Cartouche** s'appuie sur l'API RAWG, avec un mode démo sans clé. Lecture seule, sans compte.

## 2. MVP — ce qui doit fonctionner à la fin

1. **Mobile first** : interface pensée pour un écran de téléphone, puis adaptée à l'ordinateur. Pas de défilement horizontal, cibles tactiles suffisantes.
2. **Liste en cartouches** : chaque jeu est une cartouche (jaquette, titre, plateforme, année). Liste paginée avec défilement infini.
3. **Filtres combinés et tri** (genre, plateforme, année, note), gardés dans l'adresse pour pouvoir partager une recherche.
4. **Fiche d'un jeu** : visuels, description, plateformes, studios, captures.
5. **Deux notes côte à côte** : la **note de la communauté globale** (RAWG) et la **note de la communauté Cartouche**. La comparaison des deux est affichée sur la fiche et dans la liste.
6. **Favoris** : ajouter un jeu à ses favoris le place sur l'**étagère 3D**, qui se remplit au fil des ajouts.
7. **Export PNG** de l'étagère, prêt à partager sur les réseaux.
8. **Lien partageable** de l'étagère : un ami ouvre le lien et voit l'étagère, sans compte ni serveur de données personnelles.
9. **Mode démo** avec des données locales, qui fonctionne sans réseau.
10. **En ligne sur Coolify**, avec un README à jour et un aperçu de lien (Open Graph).

### Périmètre volontairement limité

- Lecture seule : pas de compte. Les favoris restent dans le navigateur.
- Clé d'API côté serveur (petit relais, comme 3logy).
- L'étagère et le partage se font **sans base de données** : l'état de l'étagère tient dans l'adresse (identifiants des jeux) ou dans le stockage local.

### Décisions à trancher avant de coder

- **Note de la communauté Cartouche** : sans compte ni base de données, il faut choisir la source (voir section 8, question 3).

## 3. Cahier des charges fonctionnel

### Recherche

- Pendant la frappe, avec annulation des requêtes précédentes (RxJS `switchMap`).

### Cartouches et filtres

- Chaque cartouche a une étiquette de couleur propre au jeu ou à la plateforme.
- Les filtres sont présentés comme des étiquettes, pas comme des menus déroulants.

### Étagère 3D

- Vue 3D simple (perspective CSS ou WebGL léger) : les favoris sont posés sur des tablettes.
- Ajouter un favori fait apparaître la cartouche sur l'étagère, avec une animation d'insertion.
- Retirer un favori la fait disparaître avec la même logique.
- Export PNG : capture de l'étagère telle qu'elle est affichée, à la taille d'un post de réseau social.
- Lien partageable : l'étagère est encodée dans l'adresse, et l'ami voit la même étagère en lecture seule.

### Interface

- Squelettes de chargement, images en lazy loading.
- Animations sobres : une cartouche se glisse ou se feuillette, sans effet gratuit. Respecter la réduction des mouvements du système.

## 4. Cahier des charges technique

- Angular récent : composants autonomes, signals, router avec paramètres de requête.
- Service HTTP typé, intercepteur pour les erreurs.
- Tests des services, et tests de l'encodage de l'étagère dans l'adresse (aller-retour).
- Export PNG côté navigateur, sans service externe.
- Mise en ligne sur Coolify à chaque push sur la branche principale.

## 5. Critères de réussite

- [ ] Interface utilisable au pouce sur un téléphone, sans défilement horizontal.
- [ ] Les filtres survivent au rechargement et au partage du lien.
- [ ] Aucune requête obsolète n'écrase une plus récente.
- [ ] Un favori ajouté apparaît sur l'étagère, et l'étagère survit au rechargement.
- [ ] Le lien de l'étagère, ouvert dans un autre navigateur, affiche la même étagère.
- [ ] L'export PNG contient l'étagère complète.
- [ ] Le mode démo marche sans réseau.

## 6. Bonus facultatifs

Dans l'ordre de préférence, à faire si le MVP est terminé :

1. **Une vraie voix éditoriale** : sélection « coup de cœur » écrite à la main, listes thématiques (« jeux à finir en un dimanche », « les OST à écouter sans jouer »).
2. **Une ludothèque de soirée** : le visiteur indique le nombre de joueurs, la durée disponible et l'ambiance (« entre amis », « seul le soir », « dimanche pluie »), et le site propose trois jeux avec une phrase de justification.
3. **Un générateur « quel jeu jouer ? »** : questionnaire de trois réponses qui produit un profil de joueur (« explorateur nostalgique »), partageable.
4. **Un défi de backlog** : le visiteur saisit ses jeux non finis, et le site propose un jeu à finir ce soir selon la durée.
5. **Comparaison de jeux**, thème sombre / clair, PWA.

## 7. Définition du « terminé »

Le MVP fonctionne sur téléphone et ordinateur, les critères de la section 5 sont cochés, le site est en ligne sur `cartouche.projectp.fr`, le README a son lien et sa capture, et la carte du projet passe à « terminé » sur la vitrine.

## 8. À me demander avant de coder

À poser **avant d'écrire le code**, et attendre ma réponse :

1. **Le jeu quotidien.** Chaque projet a un jeu du jour pour faire revenir les visiteurs : le même tirage pour tout le monde (d'après la date), une tentative par jour, une série 🔥 et un résultat à partager. Me proposer deux ou trois idées adaptées au projet (par exemple, deviner un jeu à partir de ses métadonnées), puis attendre mon choix.
2. **Le look.** Me demander une référence visuelle sur laquelle se baser (un site, une marque, une ambiance, une capture). Le site doit être original et agréable à regarder, **pas « basique »** : une vraie identité (typographie, palette, mise en page, détails, animations), pas un gabarit générique. Si je n'ai pas d'idée, me proposer deux directions et attendre mon choix.
3. **La note de la communauté Cartouche.** Sans compte ni base de données, deux options : (a) une note personnelle stockée dans le navigateur, qui n'est pas une vraie note communautaire ; (b) un petit service de notes sur le serveur (comme le relais RAWG), avec une base de données, ce qui ajoute du travail. Me proposer le compromis, puis attendre mon choix.
4. **Le périmètre de l'étagère 3D.** Vue 3D en CSS (plus simple, plus rapide) ou WebGL (plus spectaculaire, plus lourd). Me proposer le choix, puis attendre.

## 9. Aperçu du lien (à faire sans me le redemander)

- Image Open Graph **1200 × 630** stylisée aux couleurs du projet : nom, accroche, technos et capture, générée avec `scripts/og/build-og.py` (ajouter le projet à la liste).
- Sur chaque page publique : `og:title`, `og:description`, `og:url`, `og:image` (adresse absolue), `og:image:width`, `og:image:height`, `og:image:alt` et `twitter:card` = `summary_large_image`.
- Vérifier en ligne que l'image répond en 200 et que les balises sont servies.

## 10. Indexation (à faire sans me le redemander)

- `robots.txt` : pages privées et routes techniques (API, JSON, admin) en `Disallow`, lien vers le sitemap.
- `sitemap.xml` : les pages publiques uniquement. L'étagère partagée, qui est une page d'adresse variable, est en `noindex`.
- Balise `canonical` sur chaque page publique ; `noindex` sur les pages privées.
- Données structurées JSON-LD sur l'accueil : `WebApplication`, avec `isPartOf` ProjectP (https://projectp.fr/).
- Lien « 30 jours, 30 projets » vers https://projectp.fr/ dans le pied de page.
- Site statique : ajouter le projet à `scripts/seo/apply-seo.py` et relancer le script.
- Vérifier en ligne, puis me rappeler de soumettre `https://cartouche.projectp.fr/sitemap.xml` dans Google Search Console.

## 11. Vitrine 30days30projects (avec ma validation)

Une fois le projet en ligne, **me demander mon accord**, puis seulement :

- `projects.js` : l'entrée du jour 20 passe à `status: 'done'`, avec `name: 'Cartouche'`, `url`, `repo`, `image` et `description`.
- `preview-days-images/day20_cartouche.png` : la capture de l'accueil, en 1600 × 900.
- `README.md` : la ligne du jour 20 dans le tableau des 30 projets.
- Commit et push du dépôt `30days30projects`.
