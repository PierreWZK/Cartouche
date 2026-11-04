# Cartouche · Revue du jour 20 (Clean Up)

> Revue du 3 novembre 2026. Code relu en entier (`api/` et `front/`), tests relancés, site testé dans le navigateur en mobile (375 px) et en ordinateur.
> Méthode : deux évaluations séparées, une revue design (UI/UX Pro Max, Taste, Impeccable) et une analyse automatique (détecteur Impeccable et mesures dans le navigateur), puis la synthèse ci-dessous.
> **Aucun fichier du projet n'a été modifié.**

## Conditions du test

- **RAWG était en panne pendant toute la revue** : Cloudflare répondait 522 au bout d'environ 20 s, même sans clé. Le vrai catalogue (jaquettes, captures, pagination réelle, facettes RAWG) n'a donc **pas pu être testé**. Tout ce qui suit a été vu avec le repli sur les données de démo.
- IGDB n'est pas configuré, comme prévu.
- La base de données est en mémoire (pg-mem). Un compte de test `review-a@cartouche.test` avec 3 favoris a été créé : il disparaît à l'arrêt de l'API.
- Les tests de l'API passent : **14 sur 14**. Le build de production du front passe aussi : 320 kB au démarrage, plus Three.js chargé à part (545 kB).

## Les notes en bref

| Évaluation | Note |
| --- | --- |
| Heuristiques de Nielsen (revue design) | **23 / 40**, correct mais avec de vrais trous |
| État du système (heuristique 1) | **1 / 4**, le point le plus faible |
| Débordement horizontal | Aucun sur les 4 pages principales, **mais l'étagère déborde** (voir P0-1) |
| Détecteur automatique | 24 résultats sur l'accueil, 14 sur la ludothèque, dont environ la moitié de faux positifs voulus (rainures et étagère) |

**En une phrase** : la vitrine et la fiche ont une vraie identité. Mais l'application derrière est fragile : elle attend 20 s sans rien montrer, l'étagère 3D (le moment fort) déborde et ne fait pas ce que promet le cahier des charges, et plusieurs liens mènent à des pages vides ou cassées.

---

## P0 · Bloquant (à corriger en premier)

> ✅ **Corrigés le 3 novembre** et vérifiés dans le navigateur (mobile 375 px) : étagère sans débordement, `/demo` sans aucun appel au catalogue, repli au bout d'environ 5 s au lieu de 20 puis données locales pour le reste de la visite, `.env` lu par `npm run dev:memory`. Tests API : 15 sur 15.

### P0-1 · L'étagère 3D déborde à l'horizontale sur mobile
- **Où** : `/etagere` et `/e/<id>`, fichier [etagere-3d.ts:192](front/src/app/etagere/etagere-3d.ts:192).
- **Le problème** : `renderer.setSize(w, h)` écrit une largeur fixe en pixels sur le canevas. La règle `.stage canvas` ne l'atteint pas, à cause de l'encapsulation des styles Angular. La page s'élargit à 616 px pour un écran de 375 px, et l'étagère comme le bouton « Exporter en PNG » sont coupés.
- **Pourquoi c'est grave** : c'est le premier critère de réussite (« pas de défilement horizontal »), et c'est l'écran phare du projet.
- **Piste** : `renderer.setSize(w, h, false)`, plus `min-width: 0; overflow: hidden` sur `.stage`.

### P0-2 · Le mode démo n'est pas un mode démo
- **Où** : [app.routes.ts:29-30](front/src/app/app.routes.ts:29), [games.service.ts:41](front/src/app/data/games.service.ts:41).
- **Le problème** : `/demo` et `/demo/:id` réutilisent `Catalogue` et `Fiche` sans rien changer. Ils interrogent donc l'API et RAWG comme le vrai catalogue. Avec RAWG lent, on attend 20 s. Les cartes de `/demo` renvoient aussi vers `/ludotheque/jeu/...`, si bien qu'on sort du mode démo au premier clic.
- **Pourquoi c'est grave** : la vitrine promet un « mode démo hors ligne » (critère « Le mode démo marche sans réseau »), et c'est le bouton qu'un visiteur pressé essaie en premier.
- **Piste** : forcer les données locales quand la route commence par `/demo`, et garder les liens et le bouton retour dans `/demo`.

### P0-3 · Aucun délai maximal sur les appels à RAWG : 20 s d'écran vide
- **Où** : [upstream.ts:38](api/src/upstream.ts:38) (`fetch` sans `signal`), [games.service.ts:35-69](front/src/app/data/games.service.ts:35).
- **Le problème** : quand RAWG traîne, chaque recherche, chaque étiquette et chaque fiche attend environ 20 s avant le repli sur la démo. Pendant ce temps, la liste affiche « 0 jeux » (annoncé aussi aux lecteurs d'écran) et la fiche reste vide. `/api/health` dit `rawg: true` dès que la clé existe, sans vérifier que RAWG répond.
- **Piste** : `AbortSignal.timeout(5000)` côté API, `timeout()` côté front, et retenir qu'en cas d'échec on passe en démo pour le reste de la visite au lieu de réessayer à chaque clic.

### P0-4 · `npm run dev:memory` ne lit pas le `.env`
- **Où** : [package.json](api/package.json) et [config.ts](api/src/config.ts).
- **Le problème** : rien ne charge le fichier `.env` (ni `dotenv`, ni `node --env-file`). En suivant le README, ta clé RAWG est donc ignorée et le site reste en démo sans rien dire. De plus, `.env.example` met `CORS_ORIGIN=https://cartouche.projectp.fr` : copié tel quel en local, toutes les écritures (connexion, favoris, notes) sont refusées en 403.
- **Piste** : `node --env-file=.env` dans les scripts, et une ligne dans le README sur `CORS_ORIGIN=http://localhost:4200` en local.

---

## P1 · Important (avant la mise en ligne)

> État au 3 novembre (2e passe) : **P1-1** `/e/demo` corrigé ; l'onglet Jeu du jour reste à trancher. **P1-2** état vide, export carré cadré, animation d'entrée, rendu à la demande : fait. **P1-3** squelettes liste et fiche : faits. **P1-4** texte 12 px / 10 px, contraste adaptatif, deux plateformes puis « +n » : fait. **P1-5** pagination plafonnée à 50 pages : fait. **P1-6** 10 échecs par email et par quart d'heure : fait. **P1-7** non commencé (choix de périmètre à faire).

### P1-1 · Liens qui mènent nulle part
- « Voir une étagère partagée » sur la vitrine pointe vers `/e/demo` ([app.html:88](front/src/app/app.html:88)). L'API refuse cet identifiant, trop court pour la règle de 6 à 20 caractères ([app.ts:234](api/src/app.ts:234)) : le visiteur voit « Cette étagère n'existe pas ».
- L'onglet « Jeu du jour » (un des 3 onglets du bas) affiche « Cette page arrive à l'étape suivante » ([app.routes.ts:17](front/src/app/app.routes.ts:17)). Le jeu du jour (remettre des jeux dans l'ordre de sortie) est pourtant une décision de la section 0 du cahier.
- **Piste** : une étagère de démo en local pour `/e/demo`. Pour le jeu du jour, soit le faire, soit masquer l'onglet.

### P1-2 · L'étagère ne fait pas ce que promet le cahier des charges
- Pas d'animation d'insertion ni de retrait : l'étagère est reconstruite d'un bloc à chaque changement ([etagere-3d.ts:145](front/src/app/etagere/etagere-3d.ts:145)).
- L'export PNG reprend le canevas tel qu'affiché ([etagere-3d.ts:98](front/src/app/etagere/etagere-3d.ts:98)), pas à une taille de post. Au-delà de 3 ou 4 rangées, la caméra ne cadre plus que la largeur : le haut de l'étagère sort de l'image, ce qui casse le critère « l'export contient l'étagère complète ».
- Aucun état vide : avec 0 favori, on voit une planche vide, et les boutons Exporter et Copier le lien restent actifs.
- Toutes les cartouches portent le même motif et seule la teinte change, alors que le cahier demande une étiquette propre au jeu ou à la plateforme. Avec RAWG en ligne, la jaquette réelle n'apparaît pas non plus sur la cartouche 3D : seule la cartouche CSS l'affiche.
- La boucle de rendu tourne en continu, même quand rien ne bouge (batterie sur téléphone).
- **Piste** : animer chaque cartouche qui entre ou sort, exporter avec un rendu hors écran en 1080 × 1080 cadré sur toute l'étagère, ajouter un état vide avec un lien vers la ludothèque, et ne rendre que pendant un mouvement.

### P1-3 · Pas de squelettes de chargement
- **Où** : [catalogue.ts:111](front/src/app/catalogue.ts:111), [fiche.ts:17](front/src/app/fiche.ts:17).
- **Le problème** : le chargement de la liste se résume à un texte « Chargement… » sous la ligne de flottaison, et la fiche n'affiche rien du tout tant que le jeu n'est pas arrivé (`null`). Le cahier demande des squelettes.
- **Piste** : des cartouches grises animées dans la grille et un squelette de fiche, sans afficher le compteur tant que le chargement n'est pas fini.

### P1-4 · Lisibilité des cartouches de la liste
- Le titre est en **9 px** et la plateforme en **8 px** ([cartridge.ts:124-128](front/src/app/cartridge.ts:124)). Ce sont les seules informations de chaque carte.
- Certains contrastes sont trop faibles : titre à **2,3:1** et méta à **1,9:1** sur la bande `#c9a23a` (Jardin Suspendu), méta sous 4,5:1 sur `#6b6456` et `#b8322b`.
- Avec RAWG, `platforms.join(' · ')` liste souvent plus de 8 plateformes sur une carte de 160 px ([cartridge.ts:18](front/src/app/cartridge.ts:18)). La ligne « RAWG 4.2 Cartouche — » déborde aussi de la carte.
- **Piste** : 12 px minimum, 2 plateformes au plus puis « +3 », les deux notes sur deux lignes, et une couleur de texte choisie selon la teinte de la bande.

### P1-5 · Le défilement infini boucle après la page 50
- **Où** : [games.ts:86](api/src/games.ts:86).
- **Le problème** : une page hors bornes ne renvoie pas d'erreur, elle repart silencieusement à la page 1. Avec 6 jeux par page, après 300 jeux le front recolle la page 1 à la fin de la liste : doublons et erreurs Angular sur `track g.id`.
- **Piste** : renvoyer une liste vide (ou une erreur 400) au-delà de la limite, et passer à 20 jeux par page (6, c'est une requête tous les deux écrans).

### P1-6 · Aucune limite sur les tentatives de connexion
- **Où** : [app.ts:156](api/src/app.ts:156).
- **Constat** : j'ai envoyé 30 mauvais mots de passe d'affilée, et le serveur a répondu 401 à chacun sans jamais bloquer. Rien n'empêche donc de deviner un mot de passe par force brute. L'inscription n'est pas protégée non plus.
- **Piste** : une petite limite en mémoire par adresse IP et par email, par exemple 10 essais par quart d'heure.

### P1-7 · Des fonctions du MVP manquent
- Pas de filtre par **année** ni par **note** : seuls le genre et la plateforme existent (section 2, point 3).
- Pas de **captures d'écran** sur la fiche (section 2, point 4).
- Pas de **comparaison des deux notes** affichée : on voit les deux chiffres, sans écart ni « la communauté Cartouche est plus sévère ».
- Pas d'**intercepteur HTTP** pour les erreurs, et **aucun test front** (0 fichier `.spec.ts`), alors que la section 4 en demande.

---

## P2 · À corriger dans la foulée

- **Navigation de l'accueil invisible sur mobile** : `.nav-links` est en `display: none` sous 768 px, sans menu de remplacement ([app.css:40](front/src/app/app.css:40)).
- **La 3D bloque le défilement** : OrbitControls force `touch-action: none` sur le canevas, ce qui annule le `pan-y` voulu. 380 px d'écran ne défilent plus au pouce, et la rotation par glisser n'a rien donné de visible pendant le test.
- **Le retour de la fiche perd les filtres** : « ← Retour » renvoie toujours à `/ludotheque`, ce qui efface `?genre=rpg` ([fiche.ts:15](front/src/app/fiche.ts:15)). Utiliser l'historique, ou garder les paramètres.
- **La fiche ne relit pas ta note** : après rechargement, ta note a disparu ([fiche.ts:259](front/src/app/fiche.ts:259)), et la moyenne Cartouche ne se met pas à jour après un vote. En repli démo, la « note Cartouche » vient du fichier JSON, pas de la base : un vote n'a aucun effet visible.
- **L'étagère partagée sans suite** : pas d'appel « Fais la tienne » pour l'ami, pas de liste des jeux, et les cartouches ne mènent pas aux fiches. La balise `noindex` ajoutée par `/e/:id` n'est jamais retirée : après avoir quitté la page, tout le reste de la visite reste en `noindex` ([shared-shelf.ts:80](front/src/app/etagere/shared-shelf.ts:80)).
- **Cache de l'API sans limite** : chaque recherche différente reste en mémoire, et une entrée expirée n'est supprimée qu'au moment où on la relit ([cache.ts](api/src/cache.ts)). Sur un serveur en ligne, la mémoire grossit sans fin.
- **Étagère : une requête par favori** : `byIds` lance N appels `/api/games/:id` en parallèle, et recharge toute la liste à chaque ajout ([games.service.ts:76](front/src/app/data/games.service.ts:76)).
- **Placeholder de recherche** à 3,9:1 de contraste ([catalogue.ts:43](front/src/app/catalogue.ts:43)).
- **19 choix d'un coup** sur la ludothèque : 10 genres, 6 plateformes et 3 tris en pastilles. Avec RAWG, ce sera 40 genres et 40 plateformes. Il faut un « Plus de filtres » ou un tiroir.
- **Bascule EN incomplète** : `document.title`, les descriptions et les titres des pages restent en français. Le titre de l'onglet est le même sur toutes les routes.
- **Erreurs 401 en console** sur `/api/me` à chaque visite sans compte, et `/api/health` appelé deux fois (par `GamesService` et par `AccountService`).
- **Description coupée net** à 800 caractères, au milieu d'un mot et sans « … » ([games.ts:102](api/src/games.ts:102)).
- **Année ou studio inconnus** : la fiche affiche « 0 · » ou « 2020 · » ([fiche.ts:27](front/src/app/fiche.ts:27)).

## P3 · Finitions

- Le lien « Compte » de l'en-tête mesure 59 × 26 px, sous la cible tactile de 44 px ([app-layout.ts:15](front/src/app/app-layout.ts:15)). Le lien projectp.fr du pied de page fait 21 px de haut.
- Le lien « Compte » s'affiche même quand les comptes sont désactivés, et il ne dit pas si l'on est connecté.
- La vitrine utilise des `href` qui rechargent toute l'application au lieu de `routerLink` ([app.html](front/src/app/app.html)).
- Les onglets Connexion / Créer un compte n'ont ni `tabpanel` ni navigation aux flèches. L'indice « 8 caractères minimum » s'affiche aussi à la connexion.
- Les notes 1 à 5 n'ont pas de libellé visible du type « Ta note ».
- Sur `/demo/:id`, le bouton « Retirer de l'étagère » modifie le vrai compte.
- Il n'y a pas de `aria-current` dans la barre d'onglets, et le canevas 3D n'a pas d'équivalent texte (la liste des jeux de l'étagère).
- La vitrine annonce « Huit gestes » en 8 cartes numérotées, alors que le cahier en prévoit quatre. Les étiquettes au-dessus de chaque titre (4 sections) et le halo ambre des boutons font « gabarit ».
- Le bois de l'étagère est une couleur unie, sans veinage. Le texte des cartouches 3D est dessiné avant le chargement des polices, il risque donc de sortir en police de secours.
- `fill()` libère le matériau bois partagé à chaque reconstruction, puis le réutilise ([etagere-3d.ts:150](front/src/app/etagere/etagere-3d.ts:150)) : c'est du gaspillage, mais rien ne casse.
- Les sessions expirées ne sont jamais supprimées de la base ([store.ts](api/src/store.ts)).
- La ligne `prefers-reduced-motion` du fichier global coupe toutes les animations d'un coup. Les futures animations d'insertion devront prévoir leur propre version réduite.
- `og.png` et `favicon.ico` reçoivent un cache « immutable » de 30 jours alors que leur nom ne change pas : un nouveau visuel ne sera pas vu pendant un mois ([nginx.conf](front/nginx.conf)).
- Côté SEO : la balise `canonical` pointe vers `/` sur toutes les routes, puisque c'est une page unique.

---

## Nettoyage du code (Clean Up)

- **Commentaires parasites** : presque chaque fichier commence par « Ta consigne : « On continue jusqu'à la fin » » ou « t'arrêtes pas avant l'étape 5 ». C'est du bruit, à retirer partout (api, front, Dockerfile, nginx.conf, .env.example).
- **Commentaires périmés** : « utilisée par l'API (étape 5) » ([game.model.ts:1](front/src/app/data/game.model.ts:1)), « Page provisoire… arrive aux étapes suivantes », et « Mode démo : sur données locales (aucun réseau) » ([app.routes.ts:28](front/src/app/app.routes.ts:28)), ce dernier étant faux (voir P0-2).
- **Styles de boutons copiés 5 fois** : `.btn` et `.btn-primary` sont redéfinis dans app.css, connexion.ts, etagere-page.ts, shared-shelf.ts et fiche.ts, avec des écarts de détail. Le dégradé `#f6c07a` est écrit en dur à plusieurs endroits. Il faut un seul style global.
- **Constantes en double** : les palettes de jaquettes existent à la fois dans `api/src/games.ts` et dans `app.ts`/`demo-games.json`. Le type `Game` est copié entre l'API et le front (acceptable, mais à noter).
- **`communityRatings`** : la moyenne est calculée en JavaScript à partir de toutes les lignes, alors qu'une requête `avg()` / `count()` avec `group by` suffit. Il manque aussi un index sur `ratings(game_id)`.
- **README** : il présente le projet comme « ✅ Terminé » alors que le jeu du jour manque et que le site n'est pas en ligne. La section 2 du cahier contient encore « Lecture seule, sans compte » et « sans base de données », que la section 0 contredit. Il faut nettoyer ces lignes.

## Écarts au cahier des charges

| Critère (section 5) | État |
| --- | --- |
| Utilisable au pouce, sans défilement horizontal | ❌ L'étagère déborde, et le texte des cartes est en 8-9 px |
| Les filtres survivent au rechargement et au partage | ✅ Pour genre, plateforme, tri et recherche ; mais l'année et la note n'existent pas |
| Aucune requête obsolète n'écrase une plus récente | ✅ `switchMap` + compteur de génération |
| Un favori apparaît sur l'étagère et survit au rechargement | ✅ Avec un compte, mais sans animation |
| Le lien de l'étagère s'ouvre dans un autre navigateur | ✅ Pour `/e/<id>` réel ; ❌ pour `/e/demo` |
| L'export PNG contient l'étagère complète | ❌ Pas au-delà de 3-4 rangées, et pas à une taille de post |
| Le mode démo marche sans réseau | ❌ Il passe par l'API |
| Jeu du jour | ❌ Page provisoire |
| En ligne sur Coolify | ⏳ Pas encore |

## Ce qui marche bien (à garder)

- **L'identité visuelle** : nuit et ambre, les trois polices bien chargées, et la cartouche dessinée en CSS qui sert de jaquette. La vitrine et la fiche sont vraiment propres au produit.
- **La fiche** : la grande cartouche, les deux notes en bloc (bleu RAWG, ambre Cartouche), des boutons de note de 44 px et un retour annoncé aux lecteurs d'écran.
- **L'API** : solide sur la sécurité de base. Mots de passe en scrypt, jetons de session stockés hachés, requêtes SQL paramétrées, contrôle de l'origine sur les écritures, cookies `HttpOnly` et `SameSite`, et entrées bornées (`parseQuery`, `isSlug`).
- **L'accessibilité de base** : `lang` qui suit la langue choisie, des filtres en `aria-pressed`, un contour de focus ambre visible, des libellés sur les champs et presque toutes les cibles à 44 px.
- **Les filtres dans l'adresse** et le message clair quand aucun jeu ne correspond.

## Non testé

- Le vrai catalogue RAWG (panne pendant la revue) : jaquettes réelles, facettes RAWG, pagination longue et temps de réponse normaux.
- Le fichier PNG exporté lui-même (le téléchargement n'a pas été déclenché).
- La navigation complète au clavier et avec un lecteur d'écran réel. Seuls les règles CSS et les attributs ont été vérifiés.
- Le déploiement Docker et Coolify.
