# Cartouche · La ludothèque qui se feuillette

> Jour 20 du défi **30 jours, 30 projets** · Angular · Node.js · PostgreSQL · Three.js · ✅ **Terminé** (en attente de mise en ligne)

Une ludothèque de jeux vidéo, pensée mobile first : chaque jeu est une cartouche qu'on feuillette, qu'on filtre avec des étiquettes et qu'on met en favoris. Les favoris s'empilent sur une **étagère 3D** qu'on exporte en PNG ou qu'on partage par un lien en lecture seule. Les jeux viennent de **RAWG** (et **IGDB** pour compléter une description). Sans clé, le mode démo fonctionne avec des données locales.

📄 Les règles détaillées sont dans le [cahier des charges](CAHIER_DES_CHARGES.md).

## Au programme

- Interface mobile first, adaptée à l'ordinateur, en français ou en anglais (bascule dans le pied de page).
- Catalogue en cartouches, défilement infini, recherche, filtres par genre et plateforme, tri. Les filtres restent dans l'adresse.
- Fiche d'un jeu : visuels, description, plateformes, studios, deux notes côte à côte (RAWG et communauté Cartouche).
- Comptes par email et mot de passe, favoris et notes liés au compte.
- Étagère 3D en WebGL, export PNG, lien de partage en lecture seule (`/e/<identifiant>`, marqué `noindex`).
- Mode démo sans compte ni réseau : `/demo` et `/demo/<identifiant>`.

## Structure

| Dossier | Rôle |
| --- | --- |
| `front/` | Angular (site statique). `front/src/app/i18n/` contient les traductions FR et EN. |
| `api/` | Node.js + Express (TypeScript). Relaie RAWG et IGDB, gère les comptes, les favoris et les notes. |
| `CAHIER_DES_CHARGES.md` | Le contrat du projet. Les décisions prises en cours de route sont dans sa section 0. |

## Lancer en local

Deux terminaux.

```bash
# API, avec une base en mémoire (rien à installer, les données disparaissent à l'arrêt)
cd api
npm install
npm run dev:memory           # http://localhost:3000
```

```bash
# Front
cd front
npm install
npx ng serve                 # http://localhost:4200 (proxy vers l'API sur /api)
```

Sans `api/` lancé, le front reste en mode démo. Sans `RAWG_API_KEY`, l'API répond « non configuré » et le front bascule sur les données locales.

## Variables de l'API

Modèle dans [`api/.env.example`](api/.env.example). Aucune valeur réelle n'est committée.

| Variable | Rôle |
| --- | --- |
| `RAWG_API_KEY` | Clé RAWG (catalogue et fiches). |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | Identifiants Twitch pour IGDB (description de secours). |
| `DATABASE_URL` | Base PostgreSQL. Sans elle, comptes et favoris sont désactivés. |
| `CORS_ORIGIN` | Origine du front (`https://cartouche.projectp.fr` en production). |
| `NODE_ENV=production` | Active les cookies `Secure`. |

## Tests

```bash
cd api
npm test                     # 14 tests : API, comptes et favoris sur PostgreSQL en mémoire (pg-mem)
```

## Mise en ligne (Coolify)

Deux services, à partir du dépôt :

1. **API** : Dockerfile `api/Dockerfile`, port 3000, variables ci-dessus. Son nom de service doit être `api` (le front le joint par ce nom).
2. **Front** : Dockerfile `front/Dockerfile`, port 80, domaine `cartouche.projectp.fr`. `front/nginx.conf` relaie `/api/` vers le service `api`.

La base PostgreSQL est créée à la première exécution de l'API (`migrate`).

## Aperçu du lien

`front/public/og.png` (1200 × 630) est généré par `front/scripts/og/build-og.py` (Pillow).

## Stack

Angular 22 · TypeScript · Three.js · Node.js · Express 5 · PostgreSQL · nginx.

## Avant de déclarer le projet terminé

> Rappel pour Claude : à faire sur chaque projet, sans que je le redemande (détail dans les sections 9 et 10 du cahier des charges).

- **Indexation** : `robots.txt`, `sitemap.xml`, balise canonical, données structurées JSON-LD (`WebApplication` rattachée à ProjectP) et lien « 30 jours, 30 projets » vers https://projectp.fr/ dans le pied de page. Vérifier en ligne, puis me rappeler de soumettre `https://cartouche.projectp.fr/sitemap.xml` dans Google Search Console.
- **Aperçu du lien** : image Open Graph stylisée 1200 × 630 aux couleurs du projet et balises `og:*` / `twitter:card`, vérifiées en ligne.
- **Vitrine** : la mise à jour de `30days30projects` (README et `projects.js`) se fait **après ma validation**.
