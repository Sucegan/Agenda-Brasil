-- New units stay private until the owner finishes their services, Pix and
-- public-link configuration.

begin;

create or replace function public.criar_barbearia(p_nome text, p_slug text)
returns public.barbearias
language plpgsql security definer set search_path = ''
as $$
declare
  v_perfil public.usuarios;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_result public.barbearias;
begin
  select * into v_perfil from public.usuarios where id = auth.uid() and tipo = 'barbeiro';
  if not found then raise exception 'Apenas contas profissionais podem criar barbearias'; end if;
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then raise exception 'Nome inválido'; end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 80 then raise exception 'Identificador inválido'; end if;

  insert into public.barbearias (proprietario_id, nome, slug, responsavel_legal, agendamento_publico)
  values (auth.uid(), trim(p_nome), v_slug, v_perfil.nome, false)
  returning * into v_result;
  insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id)
  values (v_perfil.nome, v_perfil.telefone, auth.uid(), v_result.id);
  return v_result;
exception when unique_violation then
  raise exception 'Este identificador já está em uso';
end;
$$;

revoke all on function public.criar_barbearia(text, text) from public;
grant execute on function public.criar_barbearia(text, text) to authenticated;

commit;
