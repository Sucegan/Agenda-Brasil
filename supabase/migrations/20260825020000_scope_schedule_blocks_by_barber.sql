-- A professional can belong to more than one barbershop. Require the selected
-- professional record so a schedule block never lands in another unit.

begin;

drop function if exists public.criar_bloqueio_agenda(date, date, time, time, text, text);

create function public.criar_bloqueio_agenda(
  p_barbeiro_id bigint,
  p_data_inicio date,
  p_data_fim date,
  p_hora_inicio time,
  p_hora_fim time,
  p_tipo text,
  p_motivo text
)
returns public.bloqueios_agenda
language plpgsql security definer set search_path = ''
as $$
declare
  v_bloqueio public.bloqueios_agenda;
  v_tipo text := coalesce(p_tipo, 'pausa');
  v_motivo text := trim(coalesce(p_motivo, 'Indisponível'));
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if not exists (
    select 1 from public.barbeiros b where b.id = p_barbeiro_id and b.usuario_id = auth.uid()
  ) then raise exception 'Profissional inválido ou não autorizado'; end if;
  if p_data_inicio is null or p_data_fim is null or p_data_fim < p_data_inicio then raise exception 'Informe um período válido'; end if;
  if v_tipo not in ('pausa', 'folga', 'ferias') then raise exception 'Tipo de bloqueio inválido'; end if;
  if char_length(v_motivo) not between 2 and 120 then raise exception 'Informe um motivo entre 2 e 120 caracteres'; end if;
  if (p_hora_inicio is null) <> (p_hora_fim is null) or (p_hora_inicio is not null and p_hora_fim <= p_hora_inicio) then
    raise exception 'Informe início e fim válidos para a pausa';
  end if;
  if exists (
    select 1 from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.data between p_data_inicio and p_data_fim
      and a.status not in ('cancelado', 'nao_compareceu')
      and (p_hora_inicio is null or (a.horario < p_hora_fim and a.horario + make_interval(mins => a.servico_duracao) > p_hora_inicio))
  ) then raise exception 'Há agendamentos ativos neste período. Cancele ou reagende-os antes de bloquear.'; end if;

  insert into public.bloqueios_agenda (barbeiro_id, data_inicio, data_fim, hora_inicio, hora_fim, tipo, motivo)
  values (p_barbeiro_id, p_data_inicio, p_data_fim, p_hora_inicio, p_hora_fim, v_tipo, v_motivo)
  returning * into v_bloqueio;
  return v_bloqueio;
end;
$$;

revoke all on function public.criar_bloqueio_agenda(bigint, date, date, time, time, text, text) from public;
grant execute on function public.criar_bloqueio_agenda(bigint, date, date, time, time, text, text) to authenticated;

commit;
