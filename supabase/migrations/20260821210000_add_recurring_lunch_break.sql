-- A recurring lunch break belongs to a professional's normal work schedule.
alter table public.barbeiros add column if not exists horario_almoco_inicio time;
alter table public.barbeiros add column if not exists horario_almoco_fim time;
alter table public.barbeiros drop constraint if exists barbeiros_horario_almoco_check;
alter table public.barbeiros add constraint barbeiros_horario_almoco_check check (
  (horario_almoco_inicio is null and horario_almoco_fim is null)
  or (
    horario_almoco_inicio is not null
    and horario_almoco_fim is not null
    and horario_almoco_fim > horario_almoco_inicio
    and horario_almoco_inicio > horario_inicio
    and horario_almoco_fim < horario_fim
  )
);

create or replace function public.validar_intervalo_almoco_barbeiro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.horario_almoco_inicio is not distinct from old.horario_almoco_inicio
    and new.horario_almoco_fim is not distinct from old.horario_almoco_fim then
    return new;
  end if;

  if new.horario_almoco_inicio is null then
    return new;
  end if;

  if exists (
    select 1
    from public.agendamentos a
    where a.barbeiro_id = new.id
      and a.data >= timezone('America/Sao_Paulo', now())::date
      and a.status not in ('cancelado', 'nao_compareceu')
      and a.horario < new.horario_almoco_fim
      and a.horario + make_interval(mins => coalesce(a.servico_duracao, 0)) > new.horario_almoco_inicio
  ) then
    raise exception 'Há agendamentos futuros que coincidem com esse intervalo de almoço. Reagende ou cancele-os antes.';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_intervalo_almoco_barbeiro on public.barbeiros;
create trigger validar_intervalo_almoco_barbeiro
before insert or update on public.barbeiros
for each row execute function public.validar_intervalo_almoco_barbeiro();

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
  if p_data < v_hoje or (p_data = v_hoje and p_horario <= v_agora) then raise exception 'Não é possível agendar em um horário passado'; end if;
  if exists (select 1 from public.feriados_negocio where data = p_data) then raise exception 'A barbearia não abre neste feriado'; end if;

  select * into v_barbeiro from public.barbeiros where id = p_barbeiro_id;
  select * into v_servico from public.servicos where id = p_servico_id and barbeiro_id = p_barbeiro_id;
  if not found or v_barbeiro.id is null then raise exception 'Serviço não pertence ao profissional selecionado'; end if;
  if not extract(dow from p_data)::smallint = any(v_barbeiro.dias_trabalho) then raise exception 'O profissional não atende neste dia'; end if;
  if p_horario < v_barbeiro.horario_inicio or p_horario + make_interval(mins => v_servico.duracao) > v_barbeiro.horario_fim then raise exception 'Horário fora do expediente'; end if;
  if v_barbeiro.horario_almoco_inicio is not null and p_horario < v_barbeiro.horario_almoco_fim and p_horario + make_interval(mins => v_servico.duracao) > v_barbeiro.horario_almoco_inicio then
    raise exception 'Este horário coincide com o intervalo de almoço';
  end if;
  if exists (
    select 1 from public.bloqueios_agenda b
    where b.barbeiro_id = p_barbeiro_id
      and p_data between b.data_inicio and b.data_fim
      and (b.hora_inicio is null or (p_horario < b.hora_fim and p_horario + make_interval(mins => v_servico.duracao) > b.hora_inicio))
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

revoke all on function public.criar_agendamento(bigint, bigint, date, time) from public;
revoke all on function public.buscar_horarios_disponiveis(bigint, bigint, date) from public;
grant execute on function public.criar_agendamento(bigint, bigint, date, time) to authenticated;
grant execute on function public.buscar_horarios_disponiveis(bigint, bigint, date) to authenticated;
