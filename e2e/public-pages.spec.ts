import { expect, test } from '@playwright/test';

test('login and public booking entry points fit the viewport', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Agenda Brasil' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Escolher estabelecimento|Agendar sem senha/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reenviar confirmação/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Sou cliente/i })).toHaveAttribute('href', '/cadastro/cliente');
  await expect(page.getByRole('link', { name: /Tenho um negócio/i })).toHaveAttribute('href', '/cadastro/estabelecimento');
  const emailLabel = page.locator('label[for="login-email"]');
  const emailInput = page.locator('#login-email');
  const submitButton = page.getByRole('button', { name: 'Entrar', exact: true });
  await expect(emailLabel).toHaveCSS('display', 'block');
  await expect(emailInput).toHaveCSS('width', /\d+px/);
  await expect(submitButton).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const [labelBox, inputBox] = await Promise.all([emailLabel.boundingBox(), emailInput.boundingBox()]);
  expect(labelBox && inputBox && labelBox.y + labelBox.height <= inputBox.y).toBeTruthy();
  const viewport = page.viewportSize();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(viewport?.width ?? width);

  await page.getByRole('link', { name: /Sou cliente/i }).click();
  await expect(page).toHaveURL(/\/cadastro\/cliente$/);
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
          identities: [{ identity_id: '00000000-0000-4000-8000-000000000124', provider: 'email' }],
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

  await page.goto('/cadastro/cliente', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="nome"]').fill('Cliente Teste');
  await page.locator('input[name="telefone"]').fill('11999999999');
  await page.locator('input[name="email"]').fill('cliente.teste@example.com');
  await page.locator('input[name="senha"]').fill('senha-segura');
  await page.locator('input[name="confirmarSenha"]').fill('senha-segura');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta de cliente', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Cadastro realizado' })).toBeVisible();
  await expect(page.getByText('cliente.teste@example.com', { exact: true })).toBeVisible();
  await expect(page.getByText(/Spam, Lixo eletrônico e Promoções/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Reenviar e-mail de confirmação/i })).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);

  await page.getByRole('button', { name: /Reenviar e-mail de confirmação/i }).click();
  await expect(page.locator('section[role="status"]').getByText(/Solicitação recebida|Nova solicitação enviada/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Reenviar em \d+s/i })).toBeDisabled();
});

test('owner pricing and signup path are responsive and keep the owner role', async ({ page }) => {
  let signupType = '';
  await page.route('**/auth/v1/signup**', async (route) => {
    const body = route.request().postDataJSON() as { data?: { tipo?: string } };
    signupType = body.data?.tipo ?? '';
    const now = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '00000000-0000-4000-8000-000000000456', aud: 'authenticated', role: 'authenticated',
          email: 'dono.teste@example.com', phone: '', confirmation_sent_at: now,
          app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [{ identity_id: '00000000-0000-4000-8000-000000000457', provider: 'email' }],
          created_at: now, updated_at: now,
        },
        session: null,
      }),
    });
  });

  await page.goto('/planos', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /Sua agenda cheia/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Profissional' })).toBeVisible();
  const viewport = page.viewportSize();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport?.width ?? 0);

  await page.getByRole('link', { name: /Começar teste grátis/i }).click();
  await expect(page).toHaveURL(/\/cadastro\/estabelecimento$/);
  await expect(page.getByRole('heading', { name: /Comece seu teste grátis/i })).toBeVisible();
  await page.locator('input[name="nome"]').fill('Dono Teste');
  await page.locator('input[name="telefone"]').fill('11999999999');
  await page.locator('input[name="email"]').fill('dono.teste@example.com');
  await page.locator('input[name="senha"]').fill('senha-segura');
  await page.locator('input[name="confirmarSenha"]').fill('senha-segura');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Criar conta do estabelecimento/i }).click();
  await expect(page.getByRole('heading', { name: 'Cadastro realizado' })).toBeVisible();
  expect(signupType).toBe('proprietario');
});

test('signup blocks invalid profile data before calling Supabase', async ({ page }) => {
  let signupRequests = 0;
  await page.route('**/auth/v1/signup**', async (route) => {
    signupRequests += 1;
    await route.abort();
  });

  await page.goto('/cadastro/cliente', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="nome"]').fill('s');
  await page.locator('input[name="telefone"]').fill('18996582256');
  await page.locator('input[name="email"]').fill('cliente.teste@example.com');
  await page.locator('input[name="senha"]').fill('senha-segura');
  await page.locator('input[name="confirmarSenha"]').fill('senha-segura');
  await page.getByRole('checkbox').check();
  // requestSubmit exercises the browser's native constraint validation
  // without depending on the simulated iOS keyboard settling after fill().
  await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());

  expect(await page.locator('input[name="nome"]').evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  expect(signupRequests).toBe(0);
});

test('professional registration is isolated and requires a private invitation', async ({ page }) => {
  await page.goto('/cadastro/profissional?convite=convite-teste', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Convite para profissional' })).toBeVisible();
  await expect(page.getByText(/Acesso restrito por convite/i)).toBeVisible();
  await expect(page.getByText(/Como você quer usar/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Aceitar convite e criar conta/i })).toBeVisible();
});

test('legacy signup links redirect to the separated registration areas', async ({ page }) => {
  await page.goto('/?tipo=proprietario', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/cadastro\/estabelecimento$/);
  await page.goto('/?tipo=barbeiro&convite=convite-antigo', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/cadastro\/profissional\?convite=convite-antigo$/);
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
