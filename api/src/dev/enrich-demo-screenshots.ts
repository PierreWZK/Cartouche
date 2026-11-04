// Ajoute 3 captures par jeu à la base de démo, sans toucher à la liste des jeux (étagère et ordre restent identiques).
// À lancer à la main après compilation : node --env-file=.env dist/dev/enrich-demo-screenshots.js
// Les clés IGDB viennent de l'environnement et ne sont jamais affichées.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontDir = join(here, '..', '..', '..', 'front');
const dataFile = join(frontDir, 'src', 'app', 'data', 'demo-games.json');
const shotsDir = join(frontDir, 'public', 'demo', 'screenshots');
const SHOTS_PER_GAME = 3;

const clientId = process.env['IGDB_CLIENT_ID'] ?? '';
const clientSecret = process.env['IGDB_CLIENT_SECRET'] ?? '';

const tokenRes = await fetch(
  `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  { method: 'POST' },
);
const { access_token: token } = (await tokenRes.json()) as { access_token: string };

type DemoGame = { id: string; name: string; screenshots?: string[] };
const games = JSON.parse(await readFile(dataFile, 'utf8')) as DemoGame[];

await mkdir(shotsDir, { recursive: true });
for (const game of games) {
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` },
    body: `fields screenshots.image_id; where slug = "${game.id}"; limit 1;`,
  });
  const [row] = (await res.json()) as { screenshots?: { image_id: string }[] }[];
  const ids = (row?.screenshots ?? []).slice(0, SHOTS_PER_GAME).map((s) => s.image_id);

  game.screenshots = [];
  for (const [i, imageId] of ids.entries()) {
    const img = await fetch(`https://images.igdb.com/igdb/image/upload/t_screenshot_med/${imageId}.jpg`);
    if (!img.ok) throw new Error(`Capture indisponible pour ${game.id} (${img.status})`);
    const file = `${game.id}-${i + 1}.jpg`;
    await writeFile(join(shotsDir, file), Buffer.from(await img.arrayBuffer()));
    game.screenshots.push(`/demo/screenshots/${file}`);
  }
  console.log(`${game.name} : ${game.screenshots.length} capture(s)`);
}

await writeFile(dataFile, JSON.stringify(games, null, 2) + '\n');
