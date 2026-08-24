import { expect, test } from '@playwright/test';

test('login and public booking entry points fit the viewport', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Agenda Brasil' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Agendar sem senha/i })).toBeVisible();
  const viewport = page.viewportSize();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(viewport?.width ?? width);

  await page.getByRole('button', { name: /Cadastre-se/i }).click();
  await expect(page.getByText(/Aceito os termos/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport?.width ?? width);
});

test('web version does not expose install or update app surfaces', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  await expect(page.getByText(/Uma nova versão está pronta/i)).toHaveCount(0);
  await expect(page.getByText(/Instalar aplicativo|Adicionar à Tela de Início/i)).toHaveCount(0);

  expect((await request.get('/manifest.webmanifest')).status()).toBe(404);
  expect((await request.get('/sw.js')).status()).toBe(404);
});

test('legal pages are available without authentication', async ({ page }) => {
  await page.goto('/privacidade', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Política de privacidade' })).toBeVisible();
  await page.goto('/termos', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Termos de uso' })).toBeVisible();
});

test('public booking route always returns a usable page', async ({ page }) => {
  await page.goto('/agendar', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Application error');
  const viewport = page.viewportSize();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport?.width ?? 0);
});

test('dashboard redirects visitors without a session', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Agenda Brasil' })).toBeVisible();
});
