import { expect, test } from '@playwright/test';

test('login and public booking entry points fit the viewport', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Agenda Brasil' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Agendar sem senha/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reenviar confirmação/i })).toBeVisible();
  const viewport = page.viewportSize();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(viewport?.width ?? width);

  await page.getByRole('button', { name: /Cadastre-se/i }).click();
  await expect(page.getByText(/Aceito os termos/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport?.width ?? width);
});

test('signup keeps a persistent email confirmation notice', async ({ page }) => {
  await page.route('**/auth/v1/signup**', async (route) => {
    const now = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '00000000-0000-4000-8000-000000000123',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'cliente.teste@example.com',
          phone: '',
          confirmation_sent_at: now,
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          identities: [],
          created_at: now,
          updated_at: now,
        },
        session: null,
      }),
    });
  });
  await page.route('**/auth/v1/resend**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Cadastre-se/i }).click();
  await page.locator('input[name="nome"]').fill('Cliente Teste');
  await page.locator('input[name="telefone"]').fill('11999999999');
  await page.locator('input[name="email"]').fill('cliente.teste@example.com');
  await page.locator('input[name="senha"]').fill('senha-segura');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Cadastro realizado' })).toBeVisible();
  await expect(page.getByText('cliente.teste@example.com', { exact: true })).toBeVisible();
  await expect(page.getByText(/Spam, Lixo eletrônico e Promoções/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Reenviar e-mail de confirmação/i })).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);

  await page.getByRole('button', { name: /Reenviar e-mail de confirmação/i }).click();
  await expect(page.locator('section[role="status"]').getByText(/Nova solicitação enviada/i)).toBeVisible();
});

test('signup blocks invalid profile data before calling Supabase', async ({ page }) => {
  let signupRequests = 0;
  await page.route('**/auth/v1/signup**', async (route) => {
    signupRequests += 1;
    await route.abort();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Cadastre-se/i }).click();
  await page.locator('input[name="nome"]').fill('s');
  await page.locator('input[name="telefone"]').fill('18996582256');
  await page.locator('input[name="email"]').fill('cliente.teste@example.com');
  await page.locator('input[name="senha"]').fill('senha-segura');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();

  expect(await page.locator('input[name="nome"]').evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  expect(signupRequests).toBe(0);
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
  await expect(page).toHaveURL(/\/?motivo=sessao-expirada$/);
  await expect(page.getByRole('heading', { name: 'Agenda Brasil' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('sessão anterior expirou');
});
