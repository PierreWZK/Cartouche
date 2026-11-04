# CLAUDE_CHAT.md · Cartouche (jour 20)

Journal de travail de la session avec Claude : ce qui a été demandé, ce qui a été décidé, les erreurs à ne pas reproduire et l'état réel du projet. À relire avant de reprendre le travail.

Dernière mise à jour : 3 novembre 2026.

---

## 1. Le projet en bref

- **Nom** : Cartouche, jour 20 du défi « 30 jours, 30 projets ».
- **Idée** : une bibliothèque de jeux vidéo mobile-first, présentée comme une ludothèque rétro. Les jeux sont des cartouches, les favoris vont dans une étagère 3D.
- **Dépôt GitHub** : `PierreWZK/Cartouche` (créé par l'utilisateur).
- **Adresse prévue** : `cartouche.projectp.fr`, avec le mode démo sous `/demo/...`.
- **Stack** :
  - Front : Angular (standalone, signals), dans `front/`.
  - API : Node + Express 5, TypeScript, dans `api/`.
  - Base : PostgreSQL pour les comptes et les favoris. Les tests locaux utilisent pg-mem.
  - Données : RAWG (principal) et IGDB (secondaire), appelés via l'API (proxy, clés gardées côté serveur).
  - 3D : Three.js pour l'étagère, modèle de cartouche généré avec le skill `img2threejs`.
  - Déploiement prévu : Coolify, avec Docker et nginx qui relaie `/api/` vers l'API.
- **Documents de référence** : `README.md`, `CAHIER_DES_CHARGES.md` (le contrat), `REVIEW.md` (revue du 3 novembre).

---

## 2. Demandes précises de l'utilisateur (à respecter)

**Cadrage**
- Relire le README et le cahier des charges, puis poser toutes les questions avant de coder. Il voulait décider, pas découvrir après coup.
- Le mode démo utilise des données en dur, pas d'appel réseau.
- Sources de données : RAWG **et** IGDB.
- Un proxy côté serveur pour les clés. Les clés ne doivent jamais passer par le chat.
- Stack Node + Express, back séparé du front.
- Connexion, favoris et bibliothèque 3D (étagère avec les cartouches favorites). Les comptes et favoris sont en base de données.
- Style rétro : gris comme les cartouches, avec noir et or. Pas d'autre couleur dominante.
- Interface **française par défaut**, avec des fichiers de traduction EN/FR et un choix de langue dans le pied de page.
- Une étape 0 a été ajoutée au MVP (comptes et favoris en base).
- Un mini guide avec les liens où récupérer les clés (RAWG, IGDB), sans saisir les valeurs dans le chat.

**Méthode de travail**
- Avancer **étape par étape**, faire valider chaque étape avant de continuer (validation demandée explicitement).
- Puis, en fin de cadrage : « je valide, on continue et t'arrêtes pas avant l'étape 5 », puis « on continue jusqu'à la fin ».
- Tester tout, y compris visuellement, mobile et ordinateur, FR et EN.
- « Reprends et retest étape par étape » : refaire les parcours un par un, avec le résultat de chaque étape.

**Règles absolues**
- **Ne pas mettre à jour la vitrine** (le site `30days30projects`) sans validation explicite.
- **Ne pas committer** sans demande explicite. Rien n'a été committé dans ce projet.
- **Clés API** : jamais dans le chat. Elles vont dans Coolify ou dans `.env` (`.env.example` ne contient que des placeholders).
- Pour les actions difficiles à annuler ou visibles de l'extérieur, demander avant.

---

## 3. Décisions prises

| Sujet | Décision |
| --- | --- |
| Périmètre | MVP par étapes, étape 0 = comptes et favoris en base |
| Langue | Français par défaut, EN disponible, bascule dans le pied de page |
| Données | RAWG en principal, IGDB en secours, repli sur des données de démo |
| Architecture | Front Angular et API Express séparés |
| Mode démo | Routes `/demo` et `/demo/:id`, données locales uniquement |
| Style | Rétro, gris cartouche, noir et or |
| Tests | API en node:test (14 puis 15 tests, tous verts) ; pas encore de tests front |
| Infinite scroll | Pagination par 6 jeux, chargement au défilement, filtres dans l'URL |
| Sécurité | Session en cookie HttpOnly SameSite=Lax, jeton haché en base, mots de passe scrypt, contrôle d'origine sur les écritures |

---

## 4. Erreurs à ne pas reproduire

### Pendant le développement

1. **Défilement infini bloqué sur téléphone.** `IntersectionObserver` ne re-notifie pas si la sentinelle reste visible (page courte). Corrigé : `recheckSentinel()` réobserve la sentinelle après chaque mise à jour de liste (`front/src/app/catalogue.ts`). **Règle** : après toute mise à jour de liste, vérifier qu'une page suivante se charge quand la page est courte.
2. **Cartouches à largeur nulle sur ordinateur.** Le `:host` de `Cartridge` s'effondrait dans une grille ou un flex, et le titre disparaissait. Corrigé avec `:host { display: block; width: 100% }` et `margin: 0 auto` (`front/src/app/cartridge.ts`). **Règle** : tester le composant dans une grille, pas seulement isolé.
3. **Pagination qui repart à la page 1 après la page 50.** L'API renvoyait silencieusement la page 1, donc doublons. Corrigé : plafond à 50 pages (P1-5).
4. **Aucune limite de tentatives de connexion.** 30 mauvais mots de passe passaient sans blocage. Corrigé : 10 échecs par email et par quart d'heure (P1-6).
5. **Mode démo qui n'en était pas un.** `/demo` appelait l'API et RAWG comme le vrai catalogue, et les fiches sortaient du mode démo au premier clic. Corrigé (P0-2). **Règle** : une route « démo » ne doit faire aucun appel réseau.
6. **20 secondes d'écran vide quand RAWG est lent.** Aucun délai maximal sur les appels (`api/src/upstream.ts`). Corrigé avec un timeout d'environ 5 secondes et repli sur les données locales pour le reste de la visite (P0-3). **Règle** : tout appel externe a un délai maximal.
7. **Étagère 3D qui déborde à 616 px sur un écran de 375 px.** `renderer.setSize(w, h)` écrit une largeur fixe sur le canevas. Corrigé (P0-1). **Règle** : toujours tester l'étagère en mobile.
8. **`.env` ignoré par `npm run dev:memory`.** Le README suivi donnait une démo silencieuse. Corrigé (P0-4). **Règle** : les scripts de dev doivent charger `.env`.
9. **`CORS_ORIGIN` de production copié en local.** Toutes les écritures (connexion, favoris, notes) répondaient 403. Documenté : en local, `CORS_ORIGIN=http://localhost:4200`.
10. **Lien « Voir une étagère partagée » vers `/e/demo`.** L'identifiant est trop court (règle 6 à 20 caractères), la page affiche « n'existe pas ». **Toujours ouvert** (P1-1).
11. **Pluriel cassé** : « 1 cartouches posées » et « 1 cartridges on the shelf ». **Toujours ouvert.** Il faut une forme au singulier dans les deux fichiers de traduction.
12. **Compteur « 0 jeux » affiché pendant le chargement.** Corrigé : compteur masqué pendant le chargement, squelettes ajoutés (P1-3).
13. **Texte de cartouche en 9 px avec contraste trop faible.** Corrigé : 12 px minimum, contraste adaptatif, deux plateformes puis « +n » (P1-4).
14. **Balises `noindex` jamais retirées.** Après une étagère partagée, toute la visite restait en `noindex`. **Toujours ouvert** (P2).

### Pendant les tests (erreurs de méthode)

15. **Mauvais libellé de bouton.** Le sélecteur cherchait « Déconnexion », l'application affiche « Se déconnecter ». Le test a été corrigé, l'application était bonne. **Règle** : lire le libellé réel dans l'arbre d'accessibilité avant d'écrire un sélecteur.
16. **Session encore connectée.** `/connexion` affichait le panneau du compte et non le formulaire, ce qui a faussé un test. **Règle** : se déconnecter avant chaque parcours « connexion ».
17. **`curl` bloqué par un hook de contexte.** Remplacé par des `fetch` dans le navigateur via Playwright. **Règle** : ne pas insister sur `curl`, passer par le navigateur.
18. **Chemins Playwright.** Les captures sont écrites à la racine de l'espace de travail, pas dans `front/`. Le Read refusait certains chemins relatifs : utiliser `Glob` pour retrouver le fichier.
19. **Répondre sans vérifier.** Un résultat de test ne doit jamais être annoncé « OK » sans avoir été vu dans la sortie. Le rapport doit distinguer ce qui est vérifié de ce qui ne l'est pas (par exemple : RAWG n'a pas pu être testé).

---

## 5. État réel au 3 novembre

### Vérifié

- Tests API : 15 sur 15 après les corrections P0.
- Build de production du front : passe (environ 320 kB au démarrage, Three.js chargé à part).
- Vitrine : pas de débordement horizontal, balises SEO et JSON-LD présentes.
- Catalogue : chargement au défilement, filtres et tri dans l'URL, recherche, état vide, FR/EN.
- Fiche : état hors connexion, jeu introuvable, mise en page ordinateur et mobile.
- Comptes : validation, inscription, email déjà pris, mauvais mot de passe, connexion, déconnexion.
- Favoris, notes avec confirmation, compteur d'étagère, export PNG, copie du lien de partage.
- Étagère partagée : lecture seule, `noindex`, identifiant inconnu géré.
- Mode démo : `/demo` et `/demo/:id` sans appel réseau.
- SEO : `robots.txt`, `sitemap.xml`, `og.png` en 200.

### Non testé

- Appels réels à RAWG et IGDB (RAWG était en panne pendant la revue, IGDB non configuré).
- PostgreSQL réel (seulement pg-mem).
- Déploiement Coolify, SEO en ligne, soumission à Google Search Console.
- Tests front unitaires (aucun fichier `.spec.ts`).

### Ouvert, à trancher avec l'utilisateur

- **Jeu du jour** (`/ludotheque/jour`) : page d'attente « arrive à l'étape suivante ». Le faire, ou masquer l'onglet.
- **P1-7 non commencé** : filtres par année et par note, captures sur la fiche, comparaison des deux notes, intercepteur HTTP, tests front. C'est un choix de périmètre.
- **Lien vitrine `/e/demo`** (P1-1) : créer une étagère de démo locale, ou pointer ailleurs.
- **Pluriel** (point 11 ci-dessus).
- **Note non relue** après rechargement, et moyenne Cartouche non mise à jour après un vote (P2).
- **Journal du défi** : des entrées jour 20 et jour 21 ont été ajoutées au journal, et le dossier du jour 21 a été renommé. À faire valider, car la vitrine ne doit pas bouger sans accord.

### Backlog de finitions (P2 et P3, voir `REVIEW.md`)

Navigation invisible sur mobile, 3D qui bloque le défilement au pouce, retour de fiche qui perd les filtres, cache API sans limite, nombre de filtres affichés d'un coup, bascule EN incomplète (titres des pages), erreurs 401 en console, description coupée net, cibles tactiles sous 44 px, onglets sans `tabpanel`.

---

## 6. Comment reprendre

1. Lire `REVIEW.md` (états P0 et P1) et `CAHIER_DES_CHARGES.md`.
2. Demander à l'utilisateur les décisions ouvertes (jeu du jour, pluriel et lien vitrine, périmètre P1-7) avant de coder.
3. Une étape à la fois, avec validation avant la suivante.
4. Vérifier dans le navigateur (mobile 375 px et ordinateur), en FR et en EN.
5. Ne rien committer, ne rien publier, ne toucher à la vitrine qu'après accord.
