-- Stripe Checkout and Connect state. Secret API credentials never live in the
-- database; only provider identifiers needed for reconciliation are stored.

begin;

alter table public.barbearias
  add column if not exists stripe_account_id varchar(80),
  add column if not exists stripe_onboarding_status varchar(24) not null default 'nao_conectado';

alter table public.barbearias drop constraint if exists barbearias_stripe_onboarding_status_check;
alter table public.barbearias add constraint barbearias_stripe_onboarding_status_check
  check (stripe_onboarding_status in ('nao_conectado', 'pendente', 'ativo', 'restrito'));
create unique index if not exists barbearias_stripe_account_unique_idx
  on public.barbearias (stripe_account_id) where stripe_account_id is not null;

alter table public.configuracoes_plataforma
  add column if not exists taxa_plataforma_percentual numeric(5, 2) not null default 0;
alter table public.configuracoes_plataforma drop constraint if exists configuracoes_taxa_plataforma_check;
alter table public.configuracoes_plataforma add constraint configuracoes_taxa_plataforma_check
  check (taxa_plataforma_percentual between 0 and 30);

alter table public.agendamentos
  add column if not exists pagamento_online_status varchar(20) not null default 'nao_iniciado';
alter table public.agendamentos drop constraint if exists agendamentos_pagamento_online_status_check;
alter table public.agendamentos add constraint agendamentos_pagamento_online_status_check
  check (pagamento_online_status in ('nao_iniciado', 'processando', 'pago', 'estornado'));

create table if not exists public.checkouts_pagamento (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete restrict,
  usuario_id uuid not null references public.usuarios(id) on delete restrict,
  agendamento_id bigint references public.agendamentos(id) on delete restrict,
  plano_id bigint references public.planos_mensais(id) on delete restrict,
  tipo varchar(16) not null check (tipo in ('sinal', 'servico', 'assinatura')),
  valor numeric(10, 2) not null check (valor > 0),
  moeda char(3) not null default 'brl' check (moeda = lower(moeda)),
  status varchar(20) not null default 'criado'
    check (status in ('criado', 'pago', 'expirado', 'cancelado', 'falhou')),
  stripe_session_id varchar(255) not null unique,
  stripe_payment_intent_id varchar(255),
  stripe_subscription_id varchar(255),
  stripe_customer_id varchar(255),
  livemode boolean not null default false,
  expires_at timestamptz,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (tipo in ('sinal', 'servico') and agendamento_id is not null and plano_id is null)
    or (tipo = 'assinatura' and plano_id is not null and agendamento_id is null)
  )
);

create index if not exists checkouts_pagamento_usuario_idx
  on public.checkouts_pagamento (usuario_id, created_at desc);
create index if not exists checkouts_pagamento_barbearia_idx
  on public.checkouts_pagamento (barbearia_id, status, created_at desc);
create index if not exists checkouts_pagamento_agendamento_idx
  on public.checkouts_pagamento (agendamento_id, status)
  where agendamento_id is not null;

drop index if exists public.movimentacoes_agendamento_receita_unique_idx;
create unique index movimentacoes_agendamento_receita_unique_idx
  on public.movimentacoes_financeiras (agendamento_id, categoria)
  where agendamento_id is not null and tipo = 'receita' and status <> 'cancelado';

alter table public.checkouts_pagamento enable row level security;

drop policy if exists checkouts_pagamento_cliente_select on public.checkouts_pagamento;
drop policy if exists checkouts_pagamento_owner_select on public.checkouts_pagamento;
create policy checkouts_pagamento_cliente_select on public.checkouts_pagamento
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy checkouts_pagamento_owner_select on public.checkouts_pagamento
  for select to authenticated using ((select public.eh_proprietario_barbearia(barbearia_id)));

revoke all on public.checkouts_pagamento from anon, authenticated;
grant select on public.checkouts_pagamento to authenticated;
grant update (taxa_plataforma_percentual) on public.configuracoes_plataforma to authenticated;

commit;
