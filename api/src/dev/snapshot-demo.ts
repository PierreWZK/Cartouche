// Fige une base de jeux réels pour le mode démo : 20 jeux IGDB les mieux notés, avec leurs jaquettes.
// À lancer à la main, une fois : node --env-file=.env dist/dev/snapshot-demo.js
// Les clés IGDB viennent de l'environnement et ne sont jamais affichées.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseQuery, type Game } from '../games.js';
import { createUpstream } from '../upstream.js';

const here = dirname(fileURLToPath(import.meta.url));
const frontDir = join(here, '..', '..', '..', 'front');
const dataFile = join(frontDir, 'src', 'app', 'data', 'demo-games.json');
const coversDir = join(frontDir, 'public', 'demo', 'covers');

const upstream = createUpstream({
  rawgKey: '',
  igdbClientId: process.env['IGDB_CLIENT_ID'] ?? '',
  igdbClientSecret: process.env['IGDB_CLIENT_SECRET'] ?? '',
});

const { items } = await upstream.games(parseQuery({ sort: 'rating', page: '1', size: '40' }));

// Une même série sort en plusieurs éditions (« Titre : Édition ») : on n'en garde qu'une.
const baseTitle = (name: string) => name.split(/:| - /)[0]!.trim().toLowerCase();
const seen = new Set<string>();
const unique = items.filter((g) => {
  const base = baseTitle(g.name);
  if (seen.has(base)) return false;
  seen.add(base);
  return true;
});
const selected = unique.slice(0, 20);
if (selected.length < 10) throw new Error(`Seulement ${selected.length} jeux distincts : on ne fige pas une base trop petite.`);

await mkdir(coversDir, { recursive: true });
const games: Game[] = [];
for (const game of selected) {
  if (!game.cover) continue;
  const res = await fetch(game.cover);
  if (!res.ok) throw new Error(`Jaquette indisponible pour ${game.id} (${res.status})`);
  await writeFile(join(coversDir, `${game.id}.jpg`), Buffer.from(await res.arrayBuffer()));
  games.push({ ...game, cover: `/demo/covers/${game.id}.jpg` });
}

await writeFile(dataFile, JSON.stringify(games, null, 2) + '\n');
console.log(`${games.length} jeux écrits dans ${dataFile}`);
console.log(games.map((g) => `${g.name} (${g.year}) · ${g.platforms.slice(0, 2).join(', ')}`).join('\n'));
