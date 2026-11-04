# CARTOUCHE — Audit et plan de refonte (phase 1)

Date : 3 novembre 2026. Aucun code n'a été modifié pour cet audit. Ce document complète `REVIEW.md`.

## Méthode

- **Lecture du code** : API (`app.ts`, `auth.ts`, `store.ts`, `db.ts`, `cache.ts`, `upstream.ts`, `games.ts`) et front (routes, catalogue, fiche, étagère 3D, étagère partagée, comptes, jeu du jour).
- **Mesures** : taille des bundles (`ng build`) et API testée en direct avec les vraies clés : RAWG répond 522, IGDB fonctionne.
- **Tests navigateur** : faits pendant les étapes 1 à 8b, en 375 px et en bureau, en FR et en EN.
- **Pas fait dans ce passage** : relecture des conditions de licence RAWG et IGDB (marquées « à vérifier ») et test complet des comptes en local. Les écritures locales répondent 403 car `CORS_ORIGIN` pointe vers la production.

## Ce qui tient debout et qu'on garde

- **Stack** : Angular 22 (composants autonomes, signals) et API Express 5 avec PostgreSQL. Les requêtes SQL sont paramétrées.
- **Mots de passe** : scrypt avec sel.
- **Sessions** : jeton aléatoire stocké haché, cookie `HttpOnly` et `SameSite=Lax`, avec `Secure` en production.
- **Protection des écritures** : contrôle de l'origine sur les requêtes qui écrivent, limitation des essais de connexion par email.
- **Bascule entre sources** : passage de RAWG à IGDB avec une pause sur RAWG, plus un cache mémoire.
- **Tests** : 24 tests côté API (catalogue, comptes, IGDB, filtres).
- **Interface** : catalogue avec filtres dans l'URL, fiche avec captures, jeu du jour, navigation mobile en barre d'onglets.

Le système de comptes n'est pas à reconstruire. Il faut le compléter.

---

## 1. Problèmes bloquants

| # | Fichier | Constat | Pourquoi c'est grave | Solution | Priorité |
|---|---|---|---|---|---|
| B1 | `front/src/app/etagere/etagere-3d.ts:19,241` | L'étagère 3D range 3 cartouches par rangée (`PER_SHELF = 3`) dans un canvas de 380 à 480 px. La caméra recule pour tout faire tenir. | À 30 jeux, il y a 10 rangées et les cartouches deviennent minuscules. À 100 jeux, 34 rangées : c'est illisible. La pièce maîtresse ne tient pas au-delà d'une dizaine de jeux. | Reconstruire l'étagère (voir phase B). | P0 |
| B2 | `front/src/app/etagere/cartridge-model.ts:57-100` | Les cartouches 3D portent une étiquette dessinée (dégradé, nom, plateforme), pas la vraie jaquette. | L'étagère, censée être le plus bel écran, est le seul endroit sans les vraies couvertures. | Utiliser les mêmes cartouches DOM que le catalogue, avec jaquette. | P0 |
| B3 | `api/src/store.ts:54` et `front/src/app/data/games.service.ts:101` | La base ne garde que l'id des favoris. Pour afficher l'étagère, le front fait un appel par jeu (`forkJoin`), et l'API rappelle RAWG ou IGDB pour chacun. | Une étagère de 100 jeux déclenche 100 appels. Si les deux API tombent, l'étagère d'un utilisateur ne s'affiche plus. C'est contraire à « ne jamais dépendre d'une API pour une bibliothèque existante ». | Table `games` persistante (cache en base) et une route qui renvoie les fiches de l'étagère en un seul appel. | P0 |
| B4 | `api/src/upstream.ts` et `front/src/app/data/demo-games.json` | Si RAWG et IGDB sont tous les deux indisponibles, l'API répond 502. Le front ne dispose alors que des 20 jeux de démo. | La recherche, les fiches et l'ajout aux favoris deviennent inutilisables. La demande fixe un minimum de 100 jeux de secours. | Base de secours d'au moins 100 jeux dans la table `games`, utilisée par la recherche et les fiches. | P0 |
| B5 | `api/src/app.ts:25` | `.env` local : `CORS_ORIGIN` pointe vers la production. | En local, toute écriture (inscription, favoris, notes) répond 403. Impossible de tester les comptes. | Accepter une liste d'origines, ou te laisser changer cette ligne du `.env`. | P0 (dev) |
| B6 | Images stockées dans `front/public/demo` (2,3 Mo) et `front/public/daily` (1,3 Mo) | Jaquettes et captures IGDB copiées et redistribuées par le site. | Licence : la redistribution des images IGDB et RAWG est à vérifier avant mise en ligne. RAWG exige aussi une mention de source avec lien, à confirmer. | Vérifier les conditions. Sinon, servir les images depuis leur CDN et n'enregistrer en local que des visuels de secours générés. | P0 (à vérifier) |

## 2. Problèmes fonctionnels

| # | Fichier | Constat | Pourquoi c'est un problème | Solution | Priorité |
|---|---|---|---|---|---|
| F1 | `api/src/db.ts`, `store.ts` | Pas de pseudo ni de profil : le compte se résume à email et mot de passe. | La demande prévoit un pseudo, un profil et une adresse `/u/pseudo`. | Colonne `username` unique (règles de format, noms réservés) et pages profil et réglages. | P1 |
| F2 | `api/src/app.ts` (`/api/shelves/:shareId`) | Le partage passe par un identifiant aléatoire (`/e/xxxx`). Toutes les étagères sont lisibles via cet id, sans réglage public ou privé. | Le propriétaire ne contrôle pas le partage, et le lien n'est pas lisible. | Colonne `shelf_public`, route `/u/:pseudo`, ancien lien `/e/:id` redirigé. | P1 |
| F3 | `front/src/app/etagere/etagere-3d.ts:115` | L'export PNG est une capture du canvas 3D à 1080 px : pas de pseudo, pas de nombre de jeux, pas de marque, un seul format. | La demande veut une vraie composition graphique en plusieurs formats. | Composition dessinée sur un canvas 2D dédié, en carré, paysage et portrait, après chargement complet des images. | P1 |
| F4 | `front/src/app/cartridge.ts:148` | La jaquette est un fond CSS `url(...)` sans image de repli. | Si l'URL échoue, la cartouche est vide. Pas d'image cassée visible, mais une cartouche nue. Pas non plus de chargement progressif. | Superposer jaquette et visuel généré : le visuel reste visible si l'image échoue. | P1 |
| F5 | `api/src/app.ts` (`/api/games/:id/rating`) et `fiche.ts:361` | La note d'un utilisateur n'est jamais relue : après rechargement, sa note disparaît. | L'interface ment sur l'état enregistré. | `GET` de ma note, ou note incluse dans `/api/me/...`. | P2 |
| F6 | `api/src/app.ts` | Pas de limite d'essais sur l'inscription ni par adresse IP. Les sessions expirées ne sont jamais purgées. | Risque d'abus et table qui grossit sans fin. | Limite par IP sur les routes d'authentification, purge des sessions au démarrage ou périodiquement. | P2 |
| F7 | Comptes | Pas de changement de mot de passe, pas de suppression de compte. | Données personnelles : l'utilisateur doit pouvoir supprimer son compte. | Page réglages avec suppression du compte (les tables sont déjà en `on delete cascade`). | P2 |
| F8 | `front/src/app/fiche.ts` | Le libellé « Communauté globale · RAWG » s'affiche aussi sur des notes IGDB. | Information fausse. | Libellé « Note globale » et source affichée selon la provenance réelle. | P2 |
| F9 | Front | Aucun test front, aucun test de bout en bout. | Les régressions ne sont attrapées qu'à la main. | Playwright sur les parcours clés et tests unitaires de la composition de l'étagère. | P2 |
| F10 | Doublons | Les ids sont des slugs RAWG ou IGDB : le même jeu peut porter deux slugs différents selon la source. | Doublons possibles sur l'étagère après une bascule de source. | Id interne stable dans `games`, avec `rawg_id`, `igdb_id` et rapprochement par slug et année. | P2 |

## 3. Problèmes UX/UI

| # | Fichier | Constat | Pourquoi | Solution | Priorité |
|---|---|---|---|---|---|
| U1 | `front/src/app/etagere/*` | L'étagère 3D se manipule à la souris (`OrbitControls`). Un clic sur une cartouche n'ouvre rien. Sur mobile, le geste rotation se confond avec le défilement. | L'interaction n'apporte rien à la collection et gêne au toucher. Pas d'accès clavier aux jeux. | Étagère DOM accessible : chaque cartouche est un lien avec survol, focus et animations d'ajout et de retrait. | P0 |
| U2 | `front/src/app/etagere/etagere-page.ts` | Étagère vide : une phrase seulement, aucun chemin vers le catalogue ni suggestion. | Le nouvel utilisateur ne sait pas quoi faire. | État vide mis en scène : emplacements de cartouches vides, bouton « Trouver mes premiers jeux », suggestions. | P1 |
| U3 | `front/src/app/catalogue.ts` | Ajouter un favori oblige à ouvrir la fiche. Rien dans la liste. | Parcours trop long pour l'action principale du produit. | Bouton « Ajouter à l'étagère » sur la cartouche du catalogue (connecté), avec retour visuel. | P1 |
| U4 | `front/src/app/cartridge.ts` | Cartouche CSS correcte mais simple : peu de détails physiques, ombre plate, pas d'état survol ou ajout travaillé. | Direction « objet de collection premium » non tenue. | Refonte de la cartouche : relief, rainures, étiquette, reflet, ombre portée, survol et pression. | P1 |
| U5 | `front/src/app/app.ts` (vitrine) | Cartouches décoratives fictives sur la vitrine et accroche qui promet « 3D ». | Promesse incohérente avec ce que l'app livre. | Vitrine alignée sur la nouvelle étagère, avec de vraies jaquettes (sous réserve de licence). | P2 |
| U6 | `fr.json` / `en.json` | « RAWG » écrit en dur dans les textes de la vitrine et du pied de page alors que les données viennent surtout d'IGDB. | Information fausse. | « RAWG et IGDB », mention de source correcte. | P2 |
| U7 | Divers | Styles de boutons dupliqués dans 5 composants. Commentaires « Ta consigne… » dans 12 fichiers. Titres de page non traduits. | Incohérences visuelles et code bruité. | Classes de bouton partagées dans `styles.css` et nettoyage. | P2 |
| U8 | Comptes | Connexion par email seulement : aucune identité visible (pas d'avatar, pas de pseudo). | La collection n'appartient visiblement à personne, ce qui affaiblit le partage. | Pseudo affiché partout (en-tête, étagère publique, export). | P1 |

## 4. Améliorations

| # | Idée | Valeur | Priorité |
|---|---|---|---|
| A1 | Étagère par rangées (étagères en bois) avec densité qui s'adapte au nombre de jeux et sections au-delà d'environ 40 | Belle de 4 à 200 jeux | P0 (cœur de la phase B) |
| A2 | Tri et regroupement de l'étagère : ordre d'ajout, nom, année, plateforme, avec séparateurs par groupe | Collection lisible et personnelle, sans glisser-déposer | P1 |
| A3 | Réorganisation manuelle (glisser-déposer) | Utile seulement si A2 ne suffit pas. Coûteuse sur mobile. | P3 (à décider) |
| A4 | Ajout rapide depuis la recherche, avec suggestions issues de la base de secours | Parcours court | P1 |
| A5 | Page publique `/u/pseudo` avec aperçu Open Graph (image générée) | Partage attractif sur Discord, X et Reddit | P2 |
| A6 | Réutiliser le jeu du jour comme porte d'entrée (« ajouter ces 5 jeux à mon étagère ») | Faire découvrir l'étagère par le jeu | P3 |

---

## Plan de refonte (phase 2, à valider)

L'ordre diffère un peu de la proposition : l'étagère dépend de la table `games` (B3), sans quoi elle ne pourra pas afficher 100 jeux. Je pose donc d'abord le socle de données minimal.

| Phase | Contenu | Résultat vérifiable |
|---|---|---|
| **A. Socle données** | Table `games` (id interne, `rawg_id`, `igdb_id`, source, données, `synced_at`), remplie à chaque consultation. Base de secours de 100 jeux importée au démarrage. Route `GET /api/me/shelf` qui renvoie les fiches complètes en 1 appel. Recherche de secours dans `games` quand les API échouent ou ne trouvent rien. | Tests API : API coupées, la recherche et l'étagère marchent. 100 jeux en base. |
| **B. Étagère** (priorité produit) | Remplacement de l'étagère 3D (Three.js, 536 Ko) par une étagère DOM avec rangées et niveaux de densité : 1 à 4 jeux en grand format, 5 à 12 normal, 13 à 30 compact, plus de 30 en rangées compactes avec sections (tri ou regroupement) et chargement progressif. Nouvelle cartouche premium partagée entre catalogue et étagère. Animations d'ajout et de retrait, survol, focus clavier, `prefers-reduced-motion`. | Page de test avec 4, 8, 12, 20, 30, 50 et 100 jeux, captures en 375, 768 et 1280 px. |
| **C. Comptes** | Pseudo (inscription et migration des comptes existants), profil, réglage public ou privé, suppression du compte, limite d'essais par IP, purge des sessions, note relue. | Tests API des droits : un utilisateur ne modifie que sa propre étagère, une étagère privée répond 404. |
| **D. Partage et export** | `/u/:pseudo` public, `/e/:id` redirigé. Export PNG composé (canvas 2D) en carré 1080, portrait 1080×1350 et paysage 1600×900, avec pseudo, nombre de jeux, marque et date. Attente du chargement de toutes les jaquettes, avec repli si une image refuse le canvas (CORS). | PNG générés et vérifiés dans Chromium, Firefox et WebKit (Playwright). |
| **E. Parcours et finitions** | État vide, ajout depuis le catalogue, en-tête avec pseudo, vitrine réalignée, nettoyage (U6, U7), accessibilité, performances, tests Playwright des deux parcours. | Parcours 1 et 2 automatisés et verts. |

La 3D est retirée : elle coûte 536 Ko et casse le toucher, sans servir la collection. `img2threejs` ne sera pas utilisé.

## Skills : disponibilité et usage prévu

| Demandé | Disponible ? | Usage prévu |
|---|---|---|
| Taste | Oui (`design-taste-frontend`, `ecc:taste`) | Direction visuelle de la cartouche et de l'étagère (phase B) |
| UX UI Pro Max | Oui (`ui-ux-pro-max`) | Parcours, états vides, hiérarchie (phases B et E) |
| Impeccable | Oui (`impeccable:impeccable`, détecteur déjà actif dans le projet) | Critique et audit du rendu final (B, E) |
| Emil Kowalski | Oui (`emil-design-eng`) | Animations d'ajout et de retrait, survol, transitions (B) |
| Frontend Design | Pas de skill de ce nom exact. Proches : `ecc:frontend-design-direction`, `agent-skills:frontend-ui-engineering` | Utilisés à la place (B) |
| Accessibility / A11y | Oui (`ecc:accessibility`, `ecc:frontend-a11y`) | Contrôle clavier, focus, contrastes (B, E) |
| Playwright / E2E | Oui (`playwright-cli`, `ecc:e2e-testing`, outils Playwright) | Tests de parcours et d'export multi-navigateurs (D, E) |
| Security | Oui (`security-review`, `ecc:security-review`) | Revue des droits et de l'authentification (C) |
| Game Design / Game Balancing | **Non installé** | Non utilisé |
| ImgThreeJS | Oui (`img2threejs`) | Non utilisé : la 3D est retirée |

Ces skills seront chargés au début de la phase où ils servent. Aucun n'a encore été utilisé pour cet audit.

## Décisions qui te reviennent

1. **Base de secours** : tu avais demandé « pas de données de test, une démo de 10 à 20 jeux ». La nouvelle demande veut 100 jeux réels de secours, utilisés en silence. Je propose 100 jeux réels importés une fois depuis IGDB, avec une mention discrète « données hors ligne » quand on les sert. Le mode démo à part serait supprimé.
2. **Visibilité par défaut** : nouvelle étagère publique ou privée ?
3. **Licence des images** : je vérifie les conditions RAWG et IGDB avant la phase A. Si le stockage local est interdit, la base de secours n'aura que des visuels générés, sans jaquettes.
4. **`.env`** : puis-je changer la seule ligne `CORS_ORIGIN` pour tester les comptes en local ?
5. **Ancien plan** : l'étape 8b et la suite de l'ancien plan (comparaison des notes, intercepteur d'erreurs) rejoignent ce nouveau plan (F5, F8, E).
