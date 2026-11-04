import { defineConfig, devices } from '@playwright/test';

// Parcours de bout en bout, contre le front et l'API de développement déjà lancés
// (ng serve avec le proxy vers l'API, et « npm run dev:memory » côté API). Adresse modifiable par CARTOUCHE_URL.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: process.env['CARTOUCHE_URL'] ?? 'http://localhost:4202',
  },
  projects: [
    // Edge est le Chromium déjà présent sur Windows : pas de navigateur à télécharger.
    { name: 'chromium', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'msedge' } },
  ],
});
