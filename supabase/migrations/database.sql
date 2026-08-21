-- Agenda Brasil: schema, authorization and scheduling rules.
-- This file follows the Supabase CLI migration convention. The older nested
-- migration is retained only as repository history and is not used by the CLI.

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome varchar not null check (char_length(trim(nome)) between 2 and 120),
  telefone varchar,
  tipo varchar not null check (tipo in ('cliente', 'barbeiro')),
  created_at timestamptz not null default now()
);

create table if not exists public.barbeiros (
  id bigint generated always as identity primary key,
  nome varchar not null check (char_length(trim(nome)) between 2 and 120),
  telefone varchar,
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  horario_inicio time not null default '08:00',
  horario_fim time not null default '18:00',
  dias_trabalho smallint[] not null default array[1, 2, 3, 4, 5, 6],
  check (horario_fim > horario_inicio),
  check (dias_trabalho <@ array[0, 1, 2, 3, 4, 5, 6])
);

create table if not exists public.clientes (
  id bigint generated always as identity primary key,
  nome varchar not null check (char_length(trim(nome)) between 2 and 120),
  telefone varchar not null,
  email varchar,
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade
);

create table if not exists public.servicos (
  id bigint generated always as identity primary key,
  nome varchar not null check (char_length(trim(nome)) between 2 and 120),
  preco numeric(10, 2) not null check (preco > 0),
  duracao integer not null check (duracao between 5 and 480),
  barbeiro_id bigint not null references public.barbeiros(id) on delete cascade
);

create table if not exists public.agendamentos (
  id bigint generated always as identity primary key,
  data date not null,
  horario time not null,
  status varchar not null default 'agendado',
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  barbeiro_id bigint not null references public.barbeiros(id) on delete cascade,
  servico_id bigint not null references public.servicos(id) on delete restrict,
  servico_nome varchar,
  servico_preco numeric(10, 2),
  servico_duracao integer,
  barbeiro_nome varchar,
  cliente_nome varchar,
  cliente_telefone varchar,
  created_at timestamptz not null default now(),
  cancelado_at timestamptz
);

-- Allows this migration to repair a database originally created manually.
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
from public.servicos s
join public.barbeiros b on b.id = a.barbeiro_id
join public.clientes c on c.id = a.cliente_id
where s.id = a.servico_id;

update public.agendamentos set status = 'concluido' where status = 'concluído';
alter table public.agendamentos drop constraint if exists agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check check (status in ('agendado', 'confirmado', 'concluido', 'cancelado'));
alter table public.agendamentos alter column servico_nome set not null;
alter table public.agendamentos alter column servico_preco set not null;
alter table public.agendamentos alter column servico_duracao set not null;
alter table public.agendamentos alter column barbeiro_nome set not null;
alter table public.agendamentos alter column cliente_nome set not null;
alter table public.agendamentos alter column cliente_telefone set not null;
alter table public.agendamentos add constraint agendamentos_servico_duracao_check check (servico_duracao between 5 and 480) not valid;
alter table public.agendamentos validate constraint agendamentos_servico_duracao_check;

create index if not exists agendamentos_barbeiro_data_horario_idx on public.agendamentos (barbeiro_id, data, horario);
create index if not exists agendamentos_cliente_data_idx on public.agendamentos (cliente_id, data);

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
begin
  if v_tipo not in ('cliente', 'barbeiro') or char_length(v_nome) < 2 then
    raise exception 'Dados de cadastro inválidos';
  end if;
  if v_tipo = 'cliente' and v_telefone is null then
    raise exception 'Telefone é obrigatório para clientes';
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

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.criar_perfil_usuario();

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

  -- A single bigint key avoids the invalid bigint/integer overload combination.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_barbeiro_id::text || ':' || p_data::text, 0));

  if exists (
    select 1
    from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.data = p_data
      and a.status <> 'cancelado'
      and p_horario < a.horario + make_interval(mins => a.servico_duracao)
      and a.horario < p_horario + make_interval(mins => v_servico.duracao)
  ) then
    raise exception 'Este horário não está mais disponível';
  end if;

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

create or replace function public.listar_horarios_disponiveis(
  p_barbeiro_id bigint,
  p_servico_id bigint,
  p_data date
)
returns table (horario time)
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
  select slots.inicio
  from slots
  where (p_data > v_hoje or slots.inicio > v_agora)
    and not exists (
      select 1
      from public.agendamentos a
      where a.barbeiro_id = p_barbeiro_id
        and a.data = p_data
        and a.status <> 'cancelado'
        and slots.inicio < a.horario + make_interval(mins => a.servico_duracao)
        and a.horario < slots.inicio + make_interval(mins => v_servico.duracao)
    )
  order by slots.inicio;
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
  set status = p_status,
      cancelado_at = case when p_status = 'cancelado' then now() else null end
  where a.id = p_agendamento_id
    and exists (
      select 1 from public.barbeiros b
      where b.id = a.barbeiro_id and b.usuario_id = auth.uid()
    );

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
    and exists (
      select 1 from public.clientes c
      where c.id = a.cliente_id and c.usuario_id = auth.uid()
    );

  if not found then raise exception 'Agendamento não pode ser cancelado'; end if;
end;
$$;

create or replace function public.listar_barbeiros_disponiveis()
returns table (id bigint, nome varchar, horario_inicio time, horario_fim time, dias_trabalho smallint[])
language sql
security definer
set search_path = ''
as $$
  select b.id, b.nome, b.horario_inicio, b.horario_fim, b.dias_trabalho
  from public.barbeiros b
  order by b.nome;
$$;

alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.barbeiros enable row level security;
alter table public.servicos enable row level security;
alter table public.agendamentos enable row level security;

drop policy if exists "usuario ve proprio perfil" on public.usuarios;
drop policy if exists "cliente ve proprio perfil" on public.clientes;
drop policy if exists "barbeiros visiveis" on public.barbeiros;
drop policy if exists "barbeiro ve proprio perfil" on public.barbeiros;
drop policy if exists "barbeiro atualiza proprio expediente" on public.barbeiros;
drop policy if exists "servicos visiveis" on public.servicos;
drop policy if exists "barbeiro cria servico" on public.servicos;
drop policy if exists "barbeiro altera servico" on public.servicos;
drop policy if exists "barbeiro remove servico" on public.servicos;
drop policy if exists "participantes veem agendamento" on public.agendamentos;

create policy "usuario ve proprio perfil" on public.usuarios for select to authenticated using (id = auth.uid());
create policy "cliente ve proprio perfil" on public.clientes for select to authenticated using (usuario_id = auth.uid());
create policy "barbeiro ve proprio perfil" on public.barbeiros for select to authenticated using (usuario_id = auth.uid());
create policy "barbeiro atualiza proprio expediente" on public.barbeiros for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "servicos visiveis" on public.servicos for select to authenticated using (true);
create policy "barbeiro cria servico" on public.servicos for insert to authenticated with check (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));
create policy "barbeiro altera servico" on public.servicos for update to authenticated using (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid())) with check (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));
create policy "barbeiro remove servico" on public.servicos for delete to authenticated using (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));
create policy "participantes veem agendamento" on public.agendamentos for select to authenticated using (
  exists (select 1 from public.clientes c where c.id = cliente_id and c.usuario_id = auth.uid())
  or exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid())
);

grant usage on schema public to authenticated;
grant select on public.usuarios, public.clientes, public.barbeiros, public.servicos, public.agendamentos to authenticated;
grant update on public.barbeiros to authenticated;
grant insert, update, delete on public.servicos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on function public.criar_perfil_usuario() from public;
revoke all on function public.criar_agendamento(bigint, bigint, date, time) from public;
revoke all on function public.listar_horarios_disponiveis(bigint, bigint, date) from public;
revoke all on function public.atualizar_status_agendamento(bigint, text) from public;
revoke all on function public.cancelar_meu_agendamento(bigint) from public;
revoke all on function public.listar_barbeiros_disponiveis() from public;
grant execute on function public.criar_agendamento(bigint, bigint, date, time) to authenticated;
grant execute on function public.listar_horarios_disponiveis(bigint, bigint, date) to authenticated;
grant execute on function public.atualizar_status_agendamento(bigint, text) to authenticated;
grant execute on function public.cancelar_meu_agendamento(bigint) to authenticated;
grant execute on function public.listar_barbeiros_disponiveis() to authenticated;

-- Keep open dashboards in sync after bookings, cancellations, or status changes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agendamentos'
     ) then
    alter publication supabase_realtime add table public.agendamentos;
  end if;
end;
$$;
