-- Commercial onboarding and subscription foundation for Agenda Brasil.
-- Platform plans belong to the SaaS owner account and remain separate from
-- monthly plans that each establishment sells to its own customers.

begin;

create table public.planos_plataforma (
  id bigint generated always as identity primary key,
  slug varchar(40) not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  nome varchar(80) not null check (char_length(trim(nome)) between 2 and 80),
  descricao varchar(240) not null,
  preco_mensal numeric(10,2) not null check (preco_mensal >= 0),
  max_profissionais smallint not null check (max_profissionais between 1 and 500),
  max_unidades smallint not null check (max_unidades between 1 and 100),
  recursos jsonb not null default '[]'::jsonb check (jsonb_typeof(recursos) = 'array'),
  stripe_price_id varchar(255) unique,
  destaque boolean not null default false,
  ativo boolean not null default true,
  ordem smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assinaturas_plataforma (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  plano_id bigint not null references public.planos_plataforma(id) on delete restrict,
  status varchar(24) not null default 'trialing' check (
    status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'exempt')
  ),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id varchar(255) unique,
  stripe_subscription_id varchar(255) unique,
  stripe_checkout_session_id varchar(255) unique,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assinaturas_plataforma_plano_idx on public.assinaturas_plataforma (plano_id);
create index assinaturas_plataforma_status_idx on public.assinaturas_plataforma (status, updated_at desc);

alter table public.planos_plataforma enable row level security;
alter table public.assinaturas_plataforma enable row level security;

-- RLS remains a second boundary even though browser roles receive no direct
-- table privileges. Public summaries and owner data are exposed only by the
-- narrow functions below.
create policy planos_plataforma_admin_all on public.planos_plataforma
  for all to authenticated
  using ((select public.eh_admin_global()))
  with check ((select public.eh_admin_global()));

create policy assinaturas_plataforma_owner_select on public.assinaturas_plataforma
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.eh_admin_global()));

revoke all on table public.planos_plataforma from public, anon, authenticated;
revoke all on table public.assinaturas_plataforma from public, anon, authenticated;

insert into public.planos_plataforma (
  slug, nome, descricao, preco_mensal, max_profissionais, max_unidades, recursos, destaque, ordem
) values
  ('solo', 'Solo', 'Para o profissional que atende sozinho e quer começar a vender online.', 49.00, 1, 1,
    '["Agenda online", "Página pública", "Pagamentos e relatórios", "Suporte por e-mail"]'::jsonb, false, 10),
  ('profissional', 'Profissional', 'Para estabelecimentos com equipe, automações e gestão financeira completa.', 89.00, 10, 3,
    '["Tudo do plano Solo", "Até 10 profissionais", "Até 3 unidades", "Lembretes e fila de espera", "Suporte prioritário"]'::jsonb, true, 20),
  ('premium', 'Premium', 'Para operações maiores que precisam de mais unidades, equipe e controle.', 149.00, 50, 10,
    '["Tudo do plano Profissional", "Até 50 profissionais", "Até 10 unidades", "Painel financeiro avançado", "Atendimento prioritário"]'::jsonb, false, 30)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  preco_mensal = excluded.preco_mensal,
  max_profissionais = excluded.max_profissionais,
  max_unidades = excluded.max_unidades,
  recursos = excluded.recursos,
  destaque = excluded.destaque,
  ordem = excluded.ordem,
  updated_at = now();

create or replace function public.listar_planos_plataforma_publicos()
returns table (
  id bigint,
  slug text,
  nome text,
  descricao text,
  preco_mensal numeric,
  max_profissionais smallint,
  max_unidades smallint,
  recursos jsonb,
  destaque boolean
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.slug::text, p.nome::text, p.descricao::text, p.preco_mensal,
    p.max_profissionais, p.max_unidades, p.recursos, p.destaque
  from public.planos_plataforma p
  where p.ativo
  order by p.ordem, p.preco_mensal, p.id;
$$;

create or replace function public.obter_minha_assinatura_plataforma()
returns table (
  id uuid,
  usuario_id uuid,
  plano_id bigint,
  plano_slug text,
  plano_nome text,
  preco_mensal numeric,
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  max_profissionais smallint,
  max_unidades smallint,
  stripe_customer_id text,
  stripe_subscription_id text,
  livemode boolean
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.usuario_id, a.plano_id, p.slug::text, p.nome::text, p.preco_mensal,
    a.status::text, a.trial_ends_at, a.current_period_end, a.cancel_at_period_end,
    p.max_profissionais, p.max_unidades, a.stripe_customer_id::text,
    a.stripe_subscription_id::text, a.livemode
  from public.assinaturas_plataforma a
  join public.planos_plataforma p on p.id = a.plano_id
  where a.usuario_id = (select auth.uid())
    and exists (
      select 1 from public.usuarios u
      where u.id = (select auth.uid()) and u.tipo in ('proprietario', 'admin')
    );
$$;

create or replace function public.admin_listar_assinaturas_plataforma()
returns table (
  id uuid,
  usuario_id uuid,
  proprietario_nome text,
  proprietario_email text,
  plano_nome text,
  preco_mensal numeric,
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  unidades bigint,
  stripe_subscription_id text,
  livemode boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;
  return query
  select a.id, a.usuario_id, u.nome::text, coalesce(au.email, '')::text,
    p.nome::text, p.preco_mensal, a.status::text, a.trial_ends_at,
    a.current_period_end, count(x.id)::bigint, a.stripe_subscription_id::text, a.livemode
  from public.assinaturas_plataforma a
  join public.usuarios u on u.id = a.usuario_id
  join auth.users au on au.id = a.usuario_id
  join public.planos_plataforma p on p.id = a.plano_id
  left join public.barbearias x on x.proprietario_id = a.usuario_id and x.ativa
  group by a.id, u.nome, au.email, p.nome, p.preco_mensal
  order by a.created_at desc;
end;
$$;

create or replace function public.admin_atualizar_status_assinatura_plataforma(
  p_usuario_id uuid,
  p_status text
)
returns public.assinaturas_plataforma
language plpgsql security definer set search_path = ''
as $$
declare
  v_atual public.assinaturas_plataforma;
  v_resultado public.assinaturas_plataforma;
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;
  if p_status not in ('trialing', 'exempt', 'canceled') then
    raise exception 'Status manual inválido';
  end if;
  select * into v_atual from public.assinaturas_plataforma
  where usuario_id = p_usuario_id for update;
  if not found then raise exception 'Assinatura não encontrada'; end if;
  if v_atual.stripe_subscription_id is not null then
    raise exception 'Esta assinatura deve ser alterada pelo painel de cobrança da Stripe';
  end if;
  update public.assinaturas_plataforma set
    status = p_status,
    trial_ends_at = case when p_status = 'trialing' then now() + interval '14 days' else trial_ends_at end,
    updated_at = now()
  where id = v_atual.id
  returning * into v_resultado;
  insert into public.admin_audit_logs (admin_id, acao, entidade, entidade_id, detalhes)
  values ((select auth.uid()), 'alterar_assinatura_plataforma', 'assinatura_plataforma', v_resultado.id::text,
    jsonb_build_object('usuario_id', p_usuario_id, 'status_anterior', v_atual.status, 'status_atual', p_status));
  return v_resultado;
end;
$$;

create or replace function public.criar_minha_barbearia(
  p_nome text,
  p_slug text,
  p_publicar boolean default true
)
returns public.barbearias
language plpgsql security definer set search_path = ''
as $$
declare
  v_usuario public.usuarios;
  v_plano public.planos_plataforma;
  v_assinatura public.assinaturas_plataforma;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_resultado public.barbearias;
  v_total_unidades integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Faça login para criar seu estabelecimento' using errcode = '42501';
  end if;

  select * into v_usuario
  from public.usuarios
  where id = (select auth.uid())
  for update;

  if not found or v_usuario.tipo <> 'proprietario' then
    raise exception 'Apenas proprietários podem criar seus estabelecimentos' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then
    raise exception 'Informe um nome válido';
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 80 then
    raise exception 'Informe um identificador de link válido';
  end if;
  if exists (select 1 from public.barbearias x where x.slug = v_slug) then
    raise exception 'Este identificador já está em uso';
  end if;

  select a.* into v_assinatura
  from public.assinaturas_plataforma a
  where a.usuario_id = v_usuario.id
  for update;

  if not found then
    select * into v_plano from public.planos_plataforma where slug = 'profissional' and ativo;
    if not found then raise exception 'Plano inicial indisponível'; end if;
    insert into public.assinaturas_plataforma (usuario_id, plano_id, status, trial_ends_at)
    values (v_usuario.id, v_plano.id, 'trialing', now() + interval '14 days')
    returning * into v_assinatura;
  else
    select * into v_plano from public.planos_plataforma where id = v_assinatura.plano_id and ativo;
    if not found then raise exception 'Plano indisponível'; end if;
  end if;

  if v_assinatura.status not in ('trialing', 'active', 'exempt')
     or (v_assinatura.status = 'trialing' and coalesce(v_assinatura.trial_ends_at, now()) <= now()) then
    raise exception 'Regularize a assinatura para adicionar uma unidade';
  end if;

  select count(*) into v_total_unidades
  from public.barbearias x
  where x.proprietario_id = v_usuario.id and x.ativa;
  if v_total_unidades >= v_plano.max_unidades then
    raise exception 'Seu plano permite até % unidade(s)', v_plano.max_unidades;
  end if;

  insert into public.barbearias (
    proprietario_id, nome, slug, telefone, responsavel_legal, agendamento_publico
  ) values (
    v_usuario.id, trim(p_nome), v_slug, v_usuario.telefone, v_usuario.nome, coalesce(p_publicar, true)
  ) returning * into v_resultado;

  insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id)
  values (v_usuario.nome, v_usuario.telefone, v_usuario.id, v_resultado.id);

  return v_resultado;
end;
$$;

-- Allow a user to explicitly choose the proprietor path at signup. Permission
-- still comes from database ownership checks, never from mutable JWT metadata.
create or replace function public.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_tipo text := coalesce(new.raw_user_meta_data ->> 'tipo', '');
  v_nome text := trim(coalesce(new.raw_user_meta_data ->> 'nome', ''));
  v_telefone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'telefone', '')), '');
  v_convite text := nullif(new.raw_user_meta_data ->> 'convite_barbeiro', '');
  v_termos boolean := coalesce((new.raw_user_meta_data ->> 'termos_aceitos')::boolean, false);
  v_barbearia_id uuid;
begin
  if v_tipo not in ('cliente', 'barbeiro', 'proprietario') or char_length(v_nome) not between 2 and 120 then
    raise exception 'Dados de cadastro inválidos';
  end if;
  if not v_termos then raise exception 'É necessário aceitar os termos de uso'; end if;
  if v_telefone is null then raise exception 'Telefone é obrigatório'; end if;

  if v_tipo = 'barbeiro' then
    update public.convites_barbeiro
    set usado_por = new.id, usado_em = now()
    where token = v_convite and usado_por is null and expira_em > now()
    returning barbearia_id into v_barbearia_id;
    if not found then raise exception 'Convite de barbeiro inválido ou expirado'; end if;
  end if;

  insert into public.usuarios (id, nome, telefone, tipo, termos_aceitos_em)
  values (new.id, v_nome, v_telefone, v_tipo, now())
  on conflict (id) do update set
    nome = excluded.nome,
    telefone = excluded.telefone,
    tipo = excluded.tipo,
    termos_aceitos_em = coalesce(public.usuarios.termos_aceitos_em, excluded.termos_aceitos_em);

  if v_tipo = 'cliente' then
    insert into public.clientes (nome, telefone, email, usuario_id)
    values (v_nome, v_telefone, new.email, new.id)
    on conflict (usuario_id) do update set
      nome = excluded.nome, telefone = excluded.telefone, email = excluded.email;
  elsif v_tipo = 'barbeiro' then
    insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id)
    values (v_nome, v_telefone, new.id, v_barbearia_id);
  end if;

  return new;
end;
$$;

-- Repair the ACL inherited by the administrator-only creator and apply least
-- privilege to all new SECURITY DEFINER functions.
revoke all on function public.criar_barbearia(text, text, boolean) from public, anon, authenticated;
grant execute on function public.criar_barbearia(text, text, boolean) to authenticated;

revoke all on function public.criar_perfil_usuario() from public, anon, authenticated;
revoke all on function public.listar_planos_plataforma_publicos() from public, anon, authenticated;
revoke all on function public.obter_minha_assinatura_plataforma() from public, anon, authenticated;
revoke all on function public.criar_minha_barbearia(text, text, boolean) from public, anon, authenticated;
revoke all on function public.admin_listar_assinaturas_plataforma() from public, anon, authenticated;
revoke all on function public.admin_atualizar_status_assinatura_plataforma(uuid, text) from public, anon, authenticated;

grant execute on function public.listar_planos_plataforma_publicos() to anon, authenticated;
grant execute on function public.obter_minha_assinatura_plataforma() to authenticated;
grant execute on function public.criar_minha_barbearia(text, text, boolean) to authenticated;
grant execute on function public.admin_listar_assinaturas_plataforma() to authenticated;
grant execute on function public.admin_atualizar_status_assinatura_plataforma(uuid, text) to authenticated;

commit;
