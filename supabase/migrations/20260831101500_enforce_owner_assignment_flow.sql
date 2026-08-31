begin;

-- Ownership is an operational relationship between a business and one active
-- professional. It must be changed through definir_proprietario_barbearia so
-- usuarios.tipo, barbeiros.funcao and barbearias.proprietario_id never drift.
create or replace function public.admin_atualizar_tipo_usuario(
  p_usuario_id uuid,
  p_tipo text
)
returns public.usuarios
language plpgsql security definer set search_path = ''
as $$
declare
  v_anterior public.usuarios;
  v_resultado public.usuarios;
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;
  if p_tipo not in ('cliente', 'barbeiro', 'admin') then
    raise exception 'Defina o proprietário pela equipe da barbearia';
  end if;

  select * into v_anterior
  from public.usuarios
  where id = p_usuario_id
  for update;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if v_anterior.tipo = 'proprietario' then
    raise exception 'Transfira a propriedade pela equipe da barbearia antes de alterar este perfil';
  end if;
  if p_usuario_id = (select auth.uid()) and p_tipo <> 'admin' then
    raise exception 'Você não pode remover o próprio acesso administrativo';
  end if;
  if p_tipo = 'barbeiro' and not exists (
    select 1 from public.barbeiros b
    where b.usuario_id = p_usuario_id and b.ativo
  ) then
    raise exception 'Profissionais entram por convite do proprietário';
  end if;
  if p_tipo = 'cliente' and exists (
    select 1 from public.barbeiros b
    where b.usuario_id = p_usuario_id and b.ativo
  ) then
    raise exception 'Desative o vínculo profissional antes de transformar esta conta em cliente';
  end if;

  -- A global administrator is never part of the operational team. Historical
  -- appointments keep their barber row, but it becomes inactive and hidden.
  if p_tipo = 'admin' then
    update public.barbeiros
    set ativo = false,
        funcao = 'funcionario',
        updated_at = now()
    where usuario_id = p_usuario_id and ativo;
  end if;

  update public.usuarios
  set tipo = p_tipo
  where id = p_usuario_id
  returning * into v_resultado;

  insert into public.admin_audit_logs (admin_id, acao, entidade, entidade_id, detalhes)
  values ((select auth.uid()), 'alterar_perfil', 'usuario', p_usuario_id::text,
    jsonb_build_object('tipo_anterior', v_anterior.tipo, 'tipo_atual', p_tipo));

  return v_resultado;
end;
$$;

revoke all on function public.admin_atualizar_tipo_usuario(uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_atualizar_tipo_usuario(uuid, text)
  to authenticated;

commit;
