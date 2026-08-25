-- Administrators can decide whether a new business is immediately visible in
-- public discovery. Keeping the argument optional preserves existing clients.
drop function if exists public.criar_barbearia(text, text);

create function public.criar_barbearia(
  p_nome text,
  p_slug text,
  p_publicar boolean default true
)
returns public.barbearias
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.usuarios;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_result public.barbearias;
begin
  select * into v_perfil
  from public.usuarios
  where id = (select auth.uid()) and tipo = 'admin';

  if not found then
    raise exception 'Apenas administradores podem criar barbearias';
  end if;

  if (select count(*) from public.barbearias x where x.proprietario_id = v_perfil.id and x.ativa) >= 20 then
    raise exception 'Limite de barbearias atingido';
  end if;

  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then
    raise exception 'Nome inválido';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 80 then
    raise exception 'Identificador inválido';
  end if;

  if exists (select 1 from public.barbearias x where x.slug = v_slug) then
    raise exception 'Este identificador já está em uso';
  end if;

  insert into public.barbearias (
    proprietario_id,
    nome,
    slug,
    telefone,
    responsavel_legal,
    agendamento_publico
  ) values (
    v_perfil.id,
    trim(p_nome),
    v_slug,
    v_perfil.telefone,
    v_perfil.nome,
    coalesce(p_publicar, true)
  )
  returning * into v_result;

  insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id)
  values (v_perfil.nome, v_perfil.telefone, v_perfil.id, v_result.id);

  return v_result;
end;
$$;

revoke all on function public.criar_barbearia(text, text, boolean) from public;
grant execute on function public.criar_barbearia(text, text, boolean) to authenticated;
