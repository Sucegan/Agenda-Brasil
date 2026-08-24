-- Fix short-service availability and prevent incomplete Pix/deposit settings.

begin;

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
      interval '15 minutes'
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
  v_pix_chave text := nullif(trim(coalesce(p_pix_chave, '')), '');
  v_pix_beneficiario text := nullif(trim(coalesce(p_pix_beneficiario, '')), '');
begin
  if not exists (select 1 from public.barbeiros where usuario_id = auth.uid()) then
    raise exception 'Apenas profissionais podem alterar estas configurações';
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 80 then
    raise exception 'Identificador do link inválido';
  end if;
  if p_cancelamento_horas is null or p_cancelamento_horas not between 0 and 168 then
    raise exception 'Prazo de cancelamento inválido';
  end if;
  if p_sinal_percentual is null or p_sinal_percentual not between 0 and 100 then
    raise exception 'Percentual do sinal inválido';
  end if;
  if p_sinal_percentual > 0 and (v_pix_chave is null or v_pix_beneficiario is null) then
    raise exception 'Informe a chave e o beneficiário Pix para cobrar sinal';
  end if;
  if p_bloquear_apos_faltas is null or p_bloquear_apos_faltas not between 0 and 20
     or p_dias_bloqueio is null or p_dias_bloqueio not between 1 and 365 then
    raise exception 'Regras de bloqueio por faltas inválidas';
  end if;

  update public.configuracoes_negocio
  set slug = v_slug,
      agendamento_publico = coalesce(p_agendamento_publico, false),
      cancelamento_horas = p_cancelamento_horas,
      sinal_percentual = p_sinal_percentual,
      pix_chave = v_pix_chave,
      pix_beneficiario = v_pix_beneficiario,
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

revoke all on function public.buscar_horarios_disponiveis(bigint, bigint, date) from public;
grant execute on function public.buscar_horarios_disponiveis(bigint, bigint, date) to anon, authenticated;
revoke all on function public.atualizar_configuracoes_avancadas(text, boolean, smallint, numeric, text, text, boolean, boolean, boolean, smallint, smallint) from public;
grant execute on function public.atualizar_configuracoes_avancadas(text, boolean, smallint, numeric, text, text, boolean, boolean, boolean, smallint, smallint) to authenticated;

commit;
