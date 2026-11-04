import { expect, test } from '@playwright/test';

// Parcours sans compte : langue, catalogue, recherche, fiche, étagère publique inconnue.

test('le titre et la langue de la page suivent le sélecteur', async ({ page }) => {
  // Sur le catalogue : le sélecteur doit rester atteignable malgré le défilement infini.
  await page.goto('/ludotheque');
  await expect(page).toHaveTitle('Cartouche · La ludothèque qui se feuillette');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page).toHaveTitle('Cartouche · The game library that flips open');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('le catalogue se filtre par la recherche et ouvre une fiche', async ({ page }) => {
  await page.goto('/ludotheque');
  const links = page.locator('a[href^="/ludotheque/jeu/"]');
  await expect(links.first()).toBeVisible();

  await page.locator('.search input').fill('zelda');
  await expect(page).toHaveURL(/q=zelda/);
  await expect(links.first()).toContainText(/zelda/i);

  await links.first().click();
  await expect(page).toHaveURL(/\/ludotheque\/jeu\//);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/zelda/i);
  await expect(page.getByRole('link', { name: 'Connecte-toi pour ajouter ce jeu' })).toBeVisible();
});

test('une étagère publique inconnue affiche un message, pas une erreur', async ({ page }) => {
  await page.goto('/u/personne-inconnue');
  await expect(page.getByText("Cette étagère n'existe pas ou n'est pas publique.")).toBeVisible();
});
