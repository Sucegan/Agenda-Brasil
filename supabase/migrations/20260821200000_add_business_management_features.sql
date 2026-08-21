-- Customer experience and day-to-day business management.

alter table public.agendamentos drop constraint if exists agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check
  check (status in ('agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu'));

create table if not exists public.configuracoes_negocio (
  id boolean primary key default true check (id),
  nome varchar not null default 'Agenda Brasil' check (char_length(trim(nome)) between 2 and 120),
  endereco varchar,
  telefone varchar,
  logo_url text,
  updated_at timestamptz not null default now()
);

insert into public.configuracoes_negocio (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.feriados_negocio (
  data date primary key,
  descricao varchar not null check (char_length(trim(descricao)) between 2 and 120),
  criado_por uuid not null references public.usuarios(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.bloqueios_agenda (
  id bigint generated always as identity primary key,
  barbeiro_id bigint not null references public.barbeiros(id) on delete cascade,
  data_inicio date not null,
  data_fim date not null,
  hora_inicio time,
  hora_fim time,
  tipo varchar not null default 'pausa' check (tipo in ('pausa', 'folga', 'ferias')),
  motivo varchar not null default 'Indisponível' check (char_length(trim(motivo)) between 2 and 120),
  created_at timestamptz not null default now(),
  check (data_fim >= data_inicio),
  check (
    (hora_inicio is null and hora_fim is null)
    or (hora_inicio is not null and hora_fim is not null and hora_fim > hora_inicio)
  )
);

create index if not exists bloqueios_agenda_barbeiro_data_idx
  on public.bloqueios_agenda (barbeiro_id, data_inicio, data_fim);

alter table public.configuracoes_negocio enable row level security;
alter table public.feriados_negocio enable row level security;
alter table public.bloqueios_agenda enable row level security;

drop policy if exists "configuracoes visiveis" on public.configuracoes_negocio;
create policy "configuracoes visiveis" on public.configuracoes_negocio
  for select to authenticated using (true);

drop policy if exists "barbeiro atualiza configuracoes" on public.configuracoes_negocio;
create policy "barbeiro atualiza configuracoes" on public.configuracoes_negocio
  for update to authenticated
  using (exists (select 1 from public.barbeiros b where b.usuario_id = auth.uid()))
  with check (exists (select 1 from public.barbeiros b where b.usuario_id = auth.uid()));

drop policy if exists "feriados visiveis" on public.feriados_negocio;
create policy "feriados visiveis" on public.feriados_negocio
  for select to authenticated using (true);

drop policy if exists "barbeiro gerencia feriados" on public.feriados_negocio;
create policy "barbeiro gerencia feriados" on public.feriados_negocio
  for all to authenticated
  using (exists (select 1 from public.barbeiros b where b.usuario_id = auth.uid()))
  with check (
    criado_por = auth.uid()
    and exists (select 1 from public.barbeiros b where b.usuario_id = auth.uid())
  );

drop policy if exists "barbeiro ve proprios bloqueios" on public.bloqueios_agenda;
create policy "barbeiro ve proprios bloqueios" on public.bloqueios_agenda
  for select to authenticated
  using (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));

drop policy if exists "barbeiro gerencia proprios bloqueios" on public.bloqueios_agenda;
create policy "barbeiro gerencia proprios bloqueios" on public.bloqueios_agenda
  for all to authenticated
  using (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()))
  with check (exists (select 1 from public.barbeiros b where b.id = barbeiro_id and b.usuario_id = auth.uid()));

create or replace function public.atualizar_meu_perfil(p_nome text, p_telefone text)
returns public.usuarios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario public.usuarios;
  v_nome text := trim(coalesce(p_nome, ''));
  v_telefone text := nullif(trim(coalesce(p_telefone, '')), '');
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if char_length(v_nome) not between 2 and 120 then raise exception 'Informe um nome com pelo menos 2 caracteres'; end if;

  update public.usuarios
  set nome = v_nome, telefone = v_telefone
  where id = auth.uid()
  returning * into v_usuario;
  if not found then raise exception 'Perfil não encontrado'; end if;

  if v_usuario.tipo = 'cliente' then
    if v_telefone is null then raise exception 'Telefone é obrigatório para clientes'; end if;
    update public.clientes set nome = v_nome, telefone = v_telefone where usuario_id = auth.uid();
  else
    update public.barbeiros set nome = v_nome, telefone = v_telefone where usuario_id = auth.uid();
  end if;

  return v_usuario;
end;
$$;

create or replace function public.confirmar_meu_agendamento(p_agendamento_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  update public.agendamentos a
  set status = 'confirmado'
  where a.id = p_agendamento_id
    and a.status = 'agendado'
    and a.data >= v_hoje
    and exists (select 1 from public.clientes c where c.id = a.cliente_id and c.usuario_id = auth.uid());
  if not found then raise exception 'Agendamento não pode ser confirmado'; end if;
end;
$$;

create or replace function public.criar_bloqueio_agenda(
  p_data_inicio date,
  p_data_fim date,
  p_hora_inicio time,
  p_hora_fim time,
  p_tipo text,
  p_motivo text
)
returns public.bloqueios_agenda
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barbeiro_id bigint;
  v_bloqueio public.bloqueios_agenda;
  v_tipo text := coalesce(p_tipo, 'pausa');
  v_motivo text := trim(coalesce(p_motivo, 'Indisponível'));
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  select id into v_barbeiro_id from public.barbeiros where usuario_id = auth.uid();
  if v_barbeiro_id is null then raise exception 'Apenas profissionais podem bloquear a agenda'; end if;
  if p_data_inicio is null or p_data_fim is null or p_data_fim < p_data_inicio then raise exception 'Informe um período válido'; end if;
  if v_tipo not in ('pausa', 'folga', 'ferias') then raise exception 'Tipo de bloqueio inválido'; end if;
  if char_length(v_motivo) not between 2 and 120 then raise exception 'Informe um motivo entre 2 e 120 caracteres'; end if;
  if (p_hora_inicio is null) <> (p_hora_fim is null) or (p_hora_inicio is not null and p_hora_fim <= p_hora_inicio) then
    raise exception 'Informe início e fim válidos para a pausa';
  end if;

  if exists (
    select 1 from public.agendamentos a
    where a.barbeiro_id = v_barbeiro_id
      and a.data between p_data_inicio and p_data_fim
      and a.status not in ('cancelado', 'nao_compareceu')
      and (
        p_hora_inicio is null
        or (a.horario < p_hora_fim and a.horario + make_interval(mins => a.servico_duracao) > p_hora_inicio)
      )
  ) then raise exception 'Há agendamentos ativos neste período. Cancele ou reagende-os antes de bloquear.'; end if;

  insert into public.bloqueios_agenda (barbeiro_id, data_inicio, data_fim, hora_inicio, hora_fim, tipo, motivo)
  values (v_barbeiro_id, p_data_inicio, p_data_fim, p_hora_inicio, p_hora_fim, v_tipo, v_motivo)
  returning * into v_bloqueio;
  return v_bloqueio;
end;
$$;

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
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
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
  if exists (select 1 from public.feriados_negocio where data = p_data) then raise exception 'A barbearia não abre neste feriado'; end if;

  select * into v_barbeiro from public.barbeiros where id = p_barbeiro_id;
  select * into v_servico from public.servicos where id = p_servico_id and barbeiro_id = p_barbeiro_id;
  if not found or v_barbeiro.id is null then raise exception 'Serviço não pertence ao profissional selecionado'; end if;
  if not extract(dow from p_data)::smallint = any(v_barbeiro.dias_trabalho) then raise exception 'O profissional não atende neste dia'; end if;
  if p_horario < v_barbeiro.horario_inicio or p_horario + make_interval(mins => v_servico.duracao) > v_barbeiro.horario_fim then
    raise exception 'Horário fora do expediente';
  end if;
  if exists (
    select 1 from public.bloqueios_agenda b
    where b.barbeiro_id = p_barbeiro_id
      and p_data between b.data_inicio and b.data_fim
      and (
        b.hora_inicio is null
        or (p_horario < b.hora_fim and p_horario + make_interval(mins => v_servico.duracao) > b.hora_inicio)
      )
  ) then raise exception 'Este horário está bloqueado pelo profissional'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_barbeiro_id::text || ':' || p_data::text, 0));
  if exists (
    select 1 from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.data = p_data
      and a.status not in ('cancelado', 'nao_compareceu')
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
  if p_status not in ('agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu') then raise exception 'Status inválido'; end if;
  update public.agendamentos a
  set status = p_status,
      cancelado_at = case when p_status = 'cancelado' then now() else null end
  where a.id = p_agendamento_id
    and exists (select 1 from public.barbeiros b where b.id = a.barbeiro_id and b.usuario_id = auth.uid());
  if not found then raise exception 'Agendamento não encontrado ou não autorizado'; end if;
end;
$$;

revoke all on function public.atualizar_meu_perfil(text, text) from public;
revoke all on function public.confirmar_meu_agendamento(bigint) from public;
revoke all on function public.criar_bloqueio_agenda(date, date, time, time, text, text) from public;
revoke all on function public.criar_agendamento(bigint, bigint, date, time) from public;
revoke all on function public.buscar_horarios_disponiveis(bigint, bigint, date) from public;
revoke all on function public.atualizar_status_agendamento(bigint, text) from public;
grant execute on function public.atualizar_meu_perfil(text, text) to authenticated;
grant execute on function public.confirmar_meu_agendamento(bigint) to authenticated;
grant execute on function public.criar_bloqueio_agenda(date, date, time, time, text, text) to authenticated;
grant execute on function public.criar_agendamento(bigint, bigint, date, time) to authenticated;
grant execute on function public.buscar_horarios_disponiveis(bigint, bigint, date) to authenticated;
grant execute on function public.atualizar_status_agendamento(bigint, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bloqueios_agenda') then
      alter publication supabase_realtime add table public.bloqueios_agenda;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feriados_negocio') then
      alter publication supabase_realtime add table public.feriados_negocio;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'configuracoes_negocio') then
      alter publication supabase_realtime add table public.configuracoes_negocio;
    end if;
  end if;
end;
$$;
