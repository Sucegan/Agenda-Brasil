-- Agenda Brasil: schema, authorization and scheduling rules.
create extension if not exists btree_gist;

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome varchar not null check (char_length(trim(nome)) >= 2),
  telefone varchar,
  tipo varchar not null check (tipo in ('cliente', 'barbeiro')),
  created_at timestamptz not null default now()
);
create table if not exists public.barbeiros (
  id bigint generated always as identity primary key, nome varchar not null, telefone varchar,
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  horario_inicio time not null default '08:00', horario_fim time not null default '18:00',
  dias_trabalho smallint[] not null default array[1,2,3,4,5,6],
  check (horario_fim > horario_inicio), check (dias_trabalho <@ array[0,1,2,3,4,5,6])
);
create table if not exists public.clientes (
  id bigint generated always as identity primary key, nome varchar not null, telefone varchar not null, email varchar,
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade
);
create table if not exists public.servicos (
  id bigint generated always as identity primary key, nome varchar not null check (char_length(trim(nome)) >= 2),
  preco numeric(10,2) not null check (preco > 0), duracao integer not null check (duracao between 5 and 480),
  barbeiro_id bigint not null references public.barbeiros(id) on delete cascade
);
create table if not exists public.agendamentos (
  id bigint generated always as identity primary key, data date not null, horario time not null,
  status varchar not null default 'agendado' check (status in ('agendado', 'confirmado', 'concluido', 'cancelado')),
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  barbeiro_id bigint not null references public.barbeiros(id) on delete cascade,
  servico_id bigint not null references public.servicos(id) on delete restrict, created_at timestamptz not null default now()
);
create index if not exists agendamentos_barbeiro_data_horario_idx on public.agendamentos (barbeiro_id, data, horario);
create index if not exists agendamentos_cliente_data_idx on public.agendamentos (cliente_id, data);

-- Profiles are created once, atomically, after Supabase Auth creates a user.
create or replace function public.criar_perfil_usuario() returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo text := coalesce(new.raw_user_meta_data ->> 'tipo', ''); v_nome text := trim(coalesce(new.raw_user_meta_data ->> 'nome', '')); v_telefone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'telefone', '')), '');
begin
  if v_tipo not in ('cliente', 'barbeiro') or char_length(v_nome) < 2 then raise exception 'Dados de cadastro inválidos'; end if;
  if v_tipo = 'cliente' and v_telefone is null then raise exception 'Telefone é obrigatório para clientes'; end if;
  insert into public.usuarios (id, nome, telefone, tipo) values (new.id, v_nome, v_telefone, v_tipo);
  if v_tipo = 'cliente' then insert into public.clientes (nome, telefone, email, usuario_id) values (v_nome, v_telefone, new.email, new.id);
  else insert into public.barbeiros (nome, telefone, usuario_id) values (v_nome, v_telefone, new.id); end if;
  return new;
end; $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.criar_perfil_usuario();

-- Browser inputs cannot bypass booking or authorization rules.
create or replace function public.criar_agendamento(p_barbeiro_id bigint, p_servico_id bigint, p_data date, p_horario time) returns public.agendamentos language plpgsql security definer set search_path = public as $$
declare v_cliente_id bigint; v_duracao integer; v_inicio time; v_fim time; v_dias smallint[]; v_resultado public.agendamentos;
begin
  select id into v_cliente_id from public.clientes where usuario_id = auth.uid(); if v_cliente_id is null then raise exception 'Apenas clientes podem agendar'; end if;
  if p_data < current_date then raise exception 'Não é possível agendar em uma data passada'; end if;
  select s.duracao, b.horario_inicio, b.horario_fim, b.dias_trabalho into v_duracao, v_inicio, v_fim, v_dias from public.servicos s join public.barbeiros b on b.id = s.barbeiro_id where s.id = p_servico_id and s.barbeiro_id = p_barbeiro_id;
  if not found then raise exception 'Serviço não pertence ao barbeiro selecionado'; end if;
  if not extract(dow from p_data)::smallint = any(v_dias) then raise exception 'O barbeiro não atende neste dia'; end if;
  if p_horario < v_inicio or p_horario + make_interval(mins => v_duracao) > v_fim then raise exception 'Horário fora do expediente'; end if;
  perform pg_advisory_xact_lock(p_barbeiro_id, (p_data - date '2000-01-01')::integer);
  if exists (select 1 from public.agendamentos a join public.servicos s on s.id = a.servico_id where a.barbeiro_id = p_barbeiro_id and a.data = p_data and a.status <> 'cancelado' and p_horario < a.horario + make_interval(mins => s.duracao) and a.horario < p_horario + make_interval(mins => v_duracao)) then raise exception 'Este horário não está mais disponível'; end if;
  insert into public.agendamentos (cliente_id, barbeiro_id, servico_id, data, horario) values (v_cliente_id, p_barbeiro_id, p_servico_id, p_data, p_horario) returning * into v_resultado; return v_resultado;
end; $$;
create or replace function public.atualizar_status_agendamento(p_agendamento_id bigint, p_status text) returns void language plpgsql security definer set search_path = public as $$ begin
  if p_status not in ('agendado', 'confirmado', 'concluido', 'cancelado') then raise exception 'Status inválido'; end if;
  update public.agendamentos a set status = p_status where a.id = p_agendamento_id and exists (select 1 from public.barbeiros b where b.id = a.barbeiro_id and b.usuario_id = auth.uid()); if not found then raise exception 'Agendamento não encontrado ou não autorizado'; end if;
end; $$;
create or replace function public.cancelar_meu_agendamento(p_agendamento_id bigint) returns void language plpgsql security definer set search_path = public as $$ begin
  update public.agendamentos a set status = 'cancelado' where a.id = p_agendamento_id and a.data >= current_date and a.status in ('agendado', 'confirmado') and exists (select 1 from public.clientes c where c.id = a.cliente_id and c.usuario_id = auth.uid()); if not found then raise exception 'Agendamento não pode ser cancelado'; end if;
end; $$;

alter table public.usuarios enable row level security; alter table public.clientes enable row level security; alter table public.barbeiros enable row level security; alter table public.servicos enable row level security; alter table public.agendamentos enable row level security;
create policy "usuario ve proprio perfil" on public.usuarios for select to authenticated using (id = auth.uid());
create policy "cliente ve proprio perfil" on public.clientes for select to authenticated using (usuario_id = auth.uid());
create policy "barbeiros visiveis" on public.barbeiros for select to authenticated using (true);
create policy "barbeiro atualiza proprio expediente" on public.barbeiros for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "servicos visiveis" on public.servicos for select to authenticated using (true);
create policy "barbeiro cria servico" on public.servicos for insert to authenticated with check (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));
create policy "barbeiro altera servico" on public.servicos for update to authenticated using (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid())) with check (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));
create policy "barbeiro remove servico" on public.servicos for delete to authenticated using (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));
create policy "participantes veem agendamento" on public.agendamentos for select to authenticated using (exists (select 1 from public.clientes c where c.id = cliente_id and c.usuario_id = auth.uid()) or exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));
grant execute on function public.criar_agendamento(bigint, bigint, date, time) to authenticated; grant execute on function public.atualizar_status_agendamento(bigint, text) to authenticated; grant execute on function public.cancelar_meu_agendamento(bigint) to authenticated;
revoke all on function public.criar_perfil_usuario() from public;
revoke all on function public.criar_agendamento(bigint, bigint, date, time) from public;
revoke all on function public.atualizar_status_agendamento(bigint, text) from public;
revoke all on function public.cancelar_meu_agendamento(bigint) from public;
