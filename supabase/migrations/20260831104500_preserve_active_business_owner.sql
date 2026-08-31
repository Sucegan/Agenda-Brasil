begin;

create or replace function public.alterar_status_profissional(
  p_barbeiro_id bigint,
  p_ativo boolean
)
returns public.barbeiros
language plpgsql security definer set search_path = ''
as $$
declare
  v_barbeiro public.barbeiros;
  v_resultado public.barbeiros;
begin
  select * into v_barbeiro
  from public.barbeiros
  where id = p_barbeiro_id
  for update;

  if not found or not public.eh_proprietario_barbearia(v_barbeiro.barbearia_id) then
    raise exception 'Profissional não encontrado ou acesso não autorizado' using errcode = '42501';
  end if;
  if not p_ativo and v_barbeiro.funcao = 'proprietario' then
    raise exception 'Transfira a propriedade da unidade antes de desativar este profissional';
  end if;
  if not p_ativo and exists (
    select 1
    from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.data >= timezone('America/Sao_Paulo', now())::date
      and a.status not in ('cancelado', 'concluido', 'nao_compareceu')
  ) then
    raise exception 'Reagende ou cancele os próximos horários antes de desativar o profissional';
  end if;

  update public.barbeiros
  set ativo = p_ativo,
      updated_at = now()
  where id = p_barbeiro_id
  returning * into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.alterar_status_profissional(bigint, boolean)
  from public, anon, authenticated;
grant execute on function public.alterar_status_profissional(bigint, boolean)
  to authenticated;

commit;
