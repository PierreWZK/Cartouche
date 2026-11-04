// Fige la base du jeu du jour : 200 jeux connus, RAWG d'abord, IGDB si RAWG ne répond pas.
// À lancer à la main : node --env-file=.env dist/dev/snapshot-daily.js
// Les clés viennent de l'environnement et ne sont jamais affichées.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseQuery, type Game } from '../games.js';
import { createUpstream } from '../upstream.js';

const TARGET = 200;
const PAGE_SIZE = 40;
const MAX_PAGES = 15;

const here = dirname(fileURLToPath(import.meta.url));
const frontDir = join(here, '..', '..', '..', 'front');
const poolFile = join(frontDir, 'src', 'app', 'daily', 'daily-pool.json');
const coversDir = join(frontDir, 'public', 'daily', 'covers');

const upstream = createUpstream({
  rawgKey: process.env['RAWG_API_KEY'] ?? '',
  igdbClientId: process.env['IGDB_CLIENT_ID'] ?? '',
  igdbClientSecret: process.env['IGDB_CLIENT_SECRET'] ?? '',
});

// Vignettes de 56 px à l'écran : on télécharge une version réduite, pas l'image d'origine.
function smallCover(url: string): string {
  return url
    .replace('/t_cover_big/', '/t_cover_small/')
    .replace('media.rawg.io/media/', 'media.rawg.io/media/resize/200/-/');
}

// Une même série sort en plusieurs éditions (« Titre : Édition ») : on n'en garde qu'une.
const baseTitle = (name: string) => name.split(/:| - /)[0]!.trim().toLowerCase();

const seen = new Set<string>();
const picked: Game[] = [];
for (let page = 1; page <= MAX_PAGES && picked.length < TARGET; page++) {
  const { items } = await upstream.games(parseQuery({ sort: 'rating', page: String(page), size: String(PAGE_SIZE) }));
  if (items.length === 0) break;
  for (const g of items) {
    const base = baseTitle(g.name);
    if (!g.year || !g.cover || seen.has(base)) continue;
    seen.add(base);
    picked.push(g);
    if (picked.length === TARGET) break;
  }
}
if (picked.length < TARGET) throw new Error(`Seulement ${picked.length} jeux distincts : base non écrite.`);

await rm(coversDir, { recursive: true, force: true });
await mkdir(coversDir, { recursive: true });
const pool = [];
for (const g of picked) {
  const res = await fetch(smallCover(g.cover!));
  if (!res.ok) throw new Error(`Jaquette indisponible pour ${g.id} (${res.status})`);
  await writeFile(join(coversDir, `${g.id}.jpg`), Buffer.from(await res.arrayBuffer()));
  pool.push({
    id: g.id,
    name: g.name,
    year: g.year,
    platforms: g.platforms.slice(0, 2),
    cover: `/daily/covers/${g.id}.jpg`,
    art: g.art,
  });
}

await writeFile(poolFile, JSON.stringify(pool) + '\n');
const sources = new Set(picked.map((g) => (g.cover!.includes('rawg.io') ? 'RAWG' : 'IGDB')));
const years = new Set(pool.map((g) => g.year));
console.log(`${pool.length} jeux écrits (source : ${[...sources].join(' + ')}), ${years.size} années différentes.`);
