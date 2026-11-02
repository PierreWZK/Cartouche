# Cartouche · La ludothèque qui se feuillette

> Jour 20 du défi **30 jours, 30 projets** · Angular · TypeScript · ⏳ **À venir**

Une ludothèque de jeux vidéo en **Angular**, pensée mobile first : chaque jeu est une cartouche qu'on feuillette, qu'on filtre avec des étiquettes et qu'on met en favoris. Les favoris s'empilent sur une **étagère 3D** qu'on exporte en image ou qu'on partage avec ses amis par un simple lien. **Cartouche** s'appuie sur l'API RAWG, avec un mode démo sans clé.

📄 Les règles détaillées sont dans le [cahier des charges](CAHIER_DES_CHARGES.md).

## Au programme

- Interface mobile first, adaptée à l'ordinateur.
- Liste de jeux en cartouches, avec défilement infini.
- Filtres combinés et tri, gardés dans l'adresse (lien partageable).
- Fiche d'un jeu : visuels, description, plateformes, studios, captures.
- Deux notes côte à côte : la communauté globale et la communauté Cartouche.
- Favoris dans le navigateur, posés sur une étagère 3D.
- Export PNG de l'étagère, et lien partageable pour les amis.
- Mode démo avec des données locales.

## Lancer en local

```bash
npm install
npx ng serve                 # http://localhost:4200
```

## Mise en ligne

Prévue sur Coolify : **https://cartouche.projectp.fr**.

## Stack

Angular · TypeScript.

## Avant de déclarer le projet terminé

> Rappel pour Claude : à faire sur chaque projet, sans que je le redemande (détail dans les sections 9 et 10 du cahier des charges).

- **Indexation** : `robots.txt`, `sitemap.xml`, balise canonical, données structurées JSON-LD (`WebApplication` rattachée à ProjectP) et lien « 30 jours, 30 projets » vers https://projectp.fr/ dans le pied de page. Vérifier en ligne, puis me rappeler de soumettre `https://cartouche.projectp.fr/sitemap.xml` dans Google Search Console.
- **Aperçu du lien** : image Open Graph stylisée 1200 × 630 aux couleurs du projet et balises `og:*` / `twitter:card`, vérifiées en ligne.
- **Vitrine** : la mise à jour de `30days30projects` (README et `projects.js`) se fait **après ma validation**.
