-- Enforce the commercial professional limit at the database boundary. Counting
-- pending invitations prevents issuing more seats concurrently than the plan
-- allows, and the signup trigger rechecks the limit to close race conditions.

begin;

create or replace function public.validar_limite_profissionais_barbearia(p_barbearia_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_proprietario_id uuid;
  v_tipo text;
  v_limite integer;
  v_status text;
  v_trial_ends_at timestamptz;
  v_ocupados integer;
begin
  select x.proprietario_id, u.tipo into v_proprietario_id, v_tipo
  from public.barbearias x
  join public.usuarios u on u.id = x.proprietario_id
  where x.id = p_barbearia_id and x.ativa;
  if not found then raise exception 'Estabelecimento indisponível'; end if;

  if v_tipo = 'admin' then return; end if;

  select p.max_profissionais, a.status, a.trial_ends_at
  into v_limite, v_status, v_trial_ends_at
  from public.assinaturas_plataforma a
  join public.planos_plataforma p on p.id = a.plano_id and p.ativo
  where a.usuario_id = v_proprietario_id;
  if not found then raise exception 'Assinatura da plataforma não encontrada'; end if;
  if v_status not in ('trialing', 'active', 'exempt')
     or (v_status = 'trialing' and coalesce(v_trial_ends_at, now()) <= now()) then
    raise exception 'Regularize a assinatura para adicionar profissionais';
  end if;

  select
    (select count(*) from public.barbeiros b
      join public.barbearias x on x.id = b.barbearia_id
      where x.proprietario_id = v_proprietario_id and x.ativa and b.ativo)
    +
    (select count(*) from public.convites_barbeiro c
      join public.barbearias x on x.id = c.barbearia_id
      where x.proprietario_id = v_proprietario_id and x.ativa
        and c.usado_por is null and c.expira_em > now())
  into v_ocupados;

  if v_ocupados >= v_limite then
    raise exception 'Seu plano permite até % profissional(is)', v_limite;
  end if;
end;
$$;

create or replace function public.criar_convite_barbeiro(p_barbearia_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.eh_admin_barbearia(p_barbearia_id) then
    raise exception 'Apenas administradores do estabelecimento podem criar convites' using errcode = '42501';
  end if;
  perform public.validar_limite_profissionais_barbearia(p_barbearia_id);
  insert into public.convites_barbeiro (token, criado_por, barbearia_id)
  values (v_token, (select auth.uid()), p_barbearia_id);
  return v_token;
end;
$$;

create or replace function public.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_tipo text := coalesce(new.raw_user_meta_data ->> 'tipo', '');
  v_nome text := trim(coalesce(new.raw_user_meta_data ->> 'nome', ''));
  v_telefone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'telefone', '')), '');
  v_convite text := nullif(new.raw_user_meta_data ->> 'convite_barbeiro', '');
  v_termos boolean := coalesce((new.raw_user_meta_data ->> 'termos_aceitos')::boolean, false);
  v_barbearia_id uuid;
begin
  if v_tipo not in ('cliente', 'barbeiro', 'proprietario') or char_length(v_nome) not between 2 and 120 then
    raise exception 'Dados de cadastro inválidos';
  end if;
  if not v_termos then raise exception 'É necessário aceitar os termos de uso'; end if;
  if v_telefone is null then raise exception 'Telefone é obrigatório'; end if;

  if v_tipo = 'barbeiro' then
    update public.convites_barbeiro
    set usado_por = new.id, usado_em = now()
    where token = v_convite and usado_por is null and expira_em > now()
    returning barbearia_id into v_barbearia_id;
    if not found then raise exception 'Convite de barbeiro inválido ou expirado'; end if;
    perform public.validar_limite_profissionais_barbearia(v_barbearia_id);
  end if;

  insert into public.usuarios (id, nome, telefone, tipo, termos_aceitos_em)
  values (new.id, v_nome, v_telefone, v_tipo, now())
  on conflict (id) do update set
    nome = excluded.nome,
    telefone = excluded.telefone,
    tipo = excluded.tipo,
    termos_aceitos_em = coalesce(public.usuarios.termos_aceitos_em, excluded.termos_aceitos_em);

  if v_tipo = 'cliente' then
    insert into public.clientes (nome, telefone, email, usuario_id)
    values (v_nome, v_telefone, new.email, new.id)
    on conflict (usuario_id) do update set
      nome = excluded.nome, telefone = excluded.telefone, email = excluded.email;
  elsif v_tipo = 'barbeiro' then
    insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id)
    values (v_nome, v_telefone, new.id, v_barbearia_id);
  end if;
  return new;
end;
$$;

revoke all on function public.validar_limite_profissionais_barbearia(uuid) from public, anon, authenticated;
revoke all on function public.criar_convite_barbeiro(uuid) from public, anon, authenticated;
revoke all on function public.criar_perfil_usuario() from public, anon, authenticated;
grant execute on function public.criar_convite_barbeiro(uuid) to authenticated;

commit;
