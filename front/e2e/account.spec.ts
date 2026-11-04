import { expect, test } from '@playwright/test';

// Parcours avec compte, de l'inscription à la suppression.
// shortcut: un seul navigateur, car l'API limite à 5 inscriptions par heure et par IP ; redémarrer l'API dev remet le compteur à zéro.

const username = `e2e_${Date.now().toString(36)}`;
const email = `${username}@example.test`;
const password = 'motdepasse-e2e';

// Largeur et hauteur d'un PNG : lues dans l'en-tête IHDR.
const pngSize = (buf: Buffer) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

test('inscription, étagère, export, page publique, suppression', async ({ page, browser }) => {
  test.skip(test.info().project.name !== 'chromium', 'parcours compte : chromium seulement');

  // Inscription
  await page.goto('/connexion');
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  // Après l'inscription, on arrive sur son étagère, vide : l'invitation mène au catalogue.
  await expect(page).toHaveURL(/\/etagere$/);
  await expect(page.getByText("Aucune cartouche sur l'étagère pour l'instant.")).toBeVisible();
  await page.getByRole('link', { name: 'Trouver mes premiers jeux' }).click();
  await expect(page).toHaveURL(/\/ludotheque/);

  // Ajout d'un jeu depuis sa fiche
  const first = page.locator('a[href^="/ludotheque/jeu/"]').first();
  await first.click();
  const title = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
  await page.getByRole('button', { name: "Ajouter à l'étagère" }).click();
  await expect(page.getByRole('button', { name: "Retirer de l'étagère" })).toBeVisible();

  await page.goto('/etagere');
  await expect(page.locator('.shelf li')).toHaveCount(1);
  await expect(page.getByText('1 cartouche posée')).toBeVisible();

  // Export PNG carré
  const square = page.getByRole('button', { name: 'Carré' });
  await expect(square).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), square.click()]);
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  expect(pngSize(await readFile(path))).toEqual({ width: 1080, height: 1080 });

  // Étagère privée par défaut : la page publique n'est pas visible
  // Visiteur sans cookie de session, dans un contexte séparé.
  const other = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await other.goto(`/u/${username}`);
  await expect(other.getByText("Cette étagère n'existe pas ou n'est pas publique.")).toBeVisible();

  // Pseudo + étagère publique
  await page.getByLabel('Pseudo').fill(username);
  await page.getByLabel('Étagère publique').check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Profil enregistré.')).toBeVisible();

  await other.goto(`/u/${username}`);
  await expect(other.locator('.shelf li')).toHaveCount(1);
  await expect(other.locator('.shelf')).toContainText(title.slice(0, 10));
  await other.close();

  // Suppression du compte : mauvais mot de passe refusé, bon mot de passe accepté
  await page.getByText('Supprimer mon compte').click();
  const pwd = page.locator('details.danger input[type="password"]');
  await pwd.fill('pas-le-bon');
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page.getByText('Mot de passe incorrect.')).toBeVisible();
  await pwd.fill(password);
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page).toHaveURL(/\/$/);
});
