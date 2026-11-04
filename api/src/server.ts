// Point d'entrée : branche la configuration réelle (clés, base) et lance le serveur.
import { createApp } from './app.js';
import { config } from './config.js';
import { createPool, migrate, type Db } from './db.js';
import { createUpstream } from './upstream.js';

const upstream = createUpstream({
  rawgKey: config.rawgKey,
  igdbClientId: config.igdbClientId,
  igdbClientSecret: config.igdbClientSecret,
});

async function main() {
  let db: Db | undefined;
  if (config.databaseUrl) {
    db = createPool(config.databaseUrl);
    await migrate(db);
  } else {
    console.warn('DATABASE_URL absent : comptes et favoris désactivés, mode démo seul.');
  }

  const app = createApp({
    upstream,
    db,
    corsOrigin: config.corsOrigin,
    secureCookies: config.secureCookies,
  });

  app.listen(config.port, () => {
    console.log(`API Cartouche sur le port ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
