# Agenda Brasil

Aplicação web responsiva de agendamento para barbearias, construída com Next.js 15, Supabase e Tailwind CSS. Inclui agenda de clientes e profissionais, link público sem senha, fila de espera, sinal por Pix, lembretes automáticos, relatórios, exportação, telemetria e controles de privacidade.

## Hospedagem

A aplicação utiliza exclusivamente Next.js na Vercel para compilação e hospedagem da produção.

## Titularidade

Agenda Brasil é uma plataforma desenvolvida e mantida pela **Sucegan Tech**. O software, o código, a arquitetura, o design, os textos, a identidade visual e os demais elementos originais da plataforma são de titularidade da Sucegan Tech, ressalvados os conteúdos pertencentes aos estabelecimentos, usuários e terceiros.

## Desenvolvimento

1. Copie `.env.example` para `.env.local` e preencha pelo menos as variáveis públicas do Supabase.
2. Instale dependências com `npm install`.
3. Execute `npm run dev` e abra `http://localhost:3000`.

## Banco de dados

As mudanças ficam em `supabase/migrations`. Antes de publicar:

```bash
npx supabase db push --dry-run
npx supabase db push
```

Os testes de RLS usam pgTAP e um ambiente Supabase local:

```bash
npx supabase start
npm run test:db
```

## Mensagens automáticas

A rota `/api/cron/notifications` processa a tabela `notificacoes`. Na Vercel, `vercel.json` agenda essa rota uma vez por dia. Outros provedores podem chamar a mesma rota com `Authorization: Bearer $CRON_SECRET`.

- E-mail: configure uma conta Resend, domínio validado, `RESEND_API_KEY` e `NOTIFICATION_EMAIL_FROM`.
- WhatsApp: configure Meta WhatsApp Cloud API, `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`. Para mensagens iniciadas pelo negócio, cadastre um template aprovado e informe `WHATSAPP_TEMPLATE_NAME`.

Sem essas credenciais a agenda continua funcionando; os itens permanecem registrados para diagnóstico e não são enviados.

## Segurança e produção

- Ative confirmação de e-mail, CAPTCHA do Cloudflare Turnstile, SMTP próprio e MFA nos administradores do Supabase.
- Configure `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor. Nunca use prefixo `NEXT_PUBLIC_` nessa chave.
- Configure `NEXT_PUBLIC_SITE_URL` com o domínio HTTPS definitivo.
- Revise os textos de privacidade e termos com o responsável legal do estabelecimento.
- Agende backups e valide restauração antes de receber dados reais.

## Qualidade

```bash
npm run lint
npm test
npm run build
npm run test:e2e
npm audit
```

Os testes E2E cobrem Chromium, Firefox, WebKit, Chrome móvel e WebKit móvel. A execução exige os navegadores do Playwright (`npx playwright install`).
