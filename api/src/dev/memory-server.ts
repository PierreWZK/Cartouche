// Serveur de développement avec une base PostgreSQL EN MÉMOIRE (pg-mem) : pour essayer les comptes en local
// sans installer PostgreSQL. Les données disparaissent à l'arrêt. Jamais utilisé en production (voir server.ts).
// Lancé par « npm run dev:memory ».
import { newDb } from 'pg-mem';
import { createApp } from '../app.js';
import { config } from '../config.js';
import { type Db, migrate } from '../db.js';
import { createUpstream } from '../upstream.js';

const { Pool } = newDb().adapters.createPg();
const db = new Pool() as unknown as Db;
await migrate(db);

const app = createApp({
  upstream: createUpstream({
    rawgKey: config.rawgKey,
    igdbClientId: config.igdbClientId,
    igdbClientSecret: config.igdbClientSecret,
  }),
  db,
  // Origine du front local (ng serve ou la prévisualisation), lue depuis le .env du développement.
  corsOrigin: config.corsOrigin,
  secureCookies: false,
});

app.listen(config.port, () => {
  console.log(`API dev (base en mémoire) sur le port ${config.port}`);
});
