-- Security, scheduling and invitation hardening for the hosted project.

-- Earlier versions stored times as text. Normalize them before recreating the
-- scheduling functions so comparisons and returned slots remain reliable.
alter table public.barbeiros alter column horario_inicio drop default;
alter table public.barbeiros alter column horario_inicio type time using horario_inicio::time;
alter table public.barbeiros alter column horario_inicio set default '08:00'::time;
alter table public.barbeiros alter column horario_fim drop default;
alter table public.barbeiros alter column horario_fim type time using horario_fim::time;
alter table public.barbeiros alter column horario_fim set default '18:00'::time;
alter table public.barbeiros alter column dias_trabalho drop default;
alter table public.barbeiros alter column dias_trabalho type smallint[] using (
  case
    when dias_trabalho is null or btrim(dias_trabalho::text) = '' then array[1, 2, 3, 4, 5, 6]::smallint[]
    when btrim(dias_trabalho::text) like '{%' then dias_trabalho::text::smallint[]
    else regexp_split_to_array(regexp_replace(dias_trabalho::text, '[^0-9,]', '', 'g'), ',')::smallint[]
  end
);
alter table public.barbeiros alter column dias_trabalho set default array[1, 2, 3, 4, 5, 6]::smallint[];
alter table public.agendamentos alter column horario type time using horario::time;
alter table public.servicos alter column duracao type integer using duracao::integer;
alter table public.servicos alter column preco type numeric(10, 2) using (
  case
    when preco::text like '%,%' then replace(regexp_replace(preco::text, '[^0-9,]', '', 'g'), ',', '.')::numeric(10, 2)
    else regexp_replace(preco::text, '[^0-9.]', '', 'g')::numeric(10, 2)
  end
);

alter table public.agendamentos add column if not exists servico_nome varchar;
alter table public.agendamentos add column if not exists servico_preco numeric(10, 2);
alter table public.agendamentos add column if not exists servico_duracao integer;
alter table public.agendamentos add column if not exists barbeiro_nome varchar;
alter table public.agendamentos add column if not exists cliente_nome varchar;
alter table public.agendamentos add column if not exists cliente_telefone varchar;
alter table public.agendamentos add column if not exists cancelado_at timestamptz;

update public.agendamentos a
set
  servico_nome = coalesce(a.servico_nome, s.nome),
  servico_preco = coalesce(a.servico_preco, s.preco),
  servico_duracao = coalesce(a.servico_duracao, s.duracao),
  barbeiro_nome = coalesce(a.barbeiro_nome, b.nome),
  cliente_nome = coalesce(a.cliente_nome, c.nome),
  cliente_telefone = coalesce(a.cliente_telefone, c.telefone)
from public.servicos s, public.barbeiros b, public.clientes c
where s.id = a.servico_id
  and b.id = a.barbeiro_id
  and c.id = a.cliente_id;

update public.agendamentos set status = 'concluido' where status = 'concluído';
alter table public.agendamentos drop constraint if exists agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check check (status in ('agendado', 'confirmado', 'concluido', 'cancelado'));
alter table public.agendamentos drop constraint if exists agendamentos_servico_duracao_check;
alter table public.agendamentos add constraint agendamentos_servico_duracao_check check (servico_duracao between 5 and 480);

create table if not exists public.convites_barbeiro (
  id bigint generated always as identity primary key,
  token text not null unique,
  criado_por uuid not null references public.usuarios(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_por uuid unique references auth.users(id) on delete set null,
  usado_em timestamptz,
  check (expira_em > criado_em)
);

create index if not exists convites_barbeiro_criado_por_idx on public.convites_barbeiro (criado_por, criado_em desc);

alter table public.convites_barbeiro enable row level security;
drop policy if exists "barbeiro ve os proprios convites" on public.convites_barbeiro;
create policy "barbeiro ve os proprios convites" on public.convites_barbeiro
  for select to authenticated using (criado_por = auth.uid());

create or replace function public.criar_convite_barbeiro()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null or not exists (
    select 1 from public.barbeiros where usuario_id = auth.uid()
  ) then
    raise exception 'Apenas barbeiros podem criar convites';
  end if;

  insert into public.convites_barbeiro (token, criado_por)
  values (v_token, auth.uid());

  return v_token;
end;
$$;

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
begin
  if v_tipo not in ('cliente', 'barbeiro') or char_length(v_nome) not between 2 and 120 then
    raise exception 'Dados de cadastro inválidos';
  end if;
  if v_tipo = 'cliente' and v_telefone is null then
    raise exception 'Telefone é obrigatório para clientes';
  end if;

  if v_tipo = 'barbeiro' then
    update public.convites_barbeiro
    set usado_por = new.id, usado_em = now()
    where token = v_convite
      and usado_por is null
      and expira_em > now();

    if not found then
      raise exception 'Convite de barbeiro inválido ou expirado';
    end if;
  end if;

  insert into public.usuarios (id, nome, telefone, tipo)
  values (new.id, v_nome, v_telefone, v_tipo);

  if v_tipo = 'cliente' then
    insert into public.clientes (nome, telefone, email, usuario_id)
    values (v_nome, v_telefone, new.email, new.id);
  else
    insert into public.barbeiros (nome, telefone, usuario_id)
    values (v_nome, v_telefone, new.id);
  end if;

  return new;
end;
$$;

create function public.listar_barbeiros_publicos()
returns table (id bigint, nome varchar, horario_inicio text, horario_fim text, dias_trabalho smallint[])
language sql
security definer
set search_path = ''
as $$
  select b.id, b.nome, b.horario_inicio::text, b.horario_fim::text, b.dias_trabalho
  from public.barbeiros b
  order by b.nome;
$$;

create function public.buscar_horarios_disponiveis(
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
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if p_data < v_hoje then raise exception 'Não é possível consultar uma data passada'; end if;

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
    and not exists (
      select 1 from public.agendamentos a
      where a.barbeiro_id = p_barbeiro_id
        and a.data = p_data
        and a.status <> 'cancelado'
        and slots.inicio < a.horario + make_interval(mins => a.servico_duracao)
        and a.horario < slots.inicio + make_interval(mins => v_servico.duracao)
    )
  order by slots.inicio;
end;
$$;

create or replace function public.criar_agendamento(
  p_barbeiro_id bigint,
  p_servico_id bigint,
  p_data date,
  p_horario time
)
returns public.agendamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente public.clientes;
  v_barbeiro public.barbeiros;
  v_servico public.servicos;
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
  v_agora time := timezone('America/Sao_Paulo', now())::time;
  v_resultado public.agendamentos;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  select * into v_cliente from public.clientes where usuario_id = auth.uid();
  if not found then raise exception 'Apenas clientes podem agendar'; end if;
  if p_data < v_hoje or (p_data = v_hoje and p_horario <= v_agora) then
    raise exception 'Não é possível agendar em um horário passado';
  end if;

  select * into v_barbeiro from public.barbeiros where id = p_barbeiro_id;
  select * into v_servico from public.servicos where id = p_servico_id and barbeiro_id = p_barbeiro_id;
  if not found or v_barbeiro.id is null then raise exception 'Serviço não pertence ao profissional selecionado'; end if;
  if not extract(dow from p_data)::smallint = any(v_barbeiro.dias_trabalho) then raise exception 'O profissional não atende neste dia'; end if;
  if p_horario < v_barbeiro.horario_inicio or p_horario + make_interval(mins => v_servico.duracao) > v_barbeiro.horario_fim then
    raise exception 'Horário fora do expediente';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_barbeiro_id::text || ':' || p_data::text, 0));
  if exists (
    select 1 from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.data = p_data
      and a.status <> 'cancelado'
      and p_horario < a.horario + make_interval(mins => a.servico_duracao)
      and a.horario < p_horario + make_interval(mins => v_servico.duracao)
  ) then raise exception 'Este horário não está mais disponível'; end if;

  insert into public.agendamentos (
    cliente_id, barbeiro_id, servico_id, data, horario,
    servico_nome, servico_preco, servico_duracao,
    barbeiro_nome, cliente_nome, cliente_telefone
  ) values (
    v_cliente.id, v_barbeiro.id, v_servico.id, p_data, p_horario,
    v_servico.nome, v_servico.preco, v_servico.duracao,
    v_barbeiro.nome, v_cliente.nome, v_cliente.telefone
  ) returning * into v_resultado;

  return v_resultado;
end;
$$;

create or replace function public.atualizar_status_agendamento(p_agendamento_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if p_status not in ('agendado', 'confirmado', 'concluido', 'cancelado') then raise exception 'Status inválido'; end if;

  update public.agendamentos a
  set status = p_status, cancelado_at = case when p_status = 'cancelado' then now() else null end
  where a.id = p_agendamento_id
    and exists (select 1 from public.barbeiros b where b.id = a.barbeiro_id and b.usuario_id = auth.uid());
  if not found then raise exception 'Agendamento não encontrado ou não autorizado'; end if;
end;
$$;

create or replace function public.cancelar_meu_agendamento(p_agendamento_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agora timestamp := timezone('America/Sao_Paulo', now());
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  update public.agendamentos a
  set status = 'cancelado', cancelado_at = now()
  where a.id = p_agendamento_id
    and a.status in ('agendado', 'confirmado')
    and a.data + a.horario > v_agora
    and exists (select 1 from public.clientes c where c.id = a.cliente_id and c.usuario_id = auth.uid());
  if not found then raise exception 'Agendamento não pode ser cancelado'; end if;
end;
$$;

drop policy if exists "barbeiros visiveis" on public.barbeiros;

revoke all on function public.criar_perfil_usuario() from public;
revoke all on function public.criar_convite_barbeiro() from public;
revoke all on function public.criar_agendamento(bigint, bigint, date, time) from public;
revoke all on function public.buscar_horarios_disponiveis(bigint, bigint, date) from public;
revoke all on function public.listar_barbeiros_publicos() from public;
revoke all on function public.atualizar_status_agendamento(bigint, text) from public;
revoke all on function public.cancelar_meu_agendamento(bigint) from public;
grant execute on function public.criar_convite_barbeiro() to authenticated;
grant execute on function public.criar_agendamento(bigint, bigint, date, time) to authenticated;
grant execute on function public.buscar_horarios_disponiveis(bigint, bigint, date) to authenticated;
grant execute on function public.listar_barbeiros_publicos() to authenticated;
grant execute on function public.atualizar_status_agendamento(bigint, text) to authenticated;
grant execute on function public.cancelar_meu_agendamento(bigint) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agendamentos') then
      alter publication supabase_realtime add table public.agendamentos;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'servicos') then
      alter publication supabase_realtime add table public.servicos;
    end if;
  end if;
end;
$$;
