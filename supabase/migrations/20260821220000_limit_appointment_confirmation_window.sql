-- A customer confirms the appointment shortly before it happens, not immediately after booking.
create or replace function public.confirmar_meu_agendamento(p_agendamento_id bigint)
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
  set status = 'confirmado'
  where a.id = p_agendamento_id
    and a.status = 'agendado'
    and a.data + a.horario between v_agora and v_agora + interval '24 hours'
    and exists (
      select 1
      from public.clientes c
      where c.id = a.cliente_id and c.usuario_id = auth.uid()
    );

  if not found then
    raise exception 'A confirmação fica disponível somente nas 24 horas anteriores ao horário marcado';
  end if;
end;
$$;

revoke all on function public.confirmar_meu_agendamento(bigint) from public;
grant execute on function public.confirmar_meu_agendamento(bigint) to authenticated;
