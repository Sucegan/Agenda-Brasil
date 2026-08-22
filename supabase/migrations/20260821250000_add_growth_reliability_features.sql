-- Growth, reliability and customer-retention features.
-- External delivery providers remain optional: this migration only creates the
-- secure queue and user-facing configuration used by the application worker.

begin;

create extension if not exists pgcrypto;

alter table public.usuarios
  add column if not exists termos_aceitos_em timestamptz,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists lembretes_email boolean not null default true,
  add column if not exists lembretes_whatsapp boolean not null default true,
  add column if not exists lembretes_push boolean not null default false;

update public.usuarios
set termos_aceitos_em = coalesce(termos_aceitos_em, created_at)
where termos_aceitos_em is null;

-- Persist the explicit acceptance collected by password and magic-link signup.
create or replace function public.criar_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text := coalesce(new.raw_user_meta_data ->> 'tipo', '');
  v_nome text := trim(coalesce(new.raw_user_meta_data ->> 'nome', ''));
  v_telefone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'telefone', '')), '');
  v_convite text := nullif(new.raw_user_meta_data ->> 'convite_barbeiro', '');
  v_termos boolean := coalesce((new.raw_user_meta_data ->> 'termos_aceitos')::boolean, false);
begin
  if v_tipo not in ('cliente', 'barbeiro') or char_length(v_nome) not between 2 and 120 then
    raise exception 'Dados de cadastro inválidos';
  end if;
  if not v_termos then raise exception 'É necessário aceitar os termos de uso'; end if;
  if v_tipo = 'cliente' and v_telefone is null then raise exception 'Telefone é obrigatório para clientes'; end if;

  if v_tipo = 'barbeiro' then
    update public.convites_barbeiro
    set usado_por = new.id, usado_em = now()
    where token = v_convite and usado_por is null and expira_em > now();
    if not found then raise exception 'Convite de barbeiro inválido ou expirado'; end if;
  end if;

  insert into public.usuarios (id, nome, telefone, tipo, termos_aceitos_em)
  values (new.id, v_nome, v_telefone, v_tipo, now())
  on conflict (id) do update
    set nome = excluded.nome, telefone = excluded.telefone, tipo = excluded.tipo,
        termos_aceitos_em = coalesce(public.usuarios.termos_aceitos_em, excluded.termos_aceitos_em);

  if v_tipo = 'cliente' then
    insert into public.clientes (nome, telefone, email, usuario_id)
    values (v_nome, v_telefone, new.email, new.id)
    on conflict (usuario_id) do update
      set nome = excluded.nome, telefone = excluded.telefone, email = excluded.email;
  else
    insert into public.barbeiros (nome, telefone, usuario_id)
    values (v_nome, v_telefone, new.id)
    on conflict (usuario_id) do update
      set nome = excluded.nome, telefone = excluded.telefone;
  end if;
  return new;
end;
$$;

revoke all on function public.criar_perfil_usuario() from public;

alter table public.configuracoes_negocio
  add column if not exists slug varchar not null default 'agenda-brasil',
  add column if not exists agendamento_publico boolean not null default true,
  add column if not exists cancelamento_horas smallint not null default 2,
  add column if not exists sinal_percentual numeric(5, 2) not null default 0,
  add column if not exists pix_chave text,
  add column if not exists pix_beneficiario varchar,
  add column if not exists lembrete_email boolean not null default true,
  add column if not exists lembrete_whatsapp boolean not null default true,
  add column if not exists lembrete_push boolean not null default false,
  add column if not exists bloquear_apos_faltas smallint not null default 3,
  add column if not exists dias_bloqueio smallint not null default 30;

alter table public.configuracoes_negocio
  drop constraint if exists configuracoes_negocio_slug_check,
  add constraint configuracoes_negocio_slug_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  drop constraint if exists configuracoes_negocio_cancelamento_horas_check,
  add constraint configuracoes_negocio_cancelamento_horas_check check (cancelamento_horas between 0 and 168),
  drop constraint if exists configuracoes_negocio_sinal_percentual_check,
  add constraint configuracoes_negocio_sinal_percentual_check check (sinal_percentual between 0 and 100),
  drop constraint if exists configuracoes_negocio_bloquear_apos_faltas_check,
  add constraint configuracoes_negocio_bloquear_apos_faltas_check check (bloquear_apos_faltas between 0 and 20),
  drop constraint if exists configuracoes_negocio_dias_bloqueio_check,
  add constraint configuracoes_negocio_dias_bloqueio_check check (dias_bloqueio between 1 and 365);

create unique index if not exists configuracoes_negocio_slug_idx
  on public.configuracoes_negocio (slug);

alter table public.clientes
  add column if not exists faltas smallint not null default 0,
  add column if not exists bloqueado_ate date,
  add column if not exists observacoes text;

alter table public.clientes
  drop constraint if exists clientes_faltas_check,
  add constraint clientes_faltas_check check (faltas between 0 and 1000);

alter table public.agendamentos
  add column if not exists origem varchar not null default 'painel',
  add column if not exists sinal_valor numeric(10, 2) not null default 0,
  add column if not exists sinal_status varchar not null default 'nao_exigido',
  add column if not exists cancelamento_tardio boolean not null default false,
  add column if not exists public_token uuid not null default gen_random_uuid();

alter table public.agendamentos
  drop constraint if exists agendamentos_origem_check,
  add constraint agendamentos_origem_check check (origem in ('painel', 'link_publico')),
  drop constraint if exists agendamentos_sinal_valor_check,
  add constraint agendamentos_sinal_valor_check check (sinal_valor >= 0),
  drop constraint if exists agendamentos_sinal_status_check,
  add constraint agendamentos_sinal_status_check
    check (sinal_status in ('nao_exigido', 'pendente', 'informado', 'pago', 'dispensado'));

create unique index if not exists agendamentos_public_token_idx
  on public.agendamentos (public_token);

create table if not exists public.fila_espera (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  barbeiro_id bigint not null references public.barbeiros(id) on delete cascade,
  servico_id bigint not null references public.servicos(id) on delete cascade,
  data date not null,
  periodo varchar not null default 'qualquer' check (periodo in ('manha', 'tarde', 'noite', 'qualquer')),
  status varchar not null default 'aguardando' check (status in ('aguardando', 'notificado', 'convertido', 'cancelado')),
  notificado_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fila_espera_barbeiro_data_idx
  on public.fila_espera (barbeiro_id, data, status);

create unique index if not exists fila_espera_ativa_idx
  on public.fila_espera (cliente_id, barbeiro_id, servico_id, data)
  where status in ('aguardando', 'notificado');

create table if not exists public.notificacoes (
  id bigint generated always as identity primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade,
  agendamento_id bigint references public.agendamentos(id) on delete cascade,
  canal varchar not null check (canal in ('email', 'whatsapp', 'push')),
  tipo varchar not null check (tipo in ('confirmacao', 'lembrete_24h', 'lembrete_2h', 'status', 'fila_espera')),
  status varchar not null default 'pendente' check (status in ('pendente', 'enviada', 'erro', 'ignorada')),
  agendado_para timestamptz not null default now(),
  tentativas smallint not null default 0 check (tentativas between 0 and 20),
  payload jsonb not null default '{}'::jsonb,
  ultimo_erro text,
  enviada_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notificacoes_fila_idx
  on public.notificacoes (status, agendado_para)
  where status = 'pendente';

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_usuario_idx
  on public.push_subscriptions (usuario_id);

create table if not exists public.telemetria_eventos (
  id bigint generated always as identity primary key,
  usuario_id uuid references public.usuarios(id) on delete set null,
  tipo varchar not null check (tipo in ('erro_cliente', 'erro_servidor', 'web_vital')),
  rota varchar not null default '/',
  mensagem text not null,
  contexto jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists telemetria_eventos_created_at_idx
  on public.telemetria_eventos (created_at desc);

create table if not exists public.solicitacoes_exclusao (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  status varchar not null default 'pendente' check (status in ('pendente', 'processando', 'concluida', 'cancelada')),
  solicitada_em timestamptz not null default now(),
  processada_em timestamptz
);

alter table public.fila_espera enable row level security;
alter table public.notificacoes enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.telemetria_eventos enable row level security;
alter table public.solicitacoes_exclusao enable row level security;

drop policy if exists "fila_cliente_select" on public.fila_espera;
create policy "fila_cliente_select" on public.fila_espera
  for select to authenticated
  using (exists (select 1 from public.clientes c where c.id = cliente_id and c.usuario_id = auth.uid()));

drop policy if exists "fila_barbeiro_select" on public.fila_espera;
create policy "fila_barbeiro_select" on public.fila_espera
  for select to authenticated
  using (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));

drop policy if exists "notificacoes_select_own" on public.notificacoes;
create policy "notificacoes_select_own" on public.notificacoes
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "solicitacoes_exclusao_own" on public.solicitacoes_exclusao;
create policy "solicitacoes_exclusao_own" on public.solicitacoes_exclusao
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Safe, read-only catalog for the public booking page. No customer or private
-- calendar information is returned.
create or replace function public.obter_catalogo_publico()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'negocio', (
      select jsonb_build_object(
        'nome', c.nome,
        'endereco', c.endereco,
        'telefone', c.telefone,
        'logo_url', c.logo_url,
        'slug', c.slug,
        'agendamento_publico', c.agendamento_publico,
        'cancelamento_horas', c.cancelamento_horas,
        'sinal_percentual', c.sinal_percentual,
        'pix_chave', c.pix_chave,
        'pix_beneficiario', c.pix_beneficiario
      )
      from public.configuracoes_negocio c where c.id = true
    ),
    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'nome', b.nome,
        'horario_inicio', b.horario_inicio::text,
        'horario_fim', b.horario_fim::text,
        'dias_trabalho', b.dias_trabalho
      ) order by b.nome)
      from public.barbeiros b
    ), '[]'::jsonb),
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'nome', s.nome,
        'preco', s.preco,
        'duracao', s.duracao,
        'barbeiro_id', s.barbeiro_id
      ) order by s.nome)
      from public.servicos s
    ), '[]'::jsonb),
    'feriados', coalesce((
      select jsonb_agg(jsonb_build_object('data', f.data, 'descricao', f.descricao) order by f.data)
      from public.feriados_negocio f
      where f.data >= timezone('America/Sao_Paulo', now())::date
    ), '[]'::jsonb)
  );
$$;

-- Availability contains no personal data and can be consulted before login.
create or replace function public.buscar_horarios_disponiveis(
  p_barbeiro_id bigint,
  p_servico_id bigint,
  p_data date
)
returns table (horario text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barbeiro public.barbeiros;
  v_servico public.servicos;
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
  v_agora time := timezone('America/Sao_Paulo', now())::time;
  v_publico boolean := coalesce((select c.agendamento_publico from public.configuracoes_negocio c where c.id = true), false);
begin
  if auth.uid() is null and not v_publico then raise exception 'Agendamento público está desativado'; end if;
  if p_data < v_hoje then raise exception 'Não é possível consultar uma data passada'; end if;
  if exists (select 1 from public.feriados_negocio where data = p_data) then return; end if;

  select * into v_barbeiro from public.barbeiros where id = p_barbeiro_id;
  select * into v_servico from public.servicos where id = p_servico_id and barbeiro_id = p_barbeiro_id;
  if not found or v_barbeiro.id is null then raise exception 'Serviço não pertence ao profissional selecionado'; end if;
  if not extract(dow from p_data)::smallint = any(v_barbeiro.dias_trabalho) then return; end if;

  return query
  with slots as (
    select slot::time as inicio
    from generate_series(
      p_data::timestamp + v_barbeiro.horario_inicio,
      p_data::timestamp + v_barbeiro.horario_fim - make_interval(mins => v_servico.duracao),
      interval '30 minutes'
    ) as slot
  )
  select slots.inicio::text
  from slots
  where (p_data > v_hoje or slots.inicio > v_agora)
    and (
      v_barbeiro.horario_almoco_inicio is null
      or slots.inicio + make_interval(mins => v_servico.duracao) <= v_barbeiro.horario_almoco_inicio
      or slots.inicio >= v_barbeiro.horario_almoco_fim
    )
    and not exists (
      select 1 from public.agendamentos a
      where a.barbeiro_id = p_barbeiro_id
        and a.data = p_data
        and a.status not in ('cancelado', 'nao_compareceu')
        and slots.inicio < a.horario + make_interval(mins => a.servico_duracao)
        and a.horario < slots.inicio + make_interval(mins => v_servico.duracao)
    )
    and not exists (
      select 1 from public.bloqueios_agenda b
      where b.barbeiro_id = p_barbeiro_id
        and p_data between b.data_inicio and b.data_fim
        and (
          b.hora_inicio is null
          or (slots.inicio < b.hora_fim and slots.inicio + make_interval(mins => v_servico.duracao) > b.hora_inicio)
        )
    )
  order by slots.inicio;
end;
$$;

create or replace function public.preparar_agendamento_comercial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.configuracoes_negocio;
  v_cliente public.clientes;
begin
  select * into v_config from public.configuracoes_negocio where id = true;
  select * into v_cliente from public.clientes where id = new.cliente_id;

  if v_cliente.bloqueado_ate is not null and v_cliente.bloqueado_ate >= timezone('America/Sao_Paulo', now())::date then
    raise exception 'Novos agendamentos estão bloqueados até % por faltas anteriores', to_char(v_cliente.bloqueado_ate, 'DD/MM/YYYY');
  end if;

  new.public_token := coalesce(new.public_token, gen_random_uuid());
  new.sinal_valor := round(coalesce(new.servico_preco, 0) * coalesce(v_config.sinal_percentual, 0) / 100, 2);
  new.sinal_status := case when new.sinal_valor > 0 then 'pendente' else 'nao_exigido' end;
  return new;
end;
$$;

drop trigger if exists preparar_agendamento_comercial on public.agendamentos;
create trigger preparar_agendamento_comercial
before insert on public.agendamentos
for each row execute function public.preparar_agendamento_comercial();

create or replace function public.criar_agendamento_com_origem(
  p_barbeiro_id bigint,
  p_servico_id bigint,
  p_data date,
  p_horario time,
  p_origem text default 'painel'
)
returns public.agendamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agendamento public.agendamentos;
begin
  if p_origem not in ('painel', 'link_publico') then raise exception 'Origem inválida'; end if;
  v_agendamento := public.criar_agendamento(p_barbeiro_id, p_servico_id, p_data, p_horario);
  update public.agendamentos set origem = p_origem where id = v_agendamento.id returning * into v_agendamento;
  return v_agendamento;
end;
$$;

create or replace function public.entrar_fila_espera(
  p_barbeiro_id bigint,
  p_servico_id bigint,
  p_data date,
  p_periodo text default 'qualquer'
)
returns public.fila_espera
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente_id bigint;
  v_resultado public.fila_espera;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if p_data < timezone('America/Sao_Paulo', now())::date then raise exception 'Escolha uma data futura'; end if;
  if p_periodo not in ('manha', 'tarde', 'noite', 'qualquer') then raise exception 'Período inválido'; end if;
  select id into v_cliente_id from public.clientes where usuario_id = auth.uid();
  if v_cliente_id is null then raise exception 'Apenas clientes podem entrar na fila'; end if;
  if not exists (select 1 from public.servicos where id = p_servico_id and barbeiro_id = p_barbeiro_id) then
    raise exception 'Serviço inválido';
  end if;

  select * into v_resultado
  from public.fila_espera
  where cliente_id = v_cliente_id
    and barbeiro_id = p_barbeiro_id
    and servico_id = p_servico_id
    and data = p_data
    and status in ('aguardando', 'notificado');

  if found then
    update public.fila_espera set periodo = p_periodo where id = v_resultado.id returning * into v_resultado;
    return v_resultado;
  end if;

  insert into public.fila_espera (cliente_id, barbeiro_id, servico_id, data, periodo)
  values (v_cliente_id, p_barbeiro_id, p_servico_id, p_data, p_periodo)
  returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.cancelar_fila_espera(p_fila_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.fila_espera f set status = 'cancelado'
  where f.id = p_fila_id
    and f.status in ('aguardando', 'notificado')
    and exists (select 1 from public.clientes c where c.id = f.cliente_id and c.usuario_id = auth.uid());
  if not found then raise exception 'Entrada da fila não encontrada'; end if;
end;
$$;

create or replace function public.listar_fila_profissional()
returns table (
  id bigint,
  data date,
  periodo varchar,
  status varchar,
  cliente_nome varchar,
  cliente_telefone varchar,
  servico_nome varchar,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select f.id, f.data, f.periodo, f.status, c.nome, c.telefone, s.nome, f.created_at
  from public.fila_espera f
  join public.clientes c on c.id = f.cliente_id
  join public.servicos s on s.id = f.servico_id
  join public.barbeiros b on b.id = f.barbeiro_id
  where b.usuario_id = auth.uid() and f.status in ('aguardando', 'notificado')
  order by f.data, f.created_at;
$$;

create or replace function public.informar_pagamento_sinal(p_agendamento_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.agendamentos a set sinal_status = 'informado'
  where a.id = p_agendamento_id
    and a.sinal_status = 'pendente'
    and exists (select 1 from public.clientes c where c.id = a.cliente_id and c.usuario_id = auth.uid());
  if not found then raise exception 'Sinal não pode ser informado'; end if;
end;
$$;

create or replace function public.atualizar_sinal_agendamento(p_agendamento_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('pendente', 'informado', 'pago', 'dispensado') then raise exception 'Status de sinal inválido'; end if;
  update public.agendamentos a set sinal_status = p_status
  where a.id = p_agendamento_id
    and exists (select 1 from public.barbeiros b where b.id = a.barbeiro_id and b.usuario_id = auth.uid());
  if not found then raise exception 'Agendamento não encontrado ou não autorizado'; end if;
end;
$$;

create or replace function public.atualizar_preferencias_comunicacao(
  p_email boolean,
  p_whatsapp boolean,
  p_push boolean,
  p_marketing boolean
)
returns public.usuarios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario public.usuarios;
begin
  update public.usuarios
  set lembretes_email = coalesce(p_email, false),
      lembretes_whatsapp = coalesce(p_whatsapp, false),
      lembretes_push = coalesce(p_push, false),
      marketing_opt_in = coalesce(p_marketing, false)
  where id = auth.uid()
  returning * into v_usuario;
  if not found then raise exception 'Perfil não encontrado'; end if;
  return v_usuario;
end;
$$;

create or replace function public.atualizar_configuracoes_avancadas(
  p_slug text,
  p_agendamento_publico boolean,
  p_cancelamento_horas smallint,
  p_sinal_percentual numeric,
  p_pix_chave text,
  p_pix_beneficiario text,
  p_lembrete_email boolean,
  p_lembrete_whatsapp boolean,
  p_lembrete_push boolean,
  p_bloquear_apos_faltas smallint,
  p_dias_bloqueio smallint
)
returns public.configuracoes_negocio
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado public.configuracoes_negocio;
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if not exists (select 1 from public.barbeiros where usuario_id = auth.uid()) then
    raise exception 'Apenas profissionais podem alterar estas configurações';
  end if;

  update public.configuracoes_negocio
  set slug = v_slug,
      agendamento_publico = coalesce(p_agendamento_publico, false),
      cancelamento_horas = p_cancelamento_horas,
      sinal_percentual = p_sinal_percentual,
      pix_chave = nullif(trim(coalesce(p_pix_chave, '')), ''),
      pix_beneficiario = nullif(trim(coalesce(p_pix_beneficiario, '')), ''),
      lembrete_email = coalesce(p_lembrete_email, false),
      lembrete_whatsapp = coalesce(p_lembrete_whatsapp, false),
      lembrete_push = coalesce(p_lembrete_push, false),
      bloquear_apos_faltas = p_bloquear_apos_faltas,
      dias_bloqueio = p_dias_bloqueio,
      updated_at = now()
  where id = true
  returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.solicitar_exclusao_conta()
returns public.solicitacoes_exclusao
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado public.solicitacoes_exclusao;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  insert into public.solicitacoes_exclusao (usuario_id)
  values (auth.uid())
  on conflict (usuario_id) do update set status = 'pendente', solicitada_em = now(), processada_em = null
  returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.agendar_notificacoes_agendamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario public.usuarios;
  v_config public.configuracoes_negocio;
  v_instante timestamptz;
  v_payload jsonb;
begin
  select u.* into v_usuario
  from public.usuarios u
  join public.clientes c on c.usuario_id = u.id
  where c.id = new.cliente_id;
  select * into v_config from public.configuracoes_negocio where id = true;

  v_instante := make_timestamptz(
    extract(year from new.data)::integer,
    extract(month from new.data)::integer,
    extract(day from new.data)::integer,
    extract(hour from new.horario)::integer,
    extract(minute from new.horario)::integer,
    0,
    'America/Sao_Paulo'
  );
  v_payload := jsonb_build_object(
    'agendamento_id', new.id,
    'cliente_nome', new.cliente_nome,
    'cliente_telefone', new.cliente_telefone,
    'barbeiro_nome', new.barbeiro_nome,
    'servico_nome', new.servico_nome,
    'data', new.data,
    'horario', new.horario,
    'public_token', new.public_token
  );

  if v_config.lembrete_email and v_usuario.lembretes_email then
    insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload)
    values (v_usuario.id, new.id, 'email', 'confirmacao', now(), v_payload);
    if v_instante - interval '24 hours' > now() then
      insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload)
      values (v_usuario.id, new.id, 'email', 'lembrete_24h', v_instante - interval '24 hours', v_payload);
    end if;
  end if;

  if v_config.lembrete_whatsapp and v_usuario.lembretes_whatsapp then
    insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload)
    values (v_usuario.id, new.id, 'whatsapp', 'confirmacao', now(), v_payload);
    if v_instante - interval '24 hours' > now() then
      insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload)
      values (v_usuario.id, new.id, 'whatsapp', 'lembrete_24h', v_instante - interval '24 hours', v_payload);
    end if;
  end if;

  if v_config.lembrete_push and v_usuario.lembretes_push and v_instante - interval '2 hours' > now() then
    insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload)
    values (v_usuario.id, new.id, 'push', 'lembrete_2h', v_instante - interval '2 hours', v_payload);
  end if;
  return new;
end;
$$;

drop trigger if exists agendar_notificacoes_agendamento on public.agendamentos;
create trigger agendar_notificacoes_agendamento
after insert on public.agendamentos
for each row execute function public.agendar_notificacoes_agendamento();

create or replace function public.processar_mudanca_agendamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente public.clientes;
  v_usuario_id uuid;
  v_config public.configuracoes_negocio;
  v_limite timestamptz;
  v_payload jsonb;
  v_fila public.fila_espera;
begin
  if new.status = old.status then return new; end if;
  select * into v_config from public.configuracoes_negocio where id = true;
  select c.* into v_cliente from public.clientes c where c.id = new.cliente_id;
  v_usuario_id := v_cliente.usuario_id;

  v_limite := make_timestamptz(
    extract(year from new.data)::integer,
    extract(month from new.data)::integer,
    extract(day from new.data)::integer,
    extract(hour from new.horario)::integer,
    extract(minute from new.horario)::integer,
    0,
    'America/Sao_Paulo'
  ) - make_interval(hours => v_config.cancelamento_horas);

  if new.status = 'cancelado' then
    new.cancelamento_tardio := now() > v_limite;
    update public.notificacoes set status = 'ignorada'
    where agendamento_id = new.id and status = 'pendente';

    for v_fila in
      select * from public.fila_espera f
      where f.barbeiro_id = new.barbeiro_id
        and f.servico_id = new.servico_id
        and f.data = new.data
        and f.status = 'aguardando'
    loop
      select c.usuario_id into v_usuario_id from public.clientes c where c.id = v_fila.cliente_id;
      insert into public.notificacoes (usuario_id, canal, tipo, agendado_para, payload)
      select v_usuario_id, canal, 'fila_espera', now(), jsonb_build_object(
        'data', new.data,
        'horario', new.horario,
        'barbeiro_nome', new.barbeiro_nome,
        'servico_nome', new.servico_nome
      )
      from (values ('email'::varchar), ('whatsapp'::varchar), ('push'::varchar)) canais(canal);
      update public.fila_espera set status = 'notificado', notificado_em = now() where id = v_fila.id;
    end loop;
  elsif new.status = 'nao_compareceu' and old.status <> 'nao_compareceu' then
    update public.clientes c
    set faltas = c.faltas + 1,
        bloqueado_ate = case
          when v_config.bloquear_apos_faltas > 0 and c.faltas + 1 >= v_config.bloquear_apos_faltas
            then timezone('America/Sao_Paulo', now())::date + v_config.dias_bloqueio
          else c.bloqueado_ate
        end
    where c.id = new.cliente_id;
  end if;

  select c.usuario_id into v_usuario_id from public.clientes c where c.id = new.cliente_id;
  v_payload := jsonb_build_object(
    'agendamento_id', new.id,
    'status', new.status,
    'data', new.data,
    'horario', new.horario,
    'barbeiro_nome', new.barbeiro_nome,
    'servico_nome', new.servico_nome
  );
  insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, payload)
  values (v_usuario_id, new.id, 'push', 'status', v_payload);
  return new;
end;
$$;

drop trigger if exists processar_mudanca_agendamento on public.agendamentos;
create trigger processar_mudanca_agendamento
before update of status on public.agendamentos
for each row execute function public.processar_mudanca_agendamento();

-- Cancellation policy is enforced and recorded at the database boundary.
create or replace function public.cancelar_meu_agendamento(p_agendamento_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  update public.agendamentos a
  set status = 'cancelado', cancelado_at = now()
  where a.id = p_agendamento_id
    and a.data >= timezone('America/Sao_Paulo', now())::date
    and a.status in ('agendado', 'confirmado')
    and exists (select 1 from public.clientes c where c.id = a.cliente_id and c.usuario_id = auth.uid());
  if not found then raise exception 'Agendamento não pode ser cancelado'; end if;
end;
$$;

revoke all on function public.obter_catalogo_publico() from public;
revoke all on function public.buscar_horarios_disponiveis(bigint, bigint, date) from public;
revoke all on function public.criar_agendamento_com_origem(bigint, bigint, date, time, text) from public;
revoke all on function public.entrar_fila_espera(bigint, bigint, date, text) from public;
revoke all on function public.cancelar_fila_espera(bigint) from public;
revoke all on function public.listar_fila_profissional() from public;
revoke all on function public.informar_pagamento_sinal(bigint) from public;
revoke all on function public.atualizar_sinal_agendamento(bigint, text) from public;
revoke all on function public.atualizar_preferencias_comunicacao(boolean, boolean, boolean, boolean) from public;
revoke all on function public.atualizar_configuracoes_avancadas(text, boolean, smallint, numeric, text, text, boolean, boolean, boolean, smallint, smallint) from public;
revoke all on function public.solicitar_exclusao_conta() from public;
revoke all on function public.preparar_agendamento_comercial() from public;
revoke all on function public.agendar_notificacoes_agendamento() from public;
revoke all on function public.processar_mudanca_agendamento() from public;
revoke all on function public.cancelar_meu_agendamento(bigint) from public;

grant usage on schema public to anon, authenticated;
grant execute on function public.obter_catalogo_publico() to anon, authenticated;
grant execute on function public.listar_barbeiros_publicos() to anon, authenticated;
grant execute on function public.buscar_horarios_disponiveis(bigint, bigint, date) to anon, authenticated;
grant execute on function public.criar_agendamento_com_origem(bigint, bigint, date, time, text) to authenticated;
grant execute on function public.entrar_fila_espera(bigint, bigint, date, text) to authenticated;
grant execute on function public.cancelar_fila_espera(bigint) to authenticated;
grant execute on function public.listar_fila_profissional() to authenticated;
grant execute on function public.informar_pagamento_sinal(bigint) to authenticated;
grant execute on function public.atualizar_sinal_agendamento(bigint, text) to authenticated;
grant execute on function public.atualizar_preferencias_comunicacao(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.atualizar_configuracoes_avancadas(text, boolean, smallint, numeric, text, text, boolean, boolean, boolean, smallint, smallint) to authenticated;
grant execute on function public.solicitar_exclusao_conta() to authenticated;
grant execute on function public.cancelar_meu_agendamento(bigint) to authenticated;

grant select on public.fila_espera, public.notificacoes to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update on public.solicitacoes_exclusao to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fila_espera'
    ) then
      alter publication supabase_realtime add table public.fila_espera;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificacoes'
    ) then
      alter publication supabase_realtime add table public.notificacoes;
    end if;
  end if;
end;
$$;

commit;
