// Configuration lue une seule fois au démarrage. Les clés ne sortent jamais du serveur.
// Appelé par server.ts et upstream.ts.
export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:4200',
  rawgKey: process.env['RAWG_API_KEY'] ?? '',
  igdbClientId: process.env['IGDB_CLIENT_ID'] ?? '',
  igdbClientSecret: process.env['IGDB_CLIENT_SECRET'] ?? '',
  databaseUrl: process.env['DATABASE_URL'] ?? '',
  // Cookies « Secure » en production (HTTPS) ; désactivé en local (HTTP).
  secureCookies: process.env['NODE_ENV'] === 'production',
};
