begin;

-- Separate the platform administrator, the business owner and operational
-- professionals. Existing records are preserved so historical appointments
-- continue to resolve their professional and service snapshots.
alter table public.barbeiros
  add column if not exists funcao varchar(20) not null default 'funcionario',
  add column if not exists comissao_percentual numeric(5, 2) not null default 50,
  add column if not exists observacoes_gestao varchar(500),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.barbeiros'::regclass
      and conname = 'barbeiros_funcao_check'
  ) then
    alter table public.barbeiros add constraint barbeiros_funcao_check
      check (funcao in ('proprietario', 'funcionario'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.barbeiros'::regclass
      and conname = 'barbeiros_comissao_percentual_check'
  ) then
    alter table public.barbeiros add constraint barbeiros_comissao_percentual_check
      check (comissao_percentual between 0 and 100);
  end if;
end;
$$;

update public.barbeiros b
set ativo = false, funcao = 'funcionario', updated_at = now()
from public.usuarios u
where u.id = b.usuario_id and u.tipo = 'admin';

update public.barbeiros b
set funcao = 'proprietario', updated_at = now()
from public.barbearias x
join public.usuarios u on u.id = x.proprietario_id and u.tipo = 'proprietario'
where b.barbearia_id = x.id and b.usuario_id = x.proprietario_id;

create or replace function public.pode_editar_proprio_barbeiro(p_barbeiro_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.barbeiros b
    join public.usuarios u on u.id = (select auth.uid())
    where b.id = p_barbeiro_id
      and b.usuario_id = u.id
      and b.ativo
      and u.tipo in ('barbeiro', 'proprietario')
  );
$$;

revoke all on function public.pode_editar_proprio_barbeiro(bigint) from public, anon, authenticated;
grant execute on function public.pode_editar_proprio_barbeiro(bigint) to authenticated;

drop policy if exists barbeiros_update_own on public.barbeiros;
drop policy if exists barbeiros_update_role_scope on public.barbeiros;
create policy barbeiros_update_operational_scope on public.barbeiros
  for update to authenticated
  using ((select public.pode_gerenciar_barbeiro(id)))
  with check ((select public.pode_gerenciar_barbeiro(id)));

drop policy if exists servicos_insert_own on public.servicos;
drop policy if exists servicos_update_own on public.servicos;
drop policy if exists servicos_delete_own on public.servicos;
drop policy if exists servicos_insert_role_scope on public.servicos;
drop policy if exists servicos_update_role_scope on public.servicos;
drop policy if exists servicos_delete_role_scope on public.servicos;
create policy servicos_insert_own_operational on public.servicos
  for insert to authenticated
  with check ((select public.pode_editar_proprio_barbeiro(barbeiro_id)));
create policy servicos_update_own_operational on public.servicos
  for update to authenticated
  using ((select public.pode_editar_proprio_barbeiro(barbeiro_id)))
  with check ((select public.pode_editar_proprio_barbeiro(barbeiro_id)));
create policy servicos_delete_own_operational on public.servicos
  for delete to authenticated
  using ((select public.pode_editar_proprio_barbeiro(barbeiro_id)));

create or replace function public.listar_equipe_barbearia(p_barbearia_id uuid)
returns setof public.barbeiros
language sql stable security definer set search_path = ''
as $$
  select b.*
  from public.barbeiros b
  join public.usuarios member on member.id = b.usuario_id
  where b.barbearia_id = p_barbearia_id
    and member.tipo <> 'admin'
    and (
      public.eh_proprietario_barbearia(p_barbearia_id)
      or (b.usuario_id = (select auth.uid()) and b.ativo)
    )
  order by (b.funcao = 'proprietario') desc, b.ativo desc, b.nome;
$$;

create or replace function public.atualizar_dados_profissional(
  p_barbeiro_id bigint,
  p_nome text,
  p_telefone text,
  p_comissao_percentual numeric,
  p_observacoes text
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
  if exists (select 1 from public.usuarios u where u.id = v_barbeiro.usuario_id and u.tipo = 'admin') then
    raise exception 'O administrador da plataforma não é um profissional operacional' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then
    raise exception 'Informe um nome válido';
  end if;
  if p_comissao_percentual is null or p_comissao_percentual < 0 or p_comissao_percentual > 100 then
    raise exception 'A comissão deve estar entre 0 e 100%%';
  end if;

  update public.barbeiros
  set nome = trim(p_nome),
      telefone = nullif(trim(coalesce(p_telefone, '')), ''),
      comissao_percentual = p_comissao_percentual,
      observacoes_gestao = nullif(trim(coalesce(p_observacoes, '')), ''),
      updated_at = now()
  where id = p_barbeiro_id
  returning * into v_resultado;

  update public.usuarios
  set nome = v_resultado.nome, telefone = v_resultado.telefone
  where id = v_resultado.usuario_id and tipo <> 'admin';

  return v_resultado;
end;
$$;

create or replace function public.definir_proprietario_barbearia(
  p_barbearia_id uuid,
  p_barbeiro_id bigint
)
returns public.barbearias
language plpgsql security definer set search_path = ''
as $$
declare
  v_barbeiro public.barbeiros;
  v_anterior uuid;
  v_resultado public.barbearias;
begin
  if not public.eh_admin_global() then
    raise exception 'Apenas o administrador da plataforma pode definir o proprietário' using errcode = '42501';
  end if;

  select * into v_barbeiro
  from public.barbeiros
  where id = p_barbeiro_id and barbearia_id = p_barbearia_id and ativo
  for update;
  if not found or v_barbeiro.usuario_id is null then
    raise exception 'Selecione um profissional ativo e com conta válida';
  end if;
  if exists (select 1 from public.usuarios u where u.id = v_barbeiro.usuario_id and u.tipo = 'admin') then
    raise exception 'O administrador da plataforma não pode ser proprietário operacional';
  end if;

  select proprietario_id into v_anterior
  from public.barbearias
  where id = p_barbearia_id
  for update;
  if not found then raise exception 'Estabelecimento não encontrado'; end if;

  update public.barbeiros
  set funcao = case when id = p_barbeiro_id then 'proprietario' else 'funcionario' end,
      updated_at = now()
  where barbearia_id = p_barbearia_id;

  update public.usuarios set tipo = 'proprietario'
  where id = v_barbeiro.usuario_id and tipo <> 'admin';

  update public.barbearias
  set proprietario_id = v_barbeiro.usuario_id,
      responsavel_legal = coalesce(responsavel_legal, v_barbeiro.nome),
      updated_at = now()
  where id = p_barbearia_id
  returning * into v_resultado;

  if v_anterior <> v_barbeiro.usuario_id then
    update public.usuarios old_owner
    set tipo = 'barbeiro'
    where old_owner.id = v_anterior
      and old_owner.tipo = 'proprietario'
      and not exists (
        select 1 from public.barbearias owned
        where owned.proprietario_id = old_owner.id and owned.id <> p_barbearia_id
      );
  end if;

  insert into public.assinaturas_plataforma (usuario_id, plano_id, status, trial_ends_at)
  select v_barbeiro.usuario_id, p.id, 'trialing', now() + interval '14 days'
  from public.planos_plataforma p
  where p.slug = 'profissional' and p.ativo
  on conflict (usuario_id) do nothing;

  insert into public.admin_audit_logs (admin_id, acao, entidade, entidade_id, detalhes)
  values ((select auth.uid()), 'definir_proprietario', 'barbearia', p_barbearia_id::text,
    jsonb_build_object('proprietario_anterior', v_anterior, 'proprietario_atual', v_barbeiro.usuario_id, 'barbeiro_id', p_barbeiro_id));

  return v_resultado;
end;
$$;

-- New businesses are commercial records created only by the platform admin.
-- The admin remains a temporary account owner until a real business owner is
-- assigned, but is never inserted into the operational barber team.
create or replace function public.criar_barbearia(
  p_nome text,
  p_slug text,
  p_publicar boolean default true
)
returns public.barbearias
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin public.usuarios;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_resultado public.barbearias;
begin
  select * into v_admin
  from public.usuarios
  where id = (select auth.uid()) and tipo = 'admin';
  if not found then
    raise exception 'Apenas o administrador da plataforma pode criar barbearias' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then raise exception 'Nome inválido'; end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 80 then raise exception 'Identificador inválido'; end if;
  if exists (select 1 from public.barbearias x where x.slug = v_slug) then raise exception 'Este identificador já está em uso'; end if;

  insert into public.barbearias (
    proprietario_id, nome, slug, telefone, responsavel_legal, agendamento_publico
  ) values (
    v_admin.id, trim(p_nome), v_slug, v_admin.telefone, null, coalesce(p_publicar, true)
  ) returning * into v_resultado;

  return v_resultado;
end;
$$;

-- Business acquisition is assisted by Sucegan Tech. Public signup can create
-- clients or consume a professional invitation; it cannot mint an owner role.
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
  if v_tipo not in ('cliente', 'barbeiro') or char_length(v_nome) not between 2 and 120 then
    raise exception 'Dados de cadastro inválidos';
  end if;
  if not v_termos then raise exception 'É necessário aceitar os termos de uso'; end if;
  if v_telefone is null then raise exception 'Telefone é obrigatório'; end if;

  if v_tipo = 'barbeiro' then
    update public.convites_barbeiro
    set usado_por = new.id, usado_em = now()
    where token = v_convite and usado_por is null and expira_em > now()
    returning barbearia_id into v_barbearia_id;
    if not found then raise exception 'Convite de profissional inválido ou expirado'; end if;
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
  else
    insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id, funcao)
    values (v_nome, v_telefone, new.id, v_barbearia_id, 'funcionario');
  end if;

  return new;
end;
$$;

create or replace function public.definir_feriado_fechado(
  p_barbearia_id uuid,
  p_data date,
  p_descricao text
)
returns public.feriados_negocio
language plpgsql security definer set search_path = ''
as $$
declare
  v_resultado public.feriados_negocio;
begin
  if not public.eh_proprietario_barbearia(p_barbearia_id) then
    raise exception 'Apenas o proprietário ou administrador pode alterar feriados' using errcode = '42501';
  end if;
  if p_data is null or char_length(trim(coalesce(p_descricao, ''))) not between 2 and 120 then
    raise exception 'Informe a data e o nome do feriado';
  end if;
  if exists (
    select 1 from public.agendamentos a
    join public.barbeiros b on b.id = a.barbeiro_id
    where b.barbearia_id = p_barbearia_id
      and a.data = p_data
      and a.status not in ('cancelado', 'concluido', 'nao_compareceu')
  ) then
    raise exception 'Existem agendamentos ativos nesta data. Reagende ou cancele antes de fechar';
  end if;

  insert into public.feriados_negocio (barbearia_id, data, descricao, criado_por)
  values (p_barbearia_id, p_data, trim(p_descricao), (select auth.uid()))
  on conflict (barbearia_id, data) do update
    set descricao = excluded.descricao, criado_por = excluded.criado_por
  returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.definir_feriado_aberto(
  p_barbearia_id uuid,
  p_data date
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.eh_proprietario_barbearia(p_barbearia_id) then
    raise exception 'Apenas o proprietário ou administrador pode alterar feriados' using errcode = '42501';
  end if;
  delete from public.feriados_negocio
  where barbearia_id = p_barbearia_id and data = p_data;
  return true;
end;
$$;

-- Public discovery exposes only active operational professionals and their own
-- services. Inactive admin history is not bookable.
create or replace function public.obter_catalogo_publico(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'negocio', jsonb_build_object(
      'id', x.id, 'nome', x.nome, 'endereco', x.endereco, 'telefone', x.telefone,
      'logo_url', x.logo_url, 'slug', x.slug, 'agendamento_publico', x.agendamento_publico,
      'cancelamento_horas', x.cancelamento_horas, 'sinal_percentual', x.sinal_percentual,
      'pix_chave', null, 'pix_beneficiario', null, 'cor_primaria', x.cor_primaria,
      'cor_secundaria', x.cor_secundaria, 'icone', x.icone,
      'antecedencia_minutos', x.antecedencia_minutos,
      'intervalo_grade_minutos', x.intervalo_grade_minutos,
      'horizonte_agendamento_dias', x.horizonte_agendamento_dias
    ),
    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'nome', b.nome, 'horario_inicio', b.horario_inicio::text,
        'horario_fim', b.horario_fim::text, 'dias_trabalho', b.dias_trabalho
      ) order by b.nome)
      from public.barbeiros b
      join public.usuarios u on u.id = b.usuario_id and u.tipo <> 'admin'
      where b.barbearia_id = x.id and b.ativo
    ), '[]'::jsonb),
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'nome', s.nome, 'preco', s.preco,
        'duracao', s.duracao, 'barbeiro_id', s.barbeiro_id
      ) order by s.nome)
      from public.servicos s
      join public.barbeiros b on b.id = s.barbeiro_id and b.ativo
      join public.usuarios u on u.id = b.usuario_id and u.tipo <> 'admin'
      where b.barbearia_id = x.id
    ), '[]'::jsonb),
    'feriados', coalesce((
      select jsonb_agg(jsonb_build_object('data', f.data, 'descricao', f.descricao) order by f.data)
      from public.feriados_negocio f
      where f.barbearia_id = x.id and f.data >= timezone('America/Sao_Paulo', now())::date
    ), '[]'::jsonb)
  )
  from public.barbearias x
  where x.slug = lower(trim(p_slug)) and x.ativa;
$$;

revoke all on function public.listar_equipe_barbearia(uuid) from public, anon, authenticated;
revoke all on function public.atualizar_dados_profissional(bigint, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.definir_proprietario_barbearia(uuid, bigint) from public, anon, authenticated;
revoke all on function public.definir_feriado_fechado(uuid, date, text) from public, anon, authenticated;
revoke all on function public.definir_feriado_aberto(uuid, date) from public, anon, authenticated;
revoke all on function public.criar_barbearia(text, text, boolean) from public, anon, authenticated;
revoke all on function public.criar_minha_barbearia(text, text, boolean) from public, anon, authenticated;
revoke all on function public.admin_atribuir_proprietario_barbearia(uuid, uuid) from public, anon, authenticated;
revoke all on function public.criar_perfil_usuario() from public, anon, authenticated;
revoke all on function public.obter_catalogo_publico(text) from public, anon, authenticated;

grant execute on function public.listar_equipe_barbearia(uuid) to authenticated;
grant execute on function public.atualizar_dados_profissional(bigint, text, text, numeric, text) to authenticated;
grant execute on function public.definir_proprietario_barbearia(uuid, bigint) to authenticated;
grant execute on function public.definir_feriado_fechado(uuid, date, text) to authenticated;
grant execute on function public.definir_feriado_aberto(uuid, date) to authenticated;
grant execute on function public.criar_barbearia(text, text, boolean) to authenticated;
grant execute on function public.obter_catalogo_publico(text) to anon, authenticated;

commit;
