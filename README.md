# Agenda Brasil

Aplicação web responsiva de agendamento para barbearias e estabelecimentos, construída com Next.js 15, Supabase, Stripe e Tailwind CSS. Inclui cadastro comercial em autosserviço, agenda de clientes e profissionais, link público sem senha, fila de espera, pagamentos, assinaturas, lembretes automáticos, relatórios, exportação, telemetria e controles de privacidade.

## Modelo comercial

- O proprietário cria a conta, confirma o e-mail e publica a primeira unidade em um onboarding guiado.
- Toda conta comercial recebe 14 dias grátis sem cartão no plano Profissional.
- Os planos da Sucegan Tech ficam em `planos_plataforma` e as cobranças em `assinaturas_plataforma`.
- Os planos que uma barbearia vende aos próprios clientes continuam separados em `planos_mensais` e `assinaturas_clientes`.
- O painel global do administrador acompanha MRR, testes, pendências e pode isentar ou reiniciar manualmente uma assinatura ainda não vinculada à Stripe.

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

- E-mail de autenticação: a integração Resend do Supabase cobre confirmação de cadastro, magic link e recuperação de senha.
- E-mail de agendamento: configure também na Vercel `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM` e, opcionalmente, `NOTIFICATION_REPLY_TO`. O sistema tenta enviar confirmações imediatamente e mantém o cron diário como recuperação da fila.
- Entregabilidade: use remetente de domínio próprio verificado no Resend e publique SPF, DKIM e DMARC. Evite remetentes gratuitos ou domínios diferentes dos links do site.
- WhatsApp: configure Meta WhatsApp Cloud API, `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`. Para mensagens iniciadas pelo negócio, cadastre um template aprovado e informe `WHATSAPP_TEMPLATE_NAME`.

Sem essas credenciais a agenda continua funcionando; os itens permanecem registrados para diagnóstico e não são enviados.

## Assinaturas e pagamentos

- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` e `STRIPE_WEBHOOK_SECRET` são obrigatórias para cobrar.
- O endpoint `/api/payments/webhook` deve receber `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated` e `customer.subscription.deleted`.
- Use chaves de teste durante o piloto. Antes de cobrar clientes reais, ative a conta Stripe, troque todas as chaves por produção e refaça o webhook no modo live.
- Configure o Customer Portal da Stripe para permitir atualização de cartão, faturas e cancelamento pelo proprietário.

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
