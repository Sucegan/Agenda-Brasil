-- Production hardening: atomic notification delivery, persistent booking
-- handoff, abuse controls, retention and legal/business metadata.

begin;

create extension if not exists pgcrypto;

-- A short-lived server-only handoff keeps public bookings working after the
-- magic link is opened in another browser or device.
create table if not exists public.booking_intents (
  token uuid primary key default gen_random_uuid(),
  action varchar not null check (action in ('book', 'waitlist')),
  barber_id bigint not null references public.barbeiros(id) on delete cascade,
  service_id bigint not null references public.servicos(id) on delete cascade,
  booking_date date not null,
  booking_time time,
  period varchar not null default 'qualquer' check (period in ('manha', 'tarde', 'noite', 'qualquer')),
  customer_name varchar not null check (char_length(customer_name) between 2 and 120),
  customer_phone varchar not null check (char_length(customer_phone) between 10 and 30),
  customer_email varchar not null check (char_length(customer_email) between 5 and 320),
  terms_accepted boolean not null check (terms_accepted),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((action = 'book' and booking_time is not null) or (action = 'waitlist'))
);

create index if not exists booking_intents_expiry_idx
  on public.booking_intents (expires_at)
  where consumed_at is null;

alter table public.booking_intents enable row level security;
revoke all on table public.booking_intents from public, anon, authenticated;
grant select, insert, update, delete on table public.booking_intents to service_role;

-- Persistent, atomic rate limiting. Only hashed network identifiers are kept.
create table if not exists public.api_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  requests integer not null default 1 check (requests between 1 and 100000),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requests integer;
begin
  if char_length(coalesce(p_key_hash, '')) <> 64
     or p_max_requests not between 1 and 10000
     or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  insert into public.api_rate_limits (key_hash, window_started_at, requests, updated_at)
  values (p_key_hash, now(), 1, now())
  on conflict (key_hash) do update
  set requests = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then 1
        else public.api_rate_limits.requests + 1
      end,
      window_started_at = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then now()
        else public.api_rate_limits.window_started_at
      end,
      updated_at = now()
  returning requests into v_requests;

  return v_requests <= p_max_requests;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

-- A leased queue prevents two overlapping cron invocations from sending the
-- same e-mail, WhatsApp message or push notification.
alter table public.notificacoes
  add column if not exists lease_id uuid,
  add column if not exists lease_expires_at timestamptz;

alter table public.notificacoes
  drop constraint if exists notificacoes_status_check;
alter table public.notificacoes
  add constraint notificacoes_status_check
    check (status in ('pendente', 'processando', 'enviada', 'erro', 'ignorada'));

create index if not exists notificacoes_lease_idx
  on public.notificacoes (lease_expires_at)
  where status = 'processando';

create or replace function public.claim_due_notifications(
  p_limit integer,
  p_lease_id uuid,
  p_lease_seconds integer default 300
)
returns setof public.notificacoes
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 or p_lease_seconds not between 30 and 1800 then
    raise exception 'Invalid queue claim parameters';
  end if;

  update public.notificacoes
  set status = 'pendente', lease_id = null, lease_expires_at = null
  where status = 'processando' and lease_expires_at < now() and tentativas < 4;

  update public.notificacoes
  set status = 'erro', lease_id = null, lease_expires_at = null,
      ultimo_erro = coalesce(ultimo_erro, 'Limite de tentativas atingido')
  where status = 'processando' and lease_expires_at < now() and tentativas >= 4;

  return query
  with candidates as (
    select n.id
    from public.notificacoes n
    where n.status = 'pendente'
      and n.agendado_para <= now()
      and n.tentativas < 4
    order by n.agendado_para, n.id
    for update skip locked
    limit p_limit
  )
  update public.notificacoes n
  set status = 'processando',
      tentativas = n.tentativas + 1,
      lease_id = p_lease_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  from candidates c
  where n.id = c.id
  returning n.*;
end;
$$;

revoke all on function public.claim_due_notifications(integer, uuid, integer) from public;
grant execute on function public.claim_due_notifications(integer, uuid, integer) to service_role;

-- Public legal identity is optional, but can now be completed by the business.
alter table public.configuracoes_negocio
  add column if not exists responsavel_legal varchar,
  add column if not exists documento_legal varchar,
  add column if not exists email_privacidade varchar,
  add column if not exists prazo_retencao_meses smallint not null default 24;

alter table public.configuracoes_negocio
  drop constraint if exists configuracoes_negocio_prazo_retencao_check;
alter table public.configuracoes_negocio
  add constraint configuracoes_negocio_prazo_retencao_check
    check (prazo_retencao_meses between 1 and 120);

create or replace function public.atualizar_informacoes_legais(
  p_responsavel_legal text,
  p_documento_legal text,
  p_email_privacidade text,
  p_prazo_retencao_meses smallint
)
returns public.configuracoes_negocio
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.configuracoes_negocio;
begin
  if not exists (select 1 from public.barbeiros where usuario_id = auth.uid()) then
    raise exception 'Apenas profissionais podem alterar estas informações';
  end if;
  if p_prazo_retencao_meses not between 1 and 120 then
    raise exception 'Prazo de retenção inválido';
  end if;

  update public.configuracoes_negocio
  set responsavel_legal = nullif(trim(coalesce(p_responsavel_legal, '')), ''),
      documento_legal = nullif(trim(coalesce(p_documento_legal, '')), ''),
      email_privacidade = nullif(lower(trim(coalesce(p_email_privacidade, ''))), ''),
      prazo_retencao_meses = p_prazo_retencao_meses,
      updated_at = now()
  where id = true
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.atualizar_informacoes_legais(text, text, text, smallint) from public;
grant execute on function public.atualizar_informacoes_legais(text, text, text, smallint) to authenticated;

-- Expose only the fields intended for the public legal pages.
create or replace function public.obter_informacoes_legais_publicas()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nome', c.nome,
    'responsavel_legal', c.responsavel_legal,
    'documento_legal', c.documento_legal,
    'email_privacidade', c.email_privacidade,
    'telefone', c.telefone,
    'endereco', c.endereco,
    'prazo_retencao_meses', c.prazo_retencao_meses
  )
  from public.configuracoes_negocio c
  where c.id = true;
$$;

revoke all on function public.obter_informacoes_legais_publicas() from public;
grant execute on function public.obter_informacoes_legais_publicas() to anon, authenticated;

create or replace function public.cleanup_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate_limits integer;
  v_intents integer;
  v_telemetry integer;
  v_notifications integer;
begin
  delete from public.api_rate_limits where updated_at < now() - interval '2 days';
  get diagnostics v_rate_limits = row_count;
  delete from public.booking_intents
    where expires_at < now() or (consumed_at is not null and consumed_at < now() - interval '7 days');
  get diagnostics v_intents = row_count;
  delete from public.telemetria_eventos where created_at < now() - interval '90 days';
  get diagnostics v_telemetry = row_count;
  delete from public.notificacoes
    where (status in ('enviada', 'ignorada') and created_at < now() - interval '90 days')
       or (status = 'erro' and created_at < now() - interval '180 days');
  get diagnostics v_notifications = row_count;
  return jsonb_build_object(
    'rate_limits', v_rate_limits,
    'booking_intents', v_intents,
    'telemetry', v_telemetry,
    'notifications', v_notifications
  );
end;
$$;

revoke all on function public.cleanup_operational_data() from public;
grant execute on function public.cleanup_operational_data() to service_role;

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job_id from cron.job where jobname = 'agenda-brasil-maintenance';
    if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
    perform cron.schedule(
      'agenda-brasil-maintenance',
      '15 3 * * *',
      'select public.cleanup_operational_data();'
    );
  end if;
exception
  when insufficient_privilege or undefined_table then null;
end;
$$;

-- Customer feedback and a simple loyalty balance turn completed appointments
-- into measurable retention without exposing reviews publicly by default.
alter table public.clientes
  add column if not exists pontos_fidelidade integer not null default 0;
alter table public.clientes
  drop constraint if exists clientes_pontos_fidelidade_check;
alter table public.clientes
  add constraint clientes_pontos_fidelidade_check check (pontos_fidelidade between 0 and 1000000);

alter table public.agendamentos
  add column if not exists pontos_creditados boolean not null default false;

create table if not exists public.avaliacoes (
  id bigint generated always as identity primary key,
  agendamento_id bigint not null unique references public.agendamentos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  barbeiro_id bigint not null references public.barbeiros(id) on delete cascade,
  nota smallint not null check (nota between 1 and 5),
  comentario varchar check (comentario is null or char_length(comentario) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists avaliacoes_barbeiro_idx on public.avaliacoes (barbeiro_id, created_at desc);
alter table public.avaliacoes enable row level security;

drop policy if exists "avaliacoes_cliente_select" on public.avaliacoes;
create policy "avaliacoes_cliente_select" on public.avaliacoes
  for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "avaliacoes_cliente_insert" on public.avaliacoes;
create policy "avaliacoes_cliente_insert" on public.avaliacoes
  for insert to authenticated with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.agendamentos a
      join public.clientes c on c.id = a.cliente_id
      where a.id = agendamento_id
        and a.barbeiro_id = barbeiro_id
        and a.status = 'concluido'
        and c.usuario_id = auth.uid()
    )
  );
drop policy if exists "avaliacoes_cliente_update" on public.avaliacoes;
create policy "avaliacoes_cliente_update" on public.avaliacoes
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists "avaliacoes_profissional_select" on public.avaliacoes;
create policy "avaliacoes_profissional_select" on public.avaliacoes
  for select to authenticated using (
    exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid())
  );

grant select, insert, update on public.avaliacoes to authenticated;
grant usage, select on sequence public.avaliacoes_id_seq to authenticated;

create or replace function public.creditar_pontos_fidelidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'concluido' and old.status <> 'concluido' and not new.pontos_creditados then
    update public.clientes set pontos_fidelidade = pontos_fidelidade + 10 where id = new.cliente_id;
    update public.agendamentos set pontos_creditados = true where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.creditar_pontos_fidelidade() from public;
drop trigger if exists creditar_pontos_fidelidade on public.agendamentos;
create trigger creditar_pontos_fidelidade
after update of status on public.agendamentos
for each row execute function public.creditar_pontos_fidelidade();

commit;
