// Génère la base de secours : 100 jeux IGDB les mieux notés, données seulement (aucune image copiée).
// À lancer à la main, une fois : node --env-file-if-exists=.env dist/dev/snapshot-fallback.js
// Écrit api/src/data/fallback-games.ts. Les clés IGDB viennent de l'environnement et ne sont jamais affichées.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseQuery, type Game } from '../games.js';
import { createUpstream } from '../upstream.js';

const here = dirname(fileURLToPath(import.meta.url));
// Lancé depuis dist/dev : on remonte jusqu'à api/ puis on va dans src/ (les .ts générés n'existent pas dans dist).
const out = join(here, '..', '..', 'src', 'data', 'fallback-games.ts');
const TARGET = 100;

const upstream = createUpstream({
  rawgKey: '',
  igdbClientId: process.env['IGDB_CLIENT_ID'] ?? '',
  igdbClientSecret: process.env['IGDB_CLIENT_SECRET'] ?? '',
});

// Une même série sort en plusieurs éditions (« Titre : Édition ») : on n'en garde qu'une.
const baseTitle = (name: string) => name.split(/:| - /)[0]!.trim().toLowerCase();
const seen = new Set<string>();
const games: Game[] = [];
for (let page = 1; page <= 4 && games.length < TARGET; page++) {
  const { items } = await upstream.games(parseQuery({ sort: 'rating', page: String(page), size: '40' }));
  for (const g of items) {
    const base = baseTitle(g.name);
    if (seen.has(base) || games.length >= TARGET) continue;
    seen.add(base);
    games.push(g);
  }
}
if (games.length < TARGET) throw new Error(`Seulement ${games.length} jeux récupérés sur ${TARGET}`);

await mkdir(dirname(out), { recursive: true });
await writeFile(
  out,
  `// Généré par dev/snapshot-fallback.ts : ${games.length} jeux IGDB, données seulement.\n` +
    `import type { Game } from '../games.js';\n\n` +
    `export const FALLBACK_GAMES: Game[] = ${JSON.stringify(games, null, 2)};\n`,
);
console.log(`${games.length} jeux écrits dans api/src/data/fallback-games.ts`);
