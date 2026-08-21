-- Ensure only the current profile handler runs when Supabase Auth creates a user.
-- Older revisions of this project used different trigger names, which can leave
-- a legacy trigger active even after criar_perfil_usuario is updated.

create or replace function public.criar_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text := coalesce(new.raw_user_meta_data ->> 'tipo', '');
  v_nome text := trim(coalesce(new.raw_user_meta_data ->> 'nome', ''));
  v_telefone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'telefone', '')), '');
  v_convite text := nullif(new.raw_user_meta_data ->> 'convite_barbeiro', '');
begin
  if v_tipo not in ('cliente', 'barbeiro') or char_length(v_nome) not between 2 and 120 then
    raise exception 'Dados de cadastro inválidos';
  end if;

  if v_tipo = 'cliente' and v_telefone is null then
    raise exception 'Telefone é obrigatório para clientes';
  end if;

  if v_tipo = 'barbeiro' then
    update public.convites_barbeiro
    set usado_por = new.id, usado_em = now()
    where token = v_convite
      and usado_por is null
      and expira_em > now();

    if not found then
      raise exception 'Convite de barbeiro inválido ou expirado';
    end if;
  end if;

  insert into public.usuarios (id, nome, telefone, tipo)
  values (new.id, v_nome, v_telefone, v_tipo)
  on conflict (id) do update
    set nome = excluded.nome,
        telefone = excluded.telefone,
        tipo = excluded.tipo;

  if v_tipo = 'cliente' then
    insert into public.clientes (nome, telefone, email, usuario_id)
    values (v_nome, v_telefone, new.email, new.id)
    on conflict (usuario_id) do update
      set nome = excluded.nome,
          telefone = excluded.telefone,
          email = excluded.email;
  else
    insert into public.barbeiros (nome, telefone, usuario_id)
    values (v_nome, v_telefone, new.id)
    on conflict (usuario_id) do update
      set nome = excluded.nome,
          telefone = excluded.telefone;
  end if;

  return new;
end;
$$;

-- These are the legacy names used by earlier versions of the app. Removing
-- them is safe: both are custom triggers, not Supabase internal triggers.
drop trigger if exists ao_criar_usuario on auth.users;
drop trigger if exists on_auth_user_created on auth.users;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.criar_perfil_usuario();

revoke all on function public.criar_perfil_usuario() from public;
